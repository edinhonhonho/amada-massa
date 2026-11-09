#!/usr/bin/env python3
"""
Converte a planilha "Controle de assinaturas" em um script SQL de importação para o Supabase.

Uso:  python3 scripts/importar_planilha.py PLANILHA.xlsx PASTA_DE_SAIDA

Gera, na pasta de saída:
  importar_clientes.sql        (rode no SQL Editor do Supabase; apaga TODOS os clientes atuais e importa)
  relatorio_conferencia.md     (o que o script decidiu sozinho e o que vale conferir)

Os arquivos gerados têm dados pessoais: não os envie ao Git (a pasta importacao/ já é ignorada).
Requer a migração 0006 aplicada.
"""
import datetime as dt
import difflib
import re
import sys
import unicodedata
import uuid
import warnings
from collections import Counter, defaultdict

import openpyxl

warnings.filterwarnings("ignore")
HOJE = dt.date.today()
ANO = 2026
NS = uuid.UUID("c0ffee00-0000-4000-8000-00000000a001")
MESES_NOME = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]
PRECO_PADRAO = {("entrega", 1): 8000, ("entrega", 2): 11000, ("coleta_ponto", 1): 7500, ("coleta_ponto", 2): 10500, ("coleta_padaria", 1): 6000, ("coleta_padaria", 2): 9000}


def uid(*partes):
    return str(uuid.uuid5(NS, "|".join(map(str, partes))))


def vazio(v):
    return v is None or (isinstance(v, str) and not v.strip())


def txt(v):
    return None if vazio(v) else re.sub(r"\s+", " ", str(v)).strip()


def norm(s):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", str(s).lower()).encode("ascii", "ignore").decode())


def q(v):
    """Literal SQL."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(int(v)) if float(v).is_integer() else repr(float(v))
    if isinstance(v, (dt.date, dt.datetime)):
        return "'%s'" % (v.date() if isinstance(v, dt.datetime) else v).isoformat()
    return "'%s'" % str(v).replace("'", "''")


def telefone(v):
    if vazio(v):
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    d = re.sub(r"\D", "", str(v))
    d = d.lstrip("0")
    if len(d) in (10, 11) or (len(d) in (12, 13) and d.startswith("55")):
        return d
    return d if len(d) >= 8 else None


def email(v):
    t = txt(v)
    if not t:
        return None
    t = re.split(r"[\s;,]+", t)[0].lower()
    return t if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", t) else None


def separa_nome(nome):
    partes = nome.split()
    return (partes[0], " ".join(partes[1:])) if len(partes) > 1 else (nome, "")


def separa_endereco(end):
    """'Rua X, 123, apto 4' -> (logradouro, numero, complemento). Se não achar número, devolve o texto todo como rua."""
    if not end:
        return None, None, None
    m = re.match(r"^(.*?)[,\s]+(\d+[A-Za-z]?)\b\s*[,/\- ]*(.*)$", end.strip())
    if not m or not m.group(1).strip():
        return end.strip(), None, None
    return m.group(1).strip(" ,-"), m.group(2), (m.group(3).strip(" ,/-") or None)


def idnum(v):
    return int(v) if isinstance(v, (int, float)) else None


def data_pagamento(valor, mes, avisos, quem):
    """Mantém a data real (inclusive pagamento atrasado); só corrige ano trocado (ex.: 30/12/2026 na coluna de janeiro)."""
    if not isinstance(valor, (dt.datetime, dt.date)):
        return None
    d = valor.date() if isinstance(valor, dt.datetime) else valor
    comp = dt.date(ANO, mes, 1)
    ok = lambda c: comp - dt.timedelta(days=50) <= c <= min(HOJE, comp + dt.timedelta(days=330))
    if ok(d):
        return d
    for ano in (d.year - 1, d.year + 1):
        try:
            c = d.replace(year=ano)
        except ValueError:
            continue
        if ok(c):
            avisos.append(f"{quem}: data {d.isoformat()} na coluna de {MESES_NOME[mes-1].lower()} corrigida para {c.isoformat()}")
            return c
    avisos.append(f"{quem}: data {d.isoformat()} não bate com {MESES_NOME[mes-1].lower()}; usei o dia 10")
    return dt.date(ANO, mes, 10)


def main(caminho, saida):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    rel = defaultdict(list)

    # ---------------------------------------------------------------- cadastro
    cad = {}
    for r in wb["2.CADASTRO"].iter_rows(min_row=3, values_only=True):
        if vazio(r[2]) or idnum(r[1]) is None:
            continue
        cad[idnum(r[1])] = dict(id=idnum(r[1]), nome=txt(r[2]), social=txt(r[3]), tel1=telefone(r[4]), tel2=txt(r[5]), email=email(r[6]), end=txt(r[7]),
                                primeira=(r[8].date() if isinstance(r[8], dt.datetime) else None), obs=txt(r[9]))
    por_nome = defaultdict(list)
    for c in cad.values():
        por_nome[norm(c["nome"])].append(c["id"])

    tokens_cad = {i: {norm(t) for t in c["nome"].split() if len(norm(t)) > 1} for i, c in cad.items()}

    def achar(nome):
        """Liga um nome escrito de outro jeito (acento, 'ok' no fim, letra trocada) ao cadastro. Só devolve se for único."""
        bruto = re.sub(r"\s*\(.*?\)\s*", " ", str(nome))
        bruto = re.sub(r"\s+(rota\s*\d+\s*)?ok\s*$", "", bruto, flags=re.I).strip()
        n = norm(bruto)
        if not n:
            return None
        if n in por_nome:
            return por_nome[n][0]
        cand = {i for k, ids in por_nome.items() if len(n) >= 8 and (k.startswith(n) or n.startswith(k)) for i in ids}
        if len(cand) == 1:
            return next(iter(cand))
        toks = [norm(t) for t in bruto.split() if len(norm(t)) > 1]
        if len(toks) >= 2:
            cand = {i for i, tk in tokens_cad.items() if toks[0] in tk and toks[-1] in tk}
            if len(cand) == 1:
                return next(iter(cand))
        perto = difflib.get_close_matches(n, list(por_nome), n=2, cutoff=0.84)
        if perto and (len(perto) == 1 or difflib.SequenceMatcher(None, n, perto[0]).ratio() - difflib.SequenceMatcher(None, n, perto[1]).ratio() > 0.05):
            return por_nome[perto[0]][0]
        return None

    # --------------------------------------------------------------- pagamentos
    pag = {}
    for r in wb["3.PAGAMENTOS"].iter_rows(min_row=3, values_only=True):
        i = idnum(r[0])
        if vazio(r[1]) or i is None:
            continue
        pag[i] = dict(status=txt(r[40]), meses=[(r[4 + 3 * m], r[5 + 3 * m], r[6 + 3 * m]) for m in range(12)])

    # ------------------------------------------------------- entregas e coletas
    ent, col = {}, {}
    for r in wb["4.ENTREGAS"].iter_rows(min_row=2, max_row=71, values_only=True):
        if vazio(r[1]):
            continue
        i = idnum(r[0]) or achar(r[1])
        recompensa = isinstance(r[0], str) and r[0].strip().lower() == "benfeitoria"
        if i is None and recompensa:
            # apoiador da campanha Benfeitoria: só existe na aba ENTREGAS, então o cadastro nasce daqui
            i = 200000 + len([x for x in cad if x >= 200000])
            cad[i] = dict(id=i, nome=txt(r[1]), social=None, tel1=telefone(r[3]), tel2=None, email=None, end=txt(r[6]), primeira=None, obs=None)
            por_nome[norm(cad[i]["nome"])].append(i)
            rel["Apoiadores da Benfeitoria que só existem na aba ENTREGAS (criei o cadastro a partir dela)"].append(cad[i]["nome"])
        if i is None or i in ent:
            if i is None:
                rel["Linhas de ENTREGAS que não consegui ligar a um cadastro"].append(str(r[1]))
            continue
        ent[i] = dict(sem=r[4], trad=r[5], bairro=txt(r[7]), ordem=idnum(r[8]), rota=idnum(r[9]), dia=txt(r[10]), end=txt(r[6]), benfeitoria=isinstance(r[0], str) and r[0].strip().lower() == "benfeitoria")
    for r in wb["5.COLETAS"].iter_rows(min_row=2, values_only=True):
        if vazio(r[1]) or idnum(r[0]) is None or idnum(r[0]) in col:
            continue
        col[idnum(r[0])] = dict(sem=r[4], trad=r[5], local=str(r[6]).strip().upper(), dia=txt(r[8]))

    # -------------------------------------------- novas assinaturas (alterações)
    novas = {}
    ws = wb["1.ALTERAÇÕES"]
    proximo_extra = 100000
    for r in ws.iter_rows(min_row=3, max_row=22, values_only=True):
        if vazio(r[1]):
            continue
        i = achar(r[1])
        info = dict(tipo=(txt(r[5]) or "").upper(), valor=r[9], paes=r[10])
        if i is None:
            # assinou em 2026 e a planilha ainda não tem o cadastro nem a linha de pagamentos: cria a partir desta linha
            i = proximo_extra
            proximo_extra += 1
            nome = re.sub(r"\s*\(.*?\)\s*", " ", str(r[1])).strip()
            nome = nome.title() if nome.isupper() else nome
            cad[i] = dict(id=i, nome=nome, social=None, tel1=telefone(r[2]), tel2=None, email=email(r[3]), end=txt(r[4]),
                          primeira=(r[8].date() if isinstance(r[8], dt.datetime) else None), obs=None)
            por_nome[norm(nome)].append(i)
            meses_extra = [(None, None, None)] * 12
            if isinstance(r[6], dt.datetime) and isinstance(r[9], (int, float)):
                meses_extra[r[6].month - 1] = (r[6], r[7], r[9])
            pag[i] = dict(status=None, meses=meses_extra)
            rel["Assinantes novos que só existem na aba ALTERAÇÕES (criei o cadastro a partir dela)"].append(f"{nome} — {txt(r[5]) or ''}")
        novas[i] = info

    # ---------------------------------------------------------- quem está ativo
    ativos = set(pag) | set(ent) | set(col) | set(novas)
    ok = {i for i in ativos if i in cad}
    for i in ativos - ok:
        rel["IDs que aparecem em outras abas mas não no cadastro"].append(str(i))

    pontos_sql = {"PADARIA": "padaria", "COLETA ZS": "zona-sul", "COLETA MODESTA": "modesta", "BOM FIM": "bom-fim"}

    def local_do_texto(t):
        t = (t or "").upper()
        if "BOM FIM" in t:
            return "bom-fim"
        if "ZS" in t or "ZONA SUL" in t:
            return "zona-sul"
        if "MODESTA" in t:
            return "modesta"
        if "PADARIA" in t:
            return "padaria"
        return None

    clientes, assinaturas, cobrancas, pagamentos, atribuicoes, contatos = [], [], [], [], [], []
    combos = defaultdict(list)
    stats = Counter()
    rotas_dia = defaultdict(Counter)

    for i in sorted(cad):
        c = cad[i]
        nome, sobrenome = separa_nome(c["nome"])
        logr, num, comp = separa_endereco(c["end"] or (ent.get(i, {}).get("end")))
        obs = []
        if c["obs"]:
            obs.append(c["obs"])
        if c["tel2"] and c["tel2"] != "":
            obs.append(f"Telefone 2: {c['tel2']}")
        if c["social"]:
            obs.append(f"Nome social: {c['social']}")
        if c["end"] and not num:
            obs.append(f"Endereço original: {c['end']}")
        cli = dict(id=uid("cliente", i), nome=nome, sobrenome=sobrenome, email=c["email"], whatsapp=c["tel1"], logradouro=logr, numero=num, complemento=comp,
                   bairro=ent.get(i, {}).get("bairro"), confirmado_em=c["primeira"], observacoes=None, status="cancelado", cancelado_em=dt.date(ANO - 1, 12, 31),
                   motivo="Sem assinatura em 2026 (histórico importado da planilha)", origem="planilha")

        if i not in ok:
            cli["observacoes"] = " · ".join(obs) or None
            clientes.append(cli)
            stats["histórico (sem assinatura em 2026)"] += 1
            continue

        # ------ assinatura de 2026
        p = pag.get(i)
        st = p["status"] if p else None
        meses = p["meses"] if p else []
        cancelou_mes = next((m + 1 for m, (d, mm, v) in enumerate(meses) if any(isinstance(x, str) and "CANCEL" in x.upper() for x in (d, mm))), None)
        pausou = any(isinstance(x, str) and "PAUSA" in x.upper() for m in meses for x in m[:2])
        pagos = [(m + 1, d, mm, v) for m, (d, mm, v) in enumerate(meses) if isinstance(v, (int, float)) and v > 0]
        ultimo_valor = int(round(pagos[-1][3] * 100)) if pagos else None
        e, k, n = ent.get(i), col.get(i), novas.get(i)

        modalidade, ponto, lista_txt = None, None, None
        if e:
            modalidade = "entrega"
        elif k:
            ponto = pontos_sql.get(k["local"])
            modalidade = "coleta_padaria" if ponto == "padaria" else "coleta_ponto"
        elif n:
            ponto = local_do_texto(n["tipo"])
            modalidade = "entrega" if "ENTREGA" in n["tipo"] else ("coleta_padaria" if ponto == "padaria" else "coleta_ponto" if ponto else None)
        if modalidade is None and c["obs"]:
            t = c["obs"].upper()
            if "ENTREGA" in t:
                modalidade = "entrega"
            elif local_do_texto(t):
                ponto = local_do_texto(t)
                modalidade = "coleta_padaria" if ponto == "padaria" else "coleta_ponto"

        ar_sem_lista = st == "AR" and not (e or k or n)
        if ar_sem_lista:
            modalidade = "apoio"
        if modalidade is None and ultimo_valor is not None:
            v = ultimo_valor
            modalidade = "entrega" if v in (8000, 11000) else "coleta_padaria" if v in (6000, 9000) else "coleta_ponto" if v in (7500, 10500) else "entrega"
            ponto = "padaria" if modalidade == "coleta_padaria" else ponto
            if st != "N":
                rel["Modalidade deduzida só pelo valor pago (não está em ENTREGAS/COLETAS)"].append(f"{c['nome']} (R$ {v/100:.0f}) → {modalidade}")
        if modalidade is None:
            modalidade = "entrega"
            if st != "N":
                rel["Modalidade sem nenhuma pista (marquei entrega; confira)"].append(c["nome"])
        if modalidade == "coleta_ponto" and ponto is None:
            ponto = "zona-sul"
            rel["Ponto de coleta sem pista (marquei Zona Sul; confira)"].append(c["nome"])
        if modalidade == "coleta_padaria":
            ponto = "padaria"

        # pães por semana
        def numero(v):
            return int(v) if isinstance(v, (int, float)) else None
        sem, trad = (numero((e or k or {}).get("sem")), numero((e or k or {}).get("trad"))) if (e or k) else (None, None)
        if n and sem is None and numero(n["paes"]) is not None:
            sem, trad = numero(n["paes"]), 0
        if modalidade == "apoio":
            paes, trad = 0, 0
        elif sem is None:
            v = ultimo_valor or 0
            paes = 2 if v >= (9000 if modalidade == "coleta_padaria" else 10000) else 1
            trad = 0
            if st != "N" and not cancelou_mes:
                rel["Pães por semana estimados pelo valor (a planilha diz FORA ou está vazia)"].append(f"{c['nome']} → {paes}")
        else:
            paes = sem + (trad or 0)
            trad = trad or 0
            if paes == 0:
                paes, trad = 1, 0
                rel["Cliente com 0 pães na planilha (usei 1; confira)"].append(c["nome"])

        # situação
        if st == "N" or (cancelou_mes and not (e or k or n)):
            status = "cancelado"
        elif ar_sem_lista:
            status = "ativo"
        elif not (e or k or n):
            recente = bool(pagos) and pagos[-1][0] >= HOJE.month - 2
            status = "ativo" if recente else "pausado"
            if recente:
                rel["Pagaram nos últimos meses, mas não estão em ENTREGAS/COLETAS (importei como ativos; confira modalidade e rota)"].append(c["nome"])
        else:
            status = "ativo"
        if cancelou_mes and (e or k) and st != "N":
            rel["Planilha marca CANCELOU, mas o cliente continua em ENTREGAS/COLETAS (importei como ativo)"].append(f"{c['nome']} (marcado em {MESES_NOME[cancelou_mes-1].lower()})")
        if st == "?":
            rel["Status '?' na planilha (importei como ativo)"].append(c["nome"])
        if status == "pausado":
            rel["Sem entrega/coleta e sem pagamento recente (importei como pausados)"].append(c["nome"] + (" — 'PAUSA' na planilha" if pausou else ""))
        if e and e.get("benfeitoria"):
            obs.append("Recompensa da campanha Benfeitoria")
        if st == "AR" and not ar_sem_lista:
            obs.append("Apoio recorrente (paga valor diferente do plano)")
        nc = [MESES_NOME[m].title()[:3] for m, (d, mm, v) in enumerate(meses) if isinstance(mm, str) and mm.strip().lower() == "nc"]
        if nc:
            obs.append("Sem pagamento registrado (nc) em: " + ", ".join(nc))

        cli["observacoes"] = " · ".join(obs) or None
        cli["status"] = status
        if status == "cancelado":
            fim_mes = cancelou_mes or (pagos[-1][0] + 1 if pagos else 1)
            fim = dt.date(ANO, min(fim_mes, 12), 1)
            cli["cancelado_em"], cli["motivo"] = fim, (c["obs"] if c["obs"] and "cancel" in c["obs"].lower() else "Cancelamento registrado na planilha")
        else:
            cli["cancelado_em"], cli["motivo"] = None, None
        clientes.append(cli)
        stats[f"{status}"] += 1

        valor = ultimo_valor if ultimo_valor is not None else (0 if (e or {}).get("benfeitoria") else PRECO_PADRAO.get((modalidade, paes), 0))
        combos[(modalidade, paes)].append(valor)
        ass_status = {"ativo": "ativa", "pausado": "pausada", "cancelado": "cancelada"}[status]
        fim = cli["cancelado_em"] if status == "cancelado" else None
        inicio = c["primeira"] or dt.date(ANO, 1, 1)
        if fim and fim < inicio:
            inicio = fim
        assinaturas.append(dict(id=uid("assin", i), cliente_id=cli["id"], modalidade=modalidade, paes=paes, valor=valor, ponto=ponto, inicio=inicio, fim=fim,
                                status=ass_status, motivo=cli["motivo"], trad=trad, beneficio=bool(e and e.get("benfeitoria"))))
        stats[f"modalidade {modalidade}"] += 1

        if e and e.get("rota") and modalidade == "entrega" and status != "cancelado":
            atribuicoes.append(dict(id=uid("atrib", i), cliente_id=cli["id"], rota=e["rota"], ordem=e["ordem"] or 999))
            if e.get("dia"):
                rotas_dia[e["rota"]][e["dia"]] += 1

        for m, d, mm, v in pagos:
            data = data_pagamento(d, m, rel["Datas de pagamento corrigidas"], c["nome"]) or dt.date(ANO, m, 10)
            meio = (str(mm).strip().lower() if mm else "")
            forma, obsp = {"ppy": ("transferencia", "Papayas"), "trn": ("transferencia", "Nubank"), "trf": ("transferencia", "Bradesco"), "pix": ("pix", None)}.get(meio, ("outro", f"Meio na planilha: {meio or 'não informado'}"))
            cob = uid("cob", i, m)
            cobrancas.append(dict(id=cob, assinatura_id=uid("assin", i), competencia=dt.date(ANO, m, 1), valor=int(round(v * 100)), vencimento=dt.date(ANO, m, 10)))
            pagamentos.append(dict(id=uid("pag", i, m), cobranca_id=cob, valor=int(round(v * 100)), data=data, forma=forma, obs=obsp))

    # --------------------------------------------------------------- anotações
    ws = wb["1.ALTERAÇÕES"]
    nao_achados = []
    data_atual = None
    secao = None
    for r in ws.iter_rows(min_row=23, values_only=True):
        b, c_, d_ = r[1], r[2], r[3]
        if isinstance(b, str) and b.strip().upper().startswith("LEMBRETES"):
            secao = "lembretes"; continue
        if isinstance(b, str) and b.strip().upper().startswith("ALTERA"):
            secao = "semana"; continue
        if isinstance(b, dt.datetime) and vazio(c_):
            data_atual = b.date(); continue
        if isinstance(b, str) and b.strip().upper() in MESES_NOME and vazio(c_):
            data_atual = dt.date(ANO, MESES_NOME.index(b.strip().upper()) + 1, 1); continue
        if vazio(b) or vazio(c_) or str(b).strip().lower() in ("assinante",):
            continue
        i = achar(b)
        texto = txt(c_) + (f" → {txt(d_)}" if txt(d_) else "")
        if i is None or i not in cad:
            nao_achados.append(f"{b}: {texto[:70]}")
            continue
        cid = uid("cliente", i)
        if secao == "lembretes":
            contatos.append(dict(id=uid("lembrete", i, texto), cliente_id=cid, data=HOJE, resumo="Lembrete de longa data (planilha)", passo=texto, passo_em=HOJE, concluido=False))
        else:
            contatos.append(dict(id=uid("nota", i, data_atual, texto), cliente_id=cid, data=data_atual or HOJE, resumo=texto, passo=None, passo_em=None, concluido=True))
    if nao_achados:
        rel["Anotações da aba ALTERAÇÕES sem cliente correspondente (não importadas)"] = nao_achados

    # ------------------------------------------------------ duplicidades úteis
    emails = Counter(c["email"] for c in clientes if c["email"] and c["status"] != "cancelado")
    rel["E-mails repetidos entre clientes ativos (o app do membro liga só o primeiro)"] = [f"{e} ({n}x)" for e, n in emails.items() if n > 1]

    # ================================================================== SQL
    out = []
    w = out.append
    w("-- Importação da planilha 'Controle de assinaturas 2026' para o Amada Massa.")
    w(f"-- Gerado em {HOJE.isoformat()}. ATENÇÃO: APAGA TODOS OS CLIENTES ATUAIS (e o que depende deles) antes de importar.")
    w("-- Rode no SQL Editor do Supabase, de uma vez. É tudo uma transação: se algo falhar, nada é alterado.")
    w("begin;")
    w("""do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'modalidade' and e.enumlabel = 'apoio')
     or not exists (select 1 from information_schema.columns where table_name = 'assinaturas' and column_name = 'paes_tradicionais') then
    raise exception 'Rode a migração 0006_apoio_e_paes_tradicionais.sql antes desta importação.';
  end if;
end $$;""")
    w("\n-- 1. limpeza: clientes cadastrados à mão (e o que depende deles: assinaturas, cobranças, entregas, contatos)")
    w("delete from clientes;")

    w("\n-- 2. pontos de coleta usados na planilha (reaproveita os que existem; cria o que faltar)")
    w("create temp table _ponto (chave text primary key, id uuid not null) on commit drop;")
    w("""insert into pontos_coleta (nome, tipo, endereco, cidade)
  select 'Padaria', 'padaria', 'A completar', 'Porto Alegre' where not exists (select 1 from pontos_coleta where tipo = 'padaria');
insert into pontos_coleta (nome, tipo, endereco, cidade)
  select 'Zona Sul', 'ponto', 'A completar', 'Porto Alegre' where not exists (select 1 from pontos_coleta where tipo = 'ponto' and nome ilike '%zona sul%');
insert into pontos_coleta (nome, tipo, endereco, cidade)
  select 'Bom Fim', 'ponto', 'A completar', 'Porto Alegre' where not exists (select 1 from pontos_coleta where tipo = 'ponto' and nome ilike '%bom fim%');
insert into pontos_coleta (nome, tipo, endereco, cidade)
  select 'Modesta', 'ponto', 'A completar', 'Porto Alegre' where not exists (select 1 from pontos_coleta where tipo = 'ponto' and nome ilike '%modesta%');
insert into _ponto select 'padaria', id from pontos_coleta where tipo = 'padaria' order by ativo desc, nome limit 1;
insert into _ponto select 'zona-sul', id from pontos_coleta where tipo = 'ponto' and nome ilike '%zona sul%' order by ativo desc limit 1;
insert into _ponto select 'bom-fim', id from pontos_coleta where tipo = 'ponto' and nome ilike '%bom fim%' order by ativo desc limit 1;
insert into _ponto select 'modesta', id from pontos_coleta where tipo = 'ponto' and nome ilike '%modesta%' order by ativo desc limit 1;""")

    w("\n-- 3. planos necessários (reaproveita os do catálogo; cria só combinações que não existem)")
    nomes_mod = {"entrega": "Entrega em casa", "coleta_ponto": "Ponto de coleta", "coleta_padaria": "Coleta na padaria", "apoio": "Apoio recorrente"}
    linhas_planos = []
    for (mod, paes), valores in sorted(combos.items()):
        positivos = [v for v in valores if v > 0] or [0]
        preco = Counter(positivos).most_common(1)[0][0]
        preco = PRECO_PADRAO.get((mod, paes), 5000 if mod == "apoio" else preco)
        nome = nomes_mod[mod] if paes == 0 else f"{nomes_mod[mod]} · {paes} pão{'es' if paes > 1 else ''}/semana"
        linhas_planos.append(f"({q(nome)}, {q(mod)}, {paes}, {preco})")
    w("insert into planos (nome, modalidade, paes_por_semana, valor_centavos)\n  select v.nome, v.mod::modalidade, v.paes, v.valor from (values\n  " + ",\n  ".join(linhas_planos) + ") v(nome, mod, paes, valor)")
    w("  where not exists (select 1 from planos p where p.modalidade = v.mod::modalidade and p.paes_por_semana = v.paes and p.ativo);")
    w("create temp table _plano on commit drop as\n  select distinct on (modalidade, paes_por_semana) modalidade, paes_por_semana, id, valor_centavos from planos where ativo order by modalidade, paes_por_semana, vigencia_inicio desc;")

    w("\n-- 4. pão tradicional (fixo, entra em todas as semanas)")
    w("insert into paes (nome, descricao, tradicional) select 'Tradicional', 'Pão tradicional, o mesmo todas as semanas', true where not exists (select 1 from paes where lower(nome) = 'tradicional');")
    w("update paes set tradicional = true where lower(nome) = 'tradicional';")

    w("\n-- 5. rotas (Rota 1 a 5, como na planilha)")
    w("create temp table _rota (num int primary key, id uuid not null) on commit drop;")
    cores = {1: "#b45309", 2: "#0f766e", 3: "#1d4ed8", 4: "#7c3aed", 5: "#be123c"}
    for num in sorted({a["rota"] for a in atribuicoes}):
        dia = rotas_dia[num].most_common(1)[0][0] if rotas_dia[num] else None
        dsem = {"3ª FEIRA": 2, "4ª FEIRA": 3}.get(dia)
        w(f"insert into rotas (nome, cor, dia_semana, origem_ponto_id) select 'Rota {num}', {q(cores.get(num, '#b45309'))}, {q(dsem)}, (select id from _ponto where chave = 'padaria') "
          f"where not exists (select 1 from rotas where nome = 'Rota {num}');")
        w(f"insert into _rota select {num}, id from rotas where nome = 'Rota {num}' order by ativa desc limit 1;")

    def em_lotes(tabela, colunas, linhas, tam=150):
        for ini in range(0, len(linhas), tam):
            w(f"insert into {tabela} ({', '.join(colunas)}) values")
            w(",\n".join(linhas[ini:ini + tam]) + ";")

    w("\n-- 6. clientes")
    em_lotes("clientes", ["id", "nome", "sobrenome", "email", "whatsapp", "logradouro", "numero", "complemento", "bairro", "origem", "confirmado_em", "observacoes", "status", "cancelado_em", "motivo_cancelamento"],
             [f"({q(c['id'])}, {q(c['nome'])}, {q(c['sobrenome'])}, {q(c['email'])}, {q(c['whatsapp'])}, {q(c['logradouro'])}, {q(c['numero'])}, {q(c['complemento'])}, {q(c['bairro'])}, {q(c['origem'])}, {q(c['confirmado_em'])}, {q(c['observacoes'])}, {q(c['status'])}::status_cliente, {q(c['cancelado_em'])}, {q(c['motivo'])})" for c in clientes])

    w("\n-- 7. assinaturas")
    w("""create temp table _ass_in (id uuid, cliente_id uuid, modalidade text, paes int, valor int, ponto text, inicio date, fim date, status text, motivo text, trad int, beneficio boolean) on commit drop;""")
    em_lotes("_ass_in", ["id", "cliente_id", "modalidade", "paes", "valor", "ponto", "inicio", "fim", "status", "motivo", "trad", "beneficio"],
             [f"({q(a['id'])}, {q(a['cliente_id'])}, {q(a['modalidade'])}, {a['paes']}, {a['valor']}, {q(a['ponto'])}, {q(a['inicio'])}, {q(a['fim'])}, {q(a['status'])}, {q(a['motivo'])}, {a['trad']}, {q(a['beneficio'])})" for a in assinaturas])
    w("""insert into assinaturas (id, cliente_id, plano_id, valor_centavos, justificativa_valor, dia_vencimento, ponto_coleta_id, inicio, fim, status, motivo_cancelamento, paes_tradicionais)
select a.id, a.cliente_id, p.id, a.valor,
       case when a.beneficio then 'Recompensa da campanha Benfeitoria'
            when a.valor <> p.valor_centavos then 'Valor combinado (importado da planilha)' end,
       10, pt.id, a.inicio, a.fim, a.status::status_assinatura, a.motivo, a.trad
from _ass_in a
join _plano p on p.modalidade = a.modalidade::modalidade and p.paes_por_semana = a.paes
left join _ponto pt on pt.chave = a.ponto;""")

    w("\n-- 8. rotas dos clientes de entrega (com a ordem das paradas)")
    em_lotes("atribuicoes_rota", ["id", "cliente_id", "rota_id", "ordem", "inicio"],
             [f"({q(a['id'])}, {q(a['cliente_id'])}, (select id from _rota where num = {a['rota']}), {a['ordem']}, {q(dt.date(ANO, 1, 1))})" for a in atribuicoes])

    w("\n-- 9. cobranças e pagamentos de 2026 (só os meses com pagamento na planilha)")
    em_lotes("cobrancas", ["id", "assinatura_id", "competencia", "valor_centavos", "vencimento", "status"],
             [f"({q(c['id'])}, {q(c['assinatura_id'])}, {q(c['competencia'])}, {c['valor']}, {q(c['vencimento'])}, 'paga')" for c in cobrancas])
    em_lotes("pagamentos", ["id", "cobranca_id", "valor_centavos", "data", "forma", "observacao"],
             [f"({q(p['id'])}, {q(p['cobranca_id'])}, {p['valor']}, {q(p['data'])}, {q(p['forma'])}::forma_pagamento, {q(p['obs'])})" for p in pagamentos])

    w("\n-- 10. anotações e lembretes da aba ALTERAÇÕES (linha do tempo do cliente)")
    if contatos:
        em_lotes("contatos", ["id", "cliente_id", "data", "canal", "resumo", "proximo_passo", "proximo_passo_em", "concluido"],
                 [f"({q(c['id'])}, {q(c['cliente_id'])}, {q(c['data'])}, 'outro', {q(c['resumo'])}, {q(c['passo'])}, {q(c['passo_em'])}, {q(c['concluido'])})" for c in contatos])
    w("\ncommit;")
    w("-- Depois de rodar: confira o relatório_conferencia.md, adicione os pães de cada semana em Planejamento e trace as rotas.")

    with open(f"{saida}/importar_clientes.sql", "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    # =============================================================== relatório
    R = []
    R.append("# Relatório de conferência da importação\n")
    R.append(f"Planilha lida em {HOJE.strftime('%d/%m/%Y')}.\n")
    R.append("## O que será importado\n")
    R.append(f"- **{len(clientes)} clientes** no total: " + ", ".join(f"{v} {k}" for k, v in stats.items() if not k.startswith("modalidade")) + ".")
    R.append("- Assinaturas por modalidade: " + ", ".join(f"{v} {k.replace('modalidade ', '')}" for k, v in stats.items() if k.startswith("modalidade")) + ".")
    R.append(f"- **{len(assinaturas)} assinaturas**, **{len(atribuicoes)} clientes em rotas** (Rota {', '.join(str(n) for n in sorted({a['rota'] for a in atribuicoes}))}), **{len(cobrancas)} cobranças/pagamentos de 2026** e **{len(contatos)} anotações** na linha do tempo.")
    R.append("- Todos os clientes cadastrados à mão no sistema serão **apagados** antes da importação.\n")
    R.append("## O que o script decidiu sozinho (vale conferir)\n")
    for titulo, itens in rel.items():
        if not itens:
            continue
        R.append(f"### {titulo} ({len(itens)})")
        R.extend(f"- {x}" for x in itens)
        R.append("")
    with open(f"{saida}/relatorio_conferencia.md", "w", encoding="utf-8") as f:
        f.write("\n".join(R) + "\n")
    print("\n".join(R[:12]))
    print(f"\nSQL: {len(out)} blocos, {sum(len(x) for x in out)//1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

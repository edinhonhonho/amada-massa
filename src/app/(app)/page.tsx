import { ArrowRight, CalendarDays, CheckCircle2, CircleDashed, Pause, Route, TriangleAlert, Truck, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tom } from "@/components/ui/Badge";
import Kbd from "@/components/ui/Kbd";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import { usuarioAtual } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { dataBR, hojeISO, reais } from "@/lib/format";
import { ROTULO_SITUACAO, ordemSituacao, primeiroDoMes, situacaoCobranca, somarMeses, type Situacao } from "@/lib/pagamentos";

const COR_BARRA: Record<Situacao, string> = {
  em_dia: "bg-emerald-500", a_vencer: "bg-sky-400", vence_hoje: "bg-amber-400",
  atrasado: "bg-orange-500", atraso_critico: "bg-red-600", sem_cobranca: "bg-stone-300",
};

function saudacao() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

type Passo = { n: number; titulo: string; icone: typeof Wallet; href: string; tom: Tom; estado: string; resumo: string };

export default async function Inicio() {
  const { supabase, usuario } = await usuarioAtual();
  if (usuario.perfil === "entregador") redirect("/entregador");
  const hoje = hojeISO();
  const mes = primeiroDoMes(hoje);
  await supabase.rpc("gerar_cobrancas", { p_competencia: mes });
  const faixas = await carregarFaixas(supabase);

  const [
    { count: ativos }, { count: pausados }, { count: canceladosMes },
    { data: retornos }, { data: cobrancas }, { data: atrasadas },
    { data: semanaAtual }, { count: pendenciasEntrega }, { data: rotas }, { data: atrib }, { data: entregaAtiva },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "pausado"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).gte("cancelado_em", mes).lt("cancelado_em", somarMeses(mes, 1)),
    supabase.from("contatos").select("id, proximo_passo, proximo_passo_em, cliente_id, clientes(nome, sobrenome)")
      .eq("concluido", false).not("proximo_passo_em", "is", null).lte("proximo_passo_em", hoje).order("proximo_passo_em").limit(6),
    supabase.from("cobrancas").select("valor_centavos, vencimento, status, pagamentos(valor_centavos)").eq("competencia", mes),
    supabase.from("cobrancas").select("id, vencimento, valor_centavos, status, assinaturas(cliente_id, clientes(nome, sobrenome))").eq("status", "pendente").lt("vencimento", hoje).order("vencimento").limit(200),
    supabase.from("semanas").select("id, inicio, fim, sabor, sem_producao").lte("inicio", hoje).gte("fim", hoje).limit(1),
    supabase.from("entregas").select("*", { count: "exact", head: true }).eq("status", "nao_entregue"),
    supabase.from("rotas").select("id, nome, entregador_id").eq("ativa", true),
    supabase.from("atribuicoes_rota").select("cliente_id").is("fim", null),
    supabase.from("assinaturas").select("cliente_id, planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", "entrega"),
  ]);

  // ---- mensalidades
  const contagem = new Map<Situacao, number>();
  let esperado = 0, recebido = 0, pendentes = 0;
  for (const c of cobrancas ?? []) {
    const s = situacaoCobranca(c, hoje, faixas);
    contagem.set(s, (contagem.get(s) ?? 0) + 1);
    if (c.status !== "isenta" && c.status !== "cancelada") esperado += c.valor_centavos;
    if (c.status === "pendente") pendentes++;
    recebido += ((c.pagamentos as { valor_centavos: number }[]) ?? []).reduce((s, p) => s + p.valor_centavos, 0);
  }
  const lista = (atrasadas ?? []).filter((c) => ["atrasado", "atraso_critico"].includes(situacaoCobranca(c, hoje, faixas)));
  const emAtraso = lista.reduce((s, c) => s + c.valor_centavos, 0);
  const totalCobrancas = [...contagem.values()].reduce((a, b) => a + b, 0);
  const pctRecebido = esperado ? Math.min(100, Math.round((recebido / esperado) * 100)) : 0;

  // ---- semana
  const sem = semanaAtual?.[0];
  let producao: [string, number][] = [];
  let totalEntregas = 0;
  let execucoes: { finalizada_em: string | null }[] = [];
  if (sem) {
    const [{ data: ent }, { data: ex }] = await Promise.all([
      supabase.from("entregas").select("rota_nome, ponto_nome, qtd_prevista, status").eq("semana_id", sem.id),
      supabase.from("rota_execucoes").select("finalizada_em").eq("semana_id", sem.id),
    ]);
    totalEntregas = ent?.length ?? 0;
    execucoes = ex ?? [];
    if (!sem.sem_producao) {
      const m = new Map<string, number>();
      for (const e of ent ?? []) if (!["pulada", "suspensa_atraso"].includes(e.status)) {
        const k = e.rota_nome ?? e.ponto_nome ?? "Sem rota";
        m.set(k, (m.get(k) ?? 0) + e.qtd_prevista);
      }
      producao = [...m.entries()].sort((a, b) => b[1] - a[1]);
    }
  }
  const totalPaes = producao.reduce((s, [, n]) => s + n, 0);

  const comRota = new Set((atrib ?? []).map((a) => a.cliente_id));
  const semRota = new Set((entregaAtiva ?? []).map((a) => a.cliente_id).filter((id) => !comRota.has(id))).size;
  const rotasSemEntregador = (rotas ?? []).filter((r) => !r.entregador_id);

  // ---- os 4 passos da rotina
  const atrasoQtd = lista.length;
  const passos: Passo[] = [
    {
      n: 1, titulo: "Pagamentos", icone: Wallet, href: "/pagamentos",
      tom: atrasoQtd ? "vermelho" : pendentes ? "ambar" : "verde",
      estado: atrasoQtd ? "Atenção" : pendentes ? "A receber" : "Em dia",
      resumo: atrasoQtd ? `${atrasoQtd} em atraso · ${reais(emAtraso)}` : pendentes ? `${pendentes} mensalidade(s) pendente(s)` : "Tudo recebido neste mês",
    },
    {
      n: 2, titulo: "Semana", icone: CalendarDays, href: sem ? `/semanas/${sem.id}` : "/semanas/nova",
      tom: !sem ? "cinza" : !sem.sabor && !sem.sem_producao ? "ambar" : !totalEntregas && !sem.sem_producao ? "ambar" : "verde",
      estado: !sem ? "A fazer" : sem.sem_producao ? "Sem produção" : !sem.sabor ? "Definir sabor" : !totalEntregas ? "Abrir semana" : "Pronta",
      resumo: !sem ? "Crie a semana de entrega" : sem.sem_producao ? "Semana de descanso" : !totalEntregas ? "Gere as entregas da semana" : `${totalPaes} pães · ${sem.sabor}`,
    },
    {
      n: 3, titulo: "Rotas", icone: Route, href: "/rotas",
      tom: semRota || rotasSemEntregador.length ? "ambar" : "verde",
      estado: semRota || rotasSemEntregador.length ? "Ajustar" : "Organizadas",
      resumo: semRota ? `${semRota} cliente(s) sem rota` : rotasSemEntregador.length ? `${rotasSemEntregador.length} rota(s) sem entregador` : `${rotas?.length ?? 0} rota(s) ativas`,
    },
    {
      n: 4, titulo: "Entregas", icone: Truck, href: "/entregas/historico",
      tom: !totalEntregas ? "cinza" : execucoes.length && execucoes.every((e) => e.finalizada_em) && execucoes.length >= (rotas?.length ?? 0) ? "verde" : execucoes.length ? "azul" : "cinza",
      estado: !totalEntregas ? "Aguardando" : execucoes.length && execucoes.every((e) => e.finalizada_em) && execucoes.length >= (rotas?.length ?? 0) ? "Concluídas" : execucoes.length ? "Em andamento" : "Não iniciadas",
      resumo: (pendenciasEntrega ?? 0) > 0 ? `${pendenciasEntrega} ocorrência(s) a resolver` : execucoes.length ? `${execucoes.filter((e) => e.finalizada_em).length}/${rotas?.length ?? 0} rotas finalizadas` : "Entregador ainda não iniciou",
    },
  ];

  const nome = usuario.nome.split(" ")[0];
  return (
    <>
      <PageHeader
        titulo={`${saudacao()}, ${nome}`}
        subtitulo={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}
        acoes={<Link href="/clientes/novo" className="btn"><UserPlus size={16} />Novo cliente <span className="kbd !border-white/30 !bg-white/15 !text-white">N</span></Link>}
      />

      {/* A rotina da semana, em ordem */}
      <section aria-label="Rotina da semana" className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Rotina da semana</h2>
        <ol className="grid grid-cols-4 gap-3">
          {passos.map((p) => {
            const Icone = p.icone;
            return (
              <li key={p.n} className="relative">
                <Link href={p.href} className="cartao group block !p-4 transition hover:border-amber-300 hover:shadow-md">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">{p.n}</span>
                    <span className="font-semibold">{p.titulo}</span>
                    <Icone size={16} className="ml-auto text-stone-300 transition group-hover:text-amber-600" />
                  </div>
                  <Badge tom={p.tom} ponto>{p.estado}</Badge>
                  <p className="mt-2 text-sm text-stone-600">{p.resumo}</p>
                </Link>
                {p.n < 4 && <ArrowRight size={14} className="absolute -right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-fundo text-stone-400" />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <Stat rotulo="Clientes ativos" valor={ativos ?? 0} icone={Users} tom="verde" detalhe={<>{canceladosMes ?? 0} cancelamento(s) no mês</>} />
        <Stat rotulo="Pausados" valor={pausados ?? 0} icone={Pause} tom="ambar" />
        <Stat rotulo="Recebido no mês" valor={reais(recebido)} icone={Wallet} tom="verde" detalhe={`${pctRecebido}% de ${reais(esperado)}`} />
        <Stat rotulo="Em atraso" valor={reais(emAtraso)} icone={TriangleAlert} tom={emAtraso ? "vermelho" : "neutro"} detalhe={`${atrasoQtd} mensalidade(s)`} />
      </div>

      <div className="grid grid-cols-5 items-start gap-4">
        <section className="cartao col-span-3">
          <div className="cartao-titulo"><Wallet size={17} className="text-stone-400" />Mensalidades de {new Date(`${mes}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" })}
            <Link className="link ml-auto text-sm" href="/pagamentos">Abrir pagamentos</Link></div>
          {totalCobrancas > 0 ? (
            <>
              <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-stone-100">
                {ordemSituacao.filter((s) => contagem.get(s)).map((s) => (
                  <span key={s} className={COR_BARRA[s]} style={{ width: `${((contagem.get(s) ?? 0) / totalCobrancas) * 100}%` }} title={ROTULO_SITUACAO[s]} />
                ))}
              </div>
              <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                {ordemSituacao.filter((s) => contagem.get(s)).map((s) => (
                  <span key={s} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${COR_BARRA[s]}`} />{ROTULO_SITUACAO[s]} <b>{contagem.get(s)}</b></span>
                ))}
              </div>
            </>
          ) : <p className="mb-4 text-sm text-stone-500">Nenhuma cobrança neste mês ainda.</p>}
          {lista.length > 0 ? (
            <ul className="divide-y divide-stone-100">
              {lista.slice(0, 6).map((c) => {
                const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never } | null;
                const nm = nomeCompleto(um(a?.clientes));
                return (
                  <li key={c.id}>
                    <Link href={`/clientes/${a?.cliente_id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                      <Avatar nome={nm} tamanho={30} />
                      <span className="flex-1 font-medium">{nm}</span>
                      <span className="text-xs text-stone-500">venceu {dataBR(c.vencimento)}</span>
                      <span className="w-20 text-right text-sm font-semibold text-red-700">{reais(c.valor_centavos)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 size={16} />Nenhuma mensalidade em atraso.</div>}
        </section>

        <div className="col-span-2 flex flex-col gap-4">
          <section className="cartao">
            <div className="cartao-titulo"><CalendarDays size={17} className="text-stone-400" />Pães desta semana
              <Link className="link ml-auto text-sm" href={sem ? `/semanas/${sem.id}` : "/semanas"}>Abrir</Link></div>
            {!sem ? <p className="flex items-center gap-2 text-sm text-stone-500"><CircleDashed size={16} />Nenhuma semana aberta.</p>
              : sem.sem_producao ? <p className="text-sm">Semana sem produção.</p>
              : !producao.length ? <p className="text-sm text-stone-500">Semana criada, ainda sem entregas geradas.</p> : (
                <>
                  <div className="mb-3 flex items-baseline gap-2"><span className="text-3xl font-semibold tracking-tight">{totalPaes}</span><span className="text-sm text-stone-500">pães · {sem.sabor ?? "sabor a definir"}</span></div>
                  <ul className="space-y-2">
                    {producao.map(([k, n]) => (
                      <li key={k} className="text-sm">
                        <div className="mb-1 flex justify-between"><span>{k}</span><b>{n}</b></div>
                        <div className="h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(n / (producao[0][1] || 1)) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
          </section>

          <section className="cartao">
            <div className="cartao-titulo">Retornos vencidos</div>
            {!retornos?.length ? <p className="text-sm text-stone-500">Nenhum contato pendente.</p> : (
              <ul className="divide-y divide-stone-100">
                {retornos.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.cliente_id}`} className="block py-2 text-sm hover:opacity-80">
                      <span className="font-medium">{nomeCompleto(um(c.clientes as never))}</span>
                      <span className="block text-xs text-stone-500">{c.proximo_passo} · {dataBR(c.proximo_passo_em)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-stone-400">Dica: aperte <Kbd>⌘</Kbd><Kbd>K</Kbd> para buscar clientes e ir a qualquer tela, ou <Kbd>?</Kbd> para ver todos os atalhos.</p>
    </>
  );
}

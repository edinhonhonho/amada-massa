import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { MODALIDADES, dataBR, hojeISO, reais } from "@/lib/format";
import {
  COR_SITUACAO, ROTULO_SITUACAO, ordemSituacao, primeiroDoMes, situacaoCobranca, somarMeses, type Situacao,
} from "@/lib/pagamentos";
import { ajustarCobranca, darBaixa, estornarPagamento } from "./actions";

type Busca = { mes?: string; modalidade?: string; rota?: string; q?: string };
const FORMAS = { pix: "PIX", transferencia: "Transferência (Papayas)", debito_automatico: "Débito automático", dinheiro: "Dinheiro", outro: "Outro" };

export default async function Pagamentos({ searchParams }: { searchParams: Promise<Busca> }) {
  const { supabase, usuario } = await exigirEquipe();
  const b = await searchParams;
  const hoje = hojeISO();
  const mes = /^\d{4}-\d{2}$/.test(b.mes ?? "") ? `${b.mes}-01` : primeiroDoMes(hoje);

  // Só gera o mês atual e o próximo: meses passados nunca nascem sozinhos
  // (criariam atrasos falsos para quem cadastrou assinatura antiga).
  const atual = primeiroDoMes(hoje);
  if (mes >= atual && mes <= somarMeses(atual, 1)) await supabase.rpc("gerar_cobrancas", { p_competencia: mes });
  const faixas = await carregarFaixas(supabase);

  const [{ data: cobrancas }, { data: rotas }, { data: atrib }] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("id, valor_centavos, vencimento, status, justificativa, assinaturas(cliente_id, clientes(nome, sobrenome, whatsapp), planos(nome, modalidade)), pagamentos(id, valor_centavos, data, forma, observacao)")
      .eq("competencia", mes)
      .order("vencimento"),
    supabase.from("rotas").select("id, nome").order("nome"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id").is("fim", null),
  ]);
  const rotaDe = new Map((atrib ?? []).map((a) => [a.cliente_id, a.rota_id]));

  const linhas = (cobrancas ?? [])
    .map((c) => {
      const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never; planos: never } | null;
      const cli = um(a?.clientes) as { nome: string; sobrenome: string; whatsapp: string | null } | null;
      const plano = um(a?.planos) as { nome: string; modalidade: keyof typeof MODALIDADES } | null;
      const pagos = (c.pagamentos as { id: string; valor_centavos: number; data: string; forma: keyof typeof FORMAS; observacao: string | null }[]) ?? [];
      const pago = pagos.reduce((s, p) => s + p.valor_centavos, 0);
      return { c, a, cli, plano, pagos, pago, restante: Math.max(c.valor_centavos - pago, 0), sit: situacaoCobranca(c, hoje, faixas) };
    })
    .filter((l) => !b.modalidade || l.plano?.modalidade === b.modalidade)
    .filter((l) => !b.rota || rotaDe.get(l.a?.cliente_id ?? "") === b.rota)
    .filter((l) => !b.q || nomeCompleto(l.cli).toLowerCase().includes(b.q.toLowerCase()));

  const ativas = linhas.filter((l) => l.c.status !== "isenta" && l.c.status !== "cancelada");
  const esperado = ativas.reduce((s, l) => s + l.c.valor_centavos, 0);
  const recebido = linhas.reduce((s, l) => s + l.pago, 0);
  const emAtraso = ativas.filter((l) => l.sit === "atrasado" || l.sit === "atraso_critico").reduce((s, l) => s + l.restante, 0);

  const grupos = ordemSituacao.map((s) => ({ s, itens: linhas.filter((l) => l.sit === s) })).filter((g) => g.itens.length);
  const mesParam = (m: string) => `/pagamentos?mes=${m.slice(0, 7)}`;
  const nomeMes = new Date(`${mes}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold capitalize">Pagamentos · {nomeMes}</h1>
        <div className="ml-auto flex gap-2">
          <Link className="btn-sec" href={mesParam(somarMeses(mes, -1))}>←</Link>
          <Link className="btn-sec" href="/pagamentos">Hoje</Link>
          <Link className="btn-sec" href={mesParam(somarMeses(mes, 1))}>→</Link>
          <Link className="btn-sec" href={`/pagamentos/grade?ano=${mes.slice(0, 4)}`}>Grade do ano</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="cartao"><div className="text-xl font-bold">{reais(esperado)}</div><div className="text-sm text-stone-600">Esperado</div></div>
        <div className="cartao"><div className="text-xl font-bold text-green-700">{reais(recebido)}</div><div className="text-sm text-stone-600">Recebido</div></div>
        <div className="cartao"><div className="text-xl font-bold text-red-700">{reais(emAtraso)}</div><div className="text-sm text-stone-600">Em atraso</div></div>
      </div>

      <form className="cartao grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="mes" value={mes.slice(0, 7)} />
        <input className="campo" name="q" defaultValue={b.q} placeholder="Buscar cliente" />
        <select className="campo" name="modalidade" defaultValue={b.modalidade ?? ""}>
          <option value="">Todas as modalidades</option>
          {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" name="rota" defaultValue={b.rota ?? ""}>
          <option value="">Todas as rotas</option>
          {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <button className="btn">Filtrar</button>
      </form>

      {!grupos.length && <p className="cartao text-stone-500">Nenhuma cobrança neste mês. Cobranças nascem das assinaturas ativas.</p>}

      {grupos.map(({ s, itens }) => (
        <section key={s} className="cartao p-0">
          <h2 className={`rounded-t-xl px-4 py-2 font-semibold ${COR_SITUACAO[s as Situacao]}`}>{ROTULO_SITUACAO[s as Situacao]} ({itens.length})</h2>
          <ul className="divide-y divide-stone-100">
            {itens.map(({ c, cli, plano, pagos, pago, restante, a }) => {
              const modelo = s === "atrasado" || s === "atraso_critico" ? "cobranca_atraso" : "lembrete_pagamento";
              return (
                <li key={c.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/clientes/${a?.cliente_id}`} className="font-medium hover:underline">{nomeCompleto(cli)}</Link>
                      <div className="text-sm text-stone-600">
                        {plano?.nome} · vence {dataBR(c.vencimento)} · {reais(c.valor_centavos)}
                        {pago > 0 && ` · pago ${reais(pago)}`}
                        {c.justificativa && ` · ${c.justificativa}`}
                      </div>
                    </div>
                    {c.status === "pendente" && cli?.whatsapp && (
                      <a className="btn-sec px-3 py-1.5 text-sm" target="_blank" href={`/mensagens/enviar?cliente=${a?.cliente_id}&modelo=${modelo}&cobranca=${c.id}`}>Lembrete</a>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-amber-800 underline">Baixa / ajustes</summary>
                    <div className="mt-2 flex flex-col gap-3">
                      {c.status === "pendente" && (
                        <form action={darBaixa} className="grid gap-2 sm:grid-cols-5">
                          <input type="hidden" name="cobranca_id" value={c.id} />
                          <input className="campo" name="valor" defaultValue={(restante / 100).toFixed(2).replace(".", ",")} aria-label="Valor recebido" />
                          <input className="campo" type="date" name="data" defaultValue={hoje} />
                          <select className="campo" name="forma">{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                          <input className="campo" name="observacao" placeholder="Observação" />
                          <button className="btn">Dar baixa</button>
                        </form>
                      )}
                      {pagos.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-sm text-stone-600">
                          {dataBR(p.data)} · {reais(p.valor_centavos)} · {FORMAS[p.forma]} {p.observacao && `· ${p.observacao}`}
                          {usuario.perfil === "admin" && (
                            <form action={estornarPagamento}>
                              <input type="hidden" name="pagamento_id" value={p.id} /><input type="hidden" name="cobranca_id" value={c.id} />
                              <button className="text-red-700 underline">estornar</button>
                            </form>
                          )}
                        </div>
                      ))}
                      <form action={ajustarCobranca} className="grid gap-2 sm:grid-cols-5">
                        <input type="hidden" name="cobranca_id" value={c.id} />
                        <input className="campo" name="valor" placeholder="Novo valor" />
                        <input className="campo sm:col-span-2" name="justificativa" placeholder="Justificativa (obrigatória)" />
                        <button className="btn-sec" name="acao" value="valor">Ajustar valor</button>
                        <button className="btn-sec" name="acao" value="isentar">Isentar</button>
                        {c.status !== "pendente" && <button className="btn-sec" name="acao" value="reabrir" formNoValidate>Reabrir</button>}
                        {c.status === "pendente" && <button className="btn-sec" name="acao" value="cancelar">Cancelar cobrança</button>}
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

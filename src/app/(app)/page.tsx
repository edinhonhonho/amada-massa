import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { dataBR, hojeISO, reais } from "@/lib/format";
import { COR_SITUACAO, ROTULO_SITUACAO, ordemSituacao, primeiroDoMes, situacaoCobranca, somarMeses, type Situacao } from "@/lib/pagamentos";

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
    { data: semana }, { count: pendenciasEntrega }, { data: rotas }, { data: atrib }, { data: entregaAtiva },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "pausado"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).gte("cancelado_em", mes).lt("cancelado_em", somarMeses(mes, 1)),
    supabase.from("contatos").select("id, proximo_passo, proximo_passo_em, cliente_id, clientes(nome, sobrenome)")
      .eq("concluido", false).not("proximo_passo_em", "is", null).lte("proximo_passo_em", hoje).order("proximo_passo_em").limit(10),
    supabase.from("cobrancas").select("valor_centavos, vencimento, status, pagamentos(valor_centavos)").eq("competencia", mes),
    supabase.from("cobrancas").select("id, vencimento, valor_centavos, status, assinaturas(cliente_id, clientes(nome, sobrenome))").eq("status", "pendente").lt("vencimento", hoje).order("vencimento").limit(200),
    supabase.from("semanas").select("id, inicio, sabor, sem_producao").lte("inicio", hoje).gte("fim", hoje).limit(1),
    supabase.from("entregas").select("*", { count: "exact", head: true }).eq("status", "nao_entregue"),
    supabase.from("rotas").select("id, nome, entregador_id").eq("ativa", true),
    supabase.from("atribuicoes_rota").select("cliente_id").is("fim", null),
    supabase.from("assinaturas").select("cliente_id, planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", "entrega"),
  ]);

  const contagem = new Map<Situacao, number>();
  let esperado = 0, recebido = 0;
  for (const c of cobrancas ?? []) {
    contagem.set(situacaoCobranca(c, hoje, faixas), (contagem.get(situacaoCobranca(c, hoje, faixas)) ?? 0) + 1);
    if (c.status !== "isenta" && c.status !== "cancelada") esperado += c.valor_centavos;
    recebido += ((c.pagamentos as { valor_centavos: number }[]) ?? []).reduce((s, p) => s + p.valor_centavos, 0);
  }
  const lista = (atrasadas ?? []).filter((c) => ["atrasado", "atraso_critico"].includes(situacaoCobranca(c, hoje, faixas)));
  const emAtraso = lista.reduce((s, c) => s + c.valor_centavos, 0);

  const sem = semana?.[0];
  let producao: [string, number][] = [];
  if (sem && !sem.sem_producao) {
    const { data } = await supabase.from("entregas").select("rota_nome, ponto_nome, qtd_prevista, status").eq("semana_id", sem.id);
    const m = new Map<string, number>();
    for (const e of data ?? []) if (!["pulada", "suspensa_atraso"].includes(e.status)) m.set(e.rota_nome ?? e.ponto_nome ?? "Sem rota", (m.get(e.rota_nome ?? e.ponto_nome ?? "Sem rota") ?? 0) + e.qtd_prevista);
    producao = [...m.entries()].sort();
  }

  const comRota = new Set((atrib ?? []).map((a) => a.cliente_id));
  const semRota = new Set((entregaAtiva ?? []).map((a) => a.cliente_id).filter((id) => !comRota.has(id))).size;
  const rotasSemEntregador = (rotas ?? []).filter((r) => !r.entregador_id);

  const alertas = [
    semRota > 0 && <Link key="sr" href="/rotas" className="underline">{semRota} cliente(s) de entrega sem rota</Link>,
    rotasSemEntregador.length > 0 && <Link key="se" href="/rotas" className="underline">{rotasSemEntregador.length} rota(s) sem entregador: {rotasSemEntregador.map((r) => r.nome).join(", ")}</Link>,
    (pendenciasEntrega ?? 0) > 0 && <Link key="pe" href="/entregas/historico" className="underline">{pendenciasEntrega} entrega(s) com ocorrência sem resolver</Link>,
    !sem && <Link key="ss" href="/semanas/nova" className="underline">Nenhuma semana aberta hoje — criar semana</Link>,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Início</h1>
        <Link href="/clientes/novo" className="btn">Novo cliente</Link>
      </div>

      {alertas.length > 0 && <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3">{alertas}</div>}

      <div className="grid grid-cols-3 gap-3">
        {[["Ativos", ativos], ["Pausados", pausados], ["Cancelados no mês", canceladosMes]].map(([t, n]) => (
          <div key={t as string} className="cartao text-center"><div className="text-3xl font-bold text-amber-800">{n ?? 0}</div><div className="text-sm text-stone-600">{t}</div></div>
        ))}
      </div>

      <section className="cartao">
        <div className="mb-2 flex items-center"><h2 className="font-semibold">Mensalidades do mês</h2><Link className="ml-auto text-sm underline" href="/pagamentos">abrir</Link></div>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div><div className="font-bold">{reais(esperado)}</div><div className="text-xs text-stone-600">esperado</div></div>
          <div><div className="font-bold text-green-700">{reais(recebido)}</div><div className="text-xs text-stone-600">recebido</div></div>
          <div><div className="font-bold text-red-700">{reais(emAtraso)}</div><div className="text-xs text-stone-600">em atraso (total)</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ordemSituacao.filter((s) => contagem.get(s)).map((s) => <span key={s} className={`rounded-full px-3 py-1 text-sm ${COR_SITUACAO[s]}`}>{ROTULO_SITUACAO[s]}: {contagem.get(s)}</span>)}
        </div>
        {lista.length > 0 && (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {lista.slice(0, 8).map((c) => {
              const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never } | null;
              return <li key={c.id} className="py-1.5"><Link className="font-medium hover:underline" href={`/clientes/${a?.cliente_id}`}>{nomeCompleto(um(a?.clientes))}</Link> · venceu {dataBR(c.vencimento)} · {reais(c.valor_centavos)}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="cartao">
        <div className="mb-2 flex items-center"><h2 className="font-semibold">Pães desta semana {sem && `· ${sem.sabor ?? "sabor a definir"}`}</h2><Link className="ml-auto text-sm underline" href={sem ? `/semanas/${sem.id}` : "/semanas"}>abrir</Link></div>
        {!sem ? <p className="text-stone-500">Nenhuma semana aberta.</p> : sem.sem_producao ? <p>Semana sem produção.</p> : !producao.length ? <p className="text-stone-500">Semana criada, sem entregas geradas.</p> : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {producao.map(([k, n]) => <li key={k} className="flex justify-between border-b border-stone-100 py-1"><span>{k}</span><b>{n}</b></li>)}
            <li className="flex justify-between py-1 font-bold"><span>Total</span><span>{producao.reduce((s, [, n]) => s + n, 0)}</span></li>
          </ul>
        )}
      </section>

      <section className="cartao">
        <h2 className="mb-2 font-semibold">Contatos com próximo passo vencido</h2>
        {!retornos?.length && <p className="text-stone-500">Nada pendente.</p>}
        <ul className="divide-y divide-stone-100">
          {retornos?.map((c) => (
            <li key={c.id} className="py-2"><Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">{nomeCompleto(um(c.clientes as never))}</Link>
              <span className="text-stone-600"> — {c.proximo_passo} ({dataBR(c.proximo_passo_em)})</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

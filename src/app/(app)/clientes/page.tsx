import { MessageCircle, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tom } from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import FiltrosClientes from "@/components/clientes/FiltrosClientes";
import { exigirEquipe } from "@/lib/auth";
import { normBairro, rotaDoCliente, type RotaBairros } from "@/lib/bairros";
import { faixasEmCache } from "@/lib/cache";
import { nomeCompleto, semAcento, um } from "@/lib/dados";
import { MODALIDADES, hojeISO, linkWhatsApp, reais, soDigitos } from "@/lib/format";
import { ROTULO_SITUACAO, pior, primeiroDoMes, situacaoCobranca, type Situacao } from "@/lib/pagamentos";

type Busca = { status?: string; modalidade?: string; bairro?: string; pagamento?: string; plano?: string; rota?: string };
type Assin = { status: string; valor_centavos: number; planos: { id: string; nome: string; modalidade: keyof typeof MODALIDADES; paes_por_semana: number } | null; pontos_coleta: { nome: string } | null };

const TOM_STATUS: Record<string, Tom> = { ativo: "verde", pausado: "ambar", cancelado: "cinza" };
const TOM_SIT: Record<Situacao, Tom> = { em_dia: "verde", a_vencer: "azul", vence_hoje: "ambar", atrasado: "laranja", atraso_critico: "vermelho", sem_cobranca: "cinza" };

export default async function Clientes({ searchParams }: { searchParams: Promise<Busca> }) {
  const { supabase } = await exigirEquipe();
  const b = await searchParams;
  const hoje = hojeISO();

  const query = supabase
    .from("clientes")
    .select("id, nome, sobrenome, email, whatsapp, bairro, status, assinaturas(status, valor_centavos, planos(id, nome, modalidade, paes_por_semana), pontos_coleta(nome))")
    .order("nome")
    .range(0, 999);
  const [{ data }, { data: cobs }, { data: atrib }, { data: rotasDb }, { data: planos }, faixas] = await Promise.all([
    query,
    supabase.from("cobrancas").select("vencimento, status, assinaturas(cliente_id)").eq("competencia", primeiroDoMes(hoje)),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id").is("fim", null),
    supabase.from("rotas").select("id, nome, cor, ativa, bairros").order("nome"),
    supabase.from("planos").select("id, nome").order("modalidade").order("paes_por_semana"),
    faixasEmCache(),
  ]);

  const sit = new Map<string, Situacao[]>();
  for (const c of cobs ?? []) {
    const id = (um(c.assinaturas as never) as { cliente_id: string } | null)?.cliente_id;
    if (id) sit.set(id, [...(sit.get(id) ?? []), situacaoCobranca(c, hoje, faixas)]);
  }
  const regras: RotaBairros[] = (rotasDb ?? []).map((r) => ({ id: r.id, nome: r.nome, ativa: r.ativa, bairros: (r.bairros ?? []) as string[] }));
  const manual = new Map((atrib ?? []).map((a) => [a.cliente_id as string, a.rota_id as string]));
  const rotaInfo = new Map((rotasDb ?? []).map((r) => [r.id as string, { nome: r.nome as string, cor: r.cor as string }]));

  const vigente = (c: NonNullable<typeof data>[number]) =>
    ((c.assinaturas as unknown as Assin[]) ?? []).find((a) => a.status === "ativa" || a.status === "pausada") ?? null;
  const planoDe = (c: NonNullable<typeof data>[number]) => { const a = vigente(c); return a ? { ...a, plano: um(a.planos as never) as Assin["planos"] } : null; };

  const rotaDeCliente = (c: NonNullable<typeof data>[number]) => (planoDe(c)?.plano?.modalidade === "entrega" ? rotaDoCliente(c.bairro, manual.get(c.id), regras) : null);
  const bairrosOpcoes = [...new Map((data ?? []).filter((c) => normBairro(c.bairro)).map((c) => [normBairro(c.bairro), (c.bairro ?? "").trim()])).entries()]
    .map(([valor, rotulo]) => ({ valor, rotulo })).sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR"));

  const base = (data ?? [])
    .filter((c) => !b.bairro || normBairro(c.bairro) === b.bairro)
    .filter((c) => !b.rota || (b.rota === "sem" ? planoDe(c)?.plano?.modalidade === "entrega" && !rotaDeCliente(c) : rotaDeCliente(c) === b.rota))
    .filter((c) => !b.modalidade || planoDe(c)?.plano?.modalidade === b.modalidade)
    .filter((c) => !b.plano || planoDe(c)?.plano?.id === b.plano)
    .filter((c) => !b.pagamento || (sit.has(c.id) && pior(sit.get(c.id)!) === b.pagamento));
  const contagem = { todos: base.length, ativo: 0, pausado: 0, cancelado: 0 } as Record<string, number>;
  for (const c of base) contagem[c.status]++;
  // Por padrão só os ativos: o histórico (cancelados) fica na aba própria, "Todos" mostra tudo.
  const statusAtual = b.status ?? "ativo";
  const lista = statusAtual === "todos" ? base : base.filter((c) => c.status === statusAtual);

  const href = (extra: Partial<Busca>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...b, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/clientes${s ? `?${s}` : ""}`;
  };
  const abas = [["ativo", "Ativos", contagem.ativo], ["pausado", "Pausados", contagem.pausado], ["cancelado", "Cancelados", contagem.cancelado], ["todos", "Todos", contagem.todos]] as const;

  return (
    <>
      <PageHeader
        titulo="Clientes"
        subtitulo="Quem assina o clube. Cada cliente tem uma assinatura, e cada assinatura usa um plano do catálogo."
        acoes={<Link href="/clientes/novo" className="btn"><UserPlus size={16} />Novo cliente</Link>}
      />

      <div className="mb-4 flex items-center gap-1 border-b border-stone-200">
        {abas.map(([k, rotulo, n]) => {
          const on = statusAtual === k;
          return (
            <Link key={k} href={href({ status: k })}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${on ? "border-amber-600 text-amber-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
              {rotulo}<span className={`rounded-full px-1.5 py-0.5 text-xs ${on ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}>{n}</span>
            </Link>
          );
        })}
      </div>

      <FiltrosClientes
        alvo="#lista-clientes" status={statusAtual}
        filtros={{ plano: b.plano, modalidade: b.modalidade, pagamento: b.pagamento, rota: b.rota, bairro: b.bairro }}
        planos={(planos ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
        modalidades={Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor, rotulo }))}
        pagamentos={Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))}
        rotas={[{ valor: "sem", rotulo: "Sem rota" }, ...(rotasDb ?? []).map((r) => ({ valor: r.id as string, rotulo: r.nome as string }))]}
        bairros={bairrosOpcoes}
      />

      <div id="lista-clientes" className="cartao overflow-hidden !p-0">
        {!lista.length ? (
          <Vazio icone={Users} titulo="Nenhum cliente encontrado" texto="Ajuste os filtros ou cadastre quem acabou de confirmar a assinatura."
            acao={<Link href="/clientes/novo" className="btn"><UserPlus size={16} />Novo cliente</Link>} />
        ) : (
          <table className="tabela">
            <thead><tr><th>Cliente</th><th>Plano (assinatura)</th><th>Entrega ou retirada</th><th>Pagamento do mês</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map((c) => {
                const p = planoDe(c);
                const s = sit.has(c.id) ? pior(sit.get(c.id)!) : null;
                const rotaId = rotaDeCliente(c);
                const rota = rotaId ? rotaInfo.get(rotaId) : null;
                const wa = linkWhatsApp(c.whatsapp);
                return (
                  <tr key={c.id} data-busca={semAcento(`${nomeCompleto(c)} ${c.email ?? ""} ${c.bairro ?? ""} ${p?.plano?.nome ?? ""} ${p?.plano ? MODALIDADES[p.plano.modalidade] : ""} ${rota?.nome ?? ""}`)} data-fone={soDigitos(c.whatsapp ?? "")}>
                    <td>
                      <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                        <Avatar nome={nomeCompleto(c)} />
                        <span><span className="block font-medium text-stone-900">{nomeCompleto(c)}</span><span className="text-xs text-stone-500">{c.bairro ?? "Sem bairro"}</span></span>
                      </Link>
                    </td>
                    <td>
                      {p?.plano ? (
                        <Link href={`/planos`} className="block hover:opacity-80">
                          <span className="block text-stone-800">{MODALIDADES[p.plano.modalidade]}{p.plano.paes_por_semana > 0 && ` · ${p.plano.paes_por_semana} ${p.plano.paes_por_semana > 1 ? "pães" : "pão"}/sem`}</span>
                          <span className="text-xs text-stone-500">{reais(p.valor_centavos)}/mês</span>
                        </Link>
                      ) : <span className="text-stone-400">{c.status === "cancelado" ? "Assinatura encerrada" : "Sem assinatura"}</span>}
                    </td>
                    <td className="text-stone-700">
                      {p?.plano?.modalidade === "entrega"
                        ? (rota ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: rota.cor }} />{rota.nome}</span> : c.status === "ativo" ? <Badge tom="ambar">Sem rota</Badge> : "—")
                        : p?.pontos_coleta?.nome ?? "—"}
                    </td>
                    <td>{s ? <Badge tom={TOM_SIT[s]} ponto>{ROTULO_SITUACAO[s]}</Badge> : <span className="text-stone-400">—</span>}</td>
                    <td><Badge tom={TOM_STATUS[c.status]}>{c.status === "ativo" ? "Ativo" : c.status === "pausado" ? "Pausado" : "Cancelado"}</Badge></td>
                    <td className="text-right">
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost !p-2" title="Abrir WhatsApp"><MessageCircle size={17} /></a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

import { AlertTriangle, ChevronRight, Clock, Plus, Route as RouteIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { normBairro, rotaDoCliente, type RotaBairros } from "@/lib/bairros";
import { DIAS_SEMANA, nomeCompleto, um } from "@/lib/dados";
import { reais } from "@/lib/format";

type Linha = { cliente_id: string; valor_centavos: number; planos: { paes_por_semana: number } | { paes_por_semana: number }[] | null; clientes: { id: string; nome: string; sobrenome: string | null; bairro: string | null } | { id: string; nome: string; sobrenome: string | null; bairro: string | null }[] | null };

export default async function Rotas() {
  const { supabase } = await exigirEquipe();
  const [{ data: rotas }, { data: atrib }, { data: ass }, { data: entregadores }] = await Promise.all([
    supabase.from("rotas").select("*").order("ativa", { ascending: false }).order("nome"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id").is("fim", null),
    supabase.from("assinaturas").select("cliente_id, valor_centavos, planos!inner(modalidade, paes_por_semana), clientes!inner(id, nome, sobrenome, bairro, status)")
      .eq("status", "ativa").eq("planos.modalidade", "entrega").eq("clientes.status", "ativo").range(0, 4999),
    supabase.from("usuarios").select("id, nome"),
  ]);
  const manual = new Map((atrib ?? []).map((a) => [a.cliente_id as string, a.rota_id as string]));
  const nomeEnt = new Map((entregadores ?? []).map((e) => [e.id, e.nome]));
  const regras: RotaBairros[] = (rotas ?? []).map((r) => ({ id: r.id, nome: r.nome, ativa: r.ativa, bairros: (r.bairros ?? []) as string[] }));

  // cada cliente de entrega cai numa rota pelo bairro (ou fica sem rota)
  const porRota = new Map<string, { clientes: Set<string>; paes: number; valor: number }>();
  const semRota = new Map<string, { nome: string; bairro: string | null }>();
  for (const a of (ass ?? []) as unknown as Linha[]) {
    const c = um(a.clientes as never) as { id: string; nome: string; sobrenome: string | null; bairro: string | null } | null;
    const pl = um(a.planos as never) as { paes_por_semana: number } | null;
    if (!c) continue;
    const rotaId = rotaDoCliente(c.bairro, manual.get(c.id), regras);
    if (!rotaId) { semRota.set(c.id, { nome: nomeCompleto(c), bairro: c.bairro }); continue; }
    const g = porRota.get(rotaId) ?? porRota.set(rotaId, { clientes: new Set(), paes: 0, valor: 0 }).get(rotaId)!;
    g.clientes.add(c.id); g.paes += pl?.paes_por_semana ?? 0; g.valor += a.valor_centavos;
  }
  // bairros com clientes de entrega que nenhuma rota cobre
  const semBairro = new Map<string, { nome: string; qtd: number }>();
  for (const c of semRota.values()) {
    const k = normBairro(c.bairro) || "—";
    const e = semBairro.get(k) ?? { nome: c.bairro?.trim() || "Sem bairro no cadastro", qtd: 0 };
    e.qtd++; semBairro.set(k, e);
  }

  return (
    <>
      <PageHeader
        titulo="Rotas"
        subtitulo="Cada rota cobre alguns bairros e tem um responsável. Quem entra, a ordem e o caminho são montados a cada semana."
      />

      {semRota.size > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{semRota.size} {semRota.size === 1 ? "cliente de entrega está" : "clientes de entrega estão"} em bairros sem rota</b> e não entram nas listas:{" "}
            {[...semBairro.values()].map((b, i) => <span key={b.nome}>{i > 0 && ", "}<b className="font-semibold">{b.nome}</b> ({b.qtd})</span>)}.
            Inclua esses bairros numa rota.
          </div>
        </div>
      )}

      {!rotas?.length ? (
        <div className="cartao"><Vazio icone={RouteIcon} titulo="Nenhuma rota ainda" texto="Crie a primeira rota e depois atribua os clientes de entrega a ela." acao={<Link href="/rotas/nova" className="btn"><Plus size={16} />Nova rota</Link>} /></div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          {rotas.map((r) => {
            const g = porRota.get(r.id);
            const membros = [...(g?.clientes ?? [])];
            const paes = g?.paes ?? 0, valor = g?.valor ?? 0;
            const lista = (r.bairros ?? []) as string[];
            const estourou = !!r.capacidade_paes && paes > r.capacidade_paes;
            const entregador = r.entregador_id ? nomeEnt.get(r.entregador_id) : null;

            const ocupacao = r.capacidade_paes ? Math.min(100, Math.round((paes / r.capacidade_paes) * 100)) : null;
            return (
              <Link key={r.id} href={`/rotas/${r.id}`} className={`group flex h-full flex-col gap-4 rounded-[24px] bg-painel p-5 ring-1 ring-stone-900/[0.04] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,.35)] hover:ring-stone-900/10 ${r.ativa ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_8px_16px_-8px_rgba(28,25,23,.5)]" style={{ background: r.cor }}><RouteIcon size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><h2 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{r.nome}</h2>{!r.ativa && <Badge>Inativa</Badge>}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[13px] text-stone-500">
                      <Clock size={12} />{r.dia_semana != null ? DIAS_SEMANA[r.dia_semana] : "Sem dia"}{r.janela_inicio && ` · ${r.janela_inicio.slice(0, 5)}–${r.janela_fim?.slice(0, 5) ?? ""}`}
                    </div>
                  </div>
                  {entregador ? (
                    <span className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[13px] font-medium text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.06)]"><Avatar nome={entregador} tamanho={24} />{entregador.split(" ")[0]}</span>
                  ) : <Badge tom="ambar"><AlertTriangle size={12} />Sem entregador</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="cartao-branco px-3.5 py-3"><div className="text-xl font-semibold tabular-nums leading-none">{membros.length}</div><div className="mt-1.5 text-xs text-stone-500">{membros.length === 1 ? "parada" : "paradas"}</div></div>
                  <div className="cartao-branco px-3.5 py-3">
                    <div className="text-xl font-semibold tabular-nums leading-none">{paes}{r.capacidade_paes ? <span className="text-sm font-normal text-stone-400">/{r.capacidade_paes}</span> : ""}</div>
                    <div className="mt-1.5 text-xs text-stone-500">pães por semana</div>
                    {ocupacao !== null && <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${estourou ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${ocupacao}%` }} /></div>}
                  </div>
                  <div className="cartao-branco px-3.5 py-3"><div className="text-xl font-semibold tabular-nums leading-none">{reais(valor)}</div><div className="mt-1.5 text-xs text-stone-500">por mês</div></div>
                </div>
                {estourou && <p className="-mt-1 flex items-center gap-1.5 text-[13px] font-medium text-red-700"><AlertTriangle size={14} />Acima da capacidade da rota</p>}

                <div className="mt-auto flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {lista.slice(0, 5).map((b) => <span key={b} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.06)]">{b}</span>)}
                    {lista.length > 5 && <span className="rounded-full px-2 py-0.5 text-xs text-stone-400">+{lista.length - 5}</span>}
                    {!lista.length && <span className="flex items-center gap-1.5 text-[13px] text-amber-700"><TriangleAlert size={13} />Nenhum bairro definido</span>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
                </div>
              </Link>
            );
          })}
          <Link href="/rotas/nova" className="cartao-novo group">
            <span className="flex size-11 items-center justify-center rounded-full bg-stone-100 transition group-hover:bg-amber-100"><Plus size={20} /></span>
            <span className="font-semibold">Nova rota</span>
            <span className="text-[13px] text-stone-400">Defina o responsável e os bairros</span>
          </Link>
        </div>
      )}
    </>
  );
}

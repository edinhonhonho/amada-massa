import { AlertTriangle, ChevronRight, Clock, Plus, Route as RouteIcon, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { DIAS_SEMANA, nomeCompleto, um } from "@/lib/dados";
import { reais } from "@/lib/format";

type Cli = { nome: string; sobrenome: string; bairro: string | null; status: string; assinaturas: { status: string; valor_centavos: number; planos: { modalidade: string; paes_por_semana: number } | null }[] };

export default async function Rotas() {
  const { supabase } = await exigirEquipe();
  const [{ data: rotas }, { data: atrib }, { data: pendentes }, { data: entregadores }] = await Promise.all([
    supabase.from("rotas").select("*").order("ativa", { ascending: false }).order("nome"),
    supabase.from("atribuicoes_rota").select("rota_id, cliente_id, clientes(nome, sobrenome, bairro, status, assinaturas(status, valor_centavos, planos(modalidade, paes_por_semana)))").is("fim", null),
    supabase.from("assinaturas").select("cliente_id, clientes(nome, sobrenome, bairro, status), planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", "entrega"),
    supabase.from("usuarios").select("id, nome"),
  ]);
  const atribuidos = new Set((atrib ?? []).map((a) => a.cliente_id));
  const semRota = (pendentes ?? []).filter((p) => !atribuidos.has(p.cliente_id) && (um(p.clientes as never) as Cli | null)?.status === "ativo");
  const nomeEnt = new Map((entregadores ?? []).map((e) => [e.id, e.nome]));

  return (
    <>
      <PageHeader
        titulo="Rotas"
        subtitulo="Cada cliente de entrega pertence a uma rota. O entregador vê só a rota dele, na ordem das paradas."
        acoes={<Link href="/rotas/nova" className="btn"><Plus size={16} />Nova rota</Link>}
      />

      {semRota.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 shadow-sm p-4 text-sm text-amber-950">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{semRota.length} cliente(s) de entrega ainda sem rota</b> — não entram nas listas até serem atribuídos:{" "}
            {semRota.map((p, i) => (
              <span key={p.cliente_id}>{i > 0 && ", "}<Link className="font-medium underline" href={`/clientes/${p.cliente_id}`}>{nomeCompleto(um(p.clientes as never))}</Link></span>
            ))}
          </div>
        </div>
      )}

      {!rotas?.length ? (
        <div className="cartao"><Vazio icone={RouteIcon} titulo="Nenhuma rota ainda" texto="Crie a primeira rota e depois atribua os clientes de entrega a ela." acao={<Link href="/rotas/nova" className="btn"><Plus size={16} />Nova rota</Link>} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2 xl:grid-cols-2">
          {rotas.map((r) => {
            const membros = (atrib ?? []).filter((a) => a.rota_id === r.id);
            let paes = 0, valor = 0;
            const bairros = new Set<string>();
            for (const m of membros) {
              const c = um(m.clientes as never) as Cli | null;
              if (!c) continue;
              if (c.bairro) bairros.add(c.bairro);
              for (const a of c.assinaturas ?? []) {
                const pl = um(a.planos as never) as { modalidade: string; paes_por_semana: number } | null;
                if (a.status === "ativa" && pl?.modalidade === "entrega" && c.status === "ativo") { paes += pl.paes_por_semana; valor += a.valor_centavos; }
              }
            }
            const estourou = !!r.capacidade_paes && paes > r.capacidade_paes;
            const entregador = r.entregador_id ? nomeEnt.get(r.entregador_id) : null;
            const lista = [...bairros];
            const ocupacao = r.capacidade_paes ? Math.min(100, Math.round((paes / r.capacidade_paes) * 100)) : null;
            return (
              <Link key={r.id} href={`/rotas/${r.id}`} className={`group flex flex-col gap-4 rounded-[24px] bg-painel p-5 ring-1 ring-stone-900/[0.04] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,.35)] hover:ring-stone-900/10 ${r.ativa ? "" : "opacity-60"}`}>
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

                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {lista.slice(0, 5).map((b) => <span key={b} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.06)]">{b}</span>)}
                    {lista.length > 5 && <span className="rounded-full px-2 py-0.5 text-xs text-stone-400">+{lista.length - 5}</span>}
                    {!lista.length && <span className="flex items-center gap-1.5 text-[13px] text-stone-400"><Users size={13} />Sem clientes ainda</span>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

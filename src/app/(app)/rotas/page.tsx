import { AlertTriangle, Clock, Plus, Route as RouteIcon, TriangleAlert, Users } from "lucide-react";
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
        etiqueta={<Badge tom="cinza">Passo 3 · Organizar</Badge>}
        subtitulo="Cada cliente de entrega pertence a uma rota. O entregador vê só a rota dele, na ordem das paradas."
        acoes={<Link href="/rotas/nova" className="btn"><Plus size={16} />Nova rota</Link>}
      />

      {semRota.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
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
        <div className="grid grid-cols-2 gap-4">
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
            return (
              <Link key={r.id} href={`/rotas/${r.id}`} className={`cartao group block overflow-hidden !p-0 transition hover:border-amber-300 hover:shadow-md ${r.ativa ? "" : "opacity-60"}`}>
                <div className="h-1.5" style={{ background: r.cor }} />
                <div className="p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-tight">{r.nome}</h2>{!r.ativa && <Badge>Inativa</Badge>}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                        <Clock size={13} />{r.dia_semana != null ? DIAS_SEMANA[r.dia_semana] : "Sem dia"}{r.janela_inicio && ` · ${r.janela_inicio.slice(0, 5)}–${r.janela_fim?.slice(0, 5) ?? ""}`}
                      </div>
                    </div>
                    {entregador ? (
                      <div className="flex items-center gap-2 text-sm text-stone-600"><Avatar nome={entregador} tamanho={28} />{entregador.split(" ")[0]}</div>
                    ) : <Badge tom="ambar"><AlertTriangle size={12} />Sem entregador</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-center">
                    <div><div className="text-lg font-semibold">{membros.length}</div><div className="text-xs text-stone-500">paradas</div></div>
                    <div><div className="text-lg font-semibold">{paes}{r.capacidade_paes ? <span className="text-sm font-normal text-stone-400">/{r.capacidade_paes}</span> : ""}</div><div className="text-xs text-stone-500">pães/semana</div></div>
                    <div><div className="text-lg font-semibold">{reais(valor)}</div><div className="text-xs text-stone-500">por mês</div></div>
                  </div>
                  {estourou && <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700"><AlertTriangle size={14} />Acima da capacidade</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...bairros].slice(0, 6).map((b) => <span key={b} className="selo selo-cinza">{b}</span>)}
                    {!bairros.size && <span className="flex items-center gap-1.5 text-sm text-stone-400"><Users size={14} />Sem clientes</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

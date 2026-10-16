import Link from "next/link";
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rotas</h1>
        <Link href="/rotas/nova" className="btn">Nova rota</Link>
      </div>

      {semRota.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <b>{semRota.length} cliente(s) de entrega sem rota:</b>{" "}
          {semRota.map((p, i) => (
            <span key={p.cliente_id}>{i > 0 && ", "}<Link className="underline" href={`/clientes/${p.cliente_id}`}>{nomeCompleto(um(p.clientes as never))}</Link></span>
          ))}
        </div>
      )}

      {rotas?.map((r) => {
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
        const estourou = r.capacidade_paes && paes > r.capacidade_paes;
        return (
          <Link key={r.id} href={`/rotas/${r.id}`} className={`cartao block hover:border-amber-400 ${r.ativa ? "" : "opacity-60"}`} style={{ borderLeft: `6px solid ${r.cor}` }}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-semibold">{r.nome}</span>
              {!r.ativa && <span className="text-xs text-stone-500">inativa</span>}
              <span className="text-sm text-stone-600">{r.dia_semana != null && DIAS_SEMANA[r.dia_semana]} {r.janela_inicio && `${r.janela_inicio.slice(0, 5)}–${r.janela_fim?.slice(0, 5) ?? ""}`}</span>
            </div>
            <div className="text-sm text-stone-700">
              {membros.length} clientes · {paes} pães/semana{r.capacidade_paes ? ` (cap. ${r.capacidade_paes})` : ""} · {reais(valor)}/mês
            </div>
            <div className="text-sm text-stone-600">{[...bairros].join(", ") || "Sem clientes"}</div>
            {estourou && <div className="text-sm font-medium text-red-700">⚠ Acima da capacidade</div>}
            {!r.entregador_id ? <div className="text-sm font-medium text-amber-800">⚠ Sem entregador</div> : <div className="text-sm text-stone-600">Entregador: {nomeEnt.get(r.entregador_id) ?? "—"}</div>}
          </Link>
        );
      })}
      {!rotas?.length && <p className="cartao text-stone-500">Nenhuma rota ainda.</p>}
    </div>
  );
}

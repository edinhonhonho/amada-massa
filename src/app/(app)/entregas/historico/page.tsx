import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_ENTREGA } from "@/lib/semana";
import { tratarPendencia } from "../actions";

export default async function Historico({ searchParams }: { searchParams: Promise<{ semana?: string; rota?: string }> }) {
  const { supabase, usuario } = await exigirEquipe();
  const b = await searchParams;
  const { data: semanas } = await supabase.from("semanas").select("id, inicio").order("inicio", { ascending: false }).limit(30);
  const semanaId = b.semana ?? semanas?.[0]?.id;

  let q = supabase.from("entregas").select("id, rota_nome, ponto_nome, status, ocorrencia, observacao, qtd_prevista, entregue_em, clientes(nome, sobrenome), cliente_id").eq("semana_id", semanaId ?? "");
  if (b.rota) q = q.eq("rota_nome", b.rota);
  const [{ data }, { data: pend }] = await Promise.all([
    q.order("rota_nome").order("ordem"),
    supabase.from("entregas").select("id, rota_nome, ponto_nome, ocorrencia, semanas(inicio), clientes(nome, sobrenome)").eq("status", "nao_entregue").order("entregue_em", { ascending: false }).limit(50),
  ]);

  const porDestino = new Map<string, Record<string, number>>();
  for (const e of data ?? []) {
    const k = e.rota_nome ?? e.ponto_nome ?? "Sem rota";
    const r = porDestino.get(k) ?? {};
    r[e.status] = (r[e.status] ?? 0) + 1;
    porDestino.set(k, r);
  }
  const rotasNomes = [...new Set((data ?? []).map((e) => e.rota_nome).filter(Boolean))] as string[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Histórico de entregas</h1>
        {usuario.perfil === "admin" && <Link className="btn-sec ml-auto" href={`/exportar/entregas${semanaId ? `?semana=${semanaId}` : ""}`}>Exportar CSV</Link>}
      </div>

      {(pend?.length ?? 0) > 0 && (
        <section className="cartao border-red-200">
          <h2 className="mb-2 font-semibold text-red-800">Pendências (não entregues) — {pend?.length}</h2>
          <ul className="divide-y divide-stone-100">
            {pend?.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <b>{nomeCompleto(um(e.clientes as never))}</b> <span className="text-sm text-stone-600">{e.rota_nome ?? e.ponto_nome} · semana {dataBR((um(e.semanas as never) as { inicio: string } | null)?.inicio)} · {e.ocorrencia}</span>
                </div>
                {(["reagendada", "programada"] as const).map((st) => (
                  <form key={st} action={tratarPendencia}>
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={st} />
                    <button className="btn-sec px-3 py-1.5 text-sm">{st === "reagendada" ? "Reagendar" : "Reprogramar"}</button>
                  </form>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="cartao grid gap-3 sm:grid-cols-3">
        <select className="campo" name="semana" defaultValue={semanaId}>{semanas?.map((s) => <option key={s.id} value={s.id}>Semana {dataBR(s.inicio)}</option>)}</select>
        <select className="campo" name="rota" defaultValue={b.rota ?? ""}><option value="">Todas as rotas</option>{rotasNomes.map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn">Filtrar</button>
      </form>

      <div className="cartao overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="border-b border-stone-200 text-left"><th className="p-2">Destino</th><th>Entregues/retiradas</th><th>Falhas</th><th>Pendentes</th><th>Taxa</th></tr></thead>
          <tbody>
            {[...porDestino.entries()].map(([k, r]) => {
              const ok = (r.entregue ?? 0) + (r.retirada ?? 0), falha = r.nao_entregue ?? 0, pendente = (r.programada ?? 0) + (r.reagendada ?? 0);
              const total = ok + falha + pendente;
              return <tr key={k} className="border-b border-stone-100"><td className="p-2">{k}</td><td>{ok}</td><td>{falha}</td><td>{pendente}</td><td>{total ? Math.round((ok / total) * 100) : 0}%</td></tr>;
            })}
          </tbody>
        </table>
      </div>

      <ul className="cartao divide-y divide-stone-100 p-0 text-sm">
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-2 p-2">
            <Link href={`/clientes/${e.cliente_id}`} className="flex-1 hover:underline">{nomeCompleto(um(e.clientes as never))}</Link>
            <span className="text-stone-600">{e.rota_nome ?? e.ponto_nome}</span>
            <span>{STATUS_ENTREGA[e.status]}{e.ocorrencia && ` — ${e.ocorrencia}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

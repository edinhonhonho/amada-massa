import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { bairroAtendido, nomeCompleto, um } from "@/lib/dados";
import { atribuirClientes, moverParada, removerDaRota } from "../actions";
import RotaForm from "../RotaForm";

export default async function Rota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const { data: rota } = await supabase.from("rotas").select("*").eq("id", id).single();
  if (!rota) notFound();

  const [{ data: membros }, { data: candidatos }, { data: todas }, { data: usuarios }] = await Promise.all([
    supabase.from("atribuicoes_rota").select("id, ordem, cliente_id, clientes(nome, sobrenome, bairro, logradouro, numero, instrucoes_entrega)").eq("rota_id", id).is("fim", null).order("ordem"),
    supabase.from("assinaturas").select("cliente_id, clientes(nome, sobrenome, bairro, status), planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", "entrega"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id, rotas(nome)").is("fim", null),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const rotaAtual = new Map((todas ?? []).map((t) => [t.cliente_id, { rota: t.rota_id, nome: (um(t.rotas as never) as { nome: string } | null)?.nome }]));
  const nestaRota = new Set((membros ?? []).map((m) => m.cliente_id));
  const unicos = new Map<string, { id: string; c: { nome: string; sobrenome: string; bairro: string | null; status: string } }>();
  for (const a of candidatos ?? []) {
    const c = um(a.clientes as never) as { nome: string; sobrenome: string; bairro: string | null; status: string } | null;
    if (c && c.status === "ativo" && !nestaRota.has(a.cliente_id)) unicos.set(a.cliente_id, { id: a.cliente_id, c });
  }
  const lista = [...unicos.values()].sort((x, y) => Number(!!rotaAtual.get(x.id)) - Number(!!rotaAtual.get(y.id)) || x.c.nome.localeCompare(y.c.nome));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/rotas" className="text-sm text-amber-800 underline">← Rotas</Link>
      <h1 className="text-2xl font-bold" style={{ color: rota.cor }}>{rota.nome}</h1>
      {rota.descricao && <p className="text-stone-700">{rota.descricao}</p>}

      <section className="cartao p-0">
        <h2 className="border-b border-stone-100 px-4 py-2 font-semibold">Paradas ({membros?.length ?? 0})</h2>
        <ol className="divide-y divide-stone-100">
          {membros?.map((m, i) => {
            const c = um(m.clientes as never) as { nome: string; sobrenome: string; bairro: string | null; logradouro: string | null; numero: string | null; instrucoes_entrega: string | null } | null;
            return (
              <li key={m.id} className="flex items-center gap-2 p-3">
                <span className="w-6 text-right text-stone-500">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/clientes/${m.cliente_id}`} className="font-medium hover:underline">{nomeCompleto(c)}</Link>
                  <div className="truncate text-sm text-stone-600">{[c?.logradouro && `${c.logradouro} ${c.numero ?? ""}`, c?.bairro].filter(Boolean).join(" · ")}</div>
                  {!bairroAtendido(c?.bairro) && <div className="text-xs text-amber-800">⚠ Bairro fora da lista atendida pela bike</div>}
                </div>
                {(["cima", "baixo"] as const).map((dir) => (
                  <form key={dir} action={moverParada}>
                    <input type="hidden" name="rota_id" value={id} /><input type="hidden" name="atribuicao_id" value={m.id} /><input type="hidden" name="dir" value={dir} />
                    <button className="btn-sec px-3 py-1.5" aria-label={`Mover para ${dir}`}>{dir === "cima" ? "↑" : "↓"}</button>
                  </form>
                ))}
                <form action={removerDaRota}>
                  <input type="hidden" name="rota_id" value={id} /><input type="hidden" name="atribuicao_id" value={m.id} />
                  <button className="btn-sec px-3 py-1.5 text-red-700">Remover</button>
                </form>
              </li>
            );
          })}
          {!membros?.length && <li className="p-4 text-stone-500">Nenhum cliente nesta rota.</li>}
        </ol>
      </section>

      <section className="cartao">
        <h2 className="mb-2 font-semibold">Adicionar clientes de entrega</h2>
        <form action={atribuirClientes} className="flex flex-col gap-2">
          <input type="hidden" name="rota_id" value={id} />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200">
            {lista.map(({ id: cid, c }) => (
              <label key={cid} className="flex items-center gap-2 border-b border-stone-100 p-2">
                <input type="checkbox" name="cliente_id" value={cid} />
                <span className="flex-1">{nomeCompleto(c)} <span className="text-sm text-stone-500">{c.bairro}</span></span>
                <span className="text-xs text-stone-500">{rotaAtual.get(cid)?.nome ? `hoje: ${rotaAtual.get(cid)?.nome}` : "sem rota"}</span>
              </label>
            ))}
            {!lista.length && <p className="p-3 text-stone-500">Todos os clientes de entrega já estão nesta rota.</p>}
          </div>
          <button className="btn self-start">Adicionar à rota</button>
        </form>
      </section>

      <details className="cartao"><summary className="cursor-pointer font-semibold">Editar rota</summary>
        <div className="mt-3"><RotaForm rota={rota} entregadores={usuarios ?? []} /></div></details>
    </div>
  );
}

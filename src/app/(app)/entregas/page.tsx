import Link from "next/link";
import ListaEntrega, { type Parada } from "@/components/ListaEntrega";
import { usuarioAtual } from "@/lib/auth";
import { DIAS_SEMANA } from "@/lib/dados";
import { dataBR, hojeISO } from "@/lib/format";

export default async function Entregas({ searchParams }: { searchParams: Promise<{ rota?: string }> }) {
  const { supabase, usuario } = await usuarioAtual();
  const hoje = hojeISO();
  const { rota: rotaParam } = await searchParams;

  let semana = (await supabase.from("semanas").select("id, inicio, fim, sabor, sem_producao").lte("inicio", hoje).order("inicio", { ascending: false }).limit(1)).data?.[0];
  if (!semana || semana.fim < hoje) {
    const prox = (await supabase.from("semanas").select("id, inicio, fim, sabor, sem_producao").gte("inicio", hoje).order("inicio").limit(1)).data?.[0];
    semana = prox ?? semana;
  }

  let q = supabase.from("rotas").select("id, nome, cor, dia_semana, descricao").eq("ativa", true).order("nome");
  if (usuario.perfil === "entregador") q = q.eq("entregador_id", usuario.id);
  const { data: rotas } = await q;
  const rota = rotas?.find((r) => r.id === rotaParam) ?? rotas?.[0];

  if (!semana || !rota) {
    return (
      <div className="cartao">
        <h1 className="text-xl font-bold">Entregas</h1>
        <p className="text-stone-600">{!rota ? "Nenhuma rota atribuída a você." : "Nenhuma semana planejada."}</p>
      </div>
    );
  }

  const { data } = await supabase.rpc("entregas_da_rota", { p_semana: semana.id, p_rota: rota.id });
  const paradas = (data ?? []) as Parada[];

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: rota.cor }}>{rota.nome}</h1>
        <p className="text-stone-600">
          Semana {dataBR(semana.inicio)} · {semana.sabor ?? "sabor a definir"}{rota.dia_semana != null && ` · ${DIAS_SEMANA[rota.dia_semana]}`}
        </p>
        {rota.descricao && <p className="text-sm text-stone-600">{rota.descricao}</p>}
      </header>
      {rotas && rotas.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {rotas.map((r) => (
            <Link key={r.id} href={`/entregas?rota=${r.id}`} className={r.id === rota.id ? "btn" : "btn-sec"}>{r.nome}</Link>
          ))}
        </div>
      )}
      {semana.sem_producao ? <p className="cartao">Semana sem produção. Nada a entregar.</p>
        : !paradas.length ? <p className="cartao text-stone-500">Nenhuma parada. A semana já foi aberta?</p>
        : <ListaEntrega key={`${semana.id}-${rota.id}`} paradas={paradas} />}
    </div>
  );
}

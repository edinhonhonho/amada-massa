import Link from "next/link";
import EntregadorApp, { type Parada } from "@/components/EntregadorApp";
import SairBotao from "@/components/SairBotao";
import { usuarioAtual } from "@/lib/auth";
import { DIAS_SEMANA } from "@/lib/dados";
import { dataBR, hojeISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function sair() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entregador/entrar");
}

export default async function Entregador({ searchParams }: { searchParams: Promise<{ rota?: string }> }) {
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
  const rota = rotas?.find((r) => r.id === rotaParam) ?? (rotas?.length === 1 ? rotas[0] : undefined);

  const cabecalho = (
    <header className="flex items-center gap-2 py-3">
      <span className="text-lg font-bold text-amber-800">Amada Massa</span>
      <form action={sair} className="ml-auto text-sm text-stone-600"><span className="mr-3">{usuario.nome}</span><SairBotao cache="entregador-v1" /></form>
    </header>
  );

  if (!rotas?.length) return <>{cabecalho}<p className="cartao">Nenhuma rota atribuída a você. Fale com a gestão.</p></>;
  if (!semana) return <>{cabecalho}<p className="cartao">Nenhuma semana planejada.</p></>;

  if (!rota) {
    return (
      <>
        {cabecalho}
        <h1 className="mb-3 text-xl font-bold">Escolha sua rota</h1>
        <div className="flex flex-col gap-3">
          {rotas.map((r) => (
            <Link key={r.id} href={`/entregador?rota=${r.id}`} className="cartao block py-5 text-lg font-semibold" style={{ borderLeft: `8px solid ${r.cor}` }}>
              {r.nome}
              <span className="block text-sm font-normal text-stone-600">{r.dia_semana != null && DIAS_SEMANA[r.dia_semana]} {r.descricao}</span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  const [{ data }, { data: exec }, { data: traj }] = await Promise.all([
    supabase.rpc("entregas_da_rota", { p_semana: semana.id, p_rota: rota.id }),
    supabase.rpc("execucao_da_rota", { p_semana: semana.id, p_rota: rota.id }),
    supabase.rpc("rota_trajeto", { p_rota: rota.id }),
  ]);
  const t = (traj as { trajeto: [number, number][] | null; distancia_m: number | null; duracao_s: number | null; origem_nome: string | null; origem_lat: number | null; origem_lng: number | null }[] | null)?.[0];
  const paradas = (data ?? []) as Parada[];
  const e = (exec as { iniciada_em: string; finalizada_em: string | null }[] | null)?.[0];

  return (
    <>
      {cabecalho}
      <div className="mb-3">
        <h1 className="text-2xl font-bold" style={{ color: rota.cor }}>{rota.nome}</h1>
        <p className="text-stone-600">Semana {dataBR(semana.inicio)} · {semana.sabor ?? "sabor a definir"}</p>
        {rotas.length > 1 && <Link href="/entregador" className="text-sm underline">trocar de rota</Link>}
      </div>
      {semana.sem_producao ? <p className="cartao">Semana sem produção. Nada a entregar.</p>
        : !paradas.length ? <p className="cartao text-stone-500">Nenhuma parada. A gestão já abriu a semana?</p>
        : <EntregadorApp key={`${semana.id}-${rota.id}`} semanaId={semana.id} rotaId={rota.id} paradas={paradas} cor={rota.cor} trajeto={t?.trajeto ?? null} distanciaM={t?.distancia_m ?? null} duracaoS={t?.duracao_s ?? null} origem={t?.origem_lat != null && t?.origem_lng != null ? { lat: t.origem_lat, lng: t.origem_lng, nome: t.origem_nome ?? "Partida" } : null} iniciadaEm={e?.iniciada_em ?? null} finalizadaEm={e?.finalizada_em ?? null} />}
    </>
  );
}

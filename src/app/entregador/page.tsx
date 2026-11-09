import Link from "next/link";
import EntregadorApp, { type Parada } from "@/components/EntregadorApp";
import LogoApp from "@/components/LogoApp";
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
    <header className="mb-6 flex items-center gap-3 py-2">
      <LogoApp tamanho={34} />
      <div className="min-w-0 flex-1 leading-tight"><div className="font-semibold">Entregas</div><div className="truncate text-[13px] text-stone-500">{usuario.nome}</div></div>
      <form action={sair} className="text-sm font-medium text-stone-500"><SairBotao cache="entregador-v1" /></form>
    </header>
  );

  if (!rotas?.length) return <>{cabecalho}<p className="rounded-[28px] bg-white p-6 text-stone-600 shadow-sm">Nenhuma rota atribuída a você. Fale com a gestão.</p></>;
  if (!semana) return <>{cabecalho}<p className="rounded-[28px] bg-white p-6 text-stone-600 shadow-sm">Nenhuma semana planejada.</p></>;

  if (!rota) {
    return (
      <>
        {cabecalho}
        <h1 className="mb-1 text-[32px] font-bold leading-tight tracking-tight">Escolha sua rota</h1>
        <p className="mb-6 text-[17px] text-stone-500">Toque na rota que você vai fazer hoje.</p>
        <div className="flex flex-col gap-3.5">
          {rotas.map((r) => (
            <Link key={r.id} href={`/entregador?rota=${r.id}`} className="group flex items-center gap-4 rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,.04),0_16px_34px_-22px_rgba(28,25,23,.3)] transition active:scale-[.985]">
              <span className="size-4 shrink-0 rounded-full" style={{ background: r.cor }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-semibold leading-tight">{r.nome}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-stone-500">{[r.dia_semana != null ? DIAS_SEMANA[r.dia_semana] : null, r.descricao].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="text-stone-300 transition group-hover:translate-x-0.5">›</span>
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
      <div className="mb-5">
        <h1 className="flex items-center gap-3 text-[32px] font-bold leading-tight tracking-tight"><span className="size-4 shrink-0 rounded-full" style={{ background: rota.cor }} aria-hidden />{rota.nome}</h1>
        <p className="mt-1 text-[17px] text-stone-500">Semana de {dataBR(semana.inicio)} · {semana.sabor ?? "pão a definir"}</p>
        {rotas.length > 1 && <Link href="/entregador" className="mt-1 inline-block text-sm font-medium text-amber-800 underline">trocar de rota</Link>}
      </div>
      {semana.sem_producao ? <p className="rounded-[28px] bg-white p-6 text-stone-600 shadow-sm">Semana sem produção. Nada a entregar.</p>
        : !paradas.length ? <p className="rounded-[28px] bg-white p-6 text-stone-500 shadow-sm">Nenhuma parada. A gestão já planejou a semana?</p>
        : <EntregadorApp key={`${semana.id}-${rota.id}`} semanaId={semana.id} rotaId={rota.id} paradas={paradas} cor={rota.cor} trajeto={t?.trajeto ?? null} distanciaM={t?.distancia_m ?? null} duracaoS={t?.duracao_s ?? null} origem={t?.origem_lat != null && t?.origem_lng != null ? { lat: t.origem_lat, lng: t.origem_lng, nome: t.origem_nome ?? "Partida" } : null} iniciadaEm={e?.iniciada_em ?? null} finalizadaEm={e?.finalizada_em ?? null} />}
    </>
  );
}

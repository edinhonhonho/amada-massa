import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "@/lib/dados";
import { ordenarParadas, type Ponto } from "@/lib/geo";
import { tracarTrajeto } from "@/lib/geocode";

type Coord = { lat: number | null; lng: number | null } | null;

/**
 * Define, para cada rota da semana, a ordem das paradas (vizinho mais próximo a partir do ponto de partida,
 * refinado por 2-opt) e o caminho de bicicleta. Só mexe em quem ainda não foi atendido.
 * Falhas aqui nunca derrubam a página: sem coordenadas ou sem o serviço de rotas, mantém o que já existe.
 */
export async function organizarRotasDaSemana(supabase: SupabaseClient, semanaId: string): Promise<void> {
  try {
    const [{ data: entregas }, { data: rotas }] = await Promise.all([
      supabase.from("entregas").select("id, rota_id, ordem, cliente_id, clientes(nome, lat, lng)").eq("semana_id", semanaId).not("rota_id", "is", null).in("status", ["programada", "reagendada"]),
      supabase.from("rotas").select("id, trajeto, origem:pontos_coleta!rotas_origem_ponto_id_fkey(lat, lng)").eq("ativa", true),
    ]);
    const porRota = new Map<string, NonNullable<typeof entregas>>();
    for (const e of entregas ?? []) (porRota.get(e.rota_id) ?? porRota.set(e.rota_id, []).get(e.rota_id)!).push(e);

    await Promise.all([...porRota.entries()].map(async ([rotaId, lista]) => {
      const rota = (rotas ?? []).find((r) => r.id === rotaId);
      if (!rota) return;
      const origem = um(rota.origem as never) as Coord;
      const com: { id: string; ponto: Ponto }[] = [], sem: { id: string; nome: string }[] = [];
      for (const e of lista) {
        const c = um(e.clientes as never) as ({ nome: string } & NonNullable<Coord>) | null;
        if (c?.lat != null && c?.lng != null) com.push({ id: e.id, ponto: { lat: c.lat, lng: c.lng } });
        else sem.push({ id: e.id, nome: c?.nome ?? "" });
      }
      const inicio: Ponto | null = origem?.lat != null && origem?.lng != null ? { lat: origem.lat, lng: origem.lng } : com[0]?.ponto ?? null;
      const ordenados = inicio && com.length ? ordenarParadas(inicio, com.map((p) => p.ponto)).map((i) => com[i]) : com;
      sem.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const idsEmOrdem = [...ordenados.map((p) => p.id), ...sem.map((s) => s.id)];

      const atual = new Map(lista.map((e) => [e.id, e.ordem]));
      const mudou = idsEmOrdem.filter((id, i) => atual.get(id) !== i + 1);
      await Promise.all(mudou.map((id) => supabase.from("entregas").update({ ordem: idsEmOrdem.indexOf(id) + 1 }).eq("id", id)));

      if ((mudou.length || !rota.trajeto) && inicio && ordenados.length) {
        const t = await tracarTrajeto([inicio, ...ordenados.map((p) => p.ponto)]);
        if (!t.aproximado) await supabase.from("rotas").update({ trajeto: t.pontos, distancia_m: t.distancia_m, duracao_s: t.duracao_s }).eq("id", rotaId);
      }
    }));
  } catch (e) {
    console.error("organizarRotasDaSemana", e);
  }
}

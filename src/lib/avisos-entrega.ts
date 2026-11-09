import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificar } from "@/lib/notificar";
import { textoEntregue, textoNaoEntregue, textoProximo, textoRotaIniciada, textoSabor, type Aviso } from "@/lib/avisos";

/** Rota iniciada: avisa todos os clientes das paradas; o primeiro também ganha "você é o próximo". */
export async function avisarRotaIniciada(semanaId: string, rotaId: string, entregador: string) {
  try {
    const admin = createAdminClient();
    const [{ data: semana }, { data: paradas }] = await Promise.all([
      admin.from("semanas").select("sabor").eq("id", semanaId).single(),
      admin.from("entregas").select("id, cliente_id").eq("semana_id", semanaId).eq("rota_id", rotaId)
        .in("status", ["programada", "reagendada"]).order("ordem"),
    ]);
    const t = textoRotaIniciada({ sabor: semana?.sabor, entregador });
    const avisos: Aviso[] = (paradas ?? []).map((p) => ({ cliente_id: p.cliente_id, tipo: "rota_iniciada", ...t, ref: `${semanaId}:${rotaId}` }));
    if (paradas?.[0]) avisos.push({ cliente_id: paradas[0].cliente_id, tipo: "proximo", ...textoProximo({ entregador }), ref: paradas[0].id });
    await notificar(avisos);
  } catch (e) {
    console.error("avisarRotaIniciada", e);
  }
}

/** Parada concluída: avisa o resultado ao cliente e "você é o próximo" ao seguinte da fila. */
export async function avisarResultado(entregaId: string, entregador: string) {
  try {
    const admin = createAdminClient();
    const { data: e } = await admin.from("entregas")
      .select("id, cliente_id, status, entregue_em, semana_id, rota_id, ordem").eq("id", entregaId).single();
    if (!e || !["entregue", "nao_entregue"].includes(e.status)) return;
    const em = e.entregue_em ?? new Date().toISOString();
    const avisos: Aviso[] = [{
      cliente_id: e.cliente_id, tipo: e.status, ref: e.id,
      ...(e.status === "entregue" ? textoEntregue({ entregador, em }) : textoNaoEntregue({ entregador, em })),
    }];
    if (e.rota_id) {
      const { data: prox } = await admin.from("entregas").select("id, cliente_id")
        .eq("semana_id", e.semana_id).eq("rota_id", e.rota_id).in("status", ["programada", "reagendada"])
        .gt("ordem", e.ordem).order("ordem").limit(1);
      if (prox?.[0]) avisos.push({ cliente_id: prox[0].cliente_id, tipo: "proximo", ref: prox[0].id, ...textoProximo({ entregador }) });
    }
    await notificar(avisos);
  } catch (err) {
    console.error("avisarResultado", err);
  }
}

/** O pão da semana vai para todos os clientes ativos. */
export async function avisarSabor(semanaId: string, sabor: string) {
  const t = textoSabor(sabor);
  const { data } = await createAdminClient().from("clientes").select("id").eq("status", "ativo").range(0, 4999);
  const ids = (data ?? []).map((c) => c.id);
  await notificar(ids.map((id) => ({ cliente_id: id, tipo: "sabor", ...t, ref: semanaId })));
  return ids.length;
}

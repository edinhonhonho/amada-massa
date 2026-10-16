"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth";

export type ItemFila = { id: string; status: "entregue" | "nao_entregue" | "programada"; ocorrencia?: string | null; em: string };

/** Registra uma parada. Chamada pelo celular do entregador, inclusive ao sincronizar a fila offline. */
export async function registrarEntrega(item: ItemFila): Promise<{ ok: boolean; erro?: string }> {
  const { supabase } = await usuarioAtual();
  const { error } = await supabase.rpc("marcar_entrega", {
    p_id: item.id,
    p_status: item.status,
    p_ocorrencia: item.ocorrencia ?? null,
    p_em: item.em,
  });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/entregas/historico");
  return { ok: true };
}

/** Pendências: reagendar ou devolver à programação (equipe). */
export async function tratarPendencia(f: FormData) {
  const { supabase } = await usuarioAtual();
  await supabase.rpc("marcar_entrega", {
    p_id: String(f.get("id")),
    p_status: String(f.get("status")),
    p_ocorrencia: String(f.get("ocorrencia") ?? "") || null,
  });
  revalidatePath("/entregas/historico");
}

"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";

/** Pendências: reagendar ou devolver à programação (equipe). */
export async function tratarPendencia(f: FormData) {
  const { supabase } = await exigirEquipe();
  await supabase.rpc("marcar_entrega", {
    p_id: String(f.get("id")),
    p_status: String(f.get("status")),
    p_ocorrencia: String(f.get("ocorrencia") ?? "") || null,
  });
  revalidatePath("/entregas/historico");
}

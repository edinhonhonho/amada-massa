"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";

/** Marca retirada/entrega pela equipe (lista de coleta). */
export async function marcarPelaEquipe(f: FormData) {
  const { supabase } = await exigirEquipe();
  await supabase.rpc("marcar_entrega", {
    p_id: String(f.get("id")),
    p_status: String(f.get("status")),
    p_ocorrencia: (f.get("ocorrencia") as string) || null,
  });
  revalidatePath(`/semanas/${String(f.get("semana_id"))}/listas/coleta`);
  revalidatePath(`/semanas/${String(f.get("semana_id"))}/listas/entrega`);
}

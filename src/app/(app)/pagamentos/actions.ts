"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, exigirEquipe } from "@/lib/auth";
import { hojeISO, paraCentavos } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

async function recalcular(supabase: SupabaseClient, cobrancaId: string) {
  const [{ data: c }, { data: pags }] = await Promise.all([
    supabase.from("cobrancas").select("valor_centavos, status").eq("id", cobrancaId).single(),
    supabase.from("pagamentos").select("valor_centavos").eq("cobranca_id", cobrancaId),
  ]);
  if (!c || c.status === "isenta" || c.status === "cancelada") return;
  const pago = (pags ?? []).reduce((s, p) => s + p.valor_centavos, 0);
  await supabase.from("cobrancas").update({ status: pago >= c.valor_centavos ? "paga" : "pendente" }).eq("id", cobrancaId);
  // pagamento baixado devolve a entrega ao planejamento (spec 9)
  await supabase.rpc("reavaliar_entregas");
}

export async function darBaixa(f: FormData) {
  const { supabase, usuario } = await exigirEquipe();
  const cobrancaId = String(f.get("cobranca_id"));
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  if (!valor || valor <= 0) return;
  await supabase.from("pagamentos").insert({
    cobranca_id: cobrancaId,
    valor_centavos: valor,
    data: txt(f, "data") ?? hojeISO(),
    forma: txt(f, "forma") ?? "pix",
    observacao: txt(f, "observacao"),
    usuario_id: usuario.id,
  });
  await recalcular(supabase, cobrancaId);
  revalidatePath("/pagamentos");
}

export async function estornarPagamento(f: FormData) {
  const { supabase } = await exigirAdmin();
  const cobrancaId = String(f.get("cobranca_id"));
  await supabase.from("pagamentos").delete().eq("id", String(f.get("pagamento_id")));
  await recalcular(supabase, cobrancaId);
  revalidatePath("/pagamentos");
}

/** Ajusta valor (com justificativa) ou isenta/cancela/reabre a cobrança. */
export async function ajustarCobranca(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("cobranca_id"));
  const justificativa = txt(f, "justificativa");
  const acao = String(f.get("acao"));
  if (acao === "valor") {
    const valor = paraCentavos(String(f.get("valor") ?? ""));
    if (valor === null || !justificativa) return;
    await supabase.from("cobrancas").update({ valor_centavos: valor, justificativa }).eq("id", id);
    await recalcular(supabase, id);
  } else if (acao === "isentar" || acao === "cancelar") {
    if (!justificativa) return;
    await supabase.from("cobrancas").update({ status: acao === "isentar" ? "isenta" : "cancelada", justificativa }).eq("id", id);
    await supabase.rpc("reavaliar_entregas");
  } else if (acao === "reabrir") {
    await supabase.from("cobrancas").update({ status: "pendente" }).eq("id", id);
    await recalcular(supabase, id);
  }
  revalidatePath("/pagamentos");
}

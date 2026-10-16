"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const refresh = (id: string) => { revalidatePath(`/semanas/${id}`); revalidatePath("/semanas"); };

export async function criarSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const inicio = txt(f, "inicio");
  if (!inicio) return;
  const { data, error } = await supabase.from("semanas").insert({ inicio, fim: adicionarDias(inicio, 6), sabor: txt(f, "sabor") }).select("id").single();
  if (error) redirect("/semanas/nova?erro=duplicada");
  redirect(`/semanas/${data.id}`);
}

export async function salvarSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  await supabase.from("semanas").update({
    sabor: txt(f, "sabor"), descricao: txt(f, "descricao"), ingredientes: txt(f, "ingredientes"),
    alergenos: txt(f, "alergenos"), observacao: txt(f, "observacao"), status: String(f.get("status")),
  }).eq("id", id);
  refresh(id);
}

export async function abrirSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  await supabase.rpc("gerar_cobrancas", { p_competencia: hojeISO() });
  await supabase.rpc("gerar_entregas", { p_semana: id });
  await supabase.rpc("reavaliar_entregas");
  refresh(id);
}

export async function alternarListaFechada(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  await supabase.from("semanas").update({ lista_fechada: f.get("fechar") === "1" }).eq("id", id);
  if (f.get("fechar") !== "1") await supabase.rpc("reavaliar_entregas");
  refresh(id);
}

/** Semana sem produção (feriado): ninguém recebe, sem mexer nas assinaturas. */
export async function alternarSemProducao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const ligar = f.get("ligar") === "1";
  await supabase.from("semanas").update({ sem_producao: ligar }).eq("id", id);
  if (ligar) {
    await supabase.from("entregas").update({ status: "pulada", observacao: "Semana sem produção" })
      .eq("semana_id", id).in("status", ["programada", "suspensa_atraso", "reagendada"]);
  } else {
    await supabase.from("entregas").update({ status: "programada", observacao: null })
      .eq("semana_id", id).eq("status", "pulada").eq("observacao", "Semana sem produção");
    await supabase.rpc("gerar_entregas", { p_semana: id });
    await supabase.rpc("reavaliar_entregas");
  }
  refresh(id);
}

/** Cliente não recebe nesta semana, sem pausar a assinatura (spec 8). */
export async function alternarPulo(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const assinatura = String(f.get("assinatura_id"));
  if (f.get("pular") === "1") {
    await supabase.from("pulos_semana").upsert({ semana_id: semana, assinatura_id: assinatura, motivo: txt(f, "motivo") });
    await supabase.from("entregas").update({ status: "pulada", observacao: txt(f, "motivo") ?? "Pulou a semana" })
      .eq("semana_id", semana).eq("assinatura_id", assinatura).in("status", ["programada", "suspensa_atraso", "reagendada"]);
  } else {
    await supabase.from("pulos_semana").delete().eq("semana_id", semana).eq("assinatura_id", assinatura);
    await supabase.from("entregas").update({ status: "programada", observacao: null })
      .eq("semana_id", semana).eq("assinatura_id", assinatura).eq("status", "pulada");
    await supabase.rpc("gerar_entregas", { p_semana: semana });
    await supabase.rpc("reavaliar_entregas");
  }
  refresh(semana);
}

export async function excluirSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const { count } = await supabase.from("entregas").select("*", { count: "exact", head: true }).eq("semana_id", id).in("status", ["entregue", "retirada", "nao_entregue"]);
  if (count) return; // histórico real: não apaga
  await supabase.from("semanas").delete().eq("id", id);
  revalidatePath("/semanas");
  redirect("/semanas");
}

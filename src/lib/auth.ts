import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Perfil = "admin" | "operacao" | "entregador";

export async function usuarioAtual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: u } = await supabase
    .from("usuarios")
    .select("id, nome, perfil, ativo")
    .eq("id", data.user.id)
    .single();
  if (!u) {
    // conta de membro (cliente) ou sem vínculo: nunca é equipe
    const { data: m } = await supabase.from("membros").select("user_id").eq("user_id", data.user.id).maybeSingle();
    redirect(m ? "/membro" : "/sem-acesso");
  }
  if (!u.ativo) redirect("/sem-acesso?motivo=inativo");
  return { supabase, usuario: u as { id: string; nome: string; perfil: Perfil; ativo: boolean } };
}

/** Páginas de gestão: bloqueia o entregador. */
export async function exigirEquipe() {
  const ctx = await usuarioAtual();
  if (ctx.usuario.perfil === "entregador") redirect("/entregador");
  return ctx;
}

export async function exigirAdmin() {
  const ctx = await usuarioAtual();
  if (ctx.usuario.perfil !== "admin") redirect("/");
  return ctx;
}

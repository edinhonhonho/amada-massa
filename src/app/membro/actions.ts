"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type R = { ok: boolean; erro?: string };
const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Pede o código por e-mail. Só envia se o e-mail estiver na ficha de um cliente não cancelado.
 * A resposta é sempre a mesma, para não revelar quem é cliente.
 */
async function pedirCodigo(entrada: string): Promise<R> {
  const parsed = emailSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: "Informe um e-mail válido." };
  const email = parsed.data;
  const admin = createAdminClient();

  const { data: clientes, error: erroBusca } = await admin.from("clientes").select("id").eq("email", email).neq("status", "cancelado").order("criado_em").limit(1);
  if (erroBusca) throw erroBusca; // vira "serviço indisponível", não "e-mail não cadastrado"
  const cliente = clientes?.[0];
  if (!cliente) return { ok: true };

  const { data: membro } = await admin.from("membros").select("user_id").eq("cliente_id", cliente.id).maybeSingle();
  if (!membro) {
    const criado = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { membro: true } });
    // e-mail já pertence a outra conta (ex.: da equipe): não vincula nem envia
    if (criado.error || !criado.data.user) return { ok: true };
    const { error } = await admin.from("membros").insert({ user_id: criado.data.user.id, cliente_id: cliente.id });
    if (error) {
      await admin.auth.admin.deleteUser(criado.data.user.id);
      return { ok: true };
    }
  } else {
    // o e-mail da ficha mudou desde o primeiro acesso: acompanha
    const { data: u } = await admin.auth.admin.getUserById(membro.user_id);
    if (u.user && u.user.email !== email) await admin.auth.admin.updateUserById(membro.user_id, { email, email_confirm: true });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    if (error.status === 429) return { ok: false, erro: "Aguarde um minuto antes de pedir outro código." };
    console.error("signInWithOtp", error.message);
    return { ok: false, erro: "Não foi possível enviar o código agora. Tente de novo em instantes." };
  }
  return { ok: true };
}

async function conferirCodigo(entrada: string, codigo: string): Promise<R> {
  const parsed = emailSchema.safeParse(entrada);
  const token = codigo.replace(/\s/g, "");
  if (!parsed.success || !/^\d{6,10}$/.test(token)) return { ok: false, erro: "Código inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: parsed.data, token, type: "email" });
  if (error || !data.user) return { ok: false, erro: "Código inválido ou expirado." };

  const { data: membro } = await createAdminClient().from("membros").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!membro) {
    await supabase.auth.signOut();
    return { ok: false, erro: "Este e-mail não é de um membro." };
  }
  return { ok: true };
}

async function gravarInscricao(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<R> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, erro: "Sessão expirada." };
  const { data: m } = await supabase.from("membros").select("cliente_id").eq("user_id", auth.user.id).maybeSingle();
  if (!m) return { ok: false, erro: "Conta sem vínculo com cliente." };
  if (!sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, erro: "Inscrição inválida." };

  // upsert pelo servidor: o mesmo aparelho pode ter pertencido a outra conta
  const { error } = await createAdminClient().from("push_inscricoes").upsert(
    { user_id: auth.user.id, cliente_id: m.cliente_id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function removerInscricao(endpoint: string): Promise<R> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_inscricoes").delete().eq("endpoint", endpoint);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function marcarLidas(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notificacoes").update({ lida_em: new Date().toISOString() }).is("lida_em", null);
}

export async function sairMembro() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/membro/entrar");
}

const INDISPONIVEL: R = { ok: false, erro: "Serviço indisponível no momento. Tente de novo em instantes." };
async function seguro(fn: () => Promise<R>): Promise<R> {
  try { return await fn(); } catch (e) { console.error("ação do membro falhou", e); return INDISPONIVEL; }
}

export async function solicitarCodigo(entrada: string): Promise<R> { return seguro(() => pedirCodigo(entrada)); }
export async function verificarCodigo(entrada: string, codigo: string): Promise<R> { return seguro(() => conferirCodigo(entrada, codigo)); }
export async function salvarInscricao(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<R> {
  return seguro(() => gravarInscricao(sub, userAgent));
}

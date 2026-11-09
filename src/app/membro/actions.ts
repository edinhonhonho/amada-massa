"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enviarPush } from "@/lib/notificar";
import { chaveTelefone } from "@/lib/telefone";

type R = { ok: boolean; erro?: string };
const emailSchema = z.string().trim().toLowerCase().email();

const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 25;
const JANELA_MIN = 15;
const NAO_CONFERE = "E-mail ou telefone não conferem com o cadastro do clube.";

type Admin = ReturnType<typeof createAdminClient>;

async function tentativas(admin: Admin, chave: string): Promise<number> {
  const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
  const { count } = await admin.from("tentativas_login").select("id", { count: "exact", head: true }).eq("chave", chave).gte("criada_em", desde);
  return count ?? 0;
}

/** Cria (ou reaproveita) a conta de acesso do cliente. O e-mail real é preferido; se for de outra conta, usa um apelido com "+". */
async function contaDoMembro(admin: Admin, cliente: { id: string }, email: string): Promise<string | null> {
  const { data: membro } = await admin.from("membros").select("user_id").eq("cliente_id", cliente.id).maybeSingle();
  if (membro) {
    const { data: u } = await admin.auth.admin.getUserById(membro.user_id);
    return u.user?.email ?? null;
  }
  const [local, dominio] = email.split("@");
  const candidatos = [email, `${local}+m${cliente.id.slice(0, 8)}@${dominio}`];
  for (const e of candidatos) {
    const criado = await admin.auth.admin.createUser({ email: e, email_confirm: true, app_metadata: { membro: true } });
    if (criado.error || !criado.data.user) continue;
    const { error } = await admin.from("membros").insert({ user_id: criado.data.user.id, cliente_id: cliente.id });
    if (error) {
      await admin.auth.admin.deleteUser(criado.data.user.id);
      // outra tentativa simultânea já criou o vínculo
      const { data: m } = await admin.from("membros").select("user_id").eq("cliente_id", cliente.id).maybeSingle();
      if (m) return (await admin.auth.admin.getUserById(m.user_id)).data.user?.email ?? null;
      return null;
    }
    return e;
  }
  return null;
}

/**
 * Entra no app com o e-mail e o telefone que estão no cadastro do clube. Não envia e-mail nenhum:
 * o servidor confere os dois dados e abre a sessão. Tentativas erradas são limitadas por e-mail e por endereço.
 */
async function entrar(entradaEmail: string, entradaTelefone: string): Promise<R> {
  const parsed = emailSchema.safeParse(entradaEmail);
  if (!parsed.success) return { ok: false, erro: "Informe um e-mail válido." };
  const chave = chaveTelefone(entradaTelefone);
  if (!chave) return { ok: false, erro: "Informe o telefone com DDD, por exemplo (51) 99999-8888." };
  const email = parsed.data;
  const admin = createAdminClient();

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  const [porEmail, porIp] = await Promise.all([tentativas(admin, `email:${email}`), tentativas(admin, `ip:${ip}`)]);
  if (porEmail >= MAX_POR_EMAIL || porIp >= MAX_POR_IP) {
    return { ok: false, erro: `Muitas tentativas. Aguarde ${JANELA_MIN} minutos e tente de novo.` };
  }

  const { data: candidatos, error: erroBusca } = await admin.from("clientes").select("id, email, whatsapp").ilike("email", email.replace(/[\\%_]/g, "\\$&")).neq("status", "cancelado").order("criado_em").limit(10);
  if (erroBusca) throw erroBusca; // vira "serviço indisponível", não "dados não conferem"
  const cliente = (candidatos ?? []).find((c) => c.email?.trim().toLowerCase() === email && chaveTelefone(c.whatsapp) === chave);
  if (!cliente) {
    await admin.from("tentativas_login").insert([{ chave: `email:${email}` }, { chave: `ip:${ip}` }]);
    // limpeza oportunista das tentativas antigas
    await admin.from("tentativas_login").delete().lt("criada_em", new Date(Date.now() - 24 * 3600_000).toISOString());
    return { ok: false, erro: NAO_CONFERE };
  }

  const emailConta = await contaDoMembro(admin, cliente, email);
  if (!emailConta) return INDISPONIVEL;

  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailConta });
  if (erroLink || !link.properties?.hashed_token) throw erroLink ?? new Error("link de acesso não gerado");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (error || !data.user) throw error ?? new Error("sessão não aberta");
  await admin.from("membros").update({ ultimo_acesso: new Date().toISOString() }).eq("user_id", data.user.id);
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

/** Manda uma notificação de teste para os aparelhos deste cliente e diz o que aconteceu. */
export async function testarNotificacao(): Promise<{ ok: boolean; mensagem: string }> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };
    const admin = createAdminClient();
    const { data: subs } = await admin.from("push_inscricoes").select("id, cliente_id, endpoint, p256dh, auth").eq("user_id", auth.user.id);
    if (!subs?.length) return { ok: false, mensagem: "Este aparelho ainda não está inscrito. Toque em Ativar avisos." };
    const r = await enviarPush(subs, () => [{ title: "Teste do Amada Massa 🍞", body: "Deu certo: os avisos chegam neste aparelho.", url: "/membro", tag: "teste" }]);
    if (r.mortas.length) await admin.from("push_inscricoes").delete().in("id", r.mortas);
    if (r.enviados > 0) return { ok: true, mensagem: `Enviado para ${r.enviados} ${r.enviados === 1 ? "aparelho" : "aparelhos"}. Se não aparecer em alguns segundos, confira as notificações do app nas configurações do celular.` };
    return { ok: false, mensagem: r.erro ?? "Não foi possível enviar o teste." };
  } catch (e) {
    console.error("testarNotificacao", e);
    return { ok: false, mensagem: "Serviço indisponível no momento." };
  }
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

export async function entrarNoApp(email: string, telefone: string): Promise<R> { return seguro(() => entrar(email, telefone)); }
export async function salvarInscricao(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<R> {
  return seguro(() => gravarInscricao(sub, userAgent));
}

import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Aviso } from "@/lib/avisos";

function configurarPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://localhost", pub, priv);
  return true;
}

/**
 * Grava os avisos na caixa do membro e dispara o push. Avisos com `ref` repetido
 * (mesmo cliente, tipo e ref) são ignorados, então desfazer e refazer uma entrega não avisa de novo.
 * Nunca lança erro: aviso é complemento e não pode derrubar o registro da entrega.
 */
export async function notificar(avisos: Aviso[]): Promise<void> {
  try {
    if (!avisos.length) return;
    const admin = createAdminClient();

    // só quem tem conta de membro tem caixa de entrada
    const { data: membros } = await admin.from("membros").select("cliente_id").in("cliente_id", [...new Set(avisos.map((a) => a.cliente_id))]);
    const comConta = new Set((membros ?? []).map((m) => m.cliente_id));
    const alvo = avisos.filter((a) => comConta.has(a.cliente_id));

    const novos: Aviso[] = [];
    for (let i = 0; i < alvo.length; i += 10) {
      await Promise.all(
        alvo.slice(i, i + 10).map(async (a) => {
          const { error } = await admin.from("notificacoes").insert({
            cliente_id: a.cliente_id, tipo: a.tipo, titulo: a.titulo, corpo: a.corpo, url: a.url ?? "/membro", ref: a.ref ?? null,
          });
          if (!error) novos.push(a);
        }),
      );
    }
    if (!novos.length || !configurarPush()) return;

    const { data: inscricoes } = await admin
      .from("push_inscricoes").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", [...new Set(novos.map((a) => a.cliente_id))]);
    const mortas: string[] = [];
    await Promise.all(
      (inscricoes ?? []).flatMap((s) =>
        novos.filter((a) => a.cliente_id === s.cliente_id).map(async (a) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: a.titulo, body: a.corpo, url: a.url ?? "/membro", tag: a.tipo }),
              { TTL: 60 * 60 * 12 },
            );
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) mortas.push(s.id);
          }
        }),
      ),
    );
    if (mortas.length) await admin.from("push_inscricoes").delete().in("id", mortas);
  } catch (e) {
    console.error("falha ao notificar", e);
  }
}

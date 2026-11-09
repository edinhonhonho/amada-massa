import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Aviso } from "@/lib/avisos";
import { limparChavePrivada, limparChavePublica, problemasVapid } from "@/lib/vapid";

const limpa = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "");

/** Contato que o serviço de push exige. Aceita VAPID_SUBJECT; sem ele, usa o endereço público do site. */
function assunto(): string {
  const s = limpa(process.env.VAPID_SUBJECT);
  if (/^(mailto:|https:\/\/)/.test(s) && !s.includes("localhost")) return s;
  const site = limpa(process.env.NEXT_PUBLIC_SITE_URL);
  if (site.startsWith("https://") && !site.includes("localhost")) return site;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://amadamassa.vercel.app";
}

const chavePublica = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const chavePrivada = () => process.env.VAPID_PRIVATE_KEY;

/** O que impede os avisos de chegarem no celular, em português. Lista vazia quando está tudo certo. */
export function diagnosticoPush(): string[] {
  return problemasVapid(chavePublica(), chavePrivada());
}

function configurarPush(): string | null {
  const problemas = diagnosticoPush();
  if (problemas.length) return problemas[0];
  try {
    webpush.setVapidDetails(assunto(), limparChavePublica(chavePublica()), limparChavePrivada(chavePrivada()));
    return null;
  } catch (e) {
    return `As chaves de notificação não foram aceitas (${e instanceof Error ? e.message : "erro desconhecido"}).`;
  }
}

/** Traduz a recusa do serviço de push numa frase que a equipe entende. */
export function explicarErroPush(e: unknown): string {
  const status = (e as { statusCode?: number }).statusCode;
  const corpo = String((e as { body?: string }).body ?? "").slice(0, 120);
  if (status === 404 || status === 410) return "O aparelho cancelou a inscrição; é preciso ativar os avisos de novo no app.";
  if (status === 403 && /do not correspond|credentials/i.test(corpo + String((e as Error).message))) return "Este aparelho foi inscrito com chaves de notificação antigas. Abra o app Amada Massa nele: o app se inscreve de novo sozinho com as chaves atuais.";
  if (status === 401 || status === 403) return `O serviço de notificações recusou as chaves (${status}). Confira VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_SUBJECT na Vercel e faça redeploy. ${corpo}`.trim();
  if (status === 400) return `Pedido recusado pelo serviço de notificações (400). ${corpo}`.trim();
  return `${status ? `Erro ${status}. ` : ""}${e instanceof Error ? e.message : "Falha ao enviar."} ${corpo}`.trim();
}

type Inscricao = { id: string; cliente_id: string; endpoint: string; p256dh: string; auth: string };
export type ResultadoPush = { enviados: number; falhas: number; mortas: string[]; erro?: string };

/** Envia um push a cada inscrição. Nunca lança: devolve o que deu certo, o que falhou e o motivo da última falha. */
export async function enviarPush(inscricoes: Inscricao[], carga: (s: Inscricao) => { title: string; body: string; url: string; tag?: string }[]): Promise<ResultadoPush> {
  const r: ResultadoPush = { enviados: 0, falhas: 0, mortas: [] };
  const erroConfig = configurarPush();
  if (erroConfig) { r.erro = erroConfig; r.falhas = inscricoes.length; return r; }
  await Promise.all(
    inscricoes.flatMap((s) =>
      carga(s).map(async (c) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: c.title, body: c.body, url: c.url, tag: c.tag }),
            { TTL: 60 * 60 * 12, urgency: "high" },
          );
          r.enviados++;
        } catch (e) {
          r.falhas++;
          const status = (e as { statusCode?: number }).statusCode;
          const corpo = String((e as { body?: string }).body ?? "");
          // inscrição feita com outro par de chaves nunca mais funciona: sai da lista até o app se inscrever de novo
          if (status === 404 || status === 410 || (status === 403 && /do not correspond/i.test(corpo))) r.mortas.push(s.id);
          r.erro = explicarErroPush(e);
          console.error("push recusado", status, (e as { body?: string }).body ?? (e as Error).message);
        }
      }),
    ),
  );
  return r;
}

export type ResultadoNotificar = { gravados: number; pushes: number; falhas: number; erro?: string };

/**
 * Grava os avisos na caixa do cliente e dispara o push. O aviso fica guardado mesmo para quem
 * ainda não entrou no app: aparece na primeira vez que a pessoa entrar. Avisos com `ref` repetido
 * (mesmo cliente, tipo e ref) são ignorados, então desfazer e refazer uma entrega não avisa de novo.
 * Nunca lança erro: aviso é complemento e não pode derrubar o registro da entrega.
 */
export async function notificar(avisos: Aviso[]): Promise<ResultadoNotificar> {
  const vazio = { gravados: 0, pushes: 0, falhas: 0 };
  try {
    if (!avisos.length) return vazio;
    const admin = createAdminClient();

    const novos: Aviso[] = [];
    for (let i = 0; i < avisos.length; i += 10) {
      await Promise.all(
        avisos.slice(i, i + 10).map(async (a) => {
          const { error } = await admin.from("notificacoes").insert({
            cliente_id: a.cliente_id, tipo: a.tipo, titulo: a.titulo, corpo: a.corpo, url: a.url ?? "/membro", ref: a.ref ?? null, aviso_id: a.aviso_id ?? null,
          });
          if (!error) novos.push(a);
        }),
      );
    }
    if (!novos.length) return vazio;

    const { data: inscricoes } = await admin
      .from("push_inscricoes").select("id, cliente_id, endpoint, p256dh, auth").in("cliente_id", [...new Set(novos.map((a) => a.cliente_id))]);
    const r = await enviarPush(inscricoes ?? [], (s) =>
      novos.filter((a) => a.cliente_id === s.cliente_id).map((a) => ({ title: a.titulo, body: a.corpo, url: a.url ?? "/membro", tag: a.ref ?? a.tipo })),
    );
    if (r.mortas.length) await admin.from("push_inscricoes").delete().in("id", r.mortas);
    return { gravados: novos.length, pushes: r.enviados, falhas: r.falhas, erro: r.erro };
  } catch (e) {
    console.error("falha ao notificar", e);
    return vazio;
  }
}

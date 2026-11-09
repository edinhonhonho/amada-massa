import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalizar } from "@/lib/avisos";
import { notificar } from "@/lib/notificar";
import { resolverDestinatarios } from "@/lib/destinatarios";

export type ResultadoEnvio = { id: string | null; destinatarios: number; pushes: number };

/**
 * Envia um aviso da equipe pelo app Amada Massa: grava o histórico, personaliza o texto
 * de cada pessoa ({nome}, {valor}, {vencimento}) e dispara o push para quem ativou.
 */
export async function enviarAviso(p: { titulo: string; corpo: string; segmento: string; rotulo: string; enviadoPor: string }): Promise<ResultadoEnvio> {
  const admin = createAdminClient();
  const pessoas = await resolverDestinatarios(admin, p.segmento);
  if (!pessoas.length) return { id: null, destinatarios: 0, pushes: 0 };

  const { data: aviso, error } = await admin.from("avisos")
    .insert({ titulo: p.titulo, corpo: p.corpo, segmento: p.segmento, segmento_rotulo: p.rotulo, destinatarios: pessoas.length, enviado_por: p.enviadoPor })
    .select("id").single();
  if (error || !aviso) throw error ?? new Error("não foi possível registrar o aviso");

  const { pushes } = await notificar(
    pessoas.map((x) => ({
      cliente_id: x.cliente_id, tipo: "aviso", aviso_id: aviso.id, ref: `aviso:${aviso.id}`,
      titulo: personalizar(p.titulo, { nome: x.nome, valor: x.valor, vencimento: x.vencimento }),
      corpo: personalizar(p.corpo, { nome: x.nome, valor: x.valor, vencimento: x.vencimento }),
    })),
  );
  await admin.from("avisos").update({ pushes }).eq("id", aviso.id);
  return { id: aviso.id, destinatarios: pessoas.length, pushes };
}

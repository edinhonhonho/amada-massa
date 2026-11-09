import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalizar, type Aviso } from "@/lib/avisos";
import { notificar } from "@/lib/notificar";
import { resolverDestinatarios, type Destinatario } from "@/lib/destinatarios";

export type ResultadoEnvio = { id: string | null; destinatarios: number; pushes: number; falhas: number; erro?: string };

/** Texto do aviso já personalizado para cada pessoa ({nome}, {valor}, {vencimento}), no título e na mensagem. */
export function avisosPara(aviso: { id: string; titulo: string; corpo: string }, pessoas: Destinatario[]): Aviso[] {
  return pessoas.map((x) => {
    const vars = { nome: x.nome, valor: x.valor, vencimento: x.vencimento };
    return { cliente_id: x.cliente_id, tipo: "aviso", aviso_id: aviso.id, ref: `aviso:${aviso.id}`, titulo: personalizar(aviso.titulo, vars), corpo: personalizar(aviso.corpo, vars) };
  });
}

/** Os mesmos destinatários, sempre na mesma ordem: os envios em lotes dependem disso. */
export async function destinatariosOrdenados(segmento: string): Promise<Destinatario[]> {
  const pessoas = await resolverDestinatarios(createAdminClient(), segmento);
  return [...pessoas].sort((a, b) => a.cliente_id.localeCompare(b.cliente_id));
}

/** Envio de uma vez, para avisos pequenos (um cliente). Para muita gente, use os lotes de mensagens/actions. */
export async function enviarAviso(p: { titulo: string; corpo: string; segmento: string; rotulo: string; enviadoPor: string }): Promise<ResultadoEnvio> {
  const admin = createAdminClient();
  const pessoas = await destinatariosOrdenados(p.segmento);
  if (!pessoas.length) return { id: null, destinatarios: 0, pushes: 0, falhas: 0 };

  const { data: aviso, error } = await admin.from("avisos")
    .insert({ titulo: p.titulo, corpo: p.corpo, segmento: p.segmento, segmento_rotulo: p.rotulo, destinatarios: pessoas.length, enviado_por: p.enviadoPor })
    .select("id").single();
  if (error || !aviso) throw error ?? new Error("não foi possível registrar o aviso");

  const r = await notificar(avisosPara({ id: aviso.id, titulo: p.titulo, corpo: p.corpo }, pessoas));
  await admin.from("avisos").update({ pushes: r.pushes }).eq("id", aviso.id);
  return { id: aviso.id, destinatarios: pessoas.length, pushes: r.pushes, falhas: r.falhas, erro: r.erro };
}

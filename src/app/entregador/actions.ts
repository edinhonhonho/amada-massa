"use server";

import { usuarioAtual } from "@/lib/auth";
import { avisarResultado, avisarRotaIniciada } from "@/lib/avisos-entrega";

type Resultado = { ok: boolean; erro?: string };

/** Início da rota. O aviso aos membros sai só na primeira vez. */
export async function iniciarRota(i: { semana: string; rota: string; em: string }): Promise<Resultado> {
  const { supabase, usuario } = await usuarioAtual();
  const { data, error } = await supabase.rpc("iniciar_rota", { p_semana: i.semana, p_rota: i.rota, p_em: i.em });
  if (error) return { ok: false, erro: error.message };
  if (data === true) await avisarRotaIniciada(i.semana, i.rota, usuario.nome);
  return { ok: true };
}

export async function finalizarRota(i: { semana: string; rota: string; em: string }): Promise<Resultado> {
  const { supabase } = await usuarioAtual();
  const { error } = await supabase.rpc("finalizar_rota", { p_semana: i.semana, p_rota: i.rota, p_em: i.em });
  return error ? { ok: false, erro: error.message } : { ok: true };
}

/** Registra uma parada (também chamada ao sincronizar a fila offline). */
export async function registrarEntrega(i: {
  id: string; status: "entregue" | "nao_entregue" | "programada";
  ocorrencia?: string | null; observacao?: string | null; fotoPath?: string | null; em: string;
}): Promise<Resultado> {
  const { supabase, usuario } = await usuarioAtual();
  const { error } = await supabase.rpc("marcar_entrega", {
    p_id: i.id, p_status: i.status, p_ocorrencia: i.ocorrencia ?? null,
    p_observacao: i.observacao ?? null, p_em: i.em, p_foto_path: i.fotoPath ?? null,
  });
  if (error) return { ok: false, erro: error.message };
  if (i.status !== "programada") await avisarResultado(i.id, usuario.nome);
  return { ok: true };
}

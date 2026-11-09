"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";

export type PayloadRota = {
  id?: string;
  nome: string;
  descricao: string;
  cor: string;
  dia_semana: number | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  entregador_id: string | null;
  capacidade_paes: number | null;
  ativa: boolean;
  origem_ponto_id: string | null;
  bairros: string[];
};
export type ResultadoRota = { ok: true; id: string } | { ok: false; erro: string };

/**
 * Cria ou atualiza a rota: só os dados dela e os bairros que cobre. Quem entra, a ordem e o caminho
 * são definidos a cada semana, a partir de quem tem assinatura de entrega ativa nesses bairros.
 */
export async function salvarRota(p: PayloadRota): Promise<ResultadoRota> {
  try {
    const { supabase } = await exigirEquipe();
    const nome = p.nome.trim();
    if (!nome) return { ok: false, erro: "Informe o nome da rota." };
    const bairros = [...new Set(p.bairros.map((b) => b.trim()).filter(Boolean))];
    const dados = {
      nome, descricao: p.descricao.trim() || null, cor: p.cor || "#b45309", dia_semana: p.dia_semana,
      janela_inicio: p.janela_inicio || null, janela_fim: p.janela_fim || null, entregador_id: p.entregador_id || null,
      capacidade_paes: p.capacidade_paes && p.capacidade_paes > 0 ? p.capacidade_paes : null, ativa: p.ativa,
      origem_ponto_id: p.origem_ponto_id || null, bairros,
    };
    let id = p.id;
    if (id) {
      const { error } = await supabase.from("rotas").update(dados).eq("id", id);
      if (error) return { ok: false, erro: `Não foi possível salvar a rota: ${error.message}` };
    } else {
      const { data, error } = await supabase.from("rotas").insert(dados).select("id").single();
      if (error || !data) return { ok: false, erro: `Não foi possível criar a rota: ${error?.message ?? "erro desconhecido"}` };
      id = data.id;
    }
    // semanas ainda abertas passam a usar os bairros novos
    await supabase.rpc("realocar_rotas_abertas");
    revalidatePath("/rotas");
    revalidatePath(`/rotas/${id}`);
    revalidatePath("/semana", "layout");
    return { ok: true, id: id! };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro inesperado ao salvar a rota." };
  }
}

/** Exclui a rota. As entregas das semanas ficam sem rota até serem alocadas em outra. */
export async function excluirRota(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { supabase } = await exigirEquipe();
    const { error } = await supabase.from("rotas").delete().eq("id", id);
    if (error) return { ok: false, erro: `Não foi possível excluir: ${error.message}` };
    revalidatePath("/rotas");
    revalidatePath("/semana", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro inesperado ao excluir." };
  }
}

/** Guarda as coordenadas encontradas ou corrigidas no mapa. */
export async function salvarCoordenadas(itens: { tipo: "cliente" | "ponto"; id: string; lat: number; lng: number }[]): Promise<void> {
  const { supabase } = await exigirEquipe();
  await Promise.all(
    itens
      .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
      .map((i) => supabase.from(i.tipo === "cliente" ? "clientes" : "pontos_coleta").update({ lat: i.lat, lng: i.lng }).eq("id", i.id)),
  );
}

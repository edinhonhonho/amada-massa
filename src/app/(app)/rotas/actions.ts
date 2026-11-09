"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";

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
  /** Clientes na ordem das paradas. */
  clientes: string[];
  trajeto: [number, number][] | null;
  distancia_m: number | null;
  duracao_s: number | null;
};
export type ResultadoRota = { ok: true; id: string } | { ok: false; erro: string };

/**
 * Cria ou atualiza a rota inteira: dados, clientes (com a ordem das paradas) e trajeto.
 * Quem já estava em outra rota é movido (a atribuição anterior é encerrada com data, preservando o histórico).
 */
export async function salvarRotaCompleta(p: PayloadRota): Promise<ResultadoRota> {
  try {
    const { supabase } = await exigirEquipe();
    const nome = p.nome.trim();
    if (!nome) return { ok: false, erro: "Informe o nome da rota." };
    const hoje = hojeISO();

    const dados = {
      nome, descricao: p.descricao.trim() || null, cor: p.cor || "#b45309", dia_semana: p.dia_semana,
      janela_inicio: p.janela_inicio || null, janela_fim: p.janela_fim || null, entregador_id: p.entregador_id || null,
      capacidade_paes: p.capacidade_paes && p.capacidade_paes > 0 ? p.capacidade_paes : null, ativa: p.ativa,
      origem_ponto_id: p.origem_ponto_id || null, trajeto: p.trajeto, distancia_m: p.distancia_m, duracao_s: p.duracao_s,
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

    // atribuições ativas: desta rota, e dos clientes escolhidos (que podem estar em outra)
    const escolhidos = [...new Set(p.clientes)];
    const { data: ativas, error: e1 } = await supabase
      .from("atribuicoes_rota").select("id, cliente_id, rota_id, ordem")
      .is("fim", null).or(`rota_id.eq.${id}${escolhidos.length ? `,cliente_id.in.(${escolhidos.join(",")})` : ""}`);
    if (e1) return { ok: false, erro: `Rota salva, mas não foi possível ler os clientes: ${e1.message}` };

    const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
    for (const a of ativas ?? []) {
      const naNovaLista = escolhidos.includes(a.cliente_id);
      if (a.rota_id === id && !naNovaLista) ops.push(supabase.from("atribuicoes_rota").update({ fim: hoje }).eq("id", a.id)); // saiu da rota
      else if (a.rota_id !== id && naNovaLista) ops.push(supabase.from("atribuicoes_rota").update({ fim: hoje }).eq("id", a.id)); // veio de outra
    }
    // fecha antes de abrir: o banco só admite uma atribuição ativa por cliente
    const fechar = await Promise.all(ops);
    const falha = fechar.find((r) => r.error);
    if (falha?.error) return { ok: false, erro: `Não foi possível mover clientes de rota: ${falha.error.message}` };

    const jaNaRota = new Map((ativas ?? []).filter((a) => a.rota_id === id).map((a) => [a.cliente_id, a]));
    const gravar = escolhidos.map((cliente, i) => {
      const atual = jaNaRota.get(cliente);
      return atual
        ? supabase.from("atribuicoes_rota").update({ ordem: i + 1 }).eq("id", atual.id)
        : supabase.from("atribuicoes_rota").insert({ cliente_id: cliente, rota_id: id, ordem: i + 1, inicio: hoje });
    });
    const resultados = await Promise.all(gravar);
    const erro = resultados.find((r) => r.error)?.error;
    if (erro) return { ok: false, erro: `Não foi possível gravar as paradas: ${erro.message}` };

    revalidatePath("/rotas");
    revalidatePath(`/rotas/${id}`);
    return { ok: true, id: id! };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro inesperado ao salvar a rota." };
  }
}

/** Guarda as coordenadas já encontradas, para não geocodificar de novo. */
export async function salvarCoordenadas(itens: { tipo: "cliente" | "ponto"; id: string; lat: number; lng: number }[]): Promise<void> {
  const { supabase } = await exigirEquipe();
  await Promise.all(
    itens
      .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
      .map((i) => supabase.from(i.tipo === "cliente" ? "clientes" : "pontos_coleta").update({ lat: i.lat, lng: i.lng }).eq("id", i.id)),
  );
}

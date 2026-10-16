import type { SupabaseClient } from "@supabase/supabase-js";
import { FAIXAS_PADRAO, type Faixas } from "./pagamentos";

export async function carregarFaixas(supabase: SupabaseClient): Promise<Faixas> {
  const { data } = await supabase.from("configuracoes").select("chave, valor");
  const m = Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor as number]));
  return {
    aVencerDias: m.a_vencer_dias ?? FAIXAS_PADRAO.aVencerDias,
    atrasoCriticoDias: m.atraso_critico_dias ?? FAIXAS_PADRAO.atrasoCriticoDias,
    carenciaDias: m.carencia_dias ?? FAIXAS_PADRAO.carenciaDias,
  };
}

export const nomeCompleto = (c?: { nome?: string; sobrenome?: string | null } | null) =>
  c ? `${c.nome ?? ""} ${c.sobrenome ?? ""}`.trim() : "—";

/** Supabase devolve relação 1:1 como objeto (ou array, dependendo do tipo inferido). */
export function um<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const BAIRROS_BIKE = [
  "Azenha", "Cidade Baixa", "Bom Fim", "Rio Branco", "Centro", "Centro Histórico",
  "Moinhos de Vento", "Independência", "Menino Deus", "Santana",
];
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const bairroAtendido = (b?: string | null) =>
  !!b && BAIRROS_BIKE.some((x) => semAcento(x) === semAcento(b));

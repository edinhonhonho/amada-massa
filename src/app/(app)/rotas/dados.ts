import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "@/lib/dados";
import type { RotaBairros } from "@/lib/bairros";
import type { ClienteOpc, PontoOrigem } from "./RotaEditor";

type C = { id: string; nome: string; sobrenome: string | null; bairro: string | null; logradouro: string | null; numero: string | null; cep: string | null; cidade: string | null; lat: number | null; lng: number | null };

/** Dados do editor de rotas: clientes de entrega ativos, rotas (para ver bairros em comum), pontos de partida e entregadores. */
export async function carregarDadosEditor(supabase: SupabaseClient) {
  const [{ data: ass }, { data: atrib }, { data: rotas }, { data: pontos }, { data: usuarios }] = await Promise.all([
    supabase.from("assinaturas")
      .select("cliente_id, clientes!inner(id, nome, sobrenome, bairro, logradouro, numero, cep, cidade, lat, lng, status), planos!inner(modalidade)")
      .eq("status", "ativa").eq("planos.modalidade", "entrega").eq("clientes.status", "ativo").range(0, 4999),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id").is("fim", null),
    supabase.from("rotas").select("id, nome, ativa, bairros, cor").order("nome"),
    supabase.from("pontos_coleta").select("id, nome, tipo, logradouro, numero, bairro, cidade, cep, lat, lng").eq("ativo", true).order("tipo").order("nome"),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const manual = new Map((atrib ?? []).map((a) => [a.cliente_id as string, a.rota_id as string]));
  const vistos = new Set<string>();
  const clientes: ClienteOpc[] = [];
  for (const a of ass ?? []) {
    const c = um(a.clientes as never) as C | null;
    if (!c || vistos.has(c.id)) continue;
    vistos.add(c.id);
    clientes.push({ ...c, nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(), manualRotaId: manual.get(c.id) ?? null });
  }
  clientes.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  return {
    clientes,
    rotas: (rotas ?? []).map((r) => ({ id: r.id, nome: r.nome, ativa: r.ativa, bairros: (r.bairros ?? []) as string[] })) as RotaBairros[],
    pontos: (pontos ?? []) as PontoOrigem[],
    entregadores: (usuarios ?? []) as { id: string; nome: string }[],
  };
}

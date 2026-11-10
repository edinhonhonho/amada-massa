import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "@/lib/dados";
import { normBairro, type RotaBairros } from "@/lib/bairros";
import type { PontoOrigem } from "./RotaEditor";

/** Dados do cadastro de rota: bairros dos clientes de entrega (só a contagem), outras rotas, pontos de partida e entregadores. */
export async function carregarDadosEditor(supabase: SupabaseClient) {
  const [{ data: ass, error: erroRotas }, { data: rotas }, { data: pontos }, { data: usuarios }] = await Promise.all([
    supabase.from("assinaturas")
      .select("cliente_id, clientes!inner(id, bairro, status), planos!inner(modalidade)")
      .eq("status", "ativa").eq("planos.modalidade", "entrega").eq("clientes.status", "ativo").range(0, 4999),
    supabase.from("rotas").select("id, nome, ativa, bairros").order("nome"),
    supabase.from("pontos_coleta").select("id, nome, tipo").eq("ativo", true).order("tipo").order("nome"),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  void erroRotas;
  const vistos = new Set<string>();
  const porBairro = new Map<string, { bairro: string; qtd: number }>();
  for (const a of ass ?? []) {
    const c = um(a.clientes as never) as { id: string; bairro: string | null } | null;
    if (!c || vistos.has(c.id)) continue;
    vistos.add(c.id);
    const k = normBairro(c.bairro);
    if (!k) continue;
    const e = porBairro.get(k) ?? { bairro: (c.bairro ?? "").trim(), qtd: 0 };
    e.qtd++; porBairro.set(k, e);
  }
  return {
    bairrosDosClientes: [...porBairro.values()],
    rotas: (rotas ?? []).map((r) => ({ id: r.id, nome: r.nome, ativa: r.ativa, bairros: (r.bairros ?? []) as string[] })) as RotaBairros[],
    pontos: (pontos ?? []) as PontoOrigem[],
    entregadores: (usuarios ?? []) as { id: string; nome: string }[],
  };
}

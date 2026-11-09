import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "@/lib/dados";
import type { ClienteOpc, PontoOrigem } from "./RotaEditor";

/** Dados que o editor de rotas precisa: clientes de entrega, pontos de partida e entregadores. */
export async function carregarDadosEditor(supabase: SupabaseClient, rotaId?: string) {
  const [{ data: ass }, { data: atrib }, { data: pontos }, { data: usuarios }, { data: daRota }] = await Promise.all([
    supabase.from("assinaturas")
      .select("cliente_id, clientes!inner(id, nome, sobrenome, bairro, logradouro, numero, cep, cidade, lat, lng, status), planos!inner(modalidade)")
      .eq("status", "ativa").eq("planos.modalidade", "entrega").eq("clientes.status", "ativo"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id, rotas(nome)").is("fim", null),
    supabase.from("pontos_coleta").select("id, nome, tipo, logradouro, numero, bairro, cidade, cep, lat, lng").eq("ativo", true).order("tipo").order("nome"),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
    // quem já está na rota continua visível mesmo que tenha pausado (a atribuição não se perde ao salvar)
    rotaId
      ? supabase.from("atribuicoes_rota").select("ordem, clientes(id, nome, sobrenome, bairro, logradouro, numero, cep, cidade, lat, lng)").eq("rota_id", rotaId).is("fim", null).order("ordem")
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const rotaDe = new Map((atrib ?? []).map((a) => [a.cliente_id, { id: a.rota_id as string, nome: (um(a.rotas as never) as { nome: string } | null)?.nome ?? null }]));
  const vistos = new Set<string>();
  const clientes: ClienteOpc[] = [];
  for (const a of ass ?? []) {
    const c = um(a.clientes as never) as { id: string; nome: string; sobrenome: string | null; bairro: string | null; logradouro: string | null; numero: string | null; cep: string | null; cidade: string | null; lat: number | null; lng: number | null } | null;
    if (!c || vistos.has(c.id)) continue;
    vistos.add(c.id);
    clientes.push({ ...c, nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(), rotaId: rotaDe.get(c.id)?.id ?? null, rotaNome: rotaDe.get(c.id)?.nome ?? null });
  }
  const selecionados: string[] = [];
  for (const m of (daRota ?? []) as { clientes: unknown }[]) {
    const c = um(m.clientes as never) as { id: string; nome: string; sobrenome: string | null; bairro: string | null; logradouro: string | null; numero: string | null; cep: string | null; cidade: string | null; lat: number | null; lng: number | null } | null;
    if (!c) continue;
    selecionados.push(c.id);
    if (!vistos.has(c.id)) { vistos.add(c.id); clientes.push({ ...c, nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(), rotaId: rotaId ?? null, rotaNome: null }); }
  }
  clientes.sort((x, y) => x.nome.localeCompare(y.nome));
  return {
    clientes,
    pontos: (pontos ?? []) as PontoOrigem[],
    entregadores: (usuarios ?? []) as { id: string; nome: string }[],
    totalEntrega: clientes.length,
    selecionadosInicial: selecionados,
  };
}

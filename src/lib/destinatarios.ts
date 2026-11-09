import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { faixasEmCache } from "@/lib/cache";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR, hojeISO, reais } from "@/lib/format";
import { primeiroDoMes, situacaoCobranca, type Faixas } from "@/lib/pagamentos";

/** Para quem vai um aviso. O código viaja como "tipo" ou "tipo:valor" (ex.: "rota:uuid"). */
export type Destinatario = { cliente_id: string; nome: string; valor?: string; vencimento?: string };
export type OpcaoSegmento = { codigo: string; rotulo: string; detalhe?: string; qtd: number };

const primeiro = (n: string) => n.trim().split(/\s+/)[0] ?? n;

type CobrancaLinha = {
  valor_centavos: number; vencimento: string; status: "pendente" | "paga" | "isenta" | "cancelada";
  assinaturas: { cliente_id: string; clientes: { nome: string; status: string } | { nome: string; status: string }[] | null } | { cliente_id: string; clientes: never }[] | null;
  pagamentos: { valor_centavos: number }[] | null;
};

/** Quem deve, com o total em aberto e o vencimento mais antigo. */
async function devedores(db: SupabaseClient, faixas: Faixas, soAtrasados: boolean): Promise<Destinatario[]> {
  const hoje = hojeISO();
  const { data } = await db
    .from("cobrancas")
    .select("valor_centavos, vencimento, status, assinaturas(cliente_id, clientes(nome, status)), pagamentos(valor_centavos)")
    .eq("status", "pendente")
    .lte("competencia", primeiroDoMes(hoje));
  const porCliente = new Map<string, { nome: string; aberto: number; venc: string }>();
  for (const c of (data ?? []) as unknown as CobrancaLinha[]) {
    const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never } | null;
    const cli = um(a?.clientes) as { nome: string; status: string } | null;
    if (!a || !cli || cli.status === "cancelado") continue;
    const sit = situacaoCobranca(c, hoje, faixas);
    if (soAtrasados && sit !== "atrasado" && sit !== "atraso_critico") continue;
    const resta = Math.max(c.valor_centavos - (c.pagamentos ?? []).reduce((s, p) => s + p.valor_centavos, 0), 0);
    if (!resta) continue;
    const atual = porCliente.get(a.cliente_id);
    if (!atual) porCliente.set(a.cliente_id, { nome: cli.nome, aberto: resta, venc: c.vencimento });
    else { atual.aberto += resta; if (c.vencimento < atual.venc) atual.venc = c.vencimento; }
  }
  return [...porCliente].map(([cliente_id, v]) => ({ cliente_id, nome: primeiro(v.nome), valor: reais(v.aberto), vencimento: dataBR(v.venc) }));
}

async function clientesPorIds(db: SupabaseClient, ids: string[]): Promise<Destinatario[]> {
  if (!ids.length) return [];
  const { data } = await db.from("clientes").select("id, nome, status").in("id", [...new Set(ids)]).neq("status", "cancelado");
  return (data ?? []).map((c) => ({ cliente_id: c.id, nome: primeiro(c.nome) }));
}

/** Resolve o código de um segmento nas pessoas que vão receber. */
export async function resolverDestinatarios(db: SupabaseClient, codigo: string): Promise<Destinatario[]> {
  const corte = codigo.indexOf(":");
  const tipo = corte < 0 ? codigo : codigo.slice(0, corte);
  const valor = corte < 0 ? undefined : codigo.slice(corte + 1);
  switch (tipo) {
    case "todos": {
      const { data } = await db.from("clientes").select("id, nome").eq("status", "ativo").range(0, 4999);
      return (data ?? []).map((c) => ({ cliente_id: c.id, nome: primeiro(c.nome) }));
    }
    case "atrasados": return devedores(db, await faixasEmCache(), true);
    case "pendentes": return devedores(db, await faixasEmCache(), false);
    case "rota": {
      const { data } = await db.from("atribuicoes_rota").select("cliente_id").eq("rota_id", valor ?? "").is("fim", null);
      return clientesPorIds(db, (data ?? []).map((x) => x.cliente_id));
    }
    case "ponto": {
      const { data } = await db.from("assinaturas").select("cliente_id").eq("ponto_coleta_id", valor ?? "").eq("status", "ativa");
      return clientesPorIds(db, (data ?? []).map((x) => x.cliente_id));
    }
    case "modalidade": {
      const { data } = await db.from("assinaturas").select("cliente_id, planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", valor ?? "");
      return clientesPorIds(db, (data ?? []).map((x) => x.cliente_id));
    }
    case "clientes": return clientesPorIds(db, (valor ?? "").split(",").filter(Boolean));
    default: return [];
  }
}

/** Opções do seletor "Para quem", já com a quantidade de pessoas de cada uma. */
export async function opcoesSegmento(db: SupabaseClient, extra?: { rotas?: { id: string; nome: string }[] }): Promise<OpcaoSegmento[]> {
  const faixas = await faixasEmCache();
  const rotas = extra?.rotas ?? ((await db.from("rotas").select("id, nome").order("nome")).data ?? []);
  const [todos, atrasados, pendentes, ...porRota] = await Promise.all([
    resolverDestinatarios(db, "todos"),
    devedores(db, faixas, true),
    devedores(db, faixas, false),
    ...rotas.map((r) => resolverDestinatarios(db, `rota:${r.id}`)),
  ]);
  return [
    { codigo: "todos", rotulo: "Todos os clientes", detalhe: "Clientes ativos", qtd: todos.length },
    { codigo: "atrasados", rotulo: "Em atraso", detalhe: "Mensalidade vencida", qtd: atrasados.length },
    { codigo: "pendentes", rotulo: "Com mensalidade em aberto", detalhe: "Vencida ou a vencer", qtd: pendentes.length },
    ...rotas.map((r, i) => ({ codigo: `rota:${r.id}`, rotulo: r.nome, detalhe: "Clientes da rota", qtd: porRota[i].length })),
  ];
}

export { nomeCompleto };

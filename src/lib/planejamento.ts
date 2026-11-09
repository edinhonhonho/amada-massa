import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "./dados";
import { nomeCompleto } from "./dados";

export type PaoSemana = { id: string; nome: string; descricao: string | null; ingredientes: string | null; alergenos: string | null; ordem: number };

export type LinhaEntrega = {
  id: string; cliente_id: string; assinatura_id: string; nome: string; whatsapp: string | null; bairro: string | null; endereco: string;
  plano: string; modalidade: "entrega" | "coleta_ponto" | "coleta_padaria"; paesPlano: number;
  status: string; qtd: number; manual: boolean; ordem: number; quantidades: Record<string, number>;
};
export type Grupo = {
  chave: string; tipo: "entrega" | "ponto" | "padaria"; nome: string; refId: string | null; cor: string | null;
  linhas: LinhaEntrega[]; totais: Record<string, number>; totalPaes: number; ativos: number;
};
export type SemanaCompleta = {
  semana: { id: string; inicio: string; fim: string; sabor: string | null; status: string; sem_producao: boolean; lista_fechada: boolean; observacao: string | null };
  paes: PaoSemana[]; grupos: Grupo[]; totalPaes: number; totaisPorPao: Record<string, number>; clientes: number;
};

const INATIVOS = ["pulada", "suspensa_atraso"];
export const estaAtiva = (status: string) => !INATIVOS.includes(status);

const SEM_ROTA = "rota:sem";

/** Tudo o que a tela da semana e os PDFs precisam, já agrupado por destino. */
export async function carregarSemanaCompleta(supabase: SupabaseClient, id: string): Promise<SemanaCompleta | null> {
  const [{ data: semana }, { data: paesRows }, { data: entregas }, { data: rotas }] = await Promise.all([
    supabase.from("semanas").select("id, inicio, fim, sabor, status, sem_producao, lista_fechada, observacao").eq("id", id).single(),
    supabase.from("paes_semana").select("ordem, paes(id, nome, descricao, ingredientes, alergenos)").eq("semana_id", id).order("ordem").order("criado_em"),
    supabase
      .from("entregas")
      .select("id, cliente_id, assinatura_id, rota_id, rota_nome, ponto_coleta_id, ponto_nome, ordem, qtd_prevista, status, paes_manual, clientes(nome, sobrenome, whatsapp, bairro, logradouro, numero, complemento), assinaturas(planos(modalidade, nome, paes_por_semana), pontos_coleta(tipo)), entrega_paes(pao_id, quantidade)")
      .eq("semana_id", id),
    supabase.from("rotas").select("id, nome, cor"),
  ]);
  if (!semana) return null;

  const paes: PaoSemana[] = (paesRows ?? []).flatMap((r) => {
    const p = um(r.paes as never) as { id: string; nome: string; descricao: string | null; ingredientes: string | null; alergenos: string | null } | null;
    return p ? [{ ...p, ordem: r.ordem as number }] : [];
  });
  const corRota = new Map((rotas ?? []).map((r) => [r.id as string, r.cor as string]));

  const grupos = new Map<string, Grupo>();
  const totaisPorPao: Record<string, number> = {};
  let totalPaes = 0, clientes = 0;

  for (const e of entregas ?? []) {
    const cli = um(e.clientes as never) as { nome: string; sobrenome: string | null; whatsapp: string | null; bairro: string | null; logradouro: string | null; numero: string | null; complemento: string | null } | null;
    const ass = um(e.assinaturas as never) as { planos: never; pontos_coleta: never } | null;
    const plano = um(ass?.planos) as { modalidade: LinhaEntrega["modalidade"]; nome: string; paes_por_semana: number } | null;
    const ponto = um(ass?.pontos_coleta) as { tipo: string } | null;
    if (!cli || !plano) continue;

    const quantidades: Record<string, number> = {};
    for (const q of (e.entrega_paes as { pao_id: string; quantidade: number }[]) ?? []) quantidades[q.pao_id] = q.quantidade;
    const linha: LinhaEntrega = {
      id: e.id, cliente_id: e.cliente_id, assinatura_id: e.assinatura_id, nome: nomeCompleto(cli), whatsapp: cli.whatsapp, bairro: cli.bairro,
      endereco: [cli.logradouro && `${cli.logradouro}${cli.numero ? `, ${cli.numero}` : ""}`, cli.complemento].filter(Boolean).join(" - "),
      plano: plano.nome, modalidade: plano.modalidade, paesPlano: plano.paes_por_semana, status: e.status, qtd: e.qtd_prevista, manual: e.paes_manual, ordem: e.ordem, quantidades,
    };

    let chave: string, tipo: Grupo["tipo"], nome: string, refId: string | null, cor: string | null = null;
    if (plano.modalidade === "entrega") {
      tipo = "entrega"; refId = e.rota_id ?? null; chave = refId ? `rota:${refId}` : SEM_ROTA;
      nome = e.rota_nome ?? "Sem rota"; cor = refId ? corRota.get(refId) ?? null : null;
    } else {
      tipo = plano.modalidade === "coleta_padaria" || ponto?.tipo === "padaria" ? "padaria" : "ponto";
      refId = e.ponto_coleta_id ?? null; chave = `ponto:${refId ?? "sem"}`; nome = e.ponto_nome ?? (tipo === "padaria" ? "Padaria" : "Sem ponto");
    }
    const g = grupos.get(chave) ?? { chave, tipo, nome, refId, cor, linhas: [], totais: {}, totalPaes: 0, ativos: 0 };
    g.linhas.push(linha);
    if (estaAtiva(e.status)) {
      g.ativos++; clientes++;
      g.totalPaes += e.qtd_prevista; totalPaes += e.qtd_prevista;
      for (const [pao, q] of Object.entries(quantidades)) { g.totais[pao] = (g.totais[pao] ?? 0) + q; totaisPorPao[pao] = (totaisPorPao[pao] ?? 0) + q; }
    }
    grupos.set(chave, g);
  }

  const ordemTipo = { entrega: 0, ponto: 1, padaria: 2 } as const;
  const lista = [...grupos.values()].sort((a, b) =>
    ordemTipo[a.tipo] - ordemTipo[b.tipo] || (a.chave === SEM_ROTA ? -1 : b.chave === SEM_ROTA ? 1 : 0) || a.nome.localeCompare(b.nome));
  for (const g of lista) g.linhas.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  return { semana, paes, grupos: lista, totalPaes, totaisPorPao, clientes };
}

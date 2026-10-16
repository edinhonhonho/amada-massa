import type { SupabaseClient } from "@supabase/supabase-js";
import { um } from "./dados";
import { MODALIDADES } from "./format";
import { diasEntre } from "./pagamentos";

export type Relatorio = { titulo: string; colunas: string[]; linhas: (string | number)[][] };
export type Periodo = { de: string; ate: string; hoje: string };

export const RELATORIOS: Record<string, string> = {
  receita: "Receita mensal",
  inadimplencia: "Inadimplência",
  base: "Evolução da base",
  cancelamentos: "Motivos de cancelamento",
  entregas: "Entregas por rota",
  bairros: "Distribuição por bairro",
  producao: "Produção semanal",
};

const rs = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nome = (c: { nome: string; sobrenome?: string | null } | null) => (c ? `${c.nome} ${c.sobrenome ?? ""}`.trim() : "—");
const mes = (iso: string) => iso.slice(0, 7);

export async function gerarRelatorio(supabase: SupabaseClient, chave: string, p: Periodo): Promise<Relatorio | null> {
  switch (chave) {
    case "receita": {
      const { data } = await supabase
        .from("cobrancas")
        .select("competencia, valor_centavos, status, assinaturas(planos(nome, modalidade)), pagamentos(valor_centavos)")
        .gte("competencia", `${mes(p.de)}-01`).lte("competencia", p.ate).order("competencia");
      const acc = new Map<string, { esp: number; rec: number }>();
      for (const c of data ?? []) {
        if (c.status === "isenta" || c.status === "cancelada") continue;
        const ass = um(c.assinaturas as never) as { planos: never } | null;
        const pl = um(ass?.planos) as { nome: string; modalidade: keyof typeof MODALIDADES } | null;
        const k = `${mes(c.competencia)}|${pl ? MODALIDADES[pl.modalidade] : "—"}|${pl?.nome ?? "—"}`;
        const r = acc.get(k) ?? { esp: 0, rec: 0 };
        r.esp += c.valor_centavos;
        r.rec += ((c.pagamentos as { valor_centavos: number }[]) ?? []).reduce((s, x) => s + x.valor_centavos, 0);
        acc.set(k, r);
      }
      return { titulo: RELATORIOS.receita, colunas: ["Mês", "Modalidade", "Plano", "Esperado", "Recebido"],
        linhas: [...acc.entries()].map(([k, v]) => [...k.split("|"), rs(v.esp), rs(v.rec)]) };
    }
    case "inadimplencia": {
      const { data } = await supabase
        .from("cobrancas").select("valor_centavos, vencimento, assinaturas(cliente_id, clientes(nome, sobrenome)), pagamentos(valor_centavos)")
        .eq("status", "pendente").lt("vencimento", p.hoje);
      const por = new Map<string, { nome: string; meses: number; devido: number; antigo: string }>();
      for (const c of data ?? []) {
        const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never } | null;
        if (!a) continue;
        const pago = ((c.pagamentos as { valor_centavos: number }[]) ?? []).reduce((s, x) => s + x.valor_centavos, 0);
        const r = por.get(a.cliente_id) ?? { nome: nome(um(a.clientes)), meses: 0, devido: 0, antigo: c.vencimento };
        r.meses += 1; r.devido += c.valor_centavos - pago; if (c.vencimento < r.antigo) r.antigo = c.vencimento;
        por.set(a.cliente_id, r);
      }
      return { titulo: RELATORIOS.inadimplencia, colunas: ["Cliente", "Meses em atraso", "Valor devido", "Atraso mais antigo (dias)"],
        linhas: [...por.values()].sort((a, b) => a.antigo.localeCompare(b.antigo)).map((r) => [r.nome, r.meses, rs(r.devido), diasEntre(r.antigo, p.hoje)]) };
    }
    case "base": {
      const [{ data: novas }, { data: canc }] = await Promise.all([
        supabase.from("assinaturas").select("inicio, motivo_cancelamento").gte("inicio", p.de).lte("inicio", p.ate),
        supabase.from("clientes").select("cancelado_em").not("cancelado_em", "is", null).gte("cancelado_em", p.de).lte("cancelado_em", p.ate),
      ]);
      const m = new Map<string, { n: number; c: number }>();
      for (const a of novas ?? []) if (a.motivo_cancelamento !== "Troca de plano") { const r = m.get(mes(a.inicio)) ?? { n: 0, c: 0 }; r.n++; m.set(mes(a.inicio), r); }
      for (const c of canc ?? []) { const r = m.get(mes(c.cancelado_em)) ?? { n: 0, c: 0 }; r.c++; m.set(mes(c.cancelado_em), r); }
      return { titulo: RELATORIOS.base, colunas: ["Mês", "Novas assinaturas", "Cancelamentos", "Saldo"],
        linhas: [...m.entries()].sort().map(([k, v]) => [k, v.n, v.c, v.n - v.c]) };
    }
    case "cancelamentos": {
      const { data } = await supabase.from("clientes").select("motivo_cancelamento").not("cancelado_em", "is", null).gte("cancelado_em", p.de).lte("cancelado_em", p.ate);
      const m = new Map<string, number>();
      for (const c of data ?? []) m.set(c.motivo_cancelamento ?? "—", (m.get(c.motivo_cancelamento ?? "—") ?? 0) + 1);
      return { titulo: RELATORIOS.cancelamentos, colunas: ["Motivo", "Cancelamentos"], linhas: [...m.entries()].sort((a, b) => b[1] - a[1]) };
    }
    case "entregas": {
      const { data } = await supabase.from("entregas").select("rota_nome, ponto_nome, status, ocorrencia, semanas!inner(inicio)").gte("semanas.inicio", p.de).lte("semanas.inicio", p.ate);
      const m = new Map<string, { ok: number; falha: number; pend: number; oc: Map<string, number> }>();
      for (const e of data ?? []) {
        if (["pulada", "suspensa_atraso"].includes(e.status)) continue;
        const k = e.rota_nome ?? e.ponto_nome ?? "Sem rota";
        const r = m.get(k) ?? { ok: 0, falha: 0, pend: 0, oc: new Map() };
        if (e.status === "entregue" || e.status === "retirada") r.ok++;
        else if (e.status === "nao_entregue") { r.falha++; r.oc.set(e.ocorrencia ?? "—", (r.oc.get(e.ocorrencia ?? "—") ?? 0) + 1); }
        else r.pend++;
        m.set(k, r);
      }
      return { titulo: RELATORIOS.entregas, colunas: ["Rota/ponto", "Entregas", "Sucesso", "Falhas", "Taxa de sucesso", "Ocorrências recorrentes"],
        linhas: [...m.entries()].map(([k, r]) => [k, r.ok + r.falha + r.pend, r.ok, r.falha, `${Math.round((r.ok / Math.max(r.ok + r.falha + r.pend, 1)) * 100)}%`,
          [...r.oc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o, n]) => `${o} (${n})`).join(", ")]) };
    }
    case "bairros": {
      const { data } = await supabase.from("clientes").select("bairro").eq("status", "ativo");
      const m = new Map<string, number>();
      for (const c of data ?? []) m.set(c.bairro?.trim() || "(sem bairro)", (m.get(c.bairro?.trim() || "(sem bairro)") ?? 0) + 1);
      return { titulo: RELATORIOS.bairros, colunas: ["Bairro", "Clientes ativos"], linhas: [...m.entries()].sort((a, b) => b[1] - a[1]) };
    }
    case "producao": {
      const { data } = await supabase.from("semanas").select("inicio, sabor, sem_producao, entregas(qtd_prevista, status)").gte("inicio", p.de).lte("inicio", p.ate).order("inicio");
      return { titulo: RELATORIOS.producao, colunas: ["Semana", "Sabor", "Embalagens", "Pães"],
        linhas: (data ?? []).map((s) => {
          const es = ((s.entregas as { qtd_prevista: number; status: string }[]) ?? []).filter((e) => !["pulada", "suspensa_atraso"].includes(e.status));
          return [s.inicio, s.sem_producao ? "Sem produção" : (s.sabor ?? "—"), es.length, es.reduce((n, e) => n + e.qtd_prevista, 0)];
        }) };
    }
  }
  return null;
}

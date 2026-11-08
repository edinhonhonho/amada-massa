"use server";

import { exigirEquipe } from "@/lib/auth";
import { soDigitos } from "@/lib/format";

export type ResultadoBusca = { id: string; nome: string; detalhe: string };

/** Busca rápida de clientes para a paleta de comandos. */
export async function buscarClientes(termo: string): Promise<ResultadoBusca[]> {
  const { supabase } = await exigirEquipe();
  const t = termo.replace(/[%,()*]/g, "").trim();
  if (t.length < 2) return [];
  const d = soDigitos(t);
  const filtros = [`nome.ilike.%${t}%`, `sobrenome.ilike.%${t}%`, `email.ilike.%${t}%`];
  if (d.length >= 3) filtros.push(`whatsapp.ilike.%${d}%`);
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, sobrenome, bairro, status")
    .or(filtros.join(","))
    .order("nome")
    .limit(6);
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(),
    detalhe: [c.bairro, c.status !== "ativo" ? c.status : null].filter(Boolean).join(" · "),
  }));
}

"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";
import { avisosPara, destinatariosOrdenados, enviarAviso } from "@/lib/enviar-aviso";
import { diagnosticoPush, notificar } from "@/lib/notificar";
import { createAdminClient } from "@/lib/supabase/admin";

const ROTULOS: Record<string, string> = {
  todos: "Todos os clientes",
  atrasados: "Clientes em atraso",
  pendentes: "Com mensalidade em aberto",
};
const LOTE = 25;
const TITULO_MAX = 80;
const CORPO_MAX = 400;

type Contexto = Awaited<ReturnType<typeof exigirEquipe>>;

async function rotuloDe(supabase: Contexto["supabase"], segmento: string): Promise<string | null> {
  if (ROTULOS[segmento]) return ROTULOS[segmento];
  if (segmento.startsWith("rota:")) {
    const { data } = await supabase.from("rotas").select("nome").eq("id", segmento.slice(5)).maybeSingle();
    return data?.nome ?? "Rota";
  }
  if (segmento.startsWith("clientes:")) {
    const ids = segmento.slice(9).split(",").filter(Boolean);
    if (ids.length !== 1) return `${ids.length} pessoas escolhidas`;
    const { data } = await supabase.from("clientes").select("nome, sobrenome").eq("id", ids[0]).maybeSingle();
    return data ? `${data.nome} ${data.sobrenome ?? ""}`.trim() : "Cliente";
  }
  return null;
}

// ------------------------------------------------------------ envio em lotes
export type Previa = { qtd: number; nomes: string[]; rotulo: string; avisoPush: string | null };

/** Antes de enviar: quantas pessoas, quem são (primeiros nomes) e se o push do celular está configurado. */
export async function preverEnvio(segmento: string): Promise<Previa | null> {
  const { supabase } = await exigirEquipe();
  const rotulo = await rotuloDe(supabase, segmento);
  if (!rotulo) return null;
  const pessoas = await destinatariosOrdenados(segmento);
  const falta = diagnosticoPush();
  return {
    qtd: pessoas.length, rotulo,
    nomes: pessoas.slice(0, 6).map((p) => p.nome),
    avisoPush: falta.length ? `${falta[0]} Enquanto isso, o aviso fica só dentro do app.` : null,
  };
}

export type Inicio = { ok: true; avisoId: string; total: number; lote: number } | { ok: false; erro: string };

/** Registra o aviso e informa quantos lotes serão enviados. */
export async function iniciarEnvio(d: { titulo: string; corpo: string; segmento: string }): Promise<Inicio> {
  const { supabase, usuario } = await exigirEquipe();
  const titulo = d.titulo.trim().slice(0, TITULO_MAX);
  const corpo = d.corpo.trim().slice(0, CORPO_MAX);
  if (!titulo || !corpo) return { ok: false, erro: "Preencha o título e a mensagem." };
  const rotulo = await rotuloDe(supabase, d.segmento);
  if (!rotulo) return { ok: false, erro: "Escolha para quem enviar." };
  const pessoas = await destinatariosOrdenados(d.segmento);
  if (!pessoas.length) return { ok: false, erro: "Ninguém neste grupo para receber o aviso." };
  const { data, error } = await createAdminClient().from("avisos")
    .insert({ titulo, corpo, segmento: d.segmento, segmento_rotulo: rotulo, destinatarios: pessoas.length, enviado_por: usuario.id })
    .select("id").single();
  if (error || !data) return { ok: false, erro: "Não foi possível registrar o aviso. Tente de novo." };
  return { ok: true, avisoId: data.id, total: pessoas.length, lote: LOTE };
}

export type Lote = { gravados: number; pushes: number; falhas: number; erro?: string };

/** Envia um pedaço da lista. Estado nenhum fica no navegador: o aviso e o grupo são relidos do banco. */
export async function enviarLote(avisoId: string, de: number): Promise<Lote> {
  await exigirEquipe();
  const admin = createAdminClient();
  const { data: aviso } = await admin.from("avisos").select("id, titulo, corpo, segmento, pushes").eq("id", avisoId).maybeSingle();
  if (!aviso) return { gravados: 0, pushes: 0, falhas: 0, erro: "Aviso não encontrado." };
  const pessoas = (await destinatariosOrdenados(aviso.segmento)).slice(de, de + LOTE);
  const r = await notificar(avisosPara(aviso, pessoas));
  if (r.pushes) await admin.from("avisos").update({ pushes: aviso.pushes + r.pushes }).eq("id", avisoId);
  return r;
}

export async function concluirEnvio() {
  await exigirEquipe();
  revalidatePath("/mensagens");
}

// ------------------------------------------------------------ lembrete avulso
export type ResultadoLembrete = { ok: boolean; mensagem: string };

/** Lembrete de uma cobrança específica, com valor e vencimento do cliente. */
export async function lembrarCobranca(cobrancaId: string): Promise<ResultadoLembrete> {
  const { supabase, usuario } = await exigirEquipe();
  const { data: c } = await supabase.from("cobrancas").select("id, assinaturas(cliente_id)").eq("id", cobrancaId).maybeSingle();
  const a = c?.assinaturas as unknown as { cliente_id: string } | { cliente_id: string }[] | null;
  const clienteId = (Array.isArray(a) ? a[0] : a)?.cliente_id;
  if (!clienteId) return { ok: false, mensagem: "Cobrança não encontrada." };

  const { resolverDestinatarios } = await import("@/lib/destinatarios");
  const aberto = (await resolverDestinatarios(createAdminClient(), "pendentes")).find((d) => d.cliente_id === clienteId);
  const r = await enviarAviso({
    titulo: "Sua mensalidade, {nome}",
    corpo: aberto
      ? `Oi, {nome}! Sua mensalidade de ${aberto.valor} está em aberto (vencimento ${aberto.vencimento}). Qualquer dúvida é só falar com a gente.`
      : "Oi, {nome}! Passando para lembrar da sua mensalidade do clube. Qualquer dúvida é só falar com a gente.",
    segmento: `clientes:${clienteId}`, rotulo: aberto?.nome ?? "Cliente", enviadoPor: usuario.id,
  });
  revalidatePath("/mensagens");
  if (!r.destinatarios) return { ok: false, mensagem: "Cliente sem cadastro ativo." };
  return { ok: true, mensagem: r.pushes ? "Lembrete enviado para o celular." : "Lembrete guardado no app; ainda sem notificações ativas no celular." };
}

// ------------------------------------------------------------ modelos
const txt = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

export async function salvarModelo(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = txt(f, "id", 60);
  const linha = { nome: txt(f, "nome", 60), titulo: txt(f, "titulo", TITULO_MAX), corpo: txt(f, "corpo", CORPO_MAX) };
  if (!linha.nome || !linha.titulo || !linha.corpo) return;
  if (id) await supabase.from("modelos_aviso").update(linha).eq("id", id);
  else {
    const { data } = await supabase.from("modelos_aviso").select("ordem").order("ordem", { ascending: false }).limit(1);
    await supabase.from("modelos_aviso").insert({ ...linha, ordem: (data?.[0]?.ordem ?? 0) + 1 });
  }
  revalidatePath("/mensagens");
  revalidatePath("/pagamentos");
}

export async function excluirModelo(f: FormData) {
  const { supabase } = await exigirEquipe();
  await supabase.from("modelos_aviso").delete().eq("id", txt(f, "id", 60));
  revalidatePath("/mensagens");
  revalidatePath("/pagamentos");
}

/** "Salvar como modelo" direto do compositor. */
export async function criarModelo(d: { nome: string; titulo: string; corpo: string; segmento?: string }): Promise<{ ok: boolean }> {
  const { supabase } = await exigirEquipe();
  const nome = d.nome.trim().slice(0, 60), titulo = d.titulo.trim().slice(0, TITULO_MAX), corpo = d.corpo.trim().slice(0, CORPO_MAX);
  if (!nome || !titulo || !corpo) return { ok: false };
  const { data } = await supabase.from("modelos_aviso").select("ordem").order("ordem", { ascending: false }).limit(1);
  const { error } = await supabase.from("modelos_aviso").insert({ nome, titulo, corpo, ordem: (data?.[0]?.ordem ?? 0) + 1 });
  revalidatePath("/mensagens");
  revalidatePath("/pagamentos");
  return { ok: !error };
}

// ------------------------------------------------------------ escolher pessoas
export type PessoaAviso = { id: string; nome: string; detalhe: string; noApp: boolean };

/** Busca de clientes para o aviso individual ou para um grupo escolhido a dedo. */
export async function buscarPessoasAviso(termo: string): Promise<PessoaAviso[]> {
  const { supabase } = await exigirEquipe();
  const t = termo.replace(/[%,()*]/g, "").trim();
  if (t.length < 2) return [];
  const d = t.replace(/\D/g, "");
  const filtros = [`nome.ilike.%${t}%`, `sobrenome.ilike.%${t}%`, `email.ilike.%${t}%`];
  if (d.length >= 3) filtros.push(`whatsapp.ilike.%${d}%`);
  const { data } = await supabase.from("clientes").select("id, nome, sobrenome, bairro, status").or(filtros.join(",")).neq("status", "cancelado").order("nome").limit(8);
  const ids = (data ?? []).map((c) => c.id);
  const { data: membros } = ids.length ? await supabase.from("membros").select("cliente_id").in("cliente_id", ids) : { data: [] };
  const noApp = new Set((membros ?? []).map((m) => m.cliente_id));
  return (data ?? []).map((c) => ({
    id: c.id, nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(),
    detalhe: [c.bairro, c.status === "pausado" ? "pausado" : null].filter(Boolean).join(" · "), noApp: noApp.has(c.id),
  }));
}

// ------------------------------------------------------------ quem leu
export type DetalheAviso = { leram: string[]; naoLeram: string[] };

/** Nomes de quem já leu e de quem ainda não leu um aviso enviado. */
export async function detalheAviso(avisoId: string): Promise<DetalheAviso> {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("notificacoes").select("lida_em, clientes(nome, sobrenome)").eq("aviso_id", avisoId).range(0, 1999);
  const nome = (c: unknown) => {
    const x = (Array.isArray(c) ? c[0] : c) as { nome: string; sobrenome: string | null } | null;
    return x ? `${x.nome} ${x.sobrenome ?? ""}`.trim() : "—";
  };
  const linhas = (data ?? []).map((n) => ({ lido: !!n.lida_em, nome: nome(n.clientes) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { leram: linhas.filter((l) => l.lido).map((l) => l.nome), naoLeram: linhas.filter((l) => !l.lido).map((l) => l.nome) };
}

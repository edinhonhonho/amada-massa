"use server";

import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { resolverDestinatarios } from "@/lib/destinatarios";
import { enviarAviso } from "@/lib/enviar-aviso";

const ROTULOS: Record<string, string> = {
  todos: "Todos os clientes",
  atrasados: "Clientes em atraso",
  pendentes: "Com mensalidade em aberto",
};

const volta = (v: FormDataEntryValue | null) => {
  const t = typeof v === "string" ? v : "";
  return /^\/(?!\/)[a-z0-9/_\-?&=.]*$/i.test(t) ? t : "/mensagens";
};

/** Envia pelo app Amada Massa. É o único canal de mensagem do sistema. */
export async function enviarAvisoApp(f: FormData) {
  const { supabase, usuario } = await exigirEquipe();
  const destino = volta(f.get("voltar"));
  const titulo = String(f.get("titulo") ?? "").trim().slice(0, 80);
  const corpo = String(f.get("corpo") ?? "").trim().slice(0, 400);
  const segmento = String(f.get("segmento") ?? "");
  if (!titulo || !corpo || !segmento) redirect(`${destino}?aviso=erro`);

  let rotulo = ROTULOS[segmento];
  if (!rotulo && segmento.startsWith("rota:")) {
    const { data } = await supabase.from("rotas").select("nome").eq("id", segmento.slice(5)).maybeSingle();
    rotulo = data?.nome ?? "Rota";
  }
  if (!rotulo && segmento.startsWith("clientes:")) {
    const { data } = await supabase.from("clientes").select("nome, sobrenome").eq("id", segmento.slice(9).split(",")[0]).maybeSingle();
    rotulo = data ? `${data.nome} ${data.sobrenome ?? ""}`.trim() : "Cliente";
  }
  if (!rotulo) redirect(`${destino}?aviso=erro`);

  const r = await enviarAviso({ titulo, corpo, segmento, rotulo, enviadoPor: usuario.id });
  const sep = destino.includes("?") ? "&" : "?";
  if (!r.destinatarios) redirect(`${destino}${sep}aviso=vazio`);
  redirect(`${destino}${sep}aviso=ok&n=${r.destinatarios}&push=${r.pushes}`);
}

/** Lembrete de uma cobrança específica, com valor e vencimento do cliente. */
export async function lembrarCobranca(cobrancaId: string, voltar: string, ...resto: unknown[]) {
  void resto; // o último argumento é o FormData do formulário
  const { supabase, usuario } = await exigirEquipe();
  const destino = volta(voltar);
  const { data: c } = await supabase.from("cobrancas").select("id, assinaturas(cliente_id, clientes(nome, sobrenome))").eq("id", cobrancaId).maybeSingle();
  const a = c?.assinaturas as unknown as { cliente_id: string; clientes: { nome: string; sobrenome: string | null } | { nome: string; sobrenome: string | null }[] } | { cliente_id: string }[] | null;
  const ass = Array.isArray(a) ? a[0] : a;
  if (!ass) redirect(`${destino}${destino.includes("?") ? "&" : "?"}aviso=erro`);

  const dest = (await resolverDestinatarios(supabase, `clientes:${ass.cliente_id}`))[0];
  const aberto = (await resolverDestinatarios(supabase, "pendentes")).find((d) => d.cliente_id === ass.cliente_id);
  const r = await enviarAviso({
    titulo: "Sua mensalidade",
    corpo: aberto
      ? `Oi, {nome}! Sua mensalidade de ${aberto.valor} está em aberto (vencimento ${aberto.vencimento}). Qualquer dúvida é só falar com a gente.`
      : "Oi, {nome}! Passando para lembrar da sua mensalidade do clube. Qualquer dúvida é só falar com a gente.",
    segmento: `clientes:${dest?.cliente_id ?? ass.cliente_id}`,
    rotulo: dest?.nome ?? "Cliente",
    enviadoPor: usuario.id,
  });
  redirect(`${destino}${destino.includes("?") ? "&" : "?"}aviso=${r.destinatarios ? "ok" : "vazio"}&n=${r.destinatarios}&push=${r.pushes}`);
}

/** Aviso para um único cliente (ficha do cliente). */
export async function avisarCliente(clienteId: string, f: FormData) {
  const { usuario } = await exigirEquipe();
  const titulo = String(f.get("titulo") ?? "").trim().slice(0, 80);
  const corpo = String(f.get("corpo") ?? "").trim().slice(0, 400);
  const destino = `/clientes/${clienteId}`;
  if (!titulo || !corpo) redirect(`${destino}?aviso=erro`);
  const r = await enviarAviso({ titulo, corpo, segmento: `clientes:${clienteId}`, rotulo: "Cliente", enviadoPor: usuario.id });
  redirect(`${destino}?aviso=${r.destinatarios ? "ok" : "vazio"}&n=${r.destinatarios}&push=${r.pushes}`);
}

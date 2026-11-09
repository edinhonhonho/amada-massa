"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { avisarSabor } from "@/lib/avisos-entrega";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const refresh = (id: string) => { revalidatePath(`/semana/${id}`); revalidatePath("/planejamento"); };
const falhou = (id: string, msg: string): never => redirect(`/semana/${id}?erro=${encodeURIComponent(msg)}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ----------------------------------------------------------- calendário
/** Abre (criando se preciso) a semana que começa na data indicada. */
export async function planejarSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const inicio = txt(f, "inicio");
  if (!inicio) return;
  await supabase.from("semanas").upsert({ inicio, fim: adicionarDias(inicio, 6) }, { onConflict: "inicio", ignoreDuplicates: true });
  const { data } = await supabase.from("semanas").select("id").eq("inicio", inicio).single();
  revalidatePath("/planejamento");
  redirect(data ? `/semana/${data.id}` : "/planejamento");
}

/** Cria, de uma vez, todas as semanas (segunda a domingo) do ano que ainda não existem. */
export async function criarSemanasDoAno(f: FormData) {
  const { supabase } = await exigirEquipe();
  const ano = Number(f.get("ano"));
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return;
  let d = `${ano}-01-01`;
  d = adicionarDias(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const linhas: { inicio: string; fim: string }[] = [];
  while (d <= `${ano}-12-31`) { linhas.push({ inicio: d, fim: adicionarDias(d, 6) }); d = adicionarDias(d, 7); }
  await supabase.from("semanas").upsert(linhas, { onConflict: "inicio", ignoreDuplicates: true });
  revalidatePath("/planejamento");
  redirect(`/planejamento?ano=${ano}`);
}

// --------------------------------------------------------------- semana
export async function salvarSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  await supabase.from("semanas").update({ observacao: txt(f, "observacao"), status: String(f.get("status")) }).eq("id", id);
  refresh(id);
}

export async function alternarListaFechada(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  await supabase.from("semanas").update({ lista_fechada: f.get("fechar") === "1" }).eq("id", id);
  if (f.get("fechar") !== "1") await supabase.rpc("preparar_semana", { p_semana: id });
  refresh(id);
}

/** Semana sem produção (feriado): ninguém recebe, sem mexer nas assinaturas. */
export async function alternarSemProducao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const ligar = f.get("ligar") === "1";
  await supabase.from("semanas").update({ sem_producao: ligar }).eq("id", id);
  if (ligar) {
    await supabase.from("entregas").update({ status: "pulada", observacao: "Semana sem produção" })
      .eq("semana_id", id).in("status", ["programada", "suspensa_atraso", "reagendada"]);
  } else {
    await supabase.from("entregas").update({ status: "programada", observacao: null })
      .eq("semana_id", id).eq("status", "pulada").eq("observacao", "Semana sem produção");
    await supabase.rpc("preparar_semana", { p_semana: id });
  }
  refresh(id);
}

/** Cliente não recebe nesta semana, sem pausar a assinatura (volta ao clicar de novo). */
// `_f`: ao usar a ação em formAction.bind(...), o React entrega o FormData como último argumento.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function alternarPuloLinha(semana: string, assinatura: string, _f?: FormData) {
  const { supabase } = await exigirEquipe();
  const { data: atual } = await supabase.from("pulos_semana").select("assinatura_id").eq("semana_id", semana).eq("assinatura_id", assinatura).maybeSingle();
  if (!atual) {
    await supabase.from("pulos_semana").insert({ semana_id: semana, assinatura_id: assinatura, motivo: null });
    await supabase.from("entregas").update({ status: "pulada", observacao: "Pulou a semana" })
      .eq("semana_id", semana).eq("assinatura_id", assinatura).in("status", ["programada", "suspensa_atraso", "reagendada"]);
  } else {
    await supabase.from("pulos_semana").delete().eq("semana_id", semana).eq("assinatura_id", assinatura);
    await supabase.from("entregas").update({ status: "programada", observacao: null }).eq("semana_id", semana).eq("assinatura_id", assinatura).eq("status", "pulada");
    await supabase.rpc("preparar_semana", { p_semana: semana });
  }
  refresh(semana);
}

export async function excluirSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const { count } = await supabase.from("entregas").select("*", { count: "exact", head: true }).eq("semana_id", id).in("status", ["entregue", "retirada", "nao_entregue"]);
  if (count) return falhou(id, "Esta semana já tem entregas registradas e não pode ser excluída.");
  await supabase.from("semanas").delete().eq("id", id);
  revalidatePath("/planejamento");
  redirect("/planejamento");
}

export async function avisarSaborMembros(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const { data: s } = await supabase.from("semanas").select("sabor").eq("id", id).single();
  if (!s?.sabor) return falhou(id, "Cadastre ao menos um pão antes de avisar os membros.");
  const n = await avisarSabor(id, s.sabor);
  redirect(`/semana/${id}?etapa=consolidar&avisados=${n}`);
}

// ------------------------------------------------------------------ pães
/** Coloca pães do catálogo na semana (o mesmo pão pode estar em várias semanas). */
export async function adicionarPaesSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const ids = f.getAll("pao_id").map(String).filter((x) => UUID.test(x));
  if (!ids.length) return falhou(semana, "Marque ao menos um pão.");
  const { count } = await supabase.from("paes_semana").select("*", { count: "exact", head: true }).eq("semana_id", semana);
  const { error } = await supabase.from("paes_semana").upsert(ids.map((pao_id, i) => ({ semana_id: semana, pao_id, ordem: (count ?? 0) + i })), { onConflict: "semana_id,pao_id", ignoreDuplicates: true });
  if (error) return falhou(semana, error.message);
  await supabase.rpc("distribuir_paes", { p_semana: semana });
  refresh(semana);
}

/** Cadastra um pão novo no catálogo (ou reaproveita o de mesmo nome) e, se houver semana, já o coloca nela. */
export async function criarPao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = txt(f, "semana_id");
  const nome = txt(f, "nome");
  const voltar = (msg: string) => (semana ? falhou(semana, msg) : redirect(`/paes?erro=${encodeURIComponent(msg)}`));
  if (!nome) return voltar("Informe o nome do pão.");

  const { data: existente } = await supabase.from("paes").select("id").ilike("nome", nome.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  let paoId = existente?.id as string | undefined;
  if (!paoId) {
    const { data, error } = await supabase.from("paes")
      .insert({ nome, descricao: txt(f, "descricao"), ingredientes: txt(f, "ingredientes"), alergenos: txt(f, "alergenos"), tradicional: f.get("tradicional") === "on" }).select("id").single();
    if (error || !data) return voltar(error?.message ?? "Não foi possível cadastrar o pão.");
    paoId = data.id;
  }
  if (semana) {
    const { count } = await supabase.from("paes_semana").select("*", { count: "exact", head: true }).eq("semana_id", semana);
    await supabase.from("paes_semana").upsert({ semana_id: semana, pao_id: paoId, ordem: count ?? 0 }, { onConflict: "semana_id,pao_id", ignoreDuplicates: true });
    await supabase.rpc("distribuir_paes", { p_semana: semana });
    refresh(semana);
  } else {
    revalidatePath("/paes");
  }
}

/** Edita o pão no catálogo: a mudança vale em todas as semanas que o usam. */
export async function salvarPao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const nome = txt(f, "nome");
  if (!nome) return;
  const { error } = await supabase.from("paes").update({ nome, descricao: txt(f, "descricao"), ingredientes: txt(f, "ingredientes"), alergenos: txt(f, "alergenos"), tradicional: f.get("tradicional") === "on" }).eq("id", id);
  if (error) redirect(`/paes?erro=${encodeURIComponent(error.code === "23505" ? "Já existe um pão com esse nome." : error.message)}`);
  revalidatePath("/planejamento", "layout");
}

export async function excluirPao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id"));
  const { count } = await supabase.from("paes_semana").select("*", { count: "exact", head: true }).eq("pao_id", id);
  if (count) redirect("/paes?erro=" + encodeURIComponent("Este pão está em semanas do planejamento. Tire-o delas antes de excluir."));
  await supabase.from("paes").delete().eq("id", id);
  revalidatePath("/paes");
}

/** Tira o pão desta semana (continua no catálogo). */
export async function removerPaoSemana(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const pao = String(f.get("pao_id"));
  const { data: ent } = await supabase.from("entregas").select("id").eq("semana_id", semana);
  const ids = (ent ?? []).map((e) => e.id);
  if (ids.length) await supabase.from("entrega_paes").delete().eq("pao_id", pao).in("entrega_id", ids);
  await supabase.from("paes_semana").delete().eq("semana_id", semana).eq("pao_id", pao);
  await supabase.rpc("sincronizar_quantidades", { p_semana: semana });
  await supabase.rpc("distribuir_paes", { p_semana: semana });
  refresh(semana);
}

// ------------------------------------------------------------ quantidades
/** Grava as quantidades de cada pão por cliente (campos q__<entrega>__<pão>). */
export async function salvarQuantidades(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const novas = new Map<string, Map<string, number>>();
  for (const [k, v] of f.entries()) {
    const m = /^q__([0-9a-f-]{36})__([0-9a-f-]{36})$/i.exec(k);
    if (!m || typeof v !== "string") continue;
    const q = Math.min(99, Math.max(0, parseInt(v, 10) || 0));
    (novas.get(m[1]) ?? novas.set(m[1], new Map()).get(m[1])!).set(m[2], q);
  }
  if (!novas.size) return;

  const { data: atuais } = await supabase.from("entrega_paes").select("entrega_id, pao_id, quantidade").in("entrega_id", [...novas.keys()]);
  const antes = new Map<string, Map<string, number>>();
  for (const a of atuais ?? []) (antes.get(a.entrega_id) ?? antes.set(a.entrega_id, new Map()).get(a.entrega_id)!).set(a.pao_id, a.quantidade);

  const mudou = [...novas.entries()].filter(([entrega, paes]) => [...paes.entries()].some(([pao, q]) => (antes.get(entrega)?.get(pao) ?? 0) !== q));
  const resultados = await Promise.all(mudou.map(async ([entrega, paes]) => {
    const linhas = [...paes.entries()].filter(([, q]) => q > 0).map(([pao_id, quantidade]) => ({ entrega_id: entrega, pao_id, quantidade }));
    const r1 = await supabase.from("entrega_paes").delete().eq("entrega_id", entrega);
    if (r1.error) return r1.error;
    if (linhas.length) { const r2 = await supabase.from("entrega_paes").insert(linhas); if (r2.error) return r2.error; }
    const total = linhas.reduce((s, l) => s + l.quantidade, 0);
    const r3 = await supabase.from("entregas").update({ paes_manual: true, qtd_prevista: total }).eq("id", entrega);
    return r3.error;
  }));
  const erro = resultados.find(Boolean);
  if (erro) return falhou(semana, `Não foi possível salvar as quantidades: ${erro.message}`);
  refresh(semana);
}

/** Volta a divisão de todos os clientes ao padrão do plano. */
export async function restaurarDivisao(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const { error } = await supabase.rpc("restaurar_distribuicao", { p_semana: semana });
  if (error) return falhou(semana, error.message);
  refresh(semana);
}

// ----------------------------------------------------------------- grupos
const CORES = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#4d7c0f", "#c2410c", "#0e7490"];

/** Move clientes de entrega para outra rota (grupo) nesta semana — e, se pedido, em definitivo. */
export async function moverClientes(f: FormData) {
  const { supabase } = await exigirEquipe();
  const semana = String(f.get("semana_id"));
  const ids = f.getAll("entrega_id").map(String).filter((x) => UUID.test(x));
  if (!ids.length) return falhou(semana, "Marque os clientes que quer mover.");

  const destino = String(f.get("destino") ?? "");
  let rotaId: string, rotaNome: string;
  if (destino === "nova") {
    const nome = txt(f, "nova_rota");
    if (!nome) return falhou(semana, "Dê um nome à nova rota.");
    const { count } = await supabase.from("rotas").select("*", { count: "exact", head: true });
    const { data, error } = await supabase.from("rotas").insert({ nome, cor: CORES[(count ?? 0) % CORES.length], dia_semana: 3 }).select("id, nome").single();
    if (error || !data) return falhou(semana, `Não foi possível criar a rota: ${error?.message ?? "erro"}`);
    rotaId = data.id; rotaNome = data.nome;
  } else if (destino.startsWith("rota:") && UUID.test(destino.slice(5))) {
    const { data } = await supabase.from("rotas").select("id, nome").eq("id", destino.slice(5)).single();
    if (!data) return falhou(semana, "Rota de destino não encontrada.");
    rotaId = data.id; rotaNome = data.nome;
  } else return falhou(semana, "Escolha para qual rota mover.");

  const { data: ultima } = await supabase.from("entregas").select("ordem").eq("semana_id", semana).eq("rota_id", rotaId).order("ordem", { ascending: false }).limit(1);
  let ordem = (ultima?.[0]?.ordem ?? 0) + 1;
  const { data: movidas, error } = await supabase.from("entregas").select("id, cliente_id").in("id", ids);
  if (error) return falhou(semana, error.message);
  const r = await Promise.all((movidas ?? []).map((e) => supabase.from("entregas").update({ rota_id: rotaId, rota_nome: rotaNome, ordem: ordem++ }).eq("id", e.id)));
  if (r.some((x) => x.error)) return falhou(semana, `Não foi possível mover: ${r.find((x) => x.error)?.error?.message}`);

  if (f.get("permanente") === "on") {
    const clientes = [...new Set((movidas ?? []).map((e) => e.cliente_id))];
    const hoje = hojeISO();
    await supabase.from("atribuicoes_rota").update({ fim: hoje }).in("cliente_id", clientes).is("fim", null);
    const { data: u } = await supabase.from("atribuicoes_rota").select("ordem").eq("rota_id", rotaId).is("fim", null).order("ordem", { ascending: false }).limit(1);
    let o = (u?.[0]?.ordem ?? 0) + 1;
    await supabase.from("atribuicoes_rota").insert(clientes.map((cliente_id) => ({ cliente_id, rota_id: rotaId, ordem: o++, inicio: hoje })));
    revalidatePath("/rotas");
  }
  refresh(semana);
}

/** Marca a retirada de um cliente de coleta (padaria ou ponto). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function marcarRetirada(semana: string, entregaId: string, _f?: FormData) {
  const { supabase } = await exigirEquipe();
  const { error } = await supabase.rpc("marcar_entrega", { p_id: entregaId, p_status: "retirada" });
  if (error) return falhou(semana, error.message);
  refresh(semana);
}

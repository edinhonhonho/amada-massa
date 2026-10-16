"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function salvarRota(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = txt(f, "id");
  const nome = txt(f, "nome");
  if (!nome) return;
  const cap = Number(f.get("capacidade_paes"));
  const dados = {
    nome,
    descricao: txt(f, "descricao"),
    dia_semana: f.get("dia_semana") === "" ? null : Number(f.get("dia_semana")),
    janela_inicio: txt(f, "janela_inicio"),
    janela_fim: txt(f, "janela_fim"),
    cor: txt(f, "cor") ?? "#b45309",
    entregador_id: txt(f, "entregador_id"),
    capacidade_paes: Number.isInteger(cap) && cap > 0 ? cap : null,
    ativa: id ? f.get("ativa") === "on" : true,
  };
  if (id) {
    await supabase.from("rotas").update(dados).eq("id", id);
    revalidatePath(`/rotas/${id}`);
    redirect(`/rotas/${id}`);
  }
  const { data } = await supabase.from("rotas").insert(dados).select("id").single();
  revalidatePath("/rotas");
  redirect(data ? `/rotas/${data.id}` : "/rotas");
}

/** Atribui clientes (um ou vários) a uma rota. Troca de rota fecha a atribuição anterior com data. */
export async function atribuirClientes(f: FormData) {
  const { supabase } = await exigirEquipe();
  const rotaId = String(f.get("rota_id"));
  const ids = f.getAll("cliente_id").map(String).filter(Boolean);
  if (!ids.length) return;
  const hoje = hojeISO();

  const { data: max } = await supabase.from("atribuicoes_rota").select("ordem").eq("rota_id", rotaId).is("fim", null).order("ordem", { ascending: false }).limit(1);
  let ordem = (max?.[0]?.ordem ?? 0) + 1;

  for (const clienteId of ids) {
    const { data: atual } = await supabase.from("atribuicoes_rota").select("id, rota_id").eq("cliente_id", clienteId).is("fim", null).maybeSingle();
    if (atual?.rota_id === rotaId) continue;
    if (atual) await supabase.from("atribuicoes_rota").update({ fim: hoje }).eq("id", atual.id);
    await supabase.from("atribuicoes_rota").insert({ cliente_id: clienteId, rota_id: rotaId, ordem: ordem++, inicio: hoje });
  }
  revalidatePath(`/rotas/${rotaId}`);
  revalidatePath("/rotas");
}

export async function removerDaRota(f: FormData) {
  const { supabase } = await exigirEquipe();
  await supabase.from("atribuicoes_rota").update({ fim: hojeISO() }).eq("id", String(f.get("atribuicao_id")));
  revalidatePath(`/rotas/${String(f.get("rota_id"))}`);
}

/** Troca a ordem de parada com a vizinha (cima/baixo) e renumera 1..n. */
export async function moverParada(f: FormData) {
  const { supabase } = await exigirEquipe();
  const rotaId = String(f.get("rota_id"));
  const id = String(f.get("atribuicao_id"));
  const dir = f.get("dir") === "cima" ? -1 : 1;
  const { data } = await supabase.from("atribuicoes_rota").select("id").eq("rota_id", rotaId).is("fim", null).order("ordem").order("inicio");
  const ids = (data ?? []).map((a) => a.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, k) => supabase.from("atribuicoes_rota").update({ ordem: k + 1 }).eq("id", x)));
  revalidatePath(`/rotas/${rotaId}`);
}

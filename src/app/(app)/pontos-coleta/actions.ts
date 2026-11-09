"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { janelaValida, resumoHorarios, type Janela } from "@/lib/horarios";

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const voltar = (erro: string): never => redirect(`/pontos-coleta?erro=${encodeURIComponent(erro)}`);

export async function salvarPonto(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = txt(f, "id");
  const nome = txt(f, "nome");
  const logradouro = txt(f, "logradouro");
  if (!nome) voltar("Informe o nome do ponto.");
  if (!logradouro) voltar("Informe o endereço (comece pelo CEP).");
  const tipo = f.get("tipo") === "padaria" ? "padaria" : "ponto";

  let horarios: Janela[] = [];
  try {
    horarios = (JSON.parse(String(f.get("horarios") || "[]")) as Janela[]).filter(janelaValida);
  } catch {
    voltar("Horários inválidos.");
  }

  const numero = txt(f, "numero");
  const complemento = txt(f, "complemento");
  const bairro = txt(f, "bairro");
  const cidade = txt(f, "cidade") ?? "Porto Alegre";
  const dados = {
    nome, tipo, logradouro, numero, complemento, bairro, cidade,
    cep: (txt(f, "cep") ?? "").replace(/\D/g, "") || null,
    referencia: txt(f, "referencia"),
    // texto corrido mantido para mensagens e listas
    endereco: `${logradouro}${numero ? `, ${numero}` : ""}${complemento ? ` - ${complemento}` : ""}${bairro ? ` — ${bairro}` : ""}, ${cidade}`,
    horarios,
    horario_texto: resumoHorarios(horarios) || null,
    responsavel: txt(f, "responsavel"),
    telefone: txt(f, "telefone"),
    ativo: id ? f.get("ativo") === "on" : true,
    lat: null as number | null, lng: null as number | null, // endereço mudou: o mapa geocodifica de novo
  };

  if (id) {
    // mudar o tipo de um ponto em uso quebraria a regra "padaria só na Padaria"
    const { data: atual } = await supabase.from("pontos_coleta").select("tipo").eq("id", id).single();
    if (atual && atual.tipo !== tipo) {
      const { count } = await supabase.from("assinaturas").select("*", { count: "exact", head: true }).eq("ponto_coleta_id", id).in("status", ["ativa", "pausada"]);
      if (count) voltar("Este ponto tem assinaturas ativas: não é possível mudar o tipo dele.");
    }
    const { error } = await supabase.from("pontos_coleta").update(dados).eq("id", id);
    if (error) voltar(error.message);
  } else {
    const { error } = await supabase.from("pontos_coleta").insert(dados);
    if (error) voltar(error.message);
  }
  revalidatePath("/pontos-coleta");
  redirect("/pontos-coleta");
}

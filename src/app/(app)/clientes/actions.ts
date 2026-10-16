"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin, exigirEquipe } from "@/lib/auth";
import { hojeISO, paraCentavos, soDigitos } from "@/lib/format";

const vazio = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  sobrenome: z.string().trim().default(""),
  email: z.string().trim().email("E-mail inválido.").nullable(),
  whatsapp: z.string().nullable(),
  cpf: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().default("Porto Alegre"),
  cep: z.string().nullable(),
  referencia_portaria: z.string().nullable(),
  instrucoes_entrega: z.string().nullable(),
  origem: z.string().nullable(),
  confirmado_em: z.string().nullable(),
  restricoes_alimentares: z.string().nullable(),
  observacoes: z.string().nullable(),
});

export type EstadoForm = { erro?: string; duplicados?: { id: string; nome: string }[] };

function lerCliente(f: FormData) {
  const bruto = Object.fromEntries(
    Object.keys(clienteSchema.shape).map((k) => [k, vazio(f.get(k))]),
  );
  if (bruto.nome === null) bruto.nome = "";
  if (bruto.sobrenome === null) delete bruto.sobrenome;
  if (bruto.cidade === null) delete bruto.cidade;
  const r = clienteSchema.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message } as const;
  const d = r.data;
  return {
    dados: {
      ...d,
      email: d.email?.toLowerCase() ?? null,
      whatsapp: d.whatsapp ? soDigitos(d.whatsapp) : null,
      cpf: d.cpf ? soDigitos(d.cpf) : null,
      cep: d.cep ? soDigitos(d.cep) : null,
    },
  } as const;
}

export async function salvarCliente(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirEquipe();
  const id = vazio(f.get("id"));
  const lido = lerCliente(f);
  if ("erro" in lido) return { erro: lido.erro };
  const { dados } = lido;

  // Duplicidade por WhatsApp ou e-mail (spec 4); "confirmar" deixa salvar mesmo assim.
  if (f.get("confirmar") !== "1") {
    const filtros: string[] = [];
    if (dados.whatsapp) filtros.push(`whatsapp.eq.${dados.whatsapp}`);
    if (dados.email) filtros.push(`email.eq.${dados.email.replace(/[,()]/g, "")}`);
    if (filtros.length) {
      let q = supabase.from("clientes").select("id, nome, sobrenome").or(filtros.join(","));
      if (id) q = q.neq("id", id);
      const { data } = await q.limit(5);
      if (data?.length)
        return {
          erro: "Já existe cliente com este WhatsApp ou e-mail. Confira antes de salvar.",
          duplicados: data.map((c) => ({ id: c.id, nome: `${c.nome} ${c.sobrenome}`.trim() })),
        };
    }
  }

  if (id) {
    const { error } = await supabase.from("clientes").update(dados).eq("id", id);
    if (error) return { erro: error.message };
    revalidatePath(`/clientes/${id}`);
    redirect(`/clientes/${id}`);
  }

  // Cadastro novo: cliente + primeira assinatura.
  const planoId = vazio(f.get("plano_id"));
  if (!planoId) return { erro: "Escolha o plano contratado." };
  const { data: plano } = await supabase.from("planos").select("valor_centavos, modalidade").eq("id", planoId).single();
  if (!plano) return { erro: "Plano não encontrado." };

  const textoValor = vazio(f.get("valor"));
  const valor = textoValor ? paraCentavos(textoValor) : plano.valor_centavos;
  if (valor === null) return { erro: "Valor inválido." };
  const justificativa = vazio(f.get("justificativa_valor"));
  if (valor !== plano.valor_centavos && !justificativa)
    return { erro: "Informe a justificativa do valor diferente do plano." };

  const dia = Number(f.get("dia_vencimento"));
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { erro: "Dia de pagamento deve ser de 1 a 28." };
  const pontoId = vazio(f.get("ponto_coleta_id"));
  if (plano.modalidade !== "entrega" && !pontoId) return { erro: "Escolha o ponto de coleta." };

  const { data: novo, error } = await supabase
    .from("clientes")
    .insert({ ...dados, confirmado_em: dados.confirmado_em ?? hojeISO() })
    .select("id")
    .single();
  if (error || !novo) return { erro: error?.message ?? "Não foi possível salvar." };

  const { error: e2 } = await supabase.from("assinaturas").insert({
    cliente_id: novo.id,
    plano_id: planoId,
    valor_centavos: valor,
    justificativa_valor: justificativa,
    dia_vencimento: dia,
    ponto_coleta_id: plano.modalidade === "entrega" ? null : pontoId,
    inicio: vazio(f.get("inicio")) ?? hojeISO(),
  });
  if (e2) {
    await supabase.from("clientes").delete().eq("id", novo.id); // evita cliente sem assinatura
    return { erro: e2.message };
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${novo.id}`);
}

export async function registrarContato(f: FormData) {
  const { supabase, usuario } = await exigirEquipe();
  const clienteId = String(f.get("cliente_id"));
  const resumo = vazio(f.get("resumo"));
  if (!resumo) return;
  await supabase.from("contatos").insert({
    cliente_id: clienteId,
    usuario_id: usuario.id,
    data: vazio(f.get("data")) ?? hojeISO(),
    canal: String(f.get("canal") ?? "whatsapp"),
    resumo,
    proximo_passo: vazio(f.get("proximo_passo")),
    proximo_passo_em: vazio(f.get("proximo_passo_em")),
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function concluirContato(f: FormData) {
  const { supabase } = await exigirEquipe();
  const clienteId = String(f.get("cliente_id"));
  await supabase.from("contatos").update({ concluido: true }).eq("id", String(f.get("id")));
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/");
}

/** Pausar, reativar ou cancelar. Cancelar nunca apaga: só muda status (spec 4). */
export async function mudarStatus(f: FormData) {
  const { supabase } = await exigirEquipe();
  const id = String(f.get("cliente_id"));
  const acao = String(f.get("acao"));
  const hoje = hojeISO();

  if (acao === "pausar") {
    await supabase.from("clientes").update({ status: "pausado", pausa_retorno_previsto: vazio(f.get("retorno")) }).eq("id", id);
    await supabase.from("assinaturas").update({ status: "pausada" }).eq("cliente_id", id).eq("status", "ativa");
  } else if (acao === "reativar") {
    await supabase.from("clientes").update({ status: "ativo", pausa_retorno_previsto: null, cancelado_em: null, motivo_cancelamento: null }).eq("id", id);
    await supabase.from("assinaturas").update({ status: "ativa" }).eq("cliente_id", id).eq("status", "pausada");
  } else if (acao === "cancelar") {
    const motivo = vazio(f.get("motivo"));
    if (!motivo) return;
    await supabase.from("clientes").update({ status: "cancelado", cancelado_em: vazio(f.get("data")) ?? hoje, motivo_cancelamento: motivo }).eq("id", id);
    await supabase
      .from("assinaturas")
      .update({ status: "cancelada", fim: vazio(f.get("data")) ?? hoje, motivo_cancelamento: motivo })
      .eq("cliente_id", id)
      .in("status", ["ativa", "pausada"]);
  }
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
}

/** Troca de plano: encerra a assinatura atual e cria outra, preservando o histórico (spec 5). */
export async function trocarPlano(f: FormData) {
  const { supabase } = await exigirEquipe();
  const clienteId = String(f.get("cliente_id"));
  const atualId = String(f.get("assinatura_id"));
  const planoId = String(f.get("plano_id"));
  const inicio = vazio(f.get("inicio")) ?? hojeISO();

  const [{ data: plano }, { data: atual }] = await Promise.all([
    supabase.from("planos").select("valor_centavos, modalidade").eq("id", planoId).single(),
    supabase.from("assinaturas").select("dia_vencimento, ponto_coleta_id").eq("id", atualId).single(),
  ]);
  if (!plano || !atual) return;
  const textoValor = vazio(f.get("valor"));
  const valor = textoValor ? paraCentavos(textoValor) : plano.valor_centavos;
  const justificativa = vazio(f.get("justificativa_valor"));
  if (valor === null || (valor !== plano.valor_centavos && !justificativa)) return;
  const pontoId = plano.modalidade === "entrega" ? null : (vazio(f.get("ponto_coleta_id")) ?? atual.ponto_coleta_id);
  if (plano.modalidade !== "entrega" && !pontoId) return;

  // Nova primeiro: se falhar, a antiga continua valendo.
  const { error } = await supabase.from("assinaturas").insert({
    cliente_id: clienteId, plano_id: planoId, valor_centavos: valor, justificativa_valor: justificativa,
    dia_vencimento: atual.dia_vencimento, ponto_coleta_id: pontoId, inicio,
  });
  if (error) return;
  await supabase.from("assinaturas").update({ status: "encerrada", fim: inicio, motivo_cancelamento: "Troca de plano" }).eq("id", atualId);
  revalidatePath(`/clientes/${clienteId}`);
}

export async function excluirCliente(f: FormData) {
  const { supabase } = await exigirAdmin();
  if (f.get("confirmacao") !== "EXCLUIR") return;
  await supabase.from("clientes").delete().eq("id", String(f.get("cliente_id")));
  revalidatePath("/clientes");
  redirect("/clientes");
}

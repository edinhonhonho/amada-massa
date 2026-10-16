import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIAS_SEMANA, um } from "@/lib/dados";
import { dataBR, hojeISO, linkWhatsApp, reais } from "@/lib/format";
import { montarMensagem } from "@/lib/mensagens";

/** Prepara a mensagem do modelo para o cliente, registra na linha do tempo e abre o WhatsApp. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const origem = request.nextUrl.origin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origem}/login`);
  const { data: u } = await supabase.from("usuarios").select("perfil, ativo").eq("id", auth.user.id).single();
  if (!u?.ativo || u.perfil === "entregador") return new NextResponse("Proibido", { status: 403 });

  const clienteId = p.get("cliente") ?? "";
  const [{ data: cli }, { data: modelo }] = await Promise.all([
    supabase.from("clientes").select("id, nome, whatsapp, logradouro, numero, complemento, bairro").eq("id", clienteId).single(),
    supabase.from("modelos_mensagem").select("nome, texto").eq("chave", p.get("modelo") ?? "").single(),
  ]);
  if (!cli || !modelo) return new NextResponse("Não encontrado", { status: 404 });

  const hoje = hojeISO();
  const { data: ass } = await supabase
    .from("assinaturas")
    .select("id, valor_centavos, dia_vencimento, planos(nome), pontos_coleta(nome, horario_texto)")
    .eq("cliente_id", clienteId).in("status", ["ativa", "pausada"]).order("inicio", { ascending: false }).limit(1);
  const a = ass?.[0];

  let cobranca: { valor_centavos: number; vencimento: string } | null = null;
  const cobId = p.get("cobranca");
  if (cobId) cobranca = (await supabase.from("cobrancas").select("valor_centavos, vencimento").eq("id", cobId).single()).data;
  else if (a) cobranca = (await supabase.from("cobrancas").select("valor_centavos, vencimento").eq("assinatura_id", a.id).eq("status", "pendente").order("vencimento").limit(1)).data?.[0] ?? null;

  const semana = (await supabase.from("semanas").select("sabor").lte("inicio", hoje).gte("fim", hoje).limit(1)).data?.[0];
  const rota = (await supabase.from("atribuicoes_rota").select("rotas(nome, dia_semana, janela_inicio, janela_fim)").eq("cliente_id", clienteId).is("fim", null).maybeSingle()).data;
  const r = um(rota?.rotas as never) as { nome: string; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null } | null;
  const ponto = um(a?.pontos_coleta as never) as { nome: string; horario_texto: string | null } | null;
  const diaHorario = r
    ? `Entrega ${r.dia_semana != null ? DIAS_SEMANA[r.dia_semana].toLowerCase() : ""} ${r.janela_inicio ? `das ${r.janela_inicio.slice(0, 5)} às ${r.janela_fim?.slice(0, 5) ?? ""}` : ""}`.trim()
    : ponto ? `Retirada em ${ponto.nome}: ${ponto.horario_texto ?? ""}` : "";

  const texto = montarMensagem(modelo.texto, {
    nome: cli.nome,
    plano: (um(a?.planos as never) as { nome: string } | null)?.nome,
    valor: reais(cobranca?.valor_centavos ?? a?.valor_centavos ?? 0),
    vencimento: cobranca ? dataBR(cobranca.vencimento) : undefined,
    dia_pagamento: a ? String(a.dia_vencimento) : undefined,
    sabor: semana?.sabor ?? "a definir",
    dia_horario: diaHorario,
    endereco: [cli.logradouro && `${cli.logradouro}${cli.numero ? ", " + cli.numero : ""}`, cli.complemento, cli.bairro].filter(Boolean).join(", "),
  });

  const link = linkWhatsApp(cli.whatsapp, texto);
  if (!link) return new NextResponse("Cliente sem WhatsApp", { status: 400 });
  await supabase.from("contatos").insert({
    cliente_id: clienteId, usuario_id: auth.user.id, canal: "whatsapp", data: hoje,
    resumo: `Mensagem "${modelo.nome}" preparada pelo sistema`,
  });
  return NextResponse.redirect(link);
}

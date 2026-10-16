import { NextResponse } from "next/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { um } from "@/lib/dados";
import { createClient } from "@/lib/supabase/server";

/** CSV de clientes, cobranças e entregas (somente administrador). */
export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Não autenticado", { status: 401 });
  const { data: u } = await supabase.from("usuarios").select("perfil, ativo").eq("id", auth.user.id).single();
  if (!u?.ativo || u.perfil !== "admin") return new NextResponse("Proibido", { status: 403 });
  const url = new URL(request.url);

  if (tipo === "clientes") {
    const { data } = await supabase.from("clientes").select("nome, sobrenome, email, whatsapp, bairro, cidade, status, origem, confirmado_em, observacoes").order("nome");
    return csvResponse("clientes", toCsv(
      ["Nome", "Sobrenome", "E-mail", "WhatsApp", "Bairro", "Cidade", "Status", "Origem", "Confirmado em", "Observações"],
      (data ?? []).map((c) => [c.nome, c.sobrenome, c.email, c.whatsapp, c.bairro, c.cidade, c.status, c.origem, c.confirmado_em, c.observacoes]),
    ));
  }
  if (tipo === "cobrancas") {
    let q = supabase.from("cobrancas").select("competencia, valor_centavos, vencimento, status, assinaturas(clientes(nome, sobrenome)), pagamentos(valor_centavos, data, forma)").order("competencia");
    const ano = url.searchParams.get("ano");
    if (ano) q = q.gte("competencia", `${ano}-01-01`).lte("competencia", `${ano}-12-31`);
    const { data } = await q;
    return csvResponse("cobrancas", toCsv(
      ["Competência", "Cliente", "Valor (R$)", "Vencimento", "Status", "Pago (R$)", "Data do pagamento", "Forma"],
      (data ?? []).map((c) => {
        const ass = um(c.assinaturas as never) as { clientes: never } | null;
        const cli = um(ass?.clientes) as { nome: string; sobrenome: string } | null;
        const pags = (c.pagamentos as { valor_centavos: number; data: string; forma: string }[]) ?? [];
        return [c.competencia.slice(0, 7), cli ? `${cli.nome} ${cli.sobrenome}`.trim() : "", (c.valor_centavos / 100).toFixed(2).replace(".", ","),
          c.vencimento, c.status, (pags.reduce((s, p) => s + p.valor_centavos, 0) / 100).toFixed(2).replace(".", ","),
          pags.map((p) => p.data).join(" | "), pags.map((p) => p.forma).join(" | ")];
      }),
    ));
  }
  if (tipo === "entregas") {
    let q = supabase.from("entregas").select("status, rota_nome, ponto_nome, qtd_prevista, qtd_entregue, entregue_em, ocorrencia, observacao, semanas(inicio, sabor), clientes(nome, sobrenome)").order("semana_id");
    const semana = url.searchParams.get("semana");
    if (semana) q = q.eq("semana_id", semana);
    const { data } = await q.limit(20000);
    return csvResponse("entregas", toCsv(
      ["Semana", "Sabor", "Cliente", "Rota/Ponto", "Previsto", "Entregue", "Status", "Data/hora", "Ocorrência", "Observação"],
      (data ?? []).map((e) => {
        const s = um(e.semanas as never) as { inicio: string; sabor: string | null } | null;
        const c = um(e.clientes as never) as { nome: string; sobrenome: string } | null;
        return [s?.inicio, s?.sabor, c ? `${c.nome} ${c.sobrenome}`.trim() : "", e.rota_nome ?? e.ponto_nome, e.qtd_prevista, e.qtd_entregue, e.status, e.entregue_em, e.ocorrencia, e.observacao];
      }),
    ));
  }
  return new NextResponse("Tipo desconhecido", { status: 404 });
}

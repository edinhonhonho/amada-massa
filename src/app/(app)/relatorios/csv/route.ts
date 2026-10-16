import { NextResponse } from "next/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { gerarRelatorio } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Não autenticado", { status: 401 });
  const { data: u } = await supabase.from("usuarios").select("perfil, ativo").eq("id", auth.user.id).single();
  if (!u?.ativo || u.perfil !== "admin") return new NextResponse("Proibido", { status: 403 });

  const p = new URL(request.url).searchParams;
  const hoje = hojeISO();
  const rel = await gerarRelatorio(supabase, p.get("r") ?? "", { de: p.get("de") || adicionarDias(hoje, -180), ate: p.get("ate") || hoje, hoje });
  if (!rel) return new NextResponse("Relatório desconhecido", { status: 404 });
  return csvResponse(`relatorio-${p.get("r")}`, toCsv(rel.colunas, rel.linhas));
}

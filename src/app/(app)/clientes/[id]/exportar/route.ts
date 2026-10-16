import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** LGPD: exporta todos os dados de um cliente em JSON (somente admin). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Não autenticado", { status: 401 });
  const { data: u } = await supabase.from("usuarios").select("perfil, ativo").eq("id", auth.user.id).single();
  if (!u?.ativo || u.perfil !== "admin") return new NextResponse("Proibido", { status: 403 });

  const [cliente, assinaturas, contatos] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("assinaturas").select("*").eq("cliente_id", id),
    supabase.from("contatos").select("*").eq("cliente_id", id),
  ]);
  if (!cliente.data) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(JSON.stringify({ cliente: cliente.data, assinaturas: assinaturas.data, contatos: contatos.data }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cliente-${id}.json"`,
    },
  });
}

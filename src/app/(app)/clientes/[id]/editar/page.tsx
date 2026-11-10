import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../../ClienteForm";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const [{ data }, { data: rotas }, { data: atrib }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("rotas").select("id, nome, bairros").eq("ativa", true).order("nome"),
    supabase.from("atribuicoes_rota").select("rota_id").eq("cliente_id", id).is("fim", null).maybeSingle(),
  ]);
  if (!data) notFound();
  return (
    <>
      <PageHeader voltar={{ href: `/clientes/${id}`, rotulo: data.nome }} titulo="Editar cliente" subtitulo="Dados e endereço. Plano e valor são alterados na ficha, em “Trocar plano”." />
      <ClienteForm cliente={data} rotas={(rotas ?? []).map((r) => ({ id: r.id, nome: r.nome, bairros: (r.bairros ?? []) as string[] }))} rotaPreferida={atrib?.rota_id ?? null} />
    </>
  );
}

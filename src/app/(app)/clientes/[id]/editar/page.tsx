import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../../ClienteForm";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (!data) notFound();
  return (
    <>
      <PageHeader voltar={{ href: `/clientes/${id}`, rotulo: data.nome }} titulo="Editar cliente" subtitulo="Dados e endereço. Plano e valor são alterados na ficha, em “Trocar plano”." />
      <ClienteForm cliente={data} />
    </>
  );
}

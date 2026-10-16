import { notFound } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../../ClienteForm";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (!data) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Editar {data.nome}</h1>
      <ClienteForm cliente={data} />
    </div>
  );
}

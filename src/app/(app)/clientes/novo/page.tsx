import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../ClienteForm";

export default async function NovoCliente() {
  const { supabase } = await exigirEquipe();
  const [{ data: planos }, { data: pontos }] = await Promise.all([
    supabase.from("planos").select("id, nome, modalidade, valor_centavos").eq("ativo", true).order("modalidade").order("paes_por_semana"),
    supabase.from("pontos_coleta").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Novo cliente</h1>
      <p className="text-stone-600">Cadastre apenas quem já confirmou a assinatura.</p>
      <ClienteForm planos={planos ?? []} pontos={pontos ?? []} />
    </div>
  );
}

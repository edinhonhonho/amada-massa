import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../ClienteForm";

export default async function NovoCliente() {
  const { supabase } = await exigirEquipe();
  const [{ data: planos }, { data: pontos }] = await Promise.all([
    supabase.from("planos").select("id, nome, modalidade, paes_por_semana, valor_centavos").eq("ativo", true).order("modalidade").order("paes_por_semana"),
    supabase.from("pontos_coleta").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return (
    <>
      <PageHeader voltar={{ href: "/clientes", rotulo: "Clientes" }} titulo="Novo cliente" subtitulo="Cadastre quem já confirmou a assinatura: dados, endereço e o plano que vai assinar." />
      <ClienteForm planos={planos ?? []} pontos={pontos ?? []} />
    </>
  );
}

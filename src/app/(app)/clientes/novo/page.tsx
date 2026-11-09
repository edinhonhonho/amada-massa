import { Tag } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import ClienteForm from "../ClienteForm";

export default async function NovoCliente() {
  const { supabase } = await exigirEquipe();
  const [{ data: planos }, { data: pontos }] = await Promise.all([
    supabase.from("planos").select("id, nome, modalidade, paes_por_semana, valor_centavos").eq("ativo", true).order("valor_centavos"),
    supabase.from("pontos_coleta").select("id, nome, tipo, endereco, horario_texto").eq("ativo", true).order("nome"),
  ]);

  // O cliente assina um plano: sem plano cadastrado não há o que escolher.
  if (!planos?.length) {
    return (
      <>
        <PageHeader voltar={{ href: "/clientes", rotulo: "Clientes" }} titulo="Novo cliente" />
        <div className="cartao max-w-2xl">
          <Vazio icone={Tag} titulo="Cadastre um plano primeiro"
            texto="Todo cliente assina um plano do catálogo. Crie ao menos um plano e depois volte para cadastrar o cliente."
            acao={<Link href="/planos" className="btn">Ir para Planos e preços</Link>} />
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader voltar={{ href: "/clientes", rotulo: "Clientes" }} titulo="Novo cliente" subtitulo="Cadastre quem já confirmou a assinatura: dados, endereço e o plano que vai assinar." />
      <ClienteForm planos={planos} pontos={(pontos ?? []) as never} />
    </>
  );
}

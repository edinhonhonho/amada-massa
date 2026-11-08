import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import RotaForm from "../RotaForm";

export default async function NovaRota() {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome");
  return (
    <>
      <PageHeader voltar={{ href: "/rotas", rotulo: "Rotas" }} titulo="Nova rota" subtitulo="Uma rota é um grupo de clientes de entrega atendido pelo mesmo entregador no mesmo dia." />
      <div className="cartao max-w-2xl !p-6"><RotaForm entregadores={data ?? []} /></div>
    </>
  );
}

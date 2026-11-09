import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { carregarDadosEditor } from "../dados";
import RotaEditor from "../RotaEditor";

export default async function NovaRota() {
  const { supabase } = await exigirEquipe();
  const dados = await carregarDadosEditor(supabase);
  return (
    <>
      <PageHeader voltar={{ href: "/rotas", rotulo: "Rotas" }} titulo="Nova rota" subtitulo="Escolha os clientes, deixe o sistema sugerir a ordem e trace o caminho no mapa para o entregador." />
      <RotaEditor {...dados} />
    </>
  );
}

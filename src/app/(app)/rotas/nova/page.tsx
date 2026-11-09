import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { carregarDadosEditor } from "../dados";
import RotaEditor from "../RotaEditor";

export default async function NovaRota() {
  const { supabase } = await exigirEquipe();
  const dados = await carregarDadosEditor(supabase);
  return (
    <>
      <PageHeader voltar={{ href: "/rotas", rotulo: "Rotas" }} titulo="Nova rota" subtitulo="Diga quem é o responsável e quais bairros a rota cobre. O resto é montado a cada semana." />
      <RotaEditor {...dados} />
    </>
  );
}

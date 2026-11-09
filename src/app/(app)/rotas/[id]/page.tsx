import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { carregarDadosEditor } from "../dados";
import RotaEditor, { type RotaDados } from "../RotaEditor";

export default async function Rota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const [{ data: rota }, dados] = await Promise.all([
    supabase.from("rotas").select("*").eq("id", id).single(),
    carregarDadosEditor(supabase, id),
  ]);
  if (!rota) notFound();

  const inicial: RotaDados = {
    id: rota.id, nome: rota.nome, descricao: rota.descricao, cor: rota.cor, dia_semana: rota.dia_semana,
    janela_inicio: rota.janela_inicio, janela_fim: rota.janela_fim, entregador_id: rota.entregador_id,
    capacidade_paes: rota.capacidade_paes, ativa: rota.ativa, origem_ponto_id: rota.origem_ponto_id,
    trajeto: rota.trajeto, distancia_m: rota.distancia_m, duracao_s: rota.duracao_s,
  };
  return (
    <>
      <PageHeader
        voltar={{ href: "/rotas", rotulo: "Rotas" }}
        titulo={<span className="flex items-center gap-3"><span className="size-4 rounded-full" style={{ background: rota.cor }} />{rota.nome}</span>}
        etiqueta={!rota.ativa ? <Badge>Inativa</Badge> : undefined}
        subtitulo="Altere os clientes, a ordem das paradas e o traçado. O entregador vê o mapa e a sequência no app dele."
      />
      <RotaEditor key={rota.id} rota={inicial} {...dados} />
    </>
  );
}

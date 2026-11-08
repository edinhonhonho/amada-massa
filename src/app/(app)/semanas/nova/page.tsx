import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { segundaDe } from "@/lib/semana";
import { criarSemana } from "../actions";

export default async function NovaSemana({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await exigirEquipe();
  const { erro } = await searchParams;
  const sugestao = adicionarDias(segundaDe(hojeISO()), 7);
  return (
    <>
      <PageHeader voltar={{ href: "/semanas", rotulo: "Semanas" }} titulo="Nova semana" subtitulo="A semana começa na segunda-feira. O sabor pode ser definido depois." />
      {erro && <p className="mb-4 max-w-xl rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Já existe uma semana começando nesta data.</p>}
      <form action={criarSemana} className="cartao grid max-w-xl grid-cols-2 gap-4 !p-6">
        <div><label className="rotulo">Início (segunda-feira)</label><input className="campo" type="date" name="inicio" defaultValue={sugestao} required /></div>
        <div><label className="rotulo">Sabor do pão</label><input className="campo" name="sabor" placeholder="A definir" /></div>
        <div className="col-span-2 flex justify-end"><SubmitButton>Criar semana</SubmitButton></div>
      </form>
    </>
  );
}

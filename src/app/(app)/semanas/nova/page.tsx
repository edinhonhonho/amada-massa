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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nova semana</h1>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-800">Já existe uma semana começando nesta data.</p>}
      <form action={criarSemana} className="cartao grid gap-3 sm:grid-cols-2">
        <div><label className="rotulo">Início (segunda-feira)</label><input className="campo" type="date" name="inicio" defaultValue={sugestao} required /></div>
        <div><label className="rotulo">Sabor do pão</label><input className="campo" name="sabor" placeholder="A definir" /></div>
        <button className="btn sm:justify-self-start">Criar</button>
      </form>
    </div>
  );
}

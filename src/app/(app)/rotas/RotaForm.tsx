import { DIAS_SEMANA } from "@/lib/dados";
import { salvarRota } from "./actions";

type Rota = { id: string; nome: string; descricao: string | null; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null; cor: string; entregador_id: string | null; capacidade_paes: number | null; ativa: boolean };

export default function RotaForm({ rota, entregadores }: { rota?: Rota; entregadores: { id: string; nome: string }[] }) {
  return (
    <form action={salvarRota} className="cartao grid gap-3 sm:grid-cols-2">
      {rota && <input type="hidden" name="id" value={rota.id} />}
      <div><label className="rotulo">Nome *</label><input className="campo" name="nome" defaultValue={rota?.nome} placeholder="Rota A" required /></div>
      <div><label className="rotulo">Cor</label><input className="campo h-11" type="color" name="cor" defaultValue={rota?.cor ?? "#b45309"} /></div>
      <div className="sm:col-span-2"><label className="rotulo">Descrição (bairros, ruas, partida, transporte)</label><textarea className="campo" name="descricao" rows={2} defaultValue={rota?.descricao ?? ""} /></div>
      <div><label className="rotulo">Dia da semana</label>
        <select className="campo" name="dia_semana" defaultValue={rota?.dia_semana ?? ""}><option value="">—</option>{DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
      <div><label className="rotulo">Entregador padrão</label>
        <select className="campo" name="entregador_id" defaultValue={rota?.entregador_id ?? ""}><option value="">—</option>{entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
      <div><label className="rotulo">Janela: início</label><input className="campo" type="time" name="janela_inicio" defaultValue={rota?.janela_inicio?.slice(0, 5) ?? ""} /></div>
      <div><label className="rotulo">Janela: fim</label><input className="campo" type="time" name="janela_fim" defaultValue={rota?.janela_fim?.slice(0, 5) ?? ""} /></div>
      <div><label className="rotulo">Capacidade (pães)</label><input className="campo" type="number" min={1} name="capacidade_paes" defaultValue={rota?.capacidade_paes ?? ""} /></div>
      {rota && <label className="flex items-center gap-2 self-end"><input type="checkbox" name="ativa" defaultChecked={rota.ativa} /> Rota ativa</label>}
      <button className="btn sm:justify-self-start">Salvar rota</button>
    </form>
  );
}

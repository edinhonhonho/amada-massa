import { DIAS_SEMANA } from "@/lib/dados";
import SubmitButton from "@/components/ui/SubmitButton";
import { salvarRota } from "./actions";

type Rota = { id: string; nome: string; descricao: string | null; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null; cor: string; entregador_id: string | null; capacidade_paes: number | null; ativa: boolean };

export default function RotaForm({ rota, entregadores }: { rota?: Rota; entregadores: { id: string; nome: string }[] }) {
  return (
    <form action={salvarRota} className="grid grid-cols-2 gap-x-4 gap-y-4">
      {rota && <input type="hidden" name="id" value={rota.id} />}
      <div><label className="rotulo">Nome <span className="text-red-500">*</span></label><input className="campo" name="nome" defaultValue={rota?.nome} placeholder="Rota A" required /></div>
      <div><label className="rotulo">Cor de identificação</label><input className="campo !h-[46px] !p-1.5" type="color" name="cor" defaultValue={rota?.cor ?? "#b45309"} /></div>
      <div className="col-span-2"><label className="rotulo">Descrição</label><textarea className="campo" name="descricao" rows={2} defaultValue={rota?.descricao ?? ""} placeholder="Bairros, ruas, ponto de partida, meio de transporte" /></div>
      <div><label className="rotulo">Dia da semana</label>
        <select className="campo" name="dia_semana" defaultValue={rota?.dia_semana ?? ""}><option value="">—</option>{DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
      <div><label className="rotulo">Entregador</label>
        <select className="campo" name="entregador_id" defaultValue={rota?.entregador_id ?? ""}><option value="">Sem entregador</option>{entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
      <div><label className="rotulo">Janela: início</label><input className="campo" type="time" name="janela_inicio" defaultValue={rota?.janela_inicio?.slice(0, 5) ?? ""} /></div>
      <div><label className="rotulo">Janela: fim</label><input className="campo" type="time" name="janela_fim" defaultValue={rota?.janela_fim?.slice(0, 5) ?? ""} /></div>
      <div><label className="rotulo">Capacidade (pães)</label><input className="campo" type="number" min={1} name="capacidade_paes" defaultValue={rota?.capacidade_paes ?? ""} placeholder="Opcional" /></div>
      {rota && <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="ativa" defaultChecked={rota.ativa} className="size-4 accent-amber-700" />Rota ativa</label>}
      <div className="col-span-2 flex justify-end"><SubmitButton>Salvar rota</SubmitButton></div>
    </form>
  );
}

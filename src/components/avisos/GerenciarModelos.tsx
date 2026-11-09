import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import SubmitButton from "@/components/ui/SubmitButton";
import type { ModeloAviso } from "@/lib/dados";
import { VARIAVEIS_AVISO } from "@/lib/avisos";
import { excluirModelo, salvarModelo } from "@/app/(app)/mensagens/actions";

function Campos({ m }: { m?: ModeloAviso }) {
  return (
    <div className="flex flex-col gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div><label className="rotulo">Nome do modelo</label><input className="campo" name="nome" required maxLength={60} defaultValue={m?.nome} placeholder="Ex.: Feriado" /></div>
      <div><label className="rotulo">Título do aviso</label><input className="campo" name="titulo" required maxLength={80} defaultValue={m?.titulo} /></div>
      <div><label className="rotulo">Texto</label><textarea className="campo min-h-24" name="corpo" required maxLength={400} defaultValue={m?.corpo} /></div>
    </div>
  );
}

/** Lista, edita, cria e apaga os modelos de aviso (valem para Mensagens, Pagamentos e ficha do cliente). */
export default function GerenciarModelos({ modelos }: { modelos: ModeloAviso[] }) {
  return (
    <Modal titulo="Modelos de aviso" descricao={`Textos prontos para reaproveitar. Use ${VARIAVEIS_AVISO.map((v) => `{${v.chave}}`).join(", ")} no título e no texto.`} gatilho={<><Pencil size={13} />Editar modelos</>} gatilhoClasse="flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900" largo>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {modelos.map((m) => (
            <li key={m.id} className="rounded-2xl bg-stone-50 p-4 shadow-inner">
              <form action={salvarModelo} className="flex flex-col gap-3">
                <Campos m={m} />
                <div className="flex items-center justify-between">
                  <button formAction={excluirModelo} formNoValidate className="flex items-center gap-1.5 text-sm text-stone-400 transition hover:text-red-700"><Trash2 size={14} />Apagar</button>
                  <SubmitButton className="btn-sec btn-pequeno">Salvar</SubmitButton>
                </div>
              </form>
            </li>
          ))}
          {!modelos.length && <li className="py-4 text-center text-sm text-stone-500">Nenhum modelo ainda. Crie o primeiro abaixo.</li>}
        </ul>
        <form action={salvarModelo} className="flex flex-col gap-3 border-t border-stone-100 pt-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Plus size={15} />Novo modelo</div>
          <Campos />
          <div className="flex justify-end"><SubmitButton>Criar modelo</SubmitButton></div>
        </form>
      </div>
    </Modal>
  );
}

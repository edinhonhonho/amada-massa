import SubmitButton from "@/components/ui/SubmitButton";
import { criarPao, salvarPao } from "./actions";

type Pao = { id: string; nome: string; descricao: string | null; ingredientes: string | null; alergenos: string | null; tradicional?: boolean };

/** Formulário de pão: sem `pao`, cadastra um novo no catálogo (e na semana, se `semanaId`); com `pao`, edita o do catálogo. */
export default function FormPao({ semanaId, pao }: { semanaId?: string; pao?: Pao }) {
  return (
    <form action={pao ? salvarPao : criarPao} className="flex flex-col gap-4">
      {semanaId && <input type="hidden" name="semana_id" value={semanaId} />}
      {pao && <input type="hidden" name="id" value={pao.id} />}
      <div><label className="rotulo">Nome do pão <span className="text-red-500">*</span></label><input className="campo" name="nome" defaultValue={pao?.nome} required placeholder="Ex.: Centeio com sementes" /></div>
      <div><label className="rotulo">Descrição curta</label><input className="campo" name="descricao" defaultValue={pao?.descricao ?? ""} placeholder="Ex.: casca crocante, miolo úmido" /></div>
      <div><label className="rotulo">Ingredientes</label><textarea className="campo" name="ingredientes" rows={3} defaultValue={pao?.ingredientes ?? ""} placeholder="Farinha de centeio, água, sal, sementes de girassol…" /></div>
      <div><label className="rotulo">Alérgenos</label><input className="campo" name="alergenos" defaultValue={pao?.alergenos ?? ""} placeholder="Separe por vírgula. Ex.: glúten, gergelim" /></div>
      <label className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3 text-sm shadow-sm">
        <input type="checkbox" name="tradicional" defaultChecked={pao?.tradicional} className="mt-0.5 size-4 accent-amber-700" />
        <span><b className="font-medium">Pão tradicional</b><span className="block text-xs text-stone-500">Fixo: entra automaticamente em todas as semanas. Cada assinatura define quantos de seus pães são tradicionais.</span></span>
      </label>
      {pao && <p className="ajuda -mt-2">A alteração vale em todas as semanas que usam este pão.</p>}
      <div className="flex justify-end"><SubmitButton>{pao ? "Salvar pão" : semanaId ? "Cadastrar e adicionar à semana" : "Cadastrar pão"}</SubmitButton></div>
    </form>
  );
}

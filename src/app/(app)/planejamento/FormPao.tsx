import SubmitButton from "@/components/ui/SubmitButton";
import { criarPao, salvarPao } from "./actions";

type Pao = { id: string; nome: string; descricao: string | null; ingredientes: string | null; alergenos: string | null };

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
      {pao && <p className="ajuda -mt-2">A alteração vale em todas as semanas que usam este pão.</p>}
      <div className="flex justify-end"><SubmitButton>{pao ? "Salvar pão" : semanaId ? "Cadastrar e adicionar à semana" : "Cadastrar pão"}</SubmitButton></div>
    </form>
  );
}

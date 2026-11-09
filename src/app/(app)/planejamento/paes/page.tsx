import { Pencil, Plus, Trash2, Wheat } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { excluirPao } from "../actions";
import FormPao from "../FormPao";

export default async function Paes({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("paes").select("id, nome, descricao, ingredientes, alergenos, tradicional, paes_semana(count)").order("nome");
  const paes = (data ?? []).map((p) => ({ ...p, usos: (p.paes_semana as unknown as { count: number }[])?.[0]?.count ?? 0 }));

  return (
    <>
      <PageHeader
        voltar={{ href: "/planejamento", rotulo: "Planejamento" }}
        titulo="Catálogo de pães"
        subtitulo="Cadastre cada pão uma vez e use em quantas semanas quiser."
        acoes={<Modal titulo="Novo pão" gatilho={<><Plus size={16} />Novo pão</>} gatilhoClasse="btn" largo><FormPao /></Modal>}
      />
      {erro && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">{erro}</p>}
      {!paes.length ? (
        <div className="cartao"><Vazio icone={Wheat} titulo="Nenhum pão cadastrado" texto="Cadastre aqui ou direto na semana, em Adicionar pão." /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {paes.map((p) => (
            <article key={p.id} className="cartao flex flex-col gap-2 transition hover:shadow-lg">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-sm"><Wheat size={19} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 font-semibold leading-tight">{p.nome}{p.tradicional && <span className="selo selo-ambar">Tradicional</span>}</h2>
                  {p.descricao && <p className="text-sm text-stone-500">{p.descricao}</p>}
                </div>
                <Modal titulo="Editar pão" gatilho={<Pencil size={15} />} gatilhoClasse="btn-ghost !p-2" largo><FormPao pao={p} /></Modal>
              </div>
              {p.ingredientes && <p className="text-sm text-stone-700"><span className="text-stone-400">Ingredientes: </span>{p.ingredientes}</p>}
              {p.alergenos && (
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-stone-400">Contém</span>
                  {p.alergenos.split(",").map((a: string) => a.trim()).filter(Boolean).map((a: string) => <span key={a} className="selo selo-laranja">{a}</span>)}</div>
              )}
              <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                <span>{p.usos ? `Em ${p.usos} semana${p.usos > 1 ? "s" : ""}` : "Ainda não usado"}</span>
                {!p.usos && (
                  <form action={excluirPao}><input type="hidden" name="id" value={p.id} />
                    <SubmitButton className="btn-ghost !px-2 !py-1 text-xs hover:!bg-red-50 hover:!text-red-700"><Trash2 size={13} />Excluir</SubmitButton></form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

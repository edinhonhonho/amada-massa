import { revalidatePath } from "next/cache";
import { MapPin, Pencil, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";

async function salvarPonto(f: FormData) {
  "use server";
  const { supabase } = await exigirEquipe();
  const id = String(f.get("id") ?? "");
  const nome = String(f.get("nome") ?? "").trim();
  const endereco = String(f.get("endereco") ?? "").trim();
  if (!nome || !endereco) return;
  const dados = {
    nome, endereco,
    horario_texto: String(f.get("horario_texto") ?? "").trim() || null,
    responsavel: String(f.get("responsavel") ?? "").trim() || null,
    telefone: String(f.get("telefone") ?? "").trim() || null,
    ativo: id ? f.get("ativo") === "on" : true,
  };
  if (id) await supabase.from("pontos_coleta").update(dados).eq("id", id);
  else await supabase.from("pontos_coleta").insert(dados);
  revalidatePath("/pontos-coleta");
}

type Ponto = { id: string; nome: string; endereco: string; horario_texto: string | null; responsavel: string | null; telefone: string | null; ativo: boolean };

function Form({ p }: { p?: Ponto }) {
  return (
    <form action={salvarPonto} className="grid grid-cols-2 gap-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div><label className="rotulo">Nome <span className="text-red-500">*</span></label><input className="campo" name="nome" defaultValue={p?.nome} required /></div>
      <div><label className="rotulo">Endereço <span className="text-red-500">*</span></label><input className="campo" name="endereco" defaultValue={p?.endereco} required /></div>
      <div className="col-span-2"><label className="rotulo">Dia e horário de retirada</label><input className="campo" name="horario_texto" defaultValue={p?.horario_texto ?? ""} placeholder="Ex.: Quarta 11h30–18h" /></div>
      <div><label className="rotulo">Responsável</label><input className="campo" name="responsavel" defaultValue={p?.responsavel ?? ""} /></div>
      <div><label className="rotulo">Telefone</label><input className="campo" name="telefone" defaultValue={p?.telefone ?? ""} /></div>
      {p && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} className="size-4 accent-amber-700" />Ponto ativo</label>}
      <div className="col-span-2 flex justify-end"><SubmitButton>{p ? "Salvar ponto" : "Adicionar ponto"}</SubmitButton></div>
    </form>
  );
}

export default async function Pontos() {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("pontos_coleta").select("*").order("nome");
  return (
    <>
      <PageHeader
        titulo="Pontos de coleta"
        subtitulo="Onde os clientes de coleta retiram o pão. Cada assinatura de coleta aponta para um ponto."
        acoes={<Modal titulo="Novo ponto de coleta" gatilho={<><Plus size={16} />Novo ponto</>} gatilhoClasse="btn" largo><Form /></Modal>}
      />
      <div className="grid grid-cols-2 gap-4">
        {data?.map((p) => (
          <article key={p.id} className={`cartao flex flex-col gap-2 ${p.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><MapPin size={18} /></span>
              <div className="min-w-0 flex-1"><h2 className="font-semibold leading-tight">{p.nome}</h2><p className="text-sm text-stone-500">{p.endereco}</p></div>
              {!p.ativo && <Badge>Inativo</Badge>}
            </div>
            {p.horario_texto && <p className="text-sm text-stone-700">{p.horario_texto}</p>}
            {(p.responsavel || p.telefone) && <p className="text-sm text-stone-500">{[p.responsavel, p.telefone].filter(Boolean).join(" · ")}</p>}
            <div className="mt-auto pt-2">
              <Modal titulo="Editar ponto de coleta" gatilho={<><Pencil size={14} />Editar</>} gatilhoClasse="btn-sec btn-pequeno" largo><Form p={p} /></Modal>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

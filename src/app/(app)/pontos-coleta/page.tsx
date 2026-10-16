import { revalidatePath } from "next/cache";
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

function Form({ p }: { p?: { id: string; nome: string; endereco: string; horario_texto: string | null; responsavel: string | null; telefone: string | null; ativo: boolean } }) {
  return (
    <form action={salvarPonto} className="grid gap-2 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input className="campo" name="nome" defaultValue={p?.nome} placeholder="Nome" required />
      <input className="campo" name="endereco" defaultValue={p?.endereco} placeholder="Endereço" required />
      <input className="campo sm:col-span-2" name="horario_texto" defaultValue={p?.horario_texto ?? ""} placeholder="Dia e horário" />
      <input className="campo" name="responsavel" defaultValue={p?.responsavel ?? ""} placeholder="Responsável" />
      <input className="campo" name="telefone" defaultValue={p?.telefone ?? ""} placeholder="Telefone" />
      {p && <label className="flex items-center gap-2"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo</label>}
      <button className="btn-sec sm:justify-self-start">{p ? "Salvar" : "Adicionar"}</button>
    </form>
  );
}

export default async function Pontos() {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("pontos_coleta").select("*").order("nome");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Pontos de coleta</h1>
      {data?.map((p) => <div key={p.id} className="cartao"><Form p={p} /></div>)}
      <details className="cartao"><summary className="cursor-pointer font-medium">Novo ponto</summary><div className="mt-3"><Form /></div></details>
    </div>
  );
}

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";

async function salvar(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  for (const [chave, v] of f.entries()) {
    const n = Number(v);
    if (typeof v === "string" && Number.isInteger(n) && n >= 0 && n <= 365) await supabase.from("configuracoes").update({ valor: n }).eq("chave", chave);
  }
  await supabase.rpc("reavaliar_entregas");
  revalidatePath("/configuracoes");
}

export default async function Configuracoes() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("configuracoes").select("*").order("chave");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <form action={salvar} className="cartao flex flex-col gap-3">
        {data?.map((c) => (
          <div key={c.chave}><label className="rotulo" htmlFor={c.chave}>{c.descricao}</label><input className="campo w-32" id={c.chave} name={c.chave} type="number" min={0} defaultValue={c.valor} /></div>
        ))}
        <button className="btn self-start">Salvar</button>
      </form>
      <p className="text-sm text-stone-600">Contas da equipe: crie em Supabase → Authentication → Users e ajuste o perfil na tabela <code>usuarios</code> (ver README).</p>
    </div>
  );
}

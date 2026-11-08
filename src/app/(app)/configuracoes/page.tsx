import { revalidatePath } from "next/cache";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
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
    <>
      <PageHeader titulo="Configurações" subtitulo="Regras de cobrança e de suspensão de entrega." />
      <form action={salvar} className="cartao flex max-w-xl flex-col gap-5 !p-6">
        {data?.map((c) => (
          <div key={c.chave}>
            <label className="rotulo" htmlFor={c.chave}>{c.descricao}</label>
            <div className="flex items-center gap-2"><input className="campo !w-28" id={c.chave} name={c.chave} type="number" min={0} defaultValue={c.valor} /><span className="text-sm text-stone-500">dias</span></div>
          </div>
        ))}
        <div className="flex justify-end"><SubmitButton>Salvar configurações</SubmitButton></div>
      </form>
      <p className="mt-4 max-w-xl text-sm text-stone-500">Contas da equipe: crie em Supabase → Authentication → Users e ajuste o perfil e o nome na tabela <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">usuarios</code> (ver README).</p>
    </>
  );
}

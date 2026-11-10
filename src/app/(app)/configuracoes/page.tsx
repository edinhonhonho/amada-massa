import { revalidatePath } from "next/cache";
import { renovarConfiguracoes } from "@/lib/cache";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import CampoDias from "@/components/CampoDias";
import ListaAtalhos from "@/components/ListaAtalhos";
import { exigirAdmin, usuarioAtual } from "@/lib/auth";

async function salvar(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  for (const [chave, v] of f.entries()) {
    const n = Number(v);
    if (typeof v === "string" && Number.isInteger(n) && n >= 0 && n <= 365) await supabase.from("configuracoes").update({ valor: n }).eq("chave", chave);
  }
  await supabase.rpc("reavaliar_entregas");
  renovarConfiguracoes();
  revalidatePath("/configuracoes");
}

export default async function Configuracoes() {
  const { supabase, usuario } = await usuarioAtual();
  const admin = usuario.perfil === "admin";
  const { data } = admin ? await supabase.from("configuracoes").select("*").order("chave") : { data: null };
  return (
    <>
      <PageHeader titulo="Configurações" />
      <div className="flex max-w-5xl flex-col gap-6">
        <section id="atalhos" className="cartao scroll-mt-6 !p-6">
          <div className="cartao-titulo">Atalhos de teclado</div>
          <ListaAtalhos />
        </section>

        {admin && (
          <>
            <form action={salvar} className="cartao flex max-w-xl flex-col gap-5 !p-6">
              <div className="cartao-titulo !mb-0">Cobrança e suspensão de entrega</div>
              {data?.map((c) => (
                <div key={c.chave} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-stone-200/70 pb-5 last:border-0 last:pb-0">
                  <label className="min-w-0 flex-1 basis-56 text-sm text-stone-700" htmlFor={c.chave}>{c.descricao}</label>
                  <CampoDias nome={c.chave} valor={c.valor} />
                </div>
              ))}
              <div className="flex justify-end"><SubmitButton>Salvar configurações</SubmitButton></div>
            </form>
            <p className="max-w-xl text-sm text-stone-500">Contas da equipe: crie em Supabase → Authentication → Users e ajuste o perfil e o nome na tabela <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">usuarios</code> (ver README).</p>
          </>
        )}
      </div>
    </>
  );
}

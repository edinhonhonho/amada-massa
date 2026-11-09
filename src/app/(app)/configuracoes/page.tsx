import { revalidatePath } from "next/cache";
import { renovarConfiguracoes } from "@/lib/cache";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import GeradorVapid from "@/components/GeradorVapid";
import ListaAtalhos from "@/components/ListaAtalhos";
import { exigirAdmin, usuarioAtual } from "@/lib/auth";
import { gruposVisiveis } from "@/lib/nav";
import { diagnosticoPush } from "@/lib/notificar";

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
  const grupos = gruposVisiveis(admin).map((g) => ({ titulo: g.titulo ?? "", itens: g.itens.map((i) => ({ rotulo: i.rotulo, atalho: i.atalho })) }));
  return (
    <>
      <PageHeader titulo="Configurações" />
      <div className="flex max-w-5xl flex-col gap-6">
        <section id="atalhos" className="cartao scroll-mt-6 !p-6">
          <div className="cartao-titulo">Atalhos de teclado</div>
          <ListaAtalhos grupos={grupos} />
        </section>

        {admin && (
          <>
            <form action={salvar} className="cartao flex max-w-xl flex-col gap-5 !p-6">
              <div className="cartao-titulo !mb-0">Cobrança e suspensão de entrega</div>
              {data?.map((c) => (
                <div key={c.chave}>
                  <label className="rotulo" htmlFor={c.chave}>{c.descricao}</label>
                  <div className="flex items-center gap-2"><input className="campo !w-28" id={c.chave} name={c.chave} type="number" min={0} defaultValue={c.valor} /><span className="text-sm text-stone-500">dias</span></div>
                </div>
              ))}
              <div className="flex justify-end"><SubmitButton>Salvar configurações</SubmitButton></div>
            </form>
            <GeradorVapid problema={diagnosticoPush()[0]} />
            <p className="max-w-xl text-sm text-stone-500">Contas da equipe: crie em Supabase → Authentication → Users e ajuste o perfil e o nome na tabela <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">usuarios</code> (ver README).</p>
          </>
        )}
      </div>
    </>
  );
}

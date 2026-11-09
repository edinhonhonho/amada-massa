import { redirect } from "next/navigation";
import InstalarApp from "@/components/InstalarApp";
import LogoApp from "@/components/LogoApp";
import CampoSenha from "@/components/ui/CampoSenha";
import { createClient } from "@/lib/supabase/server";

async function entrar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
  });
  if (error) redirect("/entregador/entrar?erro=1");
  redirect("/entregador");
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col justify-center gap-9 py-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <LogoApp tamanho={68} />
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Entregas</h1>
          <p className="mt-1 text-[17px] text-stone-500">Amada Massa · app do entregador</p>
        </div>
      </header>
      {erro && <p className="rounded-2xl bg-red-50 p-4 text-[15px] text-red-800">E-mail ou senha incorretos.</p>}
      <form action={entrar} className="flex flex-col gap-5 rounded-[32px] bg-white p-7 shadow-[0_1px_2px_rgba(28,25,23,.04),0_24px_50px_-26px_rgba(28,25,23,.35)]">
        <div><label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="email">E-mail</label><input className="campo !rounded-2xl !py-4 text-base" id="email" name="email" type="email" required autoComplete="username" /></div>
        <div><label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="senha">Senha</label><CampoSenha id="senha" name="senha" /></div>
        <button className="btn !rounded-full !py-4 text-base">Entrar</button>
      </form>
      <InstalarApp nome="de Entregas" />
    </main>
  );
}

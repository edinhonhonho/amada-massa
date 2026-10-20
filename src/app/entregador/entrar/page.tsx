import { redirect } from "next/navigation";
import InstalarApp from "@/components/InstalarApp";
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
    <main className="flex min-h-screen flex-col justify-center gap-5 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-amber-800">Amada Massa</h1>
        <p className="text-stone-600">Entregas</p>
      </header>
      <InstalarApp nome="de Entregas" />
      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-800">E-mail ou senha incorretos.</p>}
      <form action={entrar} className="cartao flex flex-col gap-4">
        <div><label className="rotulo" htmlFor="email">E-mail</label><input className="campo" id="email" name="email" type="email" required autoComplete="username" /></div>
        <div><label className="rotulo" htmlFor="senha">Senha</label><input className="campo" id="senha" name="senha" type="password" required autoComplete="current-password" /></div>
        <button className="btn py-3 text-lg">Entrar</button>
      </form>
    </main>
  );
}

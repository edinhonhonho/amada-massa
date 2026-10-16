import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function entrar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
  });
  if (error) redirect("/login?erro=credenciais");
  redirect("/");
}

async function recuperar(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (email) await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/redefinir-senha` });
  redirect("/login?enviado=1");
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { erro, enviado } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-amber-800">Amada Massa</h1>
        <p className="text-stone-600">Clube do Pão · acesso da equipe</p>
      </header>
      {erro === "credenciais" && <p className="rounded-lg bg-red-50 p-3 text-red-800">E-mail ou senha incorretos.</p>}
      {erro === "link" && <p className="rounded-lg bg-red-50 p-3 text-red-800">Link inválido ou expirado.</p>}
      {erro === "inativo" && <p className="rounded-lg bg-red-50 p-3 text-red-800">Conta inativa. Fale com o administrador.</p>}
      {enviado && <p className="rounded-lg bg-green-50 p-3 text-green-800">Se o e-mail existir, enviamos o link de recuperação.</p>}
      <form action={entrar} className="cartao flex flex-col gap-4">
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input className="campo" id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input className="campo" id="senha" name="senha" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn">Entrar</button>
      </form>
      <details className="text-sm text-stone-600">
        <summary className="cursor-pointer">Esqueci minha senha</summary>
        <form action={recuperar} className="mt-3 flex gap-2">
          <input className="campo" name="email" type="email" placeholder="seu e-mail" required />
          <button className="btn-sec">Enviar</button>
        </form>
      </details>
    </main>
  );
}

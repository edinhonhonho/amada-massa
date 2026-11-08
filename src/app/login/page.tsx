import { redirect } from "next/navigation";
import { CalendarDays, Truck, Wallet } from "lucide-react";
import SubmitButton from "@/components/ui/SubmitButton";
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
    <main className="grid min-h-screen grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">🍞</span><span className="text-xl font-semibold tracking-tight">Amada Massa</span></div>
        <div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Pão de fermentação natural, da massa à porta.</h2>
          <ul className="mt-8 space-y-4 text-amber-50/90">
            {[[Wallet, "Receba as mensalidades", "Cobranças automáticas e atrasos à vista."], [CalendarDays, "Planeje a semana", "Sabor, produção e listas num só lugar."], [Truck, "Acompanhe as entregas", "Rotas, fotos e avisos aos membros."]].map(([Icone, t, d]) => {
              const I = Icone as typeof Wallet;
              return <li key={t as string} className="flex items-start gap-3"><span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-white/10"><I size={16} /></span><span><b className="block text-white">{t as string}</b><span className="text-sm">{d as string}</span></span></li>;
            })}
          </ul>
        </div>
        <p className="text-sm text-amber-100/70">Clube do Pão · gestão interna</p>
        <span className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-amber-400/20 blur-3xl" />
      </section>

      <section className="flex flex-col justify-center px-8 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
          <p className="mb-6 mt-1 text-stone-500">Acesso da equipe do clube.</p>
          {erro === "credenciais" && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">E-mail ou senha incorretos.</p>}
          {erro === "link" && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Link inválido ou expirado.</p>}
          {erro === "inativo" && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Conta inativa. Fale com o administrador.</p>}
          {enviado && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Se o e-mail existir, enviamos o link de recuperação.</p>}
          <form action={entrar} className="flex flex-col gap-4">
            <div><label className="rotulo" htmlFor="email">E-mail</label><input className="campo" id="email" name="email" type="email" required autoComplete="username" /></div>
            <div><label className="rotulo" htmlFor="senha">Senha</label><input className="campo" id="senha" name="senha" type="password" required autoComplete="current-password" /></div>
            <SubmitButton className="btn !py-3 text-base">Entrar</SubmitButton>
          </form>
          <details className="mt-6 text-sm text-stone-600">
            <summary className="cursor-pointer select-none hover:text-stone-900">Esqueci minha senha</summary>
            <form action={recuperar} className="mt-3 flex gap-2">
              <input className="campo" name="email" type="email" placeholder="seu e-mail" required />
              <button className="btn-sec">Enviar</button>
            </form>
          </details>
        </div>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import CampoSenha from "@/components/ui/CampoSenha";
import Modal from "@/components/ui/Modal";
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
      <section className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 lg:flex">
        <div className="flex flex-col items-center gap-4 text-white">
          <span className="flex size-24 items-center justify-center rounded-[28px] bg-white/15 text-5xl shadow-2xl backdrop-blur">🍞</span>
          <span className="text-3xl font-semibold tracking-tight">Amada Massa</span>
        </div>
        <span className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-amber-400/20 blur-3xl" />
        <span className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-amber-300/10 blur-3xl" />
      </section>

      <section className="flex flex-col justify-center px-8 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-6 text-3xl font-semibold tracking-tight">Entrar</h1>
          {erro === "credenciais" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">E-mail ou senha incorretos.</p>}
          {erro === "link" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">Link inválido ou expirado.</p>}
          {erro === "inativo" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">Conta inativa. Fale com o administrador.</p>}
          {enviado && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 shadow-sm">Se o e-mail existir, enviamos o link de recuperação.</p>}
          <form action={entrar} className="flex flex-col gap-4">
            <div><label className="rotulo" htmlFor="email">E-mail</label><input className="campo" id="email" name="email" type="email" required autoComplete="username" /></div>
            <div><label className="rotulo" htmlFor="senha">Senha</label><CampoSenha id="senha" name="senha" /></div>
            <SubmitButton className="btn !py-3 text-base">Entrar</SubmitButton>
          </form>
          <div className="mt-5 text-center">
            <Modal titulo="Recuperar senha" descricao="Enviamos um link para você criar uma nova senha." gatilho="Esqueci minha senha" gatilhoClasse="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-50">
              <form action={recuperar} className="flex flex-col gap-4">
                <div><label className="rotulo" htmlFor="email-rec">E-mail da sua conta</label><input className="campo" id="email-rec" name="email" type="email" required autoComplete="email" /></div>
                <div className="flex justify-end"><SubmitButton>Enviar link</SubmitButton></div>
              </form>
            </Modal>
          </div>
        </div>
      </section>
    </main>
  );
}

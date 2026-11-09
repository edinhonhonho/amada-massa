import { redirect } from "next/navigation";
import CampoSenha from "@/components/ui/CampoSenha";
import { createClient } from "@/lib/supabase/server";

async function salvar(formData: FormData) {
  "use server";
  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) redirect("/redefinir-senha?erro=curta");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) redirect("/redefinir-senha?erro=falha");
  redirect("/");
}

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Nova senha</h1>
      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-800">{erro === "curta" ? "Use ao menos 8 caracteres." : "Link expirado. Peça outro."}</p>}
      <form action={salvar} className="cartao flex flex-col gap-4">
        <CampoSenha id="senha" name="senha" minLength={8} autoComplete="new-password" />
        <button className="btn">Salvar</button>
      </form>
    </main>
  );
}

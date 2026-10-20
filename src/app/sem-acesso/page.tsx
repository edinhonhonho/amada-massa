import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function sair() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function SemAcesso({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Sem acesso</h1>
      <p className="text-stone-600">
        {motivo === "inativo" ? "Sua conta está inativa." : "Esta conta não tem acesso à área de gestão."} Fale com o administrador.
      </p>
      <form action={sair}><button className="btn">Sair</button></form>
    </main>
  );
}

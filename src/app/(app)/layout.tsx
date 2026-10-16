import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function sair() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await usuarioAtual();
  const equipe = usuario.perfil !== "entregador";
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4">
        <Link href="/" className="text-lg font-bold text-amber-800">Amada Massa</Link>
        {equipe && (
          <>
            <Link href="/clientes" className="hover:underline">Clientes</Link>
            <Link href="/planos" className="hover:underline">Planos</Link>
            <Link href="/pontos-coleta" className="hover:underline">Pontos de coleta</Link>
          </>
        )}
        <Link href="/entregas" className="hover:underline">Entregas</Link>
        <form action={sair} className="ml-auto flex items-center gap-3 text-sm text-stone-600">
          <span>{usuario.nome} · {usuario.perfil}</span>
          <button className="underline">Sair</button>
        </form>
      </nav>
      <main>{children}</main>
    </div>
  );
}

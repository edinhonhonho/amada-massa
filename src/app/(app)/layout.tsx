import Link from "next/link";
import { redirect } from "next/navigation";
import SairBotao from "@/components/SairBotao";
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
  if (usuario.perfil === "entregador") redirect("/entregador");
  const admin = usuario.perfil === "admin";
  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4">
        <Link href="/" className="text-lg font-bold text-amber-800">Amada Massa</Link>
        <Link href="/clientes" className="hover:underline">Clientes</Link>
        <Link href="/planos" className="hover:underline">Planos</Link>
        <Link href="/pagamentos" className="hover:underline">Pagamentos</Link>
        <Link href="/rotas" className="hover:underline">Rotas</Link>
        <Link href="/semanas" className="hover:underline">Semanas</Link>
        <Link href="/entregas/historico" className="hover:underline">Entregas</Link>
        <Link href="/mensagens" className="hover:underline">Mensagens</Link>
        <Link href="/pontos-coleta" className="hover:underline">Pontos de coleta</Link>
        {admin && <Link href="/relatorios" className="hover:underline">Relatórios</Link>}
        {admin && <Link href="/configuracoes" className="hover:underline">Configurações</Link>}
        <form action={sair} className="ml-auto flex items-center gap-3 text-sm text-stone-600">
          <span>{usuario.nome} · {usuario.perfil}</span>
          <SairBotao />
        </form>
      </nav>
      <main>{children}</main>
    </div>
  );
}

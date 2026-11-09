import { redirect } from "next/navigation";
import Atalhos from "@/components/shell/Atalhos";
import Sidebar from "@/components/shell/Sidebar";
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
    <div className="moldura flex min-h-screen gap-3 bg-fundo p-3">
      <Sidebar admin={admin} nome={usuario.nome} perfil={usuario.perfil} sair={sair} />
      <main className="min-h-[calc(100dvh-1.5rem)] min-w-0 flex-1 rounded-[28px] bg-white shadow-[0_1px_2px_rgba(28,25,23,.05),0_0_0_1px_rgba(28,25,23,.02)] print:rounded-none print:shadow-none">
        <div className="entra max-w-[1360px] px-9 py-7">{children}</div>
      </main>
      <Atalhos admin={admin} />
    </div>
  );
}

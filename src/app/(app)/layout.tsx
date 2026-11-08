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
    <div className="flex min-h-screen">
      <Sidebar admin={admin} nome={usuario.nome} perfil={usuario.perfil} sair={sair} />
      <main className="min-w-0 flex-1">
        <div className="entra mx-auto max-w-[1180px] px-10 py-8">{children}</div>
      </main>
      <Atalhos admin={admin} />
    </div>
  );
}

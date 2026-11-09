import { LogOut } from "lucide-react";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import Avatar from "@/components/ui/Avatar";
import InstalarApp from "@/components/InstalarApp";
import NavMembro from "@/components/membro/NavMembro";
import { createClient } from "@/lib/supabase/server";
import { limparChavePublica } from "@/lib/vapid";
import { sairMembro } from "../actions";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const supabase = await createClient();
  const [{ data: nome }, { count }] = await Promise.all([
    supabase.rpc("meu_cliente_nome"),
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).is("lida_em", null),
  ]);
  const nomeCompleto = typeof nome === "string" ? nome : "";

  return (
    <>
      <main className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight">Ajustes</h1>
          <p className="text-[17px] text-stone-500">Deixe o app pronto para avisar você.</p>
        </header>

        <InstalarApp nome="Amada Massa" />
        <AtivarNotificacoes publicKey={limparChavePublica(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)} />

        <section className="flex items-center gap-4 rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,.04),0_14px_32px_-22px_rgba(28,25,23,.25)]">
          {nomeCompleto && <Avatar nome={nomeCompleto} tamanho={48} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold">{nomeCompleto || "Sua conta"}</div>
            <div className="text-sm text-stone-500">Cliente do Clube do Pão</div>
          </div>
          <form action={sairMembro}>
            <button className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-200 active:scale-[.97]"><LogOut size={16} />Sair</button>
          </form>
        </section>
      </main>
      <NavMembro naoLidas={count ?? 0} />
    </>
  );
}

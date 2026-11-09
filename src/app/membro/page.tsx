import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import InstalarApp from "@/components/InstalarApp";
import MarcarLidas from "@/components/MarcarLidas";
import { quando } from "@/lib/avisos";
import { createClient } from "@/lib/supabase/server";
import { sairMembro } from "./actions";

export const dynamic = "force-dynamic";

export default async function Membro() {
  const supabase = await createClient();
  const { data: membro } = await supabase.from("membros").select("cliente_id").maybeSingle();

  if (!membro) {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Área de membros</h1>
        <p className="text-stone-600">Esta conta não é de um membro do clube.</p>
        <form action={sairMembro}><button className="btn">Sair</button></form>
      </main>
    );
  }

  const [{ data: nome }, { data: notificacoes }] = await Promise.all([
    supabase.rpc("meu_cliente_nome"),
    supabase.from("notificacoes").select("id, titulo, corpo, criada_em, lida_em").order("criada_em", { ascending: false }).limit(50),
  ]);
  const naoLidas = (notificacoes ?? []).some((n) => !n.lida_em);

  return (
    <main className="flex flex-col gap-4 py-4">
      <header className="flex items-center">
        <div>
          <h1 className="text-2xl font-bold text-amber-800">Olá{nome ? `, ${nome}` : ""}!</h1>
          <p className="text-sm text-stone-600">Seus avisos do Clube do Pão</p>
        </div>
        <form action={sairMembro} className="ml-auto"><button className="text-sm underline">Sair</button></form>
      </header>

      <InstalarApp nome="Amada Massa" />
      <AtivarNotificacoes publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <section className="flex flex-col gap-2">
        {!notificacoes?.length && <p className="cartao text-stone-500">Nenhum aviso por enquanto. Eles aparecem aqui quando houver novidades da sua entrega.</p>}
        {notificacoes?.map((n) => (
          <article key={n.id} className={`cartao ${n.lida_em ? "" : "bg-amber-50 shadow-md"}`}>
            <h2 className="font-semibold">{n.titulo}</h2>
            <p>{n.corpo}</p>
            <p className="mt-1 text-xs text-stone-500">{quando(n.criada_em)}</p>
          </article>
        ))}
      </section>
      <MarcarLidas temNaoLidas={naoLidas} />
    </main>
  );
}

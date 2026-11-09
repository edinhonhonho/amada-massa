import { BellOff, LogOut } from "lucide-react";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import AtualizarAuto from "@/components/AtualizarAuto";
import InstalarApp from "@/components/InstalarApp";
import LogoApp from "@/components/LogoApp";
import MarcarLidas from "@/components/MarcarLidas";
import { EMOJI_TIPO, horaCurta, rotuloDia } from "@/lib/avisos";
import { createClient } from "@/lib/supabase/server";
import { sairMembro } from "./actions";

export const dynamic = "force-dynamic";

type Notificacao = { id: string; tipo: string; titulo: string; corpo: string; criada_em: string; lida_em: string | null };

export default async function Membro() {
  const supabase = await createClient();
  const { data: membro } = await supabase.from("membros").select("cliente_id").maybeSingle();

  if (!membro) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <LogoApp tamanho={56} />
        <h1 className="text-2xl font-bold">Amada Massa</h1>
        <p className="text-stone-600">Esta conta não é de um cliente do clube. Entre com o e-mail e o telefone do seu cadastro.</p>
        <form action={sairMembro}><button className="btn">Sair</button></form>
      </main>
    );
  }

  const [{ data: nome }, { data: lista }] = await Promise.all([
    supabase.rpc("meu_cliente_nome"),
    supabase.from("notificacoes").select("id, tipo, titulo, corpo, criada_em, lida_em").order("criada_em", { ascending: false }).limit(60),
  ]);
  const notificacoes = (lista ?? []) as Notificacao[];
  const naoLidas = notificacoes.filter((n) => !n.lida_em).length;
  const primeiroNome = typeof nome === "string" ? nome.trim().split(/\s+/)[0] : "";

  // agrupa por dia, mantendo a ordem (mais novo primeiro)
  const dias: { dia: string; itens: Notificacao[] }[] = [];
  for (const n of notificacoes) {
    const dia = rotuloDia(n.criada_em);
    const ultimo = dias[dias.length - 1];
    if (ultimo?.dia === dia) ultimo.itens.push(n); else dias.push({ dia, itens: [n] });
  }

  return (
    <main className="flex flex-col gap-5 py-5">
      <AtualizarAuto />
      <header className="flex items-center gap-3">
        <LogoApp tamanho={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">Olá{primeiroNome ? `, ${primeiroNome}` : ""}!</h1>
          <p className="text-sm text-stone-500">{naoLidas ? `${naoLidas} ${naoLidas === 1 ? "aviso novo" : "avisos novos"}` : "Você está em dia com os avisos"}</p>
        </div>
        <form action={sairMembro}>
          <button className="rounded-full p-2.5 text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-900" aria-label="Sair" title="Sair"><LogOut size={19} /></button>
        </form>
      </header>

      <InstalarApp nome="Amada Massa" />
      <AtivarNotificacoes publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      {!notificacoes.length ? (
        <section className="flex flex-col items-center gap-2 rounded-3xl bg-white px-6 py-12 text-center shadow-sm">
          <BellOff size={30} className="text-stone-300" />
          <h2 className="font-semibold">Nenhum aviso por enquanto</h2>
          <p className="text-sm text-stone-500">Quando sua rota sair, seu pão chegar ou o clube tiver novidades, aparece aqui.</p>
        </section>
      ) : (
        dias.map(({ dia, itens }) => (
          <section key={dia} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{dia}</h2>
            {itens.map((n) => (
              <article key={n.id} className={`relative flex gap-3 rounded-2xl p-4 ${n.lida_em ? "bg-white/70 shadow-sm" : "bg-white shadow-[0_6px_20px_-8px_rgba(146,64,14,.35)]"}`}>
                {!n.lida_em && <span className="absolute right-3 top-3 size-2 rounded-full bg-amber-600" aria-label="não lido" />}
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl" aria-hidden>{EMOJI_TIPO[n.tipo] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="pr-4 font-semibold leading-snug">{n.titulo}</h3>
                  <p className="mt-0.5 whitespace-pre-line text-[15px] leading-snug text-stone-600">{n.corpo}</p>
                  <p className="mt-1.5 text-xs text-stone-400">{horaCurta(n.criada_em)}</p>
                </div>
              </article>
            ))}
          </section>
        ))
      )}
      <MarcarLidas temNaoLidas={naoLidas > 0} />
    </main>
  );
}

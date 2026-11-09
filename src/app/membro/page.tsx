import { Bell, BellOff, LogOut } from "lucide-react";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import AtualizarAuto from "@/components/AtualizarAuto";
import InstalarApp from "@/components/InstalarApp";
import LogoApp from "@/components/LogoApp";
import MarcarLidas from "@/components/MarcarLidas";
import { EMOJI_TIPO, horaCurta, rotuloDia } from "@/lib/avisos";
import { createClient } from "@/lib/supabase/server";
import { sairMembro } from "./actions";

export const dynamic = "force-dynamic";

const TOM_TIPO: Record<string, string> = {
  rota_iniciada: "bg-amber-100", proximo: "bg-sky-100", entregue: "bg-emerald-100", nao_entregue: "bg-red-100", sabor: "bg-orange-100", aviso: "bg-violet-100",
};

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
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-5 text-white shadow-[0_18px_40px_-16px_rgba(146,64,14,.7)]">
        <div className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-12 right-10 size-28 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-start gap-3">
          <LogoApp tamanho={40} />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm text-amber-100">Amada Massa</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">Olá{primeiroNome ? `, ${primeiroNome}` : ""}!</h1>
          </div>
          <form action={sairMembro}>
            <button className="rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25" aria-label="Sair" title="Sair"><LogOut size={18} /></button>
          </form>
        </div>
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur">
          <Bell size={15} />{naoLidas ? `${naoLidas} ${naoLidas === 1 ? "aviso novo" : "avisos novos"}` : "Você está em dia com os avisos"}
        </p>
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
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-400">{dia}</h2>
            {itens.map((n) => (
              <article key={n.id} className={`relative flex gap-3.5 rounded-3xl p-4 ${n.lida_em ? "bg-white/70 shadow-sm" : "bg-white shadow-[0_10px_28px_-12px_rgba(146,64,14,.4)]"}`}>
                {!n.lida_em && <span className="absolute right-3.5 top-3.5 size-2.5 rounded-full bg-amber-600 ring-4 ring-amber-100" aria-label="não lido" />}
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl ${TOM_TIPO[n.tipo] ?? "bg-amber-50"}`} aria-hidden>{EMOJI_TIPO[n.tipo] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="pr-4 text-[15px] font-semibold leading-snug">{n.titulo}</h3>
                  <p className="mt-1 whitespace-pre-line text-[15px] leading-snug text-stone-600">{n.corpo}</p>
                  <p className="mt-2 text-xs font-medium text-stone-400">{horaCurta(n.criada_em)}</p>
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

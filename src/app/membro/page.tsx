import { Sparkle } from "lucide-react";
import FaixaConfigurar from "@/components/membro/FaixaConfigurar";
import NavMembro from "@/components/membro/NavMembro";
import LogoApp from "@/components/LogoApp";
import MarcarLidas from "@/components/MarcarLidas";
import AtualizarAuto from "@/components/AtualizarAuto";
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
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 text-center">
        <LogoApp tamanho={64} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Amada Massa</h1>
          <p className="mx-auto mt-2 max-w-xs text-stone-500">Esta conta não é de um cliente do clube. Entre com o e-mail e o telefone do seu cadastro.</p>
        </div>
        <form action={sairMembro}><button className="btn !rounded-2xl !px-8 !py-3.5">Sair</button></form>
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

  const dias: { dia: string; itens: Notificacao[] }[] = [];
  for (const n of notificacoes) {
    const dia = rotuloDia(n.criada_em);
    const ultimo = dias[dias.length - 1];
    if (ultimo?.dia === dia) ultimo.itens.push(n); else dias.push({ dia, itens: [n] });
  }

  return (
    <>
      <main className="flex flex-col gap-7">
        <AtualizarAuto />
        <header className="flex flex-col gap-1">
          <div className="mb-5 flex items-center gap-2.5 text-sm font-semibold text-stone-500"><LogoApp tamanho={28} />Amada Massa</div>
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight">Olá{primeiroNome ? `, ${primeiroNome}` : ""}</h1>
          <p className="text-[17px] text-stone-500">{naoLidas ? <><b className="font-semibold text-stone-900">{naoLidas}</b> {naoLidas === 1 ? "aviso novo" : "avisos novos"} para você</> : "Você está em dia com os avisos"}</p>
        </header>

        <FaixaConfigurar />

        {!notificacoes.length ? (
          <section className="flex flex-col items-center gap-3 rounded-[32px] bg-white px-8 py-14 text-center shadow-[0_1px_2px_rgba(28,25,23,.04),0_16px_40px_-24px_rgba(28,25,23,.2)]">
            <span className="text-5xl" aria-hidden>🥖</span>
            <h2 className="text-lg font-semibold">Tudo tranquilo por aqui</h2>
            <p className="max-w-[16rem] text-[15px] leading-relaxed text-stone-500">Quando sua rota sair, seu pão chegar ou o clube tiver novidades, você vê aqui.</p>
          </section>
        ) : (
          dias.map(({ dia, itens }) => (
            <section key={dia} className="flex flex-col gap-3">
              <h2 className="px-1 text-[13px] font-semibold text-stone-400">{dia}</h2>
              {itens.map((n) => (
                <article key={n.id} className={`flex gap-4 rounded-[28px] p-5 ${n.lida_em ? "bg-white/70" : "bg-white shadow-[0_1px_2px_rgba(28,25,23,.04),0_18px_36px_-22px_rgba(28,25,23,.3)]"}`}>
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-full text-[22px] ${TOM_TIPO[n.tipo] ?? "bg-amber-50"}`} aria-hidden>{EMOJI_TIPO[n.tipo] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="flex-1 text-[17px] font-semibold leading-snug">{n.titulo}</h3>
                      {!n.lida_em && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-amber-500" aria-label="não lido" />}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-stone-600">{n.corpo}</p>
                    <p className="mt-3 text-[13px] text-stone-400">{horaCurta(n.criada_em)}</p>
                  </div>
                </article>
              ))}
            </section>
          ))
        )}
        <p className="flex items-center justify-center gap-1.5 pb-2 text-[13px] text-stone-400"><Sparkle size={12} />Feito com carinho pela Amada Massa</p>
        <MarcarLidas temNaoLidas={naoLidas > 0} />
      </main>
      <NavMembro naoLidas={naoLidas} />
    </>
  );
}

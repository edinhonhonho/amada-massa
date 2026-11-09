"use client";

import { Bell, Camera, Flashlight, Wifi } from "lucide-react";
import { useState } from "react";

type Props = { titulo: string; corpo: string; nome?: string };

function BarraStatus({ clara }: { clara?: boolean }) {
  const cor = clara ? "text-white" : "text-stone-900";
  return (
    <div className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7 pt-3 text-[11px] font-semibold ${cor}`}>
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1">
        <span className="flex items-end gap-[1.5px]" aria-hidden>{[4, 6, 8, 10].map((h) => <i key={h} className="block w-[2.5px] rounded-[1px] bg-current" style={{ height: h }} />)}</span>
        <Wifi size={12} strokeWidth={2.6} />
        <span className="relative ml-0.5 h-[10px] w-[20px] rounded-[3px] border border-current/60"><i className="absolute inset-[1.5px] right-[3px] rounded-[1.5px] bg-current" /></span>
      </span>
    </div>
  );
}

/** Aparelho com o aviso como chega: na tela bloqueada e dentro do app Amada Massa. */
export default function PreviaCelular({ titulo, corpo, nome = "Maria" }: Props) {
  const [aba, setAba] = useState<"tela" | "app">("tela");
  const t = titulo || "Título do aviso";
  const c = corpo || "O texto aparece aqui enquanto você escreve.";
  return (
    <div>
      <div role="tablist" className="mx-auto mb-4 flex w-fit rounded-full bg-stone-200/60 p-0.5 text-xs font-medium">
        {([["tela", "Tela bloqueada"], ["app", "Dentro do app"]] as const).map(([k, r]) => (
          <button key={k} role="tab" aria-selected={aba === k} type="button" onClick={() => setAba(k)} className={`rounded-full px-3 py-1.5 transition ${aba === k ? "bg-white text-stone-900 shadow" : "text-stone-500 hover:text-stone-800"}`}>{r}</button>
        ))}
      </div>

      <div className="relative mx-auto w-[252px]">
        {/* botões laterais */}
        <i className="absolute -left-[3px] top-[84px] h-7 w-[3px] rounded-l bg-stone-600" aria-hidden />
        <i className="absolute -left-[3px] top-[128px] h-11 w-[3px] rounded-l bg-stone-600" aria-hidden />
        <i className="absolute -left-[3px] top-[182px] h-11 w-[3px] rounded-l bg-stone-600" aria-hidden />
        <i className="absolute -right-[3px] top-[140px] h-16 w-[3px] rounded-r bg-stone-600" aria-hidden />

        <div className="rounded-[2.9rem] bg-gradient-to-b from-stone-600 via-stone-800 to-stone-900 p-[3px] shadow-[0_34px_60px_-22px_rgba(28,25,23,.65)]">
          <div className="rounded-[2.75rem] bg-black p-[9px]">
            <div className={`relative h-[500px] overflow-hidden rounded-[2.15rem] ${aba === "tela" ? "bg-gradient-to-b from-amber-300 via-orange-300 to-rose-300" : "bg-gradient-to-b from-amber-50 to-stone-100"}`}>
              <div className="absolute left-1/2 top-2.5 z-20 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
              {/* reflexo */}
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/25 via-transparent to-transparent" />

              {aba === "tela" ? (
                <>
                  <BarraStatus clara />
                  <div className="pt-14 text-center text-white">
                    <div className="text-[12px] font-medium opacity-90">segunda-feira, 9 de novembro</div>
                    <div className="text-[58px] font-semibold leading-[1.02] tracking-tight">9:41</div>
                  </div>
                  <div className="mt-7 flex flex-col gap-1.5 px-2.5">
                    <div className="rounded-[18px] bg-white/80 p-2.5 shadow-[0_8px_24px_-10px_rgba(0,0,0,.45)] backdrop-blur-xl [animation:entra_.3s_ease-out]">
                      <div className="flex items-center gap-1.5 text-[10.5px] text-stone-500">
                        <span className="flex size-[17px] items-center justify-center rounded-[5px] bg-gradient-to-br from-amber-500 to-amber-800 text-[9px] font-bold text-white">A</span>
                        <span className="font-semibold uppercase tracking-wide">Amada Massa</span><span className="ml-auto">agora</span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-stone-900 [overflow-wrap:anywhere]">{t}</div>
                      <div className="mt-0.5 line-clamp-4 text-[12px] leading-snug text-stone-700 [overflow-wrap:anywhere]">{c}</div>
                    </div>
                    <div className="mx-3 h-3 rounded-b-2xl bg-white/45 backdrop-blur" />
                  </div>
                  <div className="absolute inset-x-0 bottom-5 flex items-center justify-between px-7 text-white">
                    <span className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur"><Flashlight size={17} /></span>
                    <span className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur"><Camera size={17} /></span>
                  </div>
                  <div className="absolute inset-x-0 bottom-1.5 flex justify-center"><span className="h-1 w-24 rounded-full bg-white/80" /></div>
                </>
              ) : (
                <>
                  <BarraStatus />
                  <div className="px-3 pt-14">
                    <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-3.5 text-white shadow-lg">
                      <i className="absolute -right-5 -top-6 size-20 rounded-full bg-white/10" aria-hidden />
                      <div className="relative text-[10px] text-amber-100">Amada Massa</div>
                      <div className="relative text-[18px] font-bold leading-tight">Olá, {nome}!</div>
                      <div className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium"><Bell size={10} />1 aviso novo</div>
                    </div>
                    <div className="mt-3 px-1 text-[9px] font-semibold uppercase tracking-wider text-stone-400">Hoje</div>
                    <div className="relative mt-1 flex gap-2.5 rounded-[18px] bg-white p-3 shadow-[0_10px_22px_-12px_rgba(146,64,14,.5)]">
                      <span className="absolute right-3 top-3 size-2 rounded-full bg-amber-600 ring-4 ring-amber-100" />
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-base">📣</span>
                      <div className="min-w-0 pr-3">
                        <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug [overflow-wrap:anywhere]">{t}</div>
                        <div className="mt-0.5 line-clamp-5 whitespace-pre-line text-[12px] leading-snug text-stone-600 [overflow-wrap:anywhere]">{c}</div>
                        <div className="mt-1.5 text-[10px] font-medium text-stone-400">09:41</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2.5 rounded-[18px] bg-white/70 p-3 opacity-70">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">🚲</span>
                      <div><div className="text-[12px] font-semibold">Sua rota iniciou</div><div className="text-[11px] text-stone-500">Ontem · 14:20</div></div>
                    </div>
                    <div className="mt-2 flex gap-2.5 rounded-[18px] bg-white/50 p-3 opacity-50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">🍞</span>
                      <div><div className="text-[12px] font-semibold">Seu pão chegou</div><div className="text-[11px] text-stone-500">Ontem · 15:02</div></div>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-1.5 flex justify-center"><span className="h-1 w-24 rounded-full bg-stone-900/70" /></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">Exemplo com o nome “{nome}”.</p>
    </div>
  );
}

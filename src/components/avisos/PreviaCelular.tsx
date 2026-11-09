"use client";

import { useState } from "react";

type Props = { titulo: string; corpo: string; nome?: string };

/** Como o aviso aparece: na tela bloqueada do celular e dentro do app Amada Massa. */
export default function PreviaCelular({ titulo, corpo, nome = "Maria" }: Props) {
  const [aba, setAba] = useState<"tela" | "app">("tela");
  const t = titulo || "Título do aviso";
  const c = corpo || "O texto aparece aqui enquanto você escreve.";
  return (
    <div className="sticky top-6">
      <div role="tablist" className="mx-auto mb-3 flex w-fit rounded-full bg-stone-200/60 p-0.5 text-xs font-medium">
        {([["tela", "Tela bloqueada"], ["app", "Dentro do app"]] as const).map(([k, r]) => (
          <button key={k} role="tab" aria-selected={aba === k} type="button" onClick={() => setAba(k)} className={`rounded-full px-3 py-1.5 transition ${aba === k ? "bg-white text-stone-900 shadow" : "text-stone-500 hover:text-stone-800"}`}>{r}</button>
        ))}
      </div>

      <div className="mx-auto w-[272px] rounded-[2.6rem] bg-stone-900 p-2.5 shadow-[0_30px_60px_-20px_rgba(28,25,23,.6),inset_0_0_0_2px_rgba(255,255,255,.08)]">
        <div className={`relative h-[470px] overflow-hidden rounded-[2.1rem] ${aba === "tela" ? "bg-gradient-to-b from-amber-300 via-orange-200 to-rose-200" : "bg-gradient-to-b from-amber-50 to-stone-50"}`}>
          <div className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-stone-900" />
          {aba === "tela" ? (
            <div className="pt-12 text-center text-stone-900">
              <div className="text-[11px] font-medium opacity-70">segunda-feira, 9 de novembro</div>
              <div className="text-[64px] font-light leading-none tracking-tight">9:41</div>
              <div className="mt-8 flex flex-col gap-2 px-3 text-left">
                <div className="rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur-xl [animation:entra_.3s_ease-out]">
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span className="flex size-[18px] items-center justify-center rounded-[5px] bg-gradient-to-br from-amber-500 to-amber-800 text-[10px] font-bold text-white">A</span>
                    <span className="font-semibold uppercase tracking-wide">Amada Massa</span><span className="ml-auto">agora</span>
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">{t}</div>
                  <div className="mt-0.5 line-clamp-4 text-[12.5px] leading-snug text-stone-700">{c}</div>
                </div>
                <div className="mx-2 h-9 rounded-2xl bg-white/50 shadow" />
              </div>
              <div className="absolute inset-x-0 bottom-3 flex justify-center"><span className="h-1 w-24 rounded-full bg-stone-900/40" /></div>
            </div>
          ) : (
            <div className="px-3 pt-12">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-800 p-3.5 text-white shadow-lg">
                <div className="text-[10px] text-amber-100">Amada Massa</div>
                <div className="text-lg font-bold leading-tight">Olá, {nome}!</div>
                <div className="mt-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">1 aviso novo</div>
              </div>
              <div className="mt-3 px-1 text-[9px] font-semibold uppercase tracking-wider text-stone-400">Hoje</div>
              <div className="relative mt-1 flex gap-2.5 rounded-2xl bg-white p-3 shadow-[0_8px_20px_-10px_rgba(146,64,14,.45)]">
                <span className="absolute right-3 top-3 size-2 rounded-full bg-amber-600" />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-base">📣</span>
                <div className="min-w-0 pr-3">
                  <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug">{t}</div>
                  <div className="mt-0.5 line-clamp-5 whitespace-pre-line text-[12px] leading-snug text-stone-600">{c}</div>
                  <div className="mt-1.5 text-[10px] font-medium text-stone-400">09:41</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">Exemplo com o nome “{nome}”.</p>
    </div>
  );
}

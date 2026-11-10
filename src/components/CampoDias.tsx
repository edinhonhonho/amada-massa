"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

/** Número de dias com − e +, para ajustar sem digitar. */
export default function CampoDias({ nome, valor, max = 365 }: { nome: string; valor: number; max?: number }) {
  const [v, setV] = useState(valor);
  const ajustar = (d: number) => setV((x) => Math.min(max, Math.max(0, (Number.isFinite(x) ? x : 0) + d)));
  return (
    <div className="inline-flex items-center rounded-xl bg-white shadow-[0_0_0_1px_rgba(28,25,23,.1)] focus-within:shadow-[0_0_0_2px_rgb(180,83,9)]">
      <button type="button" onClick={() => ajustar(-1)} disabled={v <= 0} aria-label="Menos um dia" className="flex size-10 items-center justify-center rounded-l-xl text-stone-500 transition hover:bg-stone-100 disabled:opacity-30"><Minus size={16} /></button>
      <input
        id={nome} name={nome} type="number" inputMode="numeric" min={0} max={max} value={Number.isFinite(v) ? v : ""}
        onChange={(e) => setV(e.target.value === "" ? NaN : Math.min(max, Math.max(0, Math.floor(Number(e.target.value)))))}
        className="w-12 border-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="pr-1 text-sm text-stone-500">{v === 1 ? "dia" : "dias"}</span>
      <button type="button" onClick={() => ajustar(1)} disabled={v >= max} aria-label="Mais um dia" className="flex size-10 items-center justify-center rounded-r-xl text-stone-500 transition hover:bg-stone-100 disabled:opacity-30"><Plus size={16} /></button>
    </div>
  );
}

"use client";

import { ChevronDown, ListFilter } from "lucide-react";
import { useState } from "react";

type Mes = { nome: string; passado: boolean; resumo: string; semanas: { chave: string; no: React.ReactNode }[] } | null;

/** Meses do ano com suas semanas. O botão condensa os meses que já passaram, sem recarregar a página. */
export default function CalendarioAno({ meses }: { meses: Mes[] }) {
  const [soRestantes, setSoRestantes] = useState(false);
  const temPassado = meses.some((m) => m?.passado);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (n: string) => setAbertos((a) => { const x = new Set(a); if (x.has(n)) x.delete(n); else x.add(n); return x; });

  return (
    <div>
      {temPassado && (
        <div className="mb-3 flex items-center justify-end">
          <button type="button" aria-pressed={soRestantes} onClick={() => setSoRestantes((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${soRestantes ? "bg-amber-700 text-white shadow-sm" : "bg-white text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.1)] hover:text-stone-900"}`}>
            <ListFilter size={15} />{soRestantes ? "Mostrando só os meses que faltam" : "Mostrar só os meses que faltam"}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {meses.map((m) => {
          if (!m) return null;
          const condensado = soRestantes && m.passado && !abertos.has(m.nome);
          if (condensado) {
            return (
              <button key={m.nome} type="button" onClick={() => alternar(m.nome)} className="flex items-center gap-3 rounded-xl bg-painel px-4 py-2.5 text-left text-sm ring-1 ring-stone-900/[0.04] transition hover:bg-white">
                <span className="font-semibold text-stone-700">{m.nome}</span>
                <span className="text-xs text-stone-500">{m.resumo}</span>
                <ChevronDown size={15} className="ml-auto text-stone-400" />
              </button>
            );
          }
          return (
            <section key={m.nome} className="grid gap-2 md:grid-cols-[104px_minmax(0,1fr)] md:gap-3">
              <h2 className="flex items-center gap-2 pt-1 text-[15px] font-semibold md:pt-3">{m.nome}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {m.semanas.map((s) => <li key={s.chave}>{s.no}</li>)}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400">
        <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-stone-300" />não planejada ou sem produção</span>
        <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-amber-500" />sem pães</span>
        <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-sky-500" />planejada</span>
        <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-emerald-500" />lista fechada</span>
      </p>
    </div>
  );
}

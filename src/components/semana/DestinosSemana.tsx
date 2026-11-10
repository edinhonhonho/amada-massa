"use client";

import { AlertTriangle, MapPin, Store, Truck } from "lucide-react";
import { useState } from "react";

export type DestinoItem = { chave: string; nome: string; cor: string; ativos: number; paes: number; resp?: string | null; alerta?: string | null };
export type CategoriaDestino = { tipo: "entrega" | "ponto" | "padaria"; titulo: string; destinos: DestinoItem[] };

const ICONE = { entrega: Truck, ponto: MapPin, padaria: Store } as const;
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

/**
 * Escolha do destino sem recarregar a página: primeiro o tipo (entrega, pontos, padaria), depois a rota ou o ponto.
 * Só o painel escolhido é montado, então trocar é instantâneo.
 */
export default function DestinosSemana({ categorias, paineis, inicial, semanaId }: { categorias: CategoriaDestino[]; paineis: Record<string, React.ReactNode>; inicial: string; semanaId: string }) {
  const [sel, setSel] = useState(inicial);
  const cat = categorias.find((c) => c.destinos.some((d) => d.chave === sel)) ?? categorias[0];

  function escolher(chave: string) {
    setSel(chave);
    try { window.history.replaceState(null, "", `/semana/${semanaId}?etapa=alocar&destino=${encodeURIComponent(chave)}`); } catch { /* sem histórico */ }
  }
  const primeiroDe = (c: CategoriaDestino) => (c.destinos.find((d) => d.alerta) ?? c.destinos[0]).chave;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Tipo de destino" className="flex max-w-full overflow-x-auto rounded-2xl bg-stone-200/60 p-1">
          {categorias.map((c) => {
            const Ic = ICONE[c.tipo];
            const ativo = c === cat;
            const alerta = c.destinos.some((d) => d.alerta);
            const clientes = c.destinos.reduce((n, d) => n + d.ativos, 0);
            return (
              <button key={c.tipo} type="button" role="tab" aria-selected={ativo} onClick={() => !ativo && escolher(primeiroDe(c))}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${ativo ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
                <Ic size={15} className={ativo ? "text-amber-700" : ""} />
                {c.titulo}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${ativo ? "bg-stone-100 text-stone-600" : "bg-stone-200/80 text-stone-500"}`}>{clientes}</span>
                {alerta && <span className="size-2 rounded-full bg-amber-500" aria-label="precisa de atenção" />}
              </button>
            );
          })}
        </div>
      </div>

      {cat.destinos.length > 1 && (
        <div role="tablist" aria-label={cat.titulo} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {cat.destinos.map((d) => {
            const ativo = d.chave === sel;
            return (
              <button key={d.chave} type="button" role="tab" aria-selected={ativo} onClick={() => escolher(d.chave)}
                className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left transition ${ativo ? "bg-white shadow-[0_8px_22px_-12px_rgba(28,25,23,.45)] ring-1 ring-stone-900/10" : "bg-painel ring-1 ring-stone-900/[0.04] hover:bg-white"}`}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: d.cor }} />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{d.nome}</span>
                  <span className="block text-xs text-stone-500">{plural(d.ativos, "cliente", "clientes")} · {plural(d.paes, "pão", "pães")}</span>
                </span>
                {d.alerta && <span title={d.alerta} className="flex items-center text-amber-600"><AlertTriangle size={14} /></span>}
              </button>
            );
          })}
        </div>
      )}

      <div key={sel}>{paineis[sel]}</div>
    </div>
  );
}

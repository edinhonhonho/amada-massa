"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

const normaliza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca instantânea sobre linhas já na tela (`tr[data-busca]`), sem diferenciar acentos. */
export default function BuscaTabela({ alvo, placeholder = "Buscar" }: { alvo: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<number | null>(null);
  useEffect(() => {
    const raiz = document.querySelector(alvo);
    if (!raiz) return;
    const t = normaliza(q);
    let n = 0;
    raiz.querySelectorAll<HTMLElement>("tr[data-busca]").forEach((tr) => {
      const bate = !t || (tr.dataset.busca ?? "").includes(t);
      tr.hidden = !bate;
      if (bate) n++;
    });
    setAchados(t ? n : null);
  }, [q, alvo]);
  return (
    <div className="relative w-64">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="campo !rounded-xl !py-1.5 !pl-8 !pr-8 text-sm" />
      {q ? <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700" aria-label="Limpar"><X size={13} /></button> : null}
      {achados !== null && <span className="absolute -bottom-5 left-1 text-[11px] text-stone-400" aria-live="polite">{achados === 0 ? "Ninguém encontrado" : `${achados} encontrado${achados > 1 ? "s" : ""}`}</span>}
    </div>
  );
}

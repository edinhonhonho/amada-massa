"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export type ChipSituacao = { chave: string; rotulo: string; qtd: number };
const normaliza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca instantânea e filtro por situação sobre as linhas já na tela
 * (`tr[data-busca]` dentro de `section[data-grupo]`), sem ir ao servidor a cada letra.
 * A busca acha por nome, e-mail, telefone, plano e valor, sem diferenciar acentos.
 */
export default function FiltroLista({ alvo, chips, mes, modalidade, rota, modalidades, rotas }: {
  alvo: string; chips: ChipSituacao[]; mes: string; modalidade?: string; rota?: string;
  modalidades: { valor: string; rotulo: string }[]; rotas: { valor: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [, navegar] = useTransition();
  const [q, setQ] = useState("");
  const [sit, setSit] = useState("todas");
  const [visiveis, setVisiveis] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raiz = document.querySelector(alvo);
    if (!raiz) return;
    const termo = normaliza(q).trim();
    const digitos = termo.replace(/\D/g, "");
    let total = 0;
    raiz.querySelectorAll<HTMLElement>("section[data-grupo]").forEach((grupo) => {
      let n = 0;
      grupo.querySelectorAll<HTMLElement>("tr[data-busca]").forEach((tr) => {
        const bate = (!termo || (tr.dataset.busca ?? "").includes(termo) || (digitos.length >= 3 && (tr.dataset.fone ?? "").includes(digitos)))
          && (sit === "todas" || tr.dataset.sit === sit || (sit === "atrasados" && (tr.dataset.sit === "atrasado" || tr.dataset.sit === "atraso_critico")));
        tr.hidden = !bate;
        if (bate) n++;
      });
      grupo.hidden = n === 0;
      const rotulo = grupo.querySelector<HTMLElement>("[data-n]");
      if (rotulo) rotulo.textContent = String(n);
      total += n;
    });
    setVisiveis(total);
  }, [q, sit, alvo]);

  function filtrar(novo: { modalidade?: string; rota?: string }) {
    const p = new URLSearchParams({ mes });
    const m = "modalidade" in novo ? novo.modalidade : modalidade;
    const r = "rota" in novo ? novo.rota : rota;
    if (m) p.set("modalidade", m);
    if (r) p.set("rota", r);
    navegar(() => router.push(`/pagamentos?${p}`));
  }

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1 sm:max-w-md">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            ref={campo} className="campo !pl-10 !pr-16" value={q} onChange={(e) => setQ(e.target.value)} type="search" autoComplete="off"
            placeholder="Buscar por nome, e-mail, telefone ou plano" aria-label="Buscar cliente"
          />
          {q && (
            <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" onClick={() => { setQ(""); campo.current?.focus(); }} aria-label="Limpar busca"><X size={15} /></button>
          )}
        </div>
        <select className="campo !w-auto" value={modalidade ?? ""} onChange={(e) => filtrar({ modalidade: e.target.value || undefined })} aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          {modalidades.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select className="campo !w-auto" value={rota ?? ""} onChange={(e) => filtrar({ rota: e.target.value || undefined })} aria-label="Rota">
          <option value="">Todas as rotas</option>
          {rotas.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por situação">
        {chips.map((c) => (
          <button
            key={c.chave} type="button" onClick={() => setSit(c.chave)} aria-pressed={sit === c.chave}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${sit === c.chave ? "bg-stone-900 text-white shadow" : "bg-white text-stone-600 shadow-[0_1px_2px_rgba(28,25,23,.08),0_0_0_1px_rgba(28,25,23,.05)] hover:text-stone-900"}`}
          >
            {c.rotulo} <span className={sit === c.chave ? "text-white/70" : "text-stone-400"}>{c.qtd}</span>
          </button>
        ))}
        {visiveis !== null && (q || sit !== "todas") && (
          <span className="ml-2 text-xs text-stone-500" aria-live="polite">{visiveis === 0 ? "Nenhuma cobrança encontrada" : `${visiveis} ${visiveis === 1 ? "cobrança" : "cobranças"}`}</span>
        )}
      </div>
    </div>
  );
}

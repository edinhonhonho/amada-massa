"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Opcao = { valor: string; rotulo: string };
type Props = {
  alvo: string;
  status: string;
  filtros: { plano?: string; modalidade?: string; pagamento?: string; rota?: string; bairro?: string };
  planos: Opcao[]; modalidades: Opcao[]; pagamentos: Opcao[]; rotas: Opcao[]; bairros: Opcao[];
};

const normaliza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca instantânea (nome, e-mail, telefone, bairro, plano) sobre a lista já carregada, mais filtros em lista
 * que aplicam ao escolher, sem botão. Os filtros ativos aparecem como etiquetas que se removem com um clique.
 */
export default function FiltrosClientes({ alvo, status, filtros, planos, modalidades, pagamentos, rotas, bairros }: Props) {
  const router = useRouter();
  const [, navegar] = useTransition();
  const [q, setQ] = useState("");
  const [visiveis, setVisiveis] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raiz = document.querySelector(alvo);
    if (!raiz) return;
    const termo = normaliza(q).trim();
    const digitos = termo.replace(/\D/g, "");
    let n = 0;
    raiz.querySelectorAll<HTMLElement>("tr[data-busca]").forEach((tr) => {
      const bate = !termo || (tr.dataset.busca ?? "").includes(termo) || (digitos.length >= 3 && (tr.dataset.fone ?? "").includes(digitos));
      tr.hidden = !bate;
      if (bate) n++;
    });
    setVisiveis(n);
  }, [q, alvo]);

  function aplicar(novo: Partial<typeof filtros>) {
    const p = new URLSearchParams({ status });
    const todos = { ...filtros, ...novo };
    for (const [k, v] of Object.entries(todos)) if (v) p.set(k, v);
    navegar(() => router.push(`/clientes?${p}`));
  }

  const seletor = (nome: keyof typeof filtros, rotulo: string, opcoes: Opcao[]) => (
    <select className={`campo !w-auto !py-2 text-sm ${filtros[nome] ? "!border-amber-500 !bg-amber-50/60" : ""}`} value={filtros[nome] ?? ""} onChange={(e) => aplicar({ [nome]: e.target.value || undefined })} aria-label={rotulo}>
      <option value="">{rotulo}</option>
      {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );

  const ativos: { chave: keyof typeof filtros; texto: string }[] = [];
  const achar = (l: Opcao[], v?: string) => l.find((o) => o.valor === v)?.rotulo ?? v ?? "";
  if (filtros.plano) ativos.push({ chave: "plano", texto: achar(planos, filtros.plano) });
  if (filtros.modalidade) ativos.push({ chave: "modalidade", texto: achar(modalidades, filtros.modalidade) });
  if (filtros.rota) ativos.push({ chave: "rota", texto: filtros.rota === "sem" ? "Sem rota" : achar(rotas, filtros.rota) });
  if (filtros.pagamento) ativos.push({ chave: "pagamento", texto: `Pagamento: ${achar(pagamentos, filtros.pagamento)}` });
  if (filtros.bairro) ativos.push({ chave: "bairro", texto: achar(bairros, filtros.bairro) });

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="relative max-w-xl">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input ref={campo} type="search" autoComplete="off" className="campo !pl-10 !pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail, telefone, bairro ou plano" aria-label="Buscar cliente" />
          {q && <button type="button" onClick={() => { setQ(""); campo.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Limpar busca"><X size={15} /></button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400"><SlidersHorizontal size={13} />Filtrar</span>
        {seletor("plano", "Plano", planos)}
        {seletor("modalidade", "Modalidade", modalidades)}
        {seletor("rota", "Rota", rotas)}
        {seletor("pagamento", "Pagamento", pagamentos)}
        {seletor("bairro", "Bairro", bairros)}
      </div>
      {(ativos.length > 0 || (visiveis !== null && q)) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
          {ativos.map((a) => (
            <button key={a.chave} type="button" onClick={() => aplicar({ [a.chave]: undefined })} className="inline-flex items-center gap-1 rounded-full bg-amber-100 py-1 pl-3 pr-2 text-[13px] font-medium text-amber-900 transition hover:bg-amber-200">{a.texto}<X size={13} /></button>
          ))}
          {ativos.length > 1 && <button type="button" onClick={() => aplicar({ plano: undefined, modalidade: undefined, rota: undefined, pagamento: undefined, bairro: undefined })} className="px-2 text-[13px] text-stone-500 underline hover:text-stone-900">Limpar filtros</button>}
          {visiveis !== null && q && <span className="ml-1 text-xs text-stone-500">{visiveis === 0 ? "Ninguém encontrado" : `${visiveis} ${visiveis === 1 ? "cliente" : "clientes"} na busca`}</span>}
        </div>
      )}
    </div>
  );
}

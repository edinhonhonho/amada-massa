"use client";

import { Check, Plus, Search, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buscarPessoasAviso, type PessoaAviso } from "@/app/(app)/mensagens/actions";
import Avatar from "@/components/ui/Avatar";

export type Escolhida = { id: string; nome: string };

/** Escolhe clientes um a um: busca por nome, e-mail ou telefone e junta numa lista. */
export default function SeletorPessoas({ escolhidas, aoMudar }: { escolhidas: Escolhida[]; aoMudar: (l: Escolhida[]) => void }) {
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<PessoaAviso[]>([]);
  const [buscando, setBuscando] = useState(false);
  const ids = new Set(escolhidas.map((e) => e.id));

  useEffect(() => {
    if (q.trim().length < 2) { setAchados([]); return; }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      const r = await buscarPessoasAviso(q).catch(() => []);
      if (!cancelado) { setAchados(r); setBuscando(false); }
    }, 200);
    return () => { cancelado = true; clearTimeout(t); };
  }, [q]);

  const alternar = (p: PessoaAviso) => aoMudar(ids.has(p.id) ? escolhidas.filter((e) => e.id !== p.id) : [...escolhidas, { id: p.id, nome: p.nome }]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 shadow-inner">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input className="campo !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nome, e-mail ou telefone" aria-label="Buscar cliente" autoComplete="off" />
      </div>

      {q.trim().length >= 2 && (
        <ul className="max-h-60 divide-y divide-stone-100 overflow-y-auto rounded-xl bg-white shadow-sm">
          {achados.map((p) => {
            const marcado = ids.has(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => alternar(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-amber-50/60">
                  <Avatar nome={p.nome} tamanho={32} />
                  <span className="min-w-0 flex-1"><b className="font-medium">{p.nome}</b>{p.detalhe && <span className="block truncate text-xs text-stone-500">{p.detalhe}</span>}</span>
                  {p.noApp && <span className="flex items-center gap-1 text-xs text-emerald-700" title="Já entrou no app"><Smartphone size={13} />no app</span>}
                  <span className={`flex size-7 items-center justify-center rounded-full ${marcado ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{marcado ? <Check size={15} /> : <Plus size={15} />}</span>
                </button>
              </li>
            );
          })}
          {!achados.length && <li className="px-4 py-5 text-center text-sm text-stone-500">{buscando ? "Buscando…" : `Ninguém encontrado para “${q}”.`}</li>}
        </ul>
      )}

      {escolhidas.length > 0 ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-stone-500">{escolhidas.length} {escolhidas.length === 1 ? "pessoa escolhida" : "pessoas escolhidas"}</div>
          <ul className="flex flex-wrap gap-1.5">
            {escolhidas.map((e) => (
              <li key={e.id} className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-3 pr-1.5 text-sm shadow-sm">
                {e.nome}
                <button type="button" onClick={() => aoMudar(escolhidas.filter((x) => x.id !== e.id))} className="rounded-full p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label={`Remover ${e.nome}`}><X size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-xs text-stone-500">Busque e toque nos clientes para escolher quem recebe.</p>}
    </div>
  );
}

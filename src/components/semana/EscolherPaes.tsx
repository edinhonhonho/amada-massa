"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { adicionarPaesSemana, removerPaoSemana } from "@/app/(app)/planejamento/actions";
import FormPao from "@/app/(app)/planejamento/FormPao";
import Modal from "@/components/ui/Modal";

type Pao = { id: string; nome: string; descricao: string | null; ingredientes: string | null };

/** Escolha dos pães da semana: a marcação muda na hora e o servidor confirma em segundo plano. */
export default function EscolherPaes({ semanaId, paes, selecionados, totais }: { semanaId: string; paes: Pao[]; selecionados: string[]; totais: Record<string, number> }) {
  const [sel, setSel] = useState(() => new Set(selecionados));
  const [pendente, iniciar] = useTransition();
  const chave = selecionados.join(",");

  // quando o servidor termina, a lista verdadeira volta; enquanto há pedido em andamento, vale o que a pessoa marcou
  useEffect(() => { if (!pendente) setSel(new Set(chave ? chave.split(",") : [])); }, [chave, pendente]);

  function alternar(id: string) {
    const entra = !sel.has(id);
    setSel((s) => { const n = new Set(s); if (entra) n.add(id); else n.delete(id); return n; });
    const f = new FormData();
    f.set("semana_id", semanaId); f.set("pao_id", id);
    iniciar(async () => { await (entra ? adicionarPaesSemana(f) : removerPaoSemana(f)); });
  }

  const escolhidos = sel.size;
  return (
    <section>
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[17px] font-semibold tracking-tight">Quais pães saem nesta semana?</h2>
        <span className="text-sm text-stone-400">{escolhidos} {escolhidos === 1 ? "escolhido" : "escolhidos"} · toque num pão para escolher ou tirar</span>
        {pendente && <span className="flex items-center gap-1.5 text-xs text-stone-400" aria-live="polite"><Loader2 size={12} className="animate-spin" />salvando…</span>}
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-stretch gap-3">
        {paes.map((p) => {
          const marcado = sel.has(p.id);
          return (
            <button key={p.id} type="button" onClick={() => alternar(p.id)} aria-pressed={marcado}
              className={`flex min-h-[112px] flex-col gap-2 rounded-[22px] p-4 text-left transition duration-150 active:scale-[.985] ${marcado ? "bg-amber-50 shadow-[0_14px_30px_-18px_rgba(180,83,9,.6)]" : "bg-painel ring-1 ring-stone-900/[0.04] hover:bg-white hover:shadow-md"}`}>
              <span className="flex items-start gap-2">
                <b className="flex-1 leading-tight">{p.nome}</b>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${marcado ? "bg-amber-700 text-white" : "bg-white text-stone-400 shadow-[0_0_0_1px_rgba(28,25,23,.1)]"}`}>{marcado ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}</span>
              </span>
              {(p.descricao || p.ingredientes) && <span className="line-clamp-2 text-[13px] leading-snug text-stone-500">{p.descricao || p.ingredientes}</span>}
              {marcado && <span className="mt-auto pt-1 text-sm text-amber-900"><b className="text-lg font-semibold tabular-nums">{totais[p.id] ?? 0}</b> a produzir</span>}
            </button>
          );
        })}
        <Modal titulo="Cadastrar pão novo" descricao="Ele entra no catálogo e já é escolhido para esta semana." gatilho={<><span className="flex size-10 items-center justify-center rounded-full bg-stone-100 transition group-hover:bg-amber-100"><Plus size={18} /></span><span className="font-semibold">Novo pão</span></>} gatilhoClasse="cartao-novo group !min-h-[112px] !rounded-[22px]" largo><FormPao semanaId={semanaId} /></Modal>
      </div>
      {!paes.length && <p className="mt-3 text-sm text-stone-500">O catálogo está vazio. Cadastre o primeiro pão no cartão acima.</p>}
      <p className="mt-5 text-xs leading-relaxed text-stone-400">O sistema divide os pães de cada plano por igual entre os pães escolhidos.</p>
    </section>
  );
}

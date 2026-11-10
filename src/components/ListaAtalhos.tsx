"use client";

import Kbd from "@/components/ui/Kbd";
import { useModificador } from "@/components/shell/useModificador";

/** Atalhos de teclado que valem em qualquer tela. */
export default function ListaAtalhos() {
  const mod = useModificador();
  const gerais: [string[][], string][] = [
    [[[mod, "K"], ["/"]], "Abrir a busca e os comandos"],
    [[[mod, "B"]], "Recolher ou abrir o menu lateral"],
    [[["?"]], "Abrir esta lista"],
  ];
  const Linha = ({ texto, opcoes }: { texto: string; opcoes: string[][] }) => (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className="flex-1 text-stone-700">{texto}</span>
      <span className="flex items-center gap-2">
        {opcoes.map((teclas, n) => (
          <span key={n} className="flex items-center gap-2">
            {n > 0 && <span className="text-xs text-stone-400">ou</span>}
            <span className="flex gap-1">{teclas.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>
          </span>
        ))}
      </span>
    </li>
  );
  return (
    <div className="max-w-xl">
      <ul className="divide-y divide-stone-200/70">{gerais.map(([o, txt]) => <Linha key={txt} texto={txt} opcoes={o} />)}</ul>
      <p className="mt-3 text-xs leading-relaxed text-stone-500">Para ir a uma tela, aperte a letra do grupo e depois a letra da página, sem prefixo (a letra aparece ao passar o mouse no menu). Os atalhos não funcionam enquanto você digita num campo.</p>
    </div>
  );
}

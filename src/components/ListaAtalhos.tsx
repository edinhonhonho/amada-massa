"use client";

import Kbd from "@/components/ui/Kbd";
import { useModificador } from "@/components/shell/useModificador";

type Grupo = { titulo: string; itens: { rotulo: string; atalho: string }[] };

/** Todos os atalhos de teclado: os gerais e o de cada tela do menu. */
export default function ListaAtalhos({ grupos }: { grupos: Grupo[] }) {
  const mod = useModificador();
  const gerais: [string[], string][] = [
    [[mod, "K"], "Abrir a busca e os comandos"],
    [[mod, "B"], "Recolher ou abrir o menu lateral"],
    [["/"], "Abrir a busca e os comandos"],
    [["N"], "Novo cliente"],
    [["?"], "Abrir esta lista"],
  ];
  const Linha = ({ texto, teclas }: { texto: string; teclas: string[] }) => (
    <li className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 text-stone-700">{texto}</span><span className="flex gap-1">{teclas.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span></li>
  );
  return (
    <div className="gap-x-12 md:columns-2 xl:columns-3 [&>div]:mb-7 [&>div]:break-inside-avoid">
      <div>
        <h3 className="mb-1 text-xs font-semibold text-stone-400">Em qualquer tela</h3>
        <ul className="divide-y divide-stone-200/70">{gerais.map(([t, txt]) => <Linha key={txt + t.join()} texto={txt} teclas={t} />)}</ul>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">Para ir a uma tela, aperte a letra do grupo e depois a letra da página, sem prefixo. Por exemplo: <Kbd>C</Kbd> <Kbd>M</Kbd> abre Mensagens. Os atalhos não funcionam enquanto você digita num campo.</p>
      </div>
      {grupos.map((g) => (
        <div key={g.titulo}>
          <h3 className="mb-1 text-xs font-semibold text-stone-400">{g.titulo}</h3>
          <ul className="divide-y divide-stone-200/70">{g.itens.map((i) => <Linha key={i.rotulo} texto={i.rotulo} teclas={i.atalho.toUpperCase().split("")} />)}</ul>
        </div>
      ))}
    </div>
  );
}

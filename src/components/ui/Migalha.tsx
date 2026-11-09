"use client";

import { usePathname } from "next/navigation";
import { TODOS_ITENS } from "@/lib/nav";

/** Ícone e nome da tela acima do título, como nas telas de dashboard. */
export default function Migalha() {
  const caminho = usePathname();
  const item = [...TODOS_ITENS].sort((a, b) => b.href.length - a.href.length).find((i) => caminho === i.href || caminho.startsWith(`${i.href}/`));
  if (!item) return null;
  const Icone = item.icone;
  return <div className="mb-1.5 flex items-center gap-1.5 text-[13px] text-stone-400"><Icone size={14} />{item.rotulo}</div>;
}

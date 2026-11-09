"use client";

import { usePathname } from "next/navigation";
import { GRUPOS } from "@/lib/nav";

/** Nome do grupo do menu acima do título (o título já diz qual é a tela). */
export default function Migalha() {
  const caminho = usePathname();
  const achado = GRUPOS.flatMap((g) => g.itens.map((i) => ({ g, i })))
    .sort((a, b) => b.i.href.length - a.i.href.length)
    .find(({ i }) => caminho === i.href || caminho.startsWith(`${i.href}/`));
  if (!achado?.g.titulo) return null;
  const Icone = achado.i.icone;
  return <div className="mb-1.5 flex items-center gap-1.5 text-[13px] text-stone-400"><Icone size={14} />{achado.g.titulo}</div>;
}

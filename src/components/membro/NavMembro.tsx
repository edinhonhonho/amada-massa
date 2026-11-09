"use client";

import { Bell, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Barra de navegação flutuante do app Amada Massa. */
export default function NavMembro({ naoLidas = 0 }: { naoLidas?: number }) {
  const caminho = usePathname();
  const itens = [
    { href: "/membro", rotulo: "Avisos", icone: Bell, ativo: caminho === "/membro" },
    { href: "/membro/ajustes", rotulo: "Ajustes", icone: SlidersHorizontal, ativo: caminho.startsWith("/membro/ajustes") },
  ];
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className="flex w-full max-w-[280px] gap-1 rounded-full bg-white/90 p-1.5 shadow-[0_18px_40px_-14px_rgba(28,25,23,.35),0_0_0_1px_rgba(28,25,23,.05)] backdrop-blur-xl">
        {itens.map(({ href, rotulo, icone: Icone, ativo }) => (
          <li key={href} className="flex-1">
            <Link href={href} aria-current={ativo ? "page" : undefined} className={`relative flex items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold transition ${ativo ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"}`}>
              <Icone size={18} />{rotulo}
              {href === "/membro" && naoLidas > 0 && !ativo && <span className="absolute right-4 top-2 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-label={`${naoLidas} novos`} />}
              {href === "/membro" && naoLidas > 0 && ativo && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold leading-5 text-stone-900">{naoLidas}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

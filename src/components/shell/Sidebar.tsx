"use client";

import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Kbd from "@/components/ui/Kbd";
import SairBotao from "@/components/SairBotao";
import { GRUPOS } from "@/lib/nav";

const ROTULO_PERFIL: Record<string, string> = { admin: "Administrador", operacao: "Operação", entregador: "Entregador" };

export default function Sidebar({
  admin, nome, perfil, sair,
}: { admin: boolean; nome: string; perfil: string; sair: () => Promise<void> }) {
  const caminho = usePathname();
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  return (
    <aside className="nao-imprimir sticky top-0 flex h-screen w-[264px] shrink-0 flex-col bg-white shadow-[1px_0_0_rgba(28,25,23,.05),8px_0_32px_-16px_rgba(28,25,23,.18)]">
      <Link href="/clientes" className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-700 text-lg shadow-sm">🍞</span>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">Amada Massa</div>
          <div className="text-xs text-stone-500">Clube do Pão</div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("abrir-paleta"))}
        className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500 transition hover:border-stone-300 hover:bg-white"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar ou ir para…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {GRUPOS.filter((g) => !g.admin || admin).map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-2">
            {g.titulo && <div className="mb-1 px-2 text-xs font-semibold text-stone-400">{g.titulo}</div>}
            <ul className={g.fluxo ? "relative" : ""}>
              {g.fluxo && <span className="absolute bottom-4 left-[19px] top-4 w-px bg-stone-200" aria-hidden />}
              {g.itens.map((it) => {
                const Icone = it.icone;
                const on = ativo(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      prefetch
                      title={it.dica}
                      className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition ${
                        on ? "bg-amber-50 font-medium text-amber-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      }`}
                    >
                      {on && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r-full bg-amber-600" />}
                      {it.passo ? (
                        <span className={`relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-white ${on ? "bg-amber-600 text-white" : "bg-stone-200 text-stone-600 group-hover:bg-stone-300"}`}>
                          {it.passo}
                        </span>
                      ) : (
                        <Icone size={18} className={on ? "text-amber-700" : "text-stone-400 group-hover:text-stone-600"} />
                      )}
                      <span className="flex-1 truncate">{it.rotulo}</span>
                      <span className="hidden items-center gap-0.5 group-hover:flex"><Kbd>G</Kbd><Kbd>{it.atalho.toUpperCase()}</Kbd></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-stone-100 p-3">
        <Avatar nome={nome} tamanho={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium">{nome}</div>
          <div className="text-xs text-stone-500">{ROTULO_PERFIL[perfil] ?? perfil}</div>
        </div>
        <form action={sair}>
          <SairBotao className="btn-ghost !p-2" icone={<LogOut size={17} />} titulo="Sair" />
        </form>
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("abrir-ajuda"))}
        className="border-t border-stone-100 py-2 text-center text-xs text-stone-400 hover:text-stone-700"
      >
        Atalhos de teclado <Kbd>?</Kbd>
      </button>
    </aside>
  );
}

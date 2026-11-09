"use client";

import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Kbd from "@/components/ui/Kbd";
import LogoApp from "@/components/LogoApp";
import SairBotao from "@/components/SairBotao";
import { GRUPOS } from "@/lib/nav";

const ROTULO_PERFIL: Record<string, string> = { admin: "Administrador", operacao: "Operação", entregador: "Entregador" };

export default function Sidebar({
  admin, nome, perfil, sair,
}: { admin: boolean; nome: string; perfil: string; sair: () => Promise<void> }) {
  const caminho = usePathname();
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  return (
    <aside className="nao-imprimir sticky top-3 flex h-[calc(100dvh-1.5rem)] w-[252px] shrink-0 flex-col rounded-[28px] bg-painel ring-1 ring-stone-900/[0.04]">
      <Link href="/clientes" className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <LogoApp tamanho={38} />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">Amada Massa</div>
          <div className="text-xs text-stone-500">Gestão do Clube do Pão</div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("abrir-paleta"))}
        className="mx-4 mb-1 mt-1 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-stone-400 shadow-[0_0_0_1px_rgba(28,25,23,.07)] transition hover:text-stone-600 hover:shadow-[0_0_0_1px_rgba(28,25,23,.14)]"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex-1 overflow-y-auto px-4 pb-3">
        {GRUPOS.filter((g) => !g.admin || admin).map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-2">
            {g.titulo && <div className="mb-1 px-2 text-[11.5px] font-medium tracking-wide text-stone-400">{g.titulo}</div>}
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
                      className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${
                        on ? "bg-white font-medium text-stone-900 shadow-[0_1px_2px_rgba(28,25,23,.06),0_0_0_1px_rgba(28,25,23,.05)]" : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                      }`}
                    >
                                            {it.passo ? (
                        <span className={`relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-white ${on ? "bg-amber-600 text-white" : "bg-stone-200 text-stone-600 group-hover:bg-stone-300"}`}>
                          {it.passo}
                        </span>
                      ) : (
                        <Icone size={17} className={on ? "text-amber-700" : "text-stone-400 group-hover:text-stone-600"} />
                      )}
                      <span className="flex-1 truncate">{it.rotulo}</span>
                      <span className="hidden items-center gap-0.5 group-hover:flex">{it.atalho.toUpperCase().split("").map((k, n) => <Kbd key={n}>{k}</Kbd>)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-1 flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-[0_0_0_1px_rgba(28,25,23,.05)]">
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
        className="py-2.5 text-center text-xs text-stone-400 hover:text-stone-700"
      >
        Atalhos de teclado <Kbd>?</Kbd>
      </button>
    </aside>
  );
}

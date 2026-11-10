"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Kbd from "@/components/ui/Kbd";
import LogoApp from "@/components/LogoApp";
import SairBotao from "@/components/SairBotao";
import { gruposVisiveis } from "@/lib/nav";
import { useModificador } from "./useModificador";

const ROTULO_PERFIL: Record<string, string> = { admin: "Administrador", operacao: "Operação", entregador: "Entregador" };

export default function Sidebar({
  admin, nome, perfil, sair,
}: { admin: boolean; nome: string; perfil: string; sair: () => Promise<void> }) {
  const caminho = usePathname();
  const mod = useModificador();
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  // menu recolhido (só ícones); lembra a escolha neste navegador. Atalho: Ctrl B (⌘ B no Mac).
  const [recolhida, setRecolhida] = useState(false);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("amada-lateral");
      // sem escolha guardada, telas estreitas começam com o menu recolhido para dar espaço ao conteúdo
      setRecolhida(guardado === null ? window.innerWidth < 1100 : guardado === "1");
    } catch { /* sem armazenamento */ }
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === "b") {
        ev.preventDefault();
        setRecolhida((v) => { try { localStorage.setItem("amada-lateral", v ? "0" : "1"); } catch { /* sem armazenamento */ } return !v; });
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const alternar = () => setRecolhida((v) => { try { localStorage.setItem("amada-lateral", v ? "0" : "1"); } catch { /* sem armazenamento */ } return !v; });

  return (
    <aside className={`nao-imprimir sticky top-3 flex h-[calc(100dvh-1.5rem)] shrink-0 flex-col rounded-[28px] bg-painel ring-1 ring-stone-900/[0.04] transition-[width] duration-200 ${recolhida ? "w-[76px]" : "w-[252px]"}`}>
      <div className={`flex items-center ${recolhida ? "flex-col gap-2 px-3 pb-2 pt-5" : "gap-1 pb-3 pl-5 pr-3 pt-5"}`}>
        <Link href="/semana" className="flex min-w-0 flex-1 items-center gap-2.5" title="Amada Massa">
          <LogoApp tamanho={38} />
          {!recolhida && (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold tracking-tight">Amada Massa</div>
              <div className="truncate text-xs text-stone-500">Gestão do Clube do Pão</div>
            </div>
          )}
        </Link>
        <button type="button" onClick={alternar} title={`${recolhida ? "Abrir" : "Recolher"} o menu (${mod} B)`} aria-label={recolhida ? "Abrir o menu lateral" : "Recolher o menu lateral"} className="btn-ghost !p-2 text-stone-400 hover:text-stone-700">
          {recolhida ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      {!recolhida && (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("abrir-paleta"))}
        title={`Buscar (${mod} K)`}
        className={`mb-1 mt-1 flex items-center rounded-xl bg-white py-2.5 text-sm text-stone-400 shadow-[0_0_0_1px_rgba(28,25,23,.07)] transition hover:text-stone-600 hover:shadow-[0_0_0_1px_rgba(28,25,23,.14)] mx-4 gap-2 px-3`}
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar…</span><Kbd>{mod} K</Kbd>
      </button>

      )}

      <nav className={`flex-1 overflow-y-auto pb-3 ${recolhida ? "px-3" : "px-4"}`}>
        {gruposVisiveis(admin).map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-2">
            {g.titulo && (recolhida ? <div className="mx-3 mb-2 h-px bg-stone-200/80" aria-hidden /> : <div className="mb-1 px-2 text-[11.5px] font-medium tracking-wide text-stone-400">{g.titulo}</div>)}
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
                      title={recolhida ? `${it.rotulo} (${it.atalho.toUpperCase().split("").join(" ")})` : it.dica}
                      aria-label={it.rotulo}
                      className={`group relative flex h-9 items-center rounded-xl text-sm transition ${recolhida ? "justify-center px-0" : "gap-2.5 px-2.5"} ${
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
                      {!recolhida && <span className="flex-1 truncate">{it.rotulo}</span>}
                      {!recolhida && <span className="hidden items-center gap-0.5 group-hover:flex [&_kbd]:!leading-none">{it.atalho.toUpperCase().split("").map((k, n) => <Kbd key={n}>{k}</Kbd>)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!recolhida && (
        <div className="mx-3 mb-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-[0_0_0_1px_rgba(28,25,23,.05)]">
            <Avatar nome={nome} tamanho={34} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{nome}</div>
              <div className="text-xs text-stone-500">{ROTULO_PERFIL[perfil] ?? perfil}</div>
            </div>
            <form action={sair}><SairBotao className="btn-ghost !p-2" icone={<LogOut size={17} />} titulo="Sair" /></form>
          </div>
        </div>
      )}
    </aside>
  );
}

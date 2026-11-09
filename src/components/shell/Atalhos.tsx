"use client";

import { CornerDownLeft, FilePlus2, Search, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buscarClientes, type ResultadoBusca } from "@/app/(app)/busca-actions";
import Avatar from "@/components/ui/Avatar";
import Kbd from "@/components/ui/Kbd";
import { GRUPOS, TODOS_ITENS } from "@/lib/nav";

type Comando = { id: string; rotulo: string; grupo: string; href: string; icone: React.ReactNode; dica?: string; palavras?: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ATALHOS_AJUDA: [string[], string][] = [
  [["⌘", "K"], "Abrir busca e comandos"],
  [["/"], "Abrir busca e comandos"],
  [["N"], "Novo cliente"],
  [["G", "C"], "Ir para Clientes"],
  [["G", "L"], "Ir para Planos"],
  [["G", "P"], "Ir para Pagamentos"],
  [["G", "S"], "Ir para Planejamento"],
  [["G", "R"], "Ir para Rotas"],
  [["G", "E"], "Ir para Entregas"],
  [["G", "M"], "Ir para Mensagens"],
  [["?"], "Mostrar esta ajuda"],
];

/** Paleta de comandos (⌘K), atalhos "g + letra" e ajuda. Vive uma vez no layout. */
export default function Atalhos({ admin }: { admin: boolean }) {
  const router = useRouter();
  const paleta = useRef<HTMLDialogElement>(null);
  const ajuda = useRef<HTMLDialogElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState("");
  const [clientes, setClientes] = useState<ResultadoBusca[]>([]);
  const [indice, setIndice] = useState(0);

  const comandos: Comando[] = useMemo(() => {
    const paginas = GRUPOS.filter((g) => !g.admin || admin).flatMap((g) =>
      g.itens.map((i) => ({ id: i.href, rotulo: i.rotulo, grupo: "Ir para", href: i.href, icone: <i.icone size={16} />, dica: `G ${i.atalho.toUpperCase()}`, palavras: i.dica })),
    );
    return [
      { id: "novo-cliente", rotulo: "Novo cliente", grupo: "Criar", href: "/clientes/novo", icone: <UserPlus size={16} />, dica: "N", palavras: "cadastrar adicionar assinante" },
      { id: "nova-semana", rotulo: "Planejar semanas do ano", grupo: "Criar", href: "/planejamento", icone: <FilePlus2 size={16} />, palavras: "calendário sabor pães produção" },
      { id: "nova-rota", rotulo: "Nova rota", grupo: "Criar", href: "/rotas/nova", icone: <FilePlus2 size={16} /> },
      ...paginas,
    ];
  }, [admin]);

  const filtrados = useMemo(() => {
    const q = semAcento(consulta.trim());
    if (!q) return comandos;
    return comandos.filter((c) => semAcento(`${c.rotulo} ${c.palavras ?? ""} ${c.grupo}`).includes(q));
  }, [comandos, consulta]);

  // Com texto digitado, quem busca quase sempre quer um cliente: eles vêm primeiro.
  const linhas = useMemo(() => {
    const cmds = filtrados.map((c) => ({ tipo: "cmd" as const, c }));
    const clis = clientes.map((r) => ({ tipo: "cli" as const, r }));
    return consulta.trim() ? [...clis, ...cmds] : cmds;
  }, [filtrados, clientes, consulta]);

  const abrirPaleta = useCallback(() => {
    setConsulta(""); setClientes([]); setIndice(0);
    paleta.current?.showModal();
    setTimeout(() => entrada.current?.focus(), 0);
  }, []);

  const ir = useCallback((href: string) => {
    paleta.current?.close();
    router.push(href);
  }, [router]);

  // busca de clientes (com pequena espera para não consultar a cada tecla)
  useEffect(() => {
    if (consulta.trim().length < 2) { setClientes([]); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      const r = await buscarClientes(consulta).catch(() => []);
      if (!cancelado) setClientes(r);
    }, 180);
    return () => { cancelado = true; clearTimeout(t); };
  }, [consulta]);

  useEffect(() => setIndice(0), [consulta]);

  // atalhos globais
  useEffect(() => {
    let aguardandoG = 0;
    const digitando = (el: EventTarget | null) => {
      const e = el as HTMLElement | null;
      return !!e && (["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName) || e.isContentEditable);
    };
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); abrirPaleta(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.altKey || digitando(ev.target) || document.querySelector("dialog[open]")) return;
      if (aguardandoG && Date.now() - aguardandoG < 1200) {
        const item = TODOS_ITENS.find((i) => i.atalho === ev.key.toLowerCase());
        aguardandoG = 0;
        if (item) { ev.preventDefault(); router.push(item.href); }
        return;
      }
      aguardandoG = 0;
      if (ev.key === "g") { aguardandoG = Date.now(); return; }
      if (ev.key === "/") { ev.preventDefault(); abrirPaleta(); }
      else if (ev.key === "n") { ev.preventDefault(); router.push("/clientes/novo"); }
      else if (ev.key === "?") { ev.preventDefault(); ajuda.current?.showModal(); }
    };
    const abrir = () => abrirPaleta();
    const abrirAjuda = () => ajuda.current?.showModal();
    window.addEventListener("keydown", tecla);
    window.addEventListener("abrir-paleta", abrir);
    window.addEventListener("abrir-ajuda", abrirAjuda);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("abrir-paleta", abrir);
      window.removeEventListener("abrir-ajuda", abrirAjuda);
    };
  }, [abrirPaleta, router]);

  function aoTeclar(ev: React.KeyboardEvent) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setIndice((i) => Math.min(i + 1, linhas.length - 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      const l = linhas[indice];
      if (l) ir(l.tipo === "cmd" ? l.c.href : `/clientes/${l.r.id}`);
    }
  }

  let ultimoGrupo = "";
  return (
    <>
      <dialog ref={paleta} className="modal !mt-[12vh] !max-w-xl" onClick={(e) => { if (e.target === paleta.current) paleta.current?.close(); }}>
        <div className="flex items-center gap-3 border-b border-stone-100 px-4">
          <Search size={18} className="text-stone-400" />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Buscar cliente, ir para uma tela ou criar algo…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400"
            aria-label="Buscar"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {linhas.map((l, i) => {
            const grupo = l.tipo === "cmd" ? l.c.grupo : "Clientes";
            const cab = grupo !== ultimoGrupo;
            ultimoGrupo = grupo;
            return (
              <li key={l.tipo === "cmd" ? l.c.id : l.r.id} role="option" aria-selected={i === indice}>
                {cab && <div className="px-3 pb-1 pt-2 text-xs font-semibold text-stone-400">{grupo}</div>}
                <button
                  type="button"
                  onMouseMove={() => setIndice(i)}
                  onClick={() => ir(l.tipo === "cmd" ? l.c.href : `/clientes/${l.r.id}`)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === indice ? "bg-amber-50 text-amber-950" : "text-stone-700"}`}
                >
                  {l.tipo === "cmd" ? (
                    <span className="flex size-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">{l.c.icone}</span>
                  ) : <Avatar nome={l.r.nome} tamanho={28} />}
                  <span className="flex-1 truncate">{l.tipo === "cmd" ? l.c.rotulo : l.r.nome}</span>
                  {l.tipo === "cli" && l.r.detalhe && <span className="text-xs text-stone-500">{l.r.detalhe}</span>}
                  {l.tipo === "cmd" && l.c.dica && <span className="flex gap-0.5">{l.c.dica.split(" ").map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                  {i === indice && <CornerDownLeft size={14} className="text-stone-400" />}
                </button>
              </li>
            );
          })}
          {!linhas.length && (
            <li className="flex flex-col items-center gap-1 px-4 py-10 text-center text-sm text-stone-500">
              <Users size={22} className="text-stone-300" />
              Nada encontrado para “{consulta}”.
            </li>
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> abrir</span>
        </div>
      </dialog>

      <dialog ref={ajuda} className="modal" onClick={(e) => { if (e.target === ajuda.current) ajuda.current?.close(); }}>
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Atalhos de teclado</h2>
          <p className="mb-4 text-sm text-stone-500">Funcionam em qualquer tela, fora dos campos de texto. Para ir a uma tela, aperte <Kbd>G</Kbd> e depois a letra.</p>
          <ul className="divide-y divide-stone-100">
            {ATALHOS_AJUDA.map(([teclas, texto]) => (
              <li key={texto + teclas.join("")} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">{texto}</span>
                <span className="flex gap-1">{teclas.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right"><button className="btn-sec" onClick={() => ajuda.current?.close()}>Fechar</button></div>
        </div>
      </dialog>
    </>
  );
}

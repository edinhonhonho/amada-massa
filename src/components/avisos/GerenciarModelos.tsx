"use client";

import { BookOpen, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { excluirModelo, salvarModelo } from "@/app/(app)/mensagens/actions";
import { VARIAVEIS_AVISO, personalizar } from "@/lib/avisos";
import type { ModeloAviso } from "@/lib/dados";

type Rascunho = { nome: string; titulo: string; corpo: string };
const NOVO = "novo";
const VAZIO: Rascunho = { nome: "", titulo: "", corpo: "" };
const EXEMPLO = { nome: "Maria", valor: "R$ 80,00", vencimento: "10/11/2026" };

/** Editor de modelos em duas colunas: lista à esquerda, edição com prévia à direita. */
export default function GerenciarModelos({ modelos }: { modelos: ModeloAviso[] }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const campoCorpo = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState<string>(modelos[0]?.id ?? NOVO);
  const [r, setR] = useState<Rascunho>(modelos[0] ? { nome: modelos[0].nome, titulo: modelos[0].titulo, corpo: modelos[0].corpo } : VAZIO);
  const [foco, setFoco] = useState<"titulo" | "corpo">("corpo");
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [aposSalvar, setAposSalvar] = useState<string | null>(null);

  const atual = modelos.find((m) => m.id === sel);
  const sujo = sel === NOVO ? !!(r.nome || r.titulo || r.corpo) : !!atual && (atual.nome !== r.nome || atual.titulo !== r.titulo || atual.corpo !== r.corpo);
  const valido = r.nome.trim() && r.titulo.trim() && r.corpo.trim();

  function escolher(id: string) {
    setSel(id); setConfirmando(false);
    const m = modelos.find((x) => x.id === id);
    setR(m ? { nome: m.nome, titulo: m.titulo, corpo: m.corpo } : VAZIO);
  }

  // depois de criar, seleciona o modelo que acabou de aparecer; se o selecionado foi apagado, vai para o primeiro
  useEffect(() => {
    if (aposSalvar) {
      const novo = modelos.find((m) => m.nome === aposSalvar);
      if (novo) { setAposSalvar(null); escolher(novo.id); }
    } else if (sel !== NOVO && !modelos.some((m) => m.id === sel)) {
      escolher(modelos[0]?.id ?? NOVO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos]);

  function inserir(chave: string) {
    const trecho = `{${chave}}`;
    const el = foco === "titulo" ? campoTitulo.current : campoCorpo.current;
    const campo = foco === "titulo" ? "titulo" : "corpo";
    const valor = r[campo];
    const ini = el?.selectionStart ?? valor.length, fim = el?.selectionEnd ?? valor.length;
    setR({ ...r, [campo]: (valor.slice(0, ini) + trecho + valor.slice(fim)).slice(0, campo === "titulo" ? 80 : 400) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + trecho.length, ini + trecho.length); });
  }

  function salvar() {
    const f = new FormData();
    if (sel !== NOVO) f.set("id", sel);
    f.set("nome", r.nome); f.set("titulo", r.titulo); f.set("corpo", r.corpo);
    iniciar(async () => {
      await salvarModelo(f);
      if (sel === NOVO) setAposSalvar(r.nome.trim());
      router.refresh();
    });
  }

  function apagar() {
    const f = new FormData();
    f.set("id", sel);
    iniciar(async () => { await excluirModelo(f); setConfirmando(false); router.refresh(); });
  }

  function duplicar() {
    setSel(NOVO); setConfirmando(false);
    setR({ ...r, nome: `${r.nome} (cópia)`.slice(0, 60) });
  }

  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900">
        <Pencil size={14} />Editar modelos
      </button>
      <dialog ref={dialogo} className="modal !max-w-4xl" onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close(); }}>
        <div className="flex h-[min(680px,86vh)] flex-col">
          <header className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><BookOpen size={17} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">Modelos de aviso</h2>
              <p className="text-sm text-stone-500">Textos prontos para reaproveitar em Mensagens, Pagamentos e na ficha do cliente.</p>
            </div>
            <button type="button" onClick={() => dialogo.current?.close()} className="btn-ghost -mr-2 !p-2" aria-label="Fechar"><X size={18} /></button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[250px_1fr]">
            <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-stone-100 bg-stone-50/60 p-3" aria-label="Modelos">
              <button type="button" onClick={() => escolher(NOVO)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${sel === NOVO ? "bg-white shadow-sm ring-1 ring-stone-900/5" : "text-amber-800 hover:bg-white/70"}`}><Plus size={15} />Novo modelo</button>
              {modelos.map((m) => (
                <button key={m.id} type="button" onClick={() => escolher(m.id)} aria-current={sel === m.id} className={`rounded-xl px-3 py-2.5 text-left transition ${sel === m.id ? "bg-white shadow-sm ring-1 ring-stone-900/5" : "hover:bg-white/70"}`}>
                  <span className="block truncate text-sm font-medium">{m.nome}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-stone-500">{m.corpo}</span>
                </button>
              ))}
              {!modelos.length && <p className="px-3 py-6 text-center text-sm text-stone-500">Nenhum modelo ainda.</p>}
            </nav>

            <form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); if (valido && sujo) salvar(); }}>
              <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[1fr_230px]">
                <div className="flex flex-col gap-4">
                  <div><label className="rotulo" htmlFor="mod-nome">Nome do modelo</label><input id="mod-nome" className="campo" maxLength={60} value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} placeholder="Ex.: Feriado" /></div>
                  <div>
                    <div className="mb-1.5 flex justify-between"><label className="rotulo !mb-0" htmlFor="mod-titulo">Título do aviso</label><span className="text-xs tabular-nums text-stone-400">{r.titulo.length}/80</span></div>
                    <input id="mod-titulo" ref={campoTitulo} className="campo" maxLength={80} value={r.titulo} onFocus={() => setFoco("titulo")} onChange={(e) => setR({ ...r, titulo: e.target.value })} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between"><label className="rotulo !mb-0" htmlFor="mod-corpo">Texto</label><span className="text-xs tabular-nums text-stone-400">{r.corpo.length}/400</span></div>
                    <textarea id="mod-corpo" ref={campoCorpo} className="campo min-h-32" maxLength={400} value={r.corpo} onFocus={() => setFoco("corpo")} onChange={(e) => setR({ ...r, corpo: e.target.value })} />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      <span>Inserir no {foco === "titulo" ? "título" : "texto"}:</span>
                      {VARIAVEIS_AVISO.map((v) => <button key={v.chave} type="button" title={v.descricao} onMouseDown={(e) => e.preventDefault()} onClick={() => inserir(v.chave)} className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[12px] text-stone-700 transition hover:bg-amber-100">{`{${v.chave}}`}</button>)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-stone-500">Como chega para {EXEMPLO.nome}</div>
                  <div className="rounded-2xl bg-stone-100 p-3">
                    <div className="rounded-[14px] bg-white/90 p-2.5 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-500"><span className="flex size-4 items-center justify-center rounded bg-amber-700 text-[8px] font-bold text-white">A</span><b className="uppercase tracking-wide">Amada Massa</b><span className="ml-auto">agora</span></div>
                      <div className="mt-1 text-[12.5px] font-semibold leading-snug">{personalizar(r.titulo, EXEMPLO) || "Título"}</div>
                      <div className="mt-0.5 whitespace-pre-line text-[12px] leading-snug text-stone-600">{personalizar(r.corpo, EXEMPLO) || "Texto do aviso"}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{"{valor}"} e {"{vencimento}"} só são preenchidos em avisos de cobrança.</p>
                </div>
              </div>

              <footer className="flex items-center gap-2 border-t border-stone-100 px-6 py-3.5">
                {sel !== NOVO && (confirmando ? (
                  <span className="flex items-center gap-2 text-sm"><span className="text-stone-600">Apagar este modelo?</span>
                    <button type="button" onClick={apagar} disabled={pendente} className="btn-perigo btn-pequeno">Sim, apagar</button>
                    <button type="button" onClick={() => setConfirmando(false)} className="btn-ghost btn-pequeno">Não</button></span>
                ) : (
                  <>
                    <button type="button" onClick={() => setConfirmando(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-stone-400 transition hover:bg-red-50 hover:text-red-700"><Trash2 size={14} />Apagar</button>
                    <button type="button" onClick={duplicar} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"><Copy size={14} />Duplicar</button>
                  </>
                ))}
                <span className="ml-auto text-xs text-stone-400">{sujo ? "Alterações não salvas" : ""}</span>
                <button type="submit" className="btn" disabled={!valido || !sujo || pendente}>{pendente && <Loader2 size={15} className="animate-spin" />}{sel === NOVO ? "Criar modelo" : "Salvar"}</button>
              </footer>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

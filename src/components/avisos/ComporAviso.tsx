"use client";

import { AlertCircle, AlertTriangle, BookmarkPlus, Smartphone, Check, CheckCircle2, Loader2, Route, Send, UserSearch, Users, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { concluirEnvio, criarModelo, enviarLote, iniciarEnvio, preverEnvio, type Previa } from "@/app/(app)/mensagens/actions";
import { VARIAVEIS_AVISO, personalizar } from "@/lib/avisos";
import type { ModeloAviso } from "@/lib/dados";
import PreviaCelular from "./PreviaCelular";
import SeletorPessoas, { type Escolhida } from "./SeletorPessoas";

export type Opcao = { codigo: string; rotulo: string; detalhe?: string; qtd: number; comPush?: number };

type Props = {
  opcoes: Opcao[];
  modelos: ModeloAviso[];
  segmentoInicial?: string;
  /** Destino fixo (ficha do cliente): esconde a escolha de grupo. */
  fixo?: { codigo: string; rotulo: string };
  /** Permite escolher clientes a dedo. */
  pessoas?: boolean;
  /** Layout enxuto, sem prévia, para dentro de modal. Sem isto, é o layout da gaveta lateral. */
  compacto?: boolean;
  /** Texto e grupo já preenchidos (ex.: "usar de novo"). */
  inicial?: { titulo: string; corpo: string; segmento?: string };
  /** Chamado ao concluir um envio (a gaveta se fecha). */
  aoConcluir?: () => void;
};

const ICONE: Record<string, LucideIcon> = { todos: Users, atrasados: AlertTriangle, pendentes: Wallet, pessoas: UserSearch };
const MAX_TITULO = 80, MAX_CORPO = 400;
type Fase = "fechado" | "conferir" | "enviando" | "pronto" | "erro";

const CHAVE_RASCUNHO = "amada-rascunho-aviso";

export default function ComporAviso({ opcoes, modelos, segmentoInicial, fixo, pessoas = true, compacto, inicial, aoConcluir }: Props) {
  const router = useRouter();
  const raiz = useRef<HTMLFormElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const campoCorpo = useRef<HTMLTextAreaElement>(null);

  const segInicial = inicial?.segmento ?? segmentoInicial;
  const [segmento, setSegmento] = useState(fixo?.codigo ?? (segInicial && opcoes.some((o) => o.codigo === segInicial) ? segInicial : (opcoes[0]?.codigo ?? "")));
  const [escolhidas, setEscolhidas] = useState<Escolhida[]>([]);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [corpo, setCorpo] = useState(inicial?.corpo ?? "");
  const [recuperado, setRecuperado] = useState(false);
  const [foco, setFoco] = useState<"titulo" | "corpo">("corpo");
  const [fase, setFase] = useState<Fase>("fechado");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [resultado, setResultado] = useState<{ total: number; pushes: number; falhas: number; erro?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoModelo, setSalvandoModelo] = useState<string | null>(null);

  const gaveta = !compacto;

  // rascunho: o que foi escrito e não enviado volta quando a gaveta é aberta de novo
  useEffect(() => {
    if (!gaveta || inicial) return;
    try {
      const r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) ?? "null") as { titulo?: string; corpo?: string } | null;
      if (r && (r.titulo || r.corpo)) { setTitulo(r.titulo ?? ""); setCorpo(r.corpo ?? ""); setRecuperado(true); }
    } catch { /* sem armazenamento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!gaveta) return;
    const t = setTimeout(() => {
      try { if (titulo || corpo) localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ titulo, corpo })); else localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
    }, 400);
    return () => clearTimeout(t);
  }, [titulo, corpo, gaveta]);

  const porPessoas = segmento === "pessoas";
  const codigoEnvio = fixo ? fixo.codigo : porPessoas ? `clientes:${escolhidas.map((e) => e.id).join(",")}` : segmento;
  const opcao = opcoes.find((o) => o.codigo === segmento);
  const qtd = fixo ? 1 : porPessoas ? escolhidas.length : (opcao?.qtd ?? 0);
  const rotuloDestino = fixo ? fixo.rotulo : porPessoas ? (escolhidas.length === 1 ? escolhidas[0].nome : `${escolhidas.length} pessoas escolhidas`) : (opcao?.rotulo ?? "");
  const comPush = fixo ? undefined : porPessoas ? undefined : opcao?.comPush;
  const nomeExemplo = (fixo ? fixo.rotulo : porPessoas ? escolhidas[0]?.nome : undefined)?.split(" ")[0] ?? "Maria";
  const exemplo = { nome: nomeExemplo, valor: "R$ 80,00", vencimento: "10/11/2026" };
  const pronto = titulo.trim() && corpo.trim() && qtd > 0;
  const usaCobranca = /\{(valor|vencimento)\}/.test(titulo + corpo);
  const semCobranca = !fixo && !porPessoas && segmento !== "atrasados" && segmento !== "pendentes";

  function inserir(chave: string) {
    const trecho = `{${chave}}`;
    const el = foco === "titulo" ? campoTitulo.current : campoCorpo.current;
    const valor = foco === "titulo" ? titulo : corpo;
    const set = foco === "titulo" ? setTitulo : setCorpo;
    const max = foco === "titulo" ? MAX_TITULO : MAX_CORPO;
    const ini = el?.selectionStart ?? valor.length, fim = el?.selectionEnd ?? valor.length;
    set((valor.slice(0, ini) + trecho + valor.slice(fim)).slice(0, max));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + trecho.length, ini + trecho.length); });
  }

  function usarModelo(m: ModeloAviso) {
    setTitulo(m.titulo); setCorpo(m.corpo);
    if (!fixo && m.segmento_sugerido && opcoes.some((o) => o.codigo === m.segmento_sugerido)) setSegmento(m.segmento_sugerido);
    campoCorpo.current?.focus();
  }

  async function conferir(ev: React.FormEvent) {
    ev.preventDefault();
    ev.stopPropagation(); // dentro de um Modal, não deixa o envio do formulário fechá-lo
    if (!pronto) return;
    setConferindo(true); setErro(null);
    try {
      const p = await preverEnvio(codigoEnvio);
      if (!p) { setErro("Escolha para quem enviar."); return; }
      setPrevia(p); setFase("conferir");
      dialogo.current?.showModal();
    } catch { setErro("Não foi possível conferir os destinatários. Tente de novo."); }
    finally { setConferindo(false); }
  }

  async function enviar() {
    setFase("enviando"); setErro(null);
    try {
      const ini = await iniciarEnvio({ titulo, corpo, segmento: codigoEnvio });
      if (!ini.ok) { setErro(ini.erro); setFase("erro"); return; }
      setProgresso({ feitos: 0, total: ini.total });
      const acc = { total: ini.total, pushes: 0, falhas: 0, erro: undefined as string | undefined };
      for (let de = 0; de < ini.total; de += ini.lote) {
        const r = await enviarLote(ini.avisoId, de);
        acc.pushes += r.pushes; acc.falhas += r.falhas; acc.erro = r.erro ?? acc.erro;
        setProgresso({ feitos: Math.min(de + ini.lote, ini.total), total: ini.total });
      }
      await concluirEnvio();
      setResultado(acc); setFase("pronto");
      router.refresh();
    } catch {
      setErro("O envio foi interrompido. Confira o histórico antes de tentar de novo para não duplicar."); setFase("erro");
    }
  }

  function fechar() {
    const concluido = fase === "pronto";
    dialogo.current?.close();
    setFase("fechado");
    if (concluido) {
      setTitulo(""); setCorpo(""); setEscolhidas([]); setResultado(null);
      try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
      if (compacto) (raiz.current?.closest("dialog") as HTMLDialogElement | null)?.close();
      aoConcluir?.();
    }
  }

  async function guardarModelo() {
    const nome = (salvandoModelo ?? "").trim();
    if (!nome) return;
    await criarModelo({ nome, titulo, corpo });
    setSalvandoModelo(null);
    router.refresh();
  }


  const resumo = (
    <div className="cartao-branco p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold"><Users size={15} className="text-stone-400" />Resumo do envio</div>
      <dl className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-3"><dt className="text-stone-500">Para</dt><dd className="truncate text-right font-medium">{rotuloDestino || "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-stone-500">Pessoas</dt><dd className="font-medium tabular-nums">{qtd}</dd></div>
        {comPush !== undefined && qtd > 0 && (
          <>
            <div className="flex justify-between gap-3"><dt className="flex items-center gap-1 text-stone-500"><Smartphone size={13} />No celular agora</dt><dd className="font-medium tabular-nums text-emerald-700">{comPush}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-stone-500">Só dentro do app</dt><dd className="font-medium tabular-nums">{Math.max(qtd - comPush, 0)}</dd></div>
          </>
        )}
      </dl>
      <p className="mt-2.5 text-xs leading-relaxed text-stone-500">Quem ainda não ativou as notificações vê o aviso quando abrir o app.</p>
    </div>
  );

  const pct = progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0;

  return (
    <>
      {gaveta ? (
        <form ref={raiz} onSubmit={conferir} className="flex flex-col gap-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
            <div className="flex min-w-0 flex-col gap-7">
          {recuperado && gaveta && (
            <p className="flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-900">Recuperamos o rascunho que você não enviou.
              <button type="button" className="ml-auto font-medium underline" onClick={() => { setTitulo(""); setCorpo(""); setRecuperado(false); }}>Descartar</button></p>
          )}
          {!fixo && (
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-[11px] text-white">1</span>Para quem</legend>
              {(() => {
                const principais = opcoes.filter((o) => !o.codigo.startsWith("rota:"));
                const rotas = opcoes.filter((o) => o.codigo.startsWith("rota:"));
                const chip = (o: { codigo: string; rotulo: string; qtd: number }, pequeno = false) => {
                  const ativa = o.codigo === segmento;
                  const Icone = ICONE[o.codigo];
                  return (
                    <button
                      key={o.codigo} type="button" onClick={() => setSegmento(o.codigo)} aria-pressed={ativa}
                      className={`inline-flex items-center gap-1.5 rounded-full transition active:scale-[.97] ${pequeno ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13.5px]"} font-medium ${ativa ? "bg-stone-900 text-white shadow-md" : "bg-white text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.1)] hover:bg-stone-50"} ${o.qtd === 0 && o.codigo !== "pessoas" && !ativa ? "opacity-50" : ""}`}
                    >
                      {Icone && <Icone size={pequeno ? 12 : 14} className={ativa ? "text-amber-300" : "text-stone-400"} />}
                      {o.rotulo}
                      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${ativa ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>{o.qtd}</span>
                    </button>
                  );
                };
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {principais.map((o) => chip(o))}
                      {pessoas && chip({ codigo: "pessoas", rotulo: "Pessoas específicas", qtd: escolhidas.length })}
                    </div>
                    {rotas.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 flex items-center gap-1 text-xs text-stone-400"><Route size={12} />Rotas</span>
                        {rotas.map((o) => chip(o, true))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {porPessoas && <div className="mt-3"><SeletorPessoas escolhidas={escolhidas} aoMudar={setEscolhidas} /></div>}
              {!porPessoas && <p className="mt-2 text-xs text-stone-500">{opcao?.detalhe ? `${opcao.detalhe}. ` : ""}Quem ainda não entrou no app vê o aviso na primeira vez que entrar.</p>}
            </fieldset>
          )}
          {fixo && <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">Para: <b className="text-stone-900">{fixo.rotulo}</b></p>}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">{!fixo && <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-[11px] text-white">2</span>}Mensagem</legend>
            {gaveta && modelos.length > 0 && !titulo && !corpo ? (
              <div>
                <div className="mb-2 text-xs font-medium text-stone-500">Comece por um modelo ou escreva do zero</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modelos.slice(0, 6).map((m) => (
                    <button key={m.id} type="button" onClick={() => usarModelo(m)} className="rounded-2xl bg-white p-3.5 text-left shadow-[0_0_0_1px_rgba(28,25,23,.07)] transition hover:bg-amber-50 hover:shadow-md active:scale-[.985]">
                      <span className="block text-sm font-semibold">{m.nome}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-stone-500">{m.corpo}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : modelos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-stone-500">Modelos:</span>
                {modelos.map((m) => (
                  <button key={m.id} type="button" onClick={() => usarModelo(m)} className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.09)] transition hover:bg-amber-50 hover:text-amber-900">{m.nome}</button>
                ))}
              </div>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between"><label className="rotulo !mb-0" htmlFor="aviso-titulo">Título</label><span className="text-xs tabular-nums text-stone-400">{titulo.length}/{MAX_TITULO}</span></div>
              <input id="aviso-titulo" ref={campoTitulo} className="campo" maxLength={MAX_TITULO} required value={titulo} onFocus={() => setFoco("titulo")} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pão novo na semana, {nome}" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><label className="rotulo !mb-0" htmlFor="aviso-corpo">Texto</label><span className={`text-xs tabular-nums ${corpo.length > 360 ? "text-amber-700" : "text-stone-400"}`}>{corpo.length}/{MAX_CORPO}</span></div>
              <textarea id="aviso-corpo" ref={campoCorpo} className="campo min-h-28" maxLength={MAX_CORPO} required value={corpo} onFocus={() => setFoco("corpo")} onChange={(e) => setCorpo(e.target.value)} placeholder="Escreva o recado. Use as variáveis para chamar cada pessoa pelo nome." />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                <span>Inserir no {foco === "titulo" ? "título" : "texto"}:</span>
                {VARIAVEIS_AVISO.map((v) => (
                  <button key={v.chave} type="button" title={v.descricao} onMouseDown={(e) => e.preventDefault()} onClick={() => inserir(v.chave)} className="rounded-md bg-white px-2 py-0.5 font-mono text-[12px] text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.09)] transition hover:bg-amber-50">{`{${v.chave}}`}</button>
                ))}
              </div>
            </div>
          </fieldset>

          {erro && fase === "fechado" && <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert"><AlertCircle size={16} />{erro}</p>}

            </div>
            <aside className="hidden self-start lg:block">{resumo}<div className="mt-5"><PreviaCelular titulo={personalizar(titulo, exemplo)} corpo={personalizar(corpo, exemplo)} nome={nomeExemplo} /></div></aside>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/70 pt-5">
            {salvandoModelo === null ? (
              <button type="button" disabled={!titulo.trim() || !corpo.trim()} onClick={() => setSalvandoModelo("")} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 disabled:opacity-40"><BookmarkPlus size={15} />Salvar como modelo</button>
            ) : (
              <div className="flex items-center gap-2">
                <input className="campo !w-48 !py-1.5 text-sm" autoFocus placeholder="Nome do modelo" value={salvandoModelo} onChange={(e) => setSalvandoModelo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void guardarModelo(); } if (e.key === "Escape") setSalvandoModelo(null); }} />
                <button type="button" className="btn btn-pequeno" onClick={guardarModelo}>Salvar</button>
                <button type="button" className="btn-ghost btn-pequeno" onClick={() => setSalvandoModelo(null)}>Cancelar</button>
              </div>
            )}
            <button className="btn shrink-0 whitespace-nowrap !px-5 !py-3" disabled={!pronto || conferindo}>
              {conferindo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Revisar e enviar{qtd > 0 ? ` (${qtd})` : ""}
            </button>
          </footer>
        </form>
      ) : (
        <form ref={raiz} onSubmit={conferir} className="flex flex-col gap-5">
          {!fixo && (
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-[11px] text-white">1</span>Para quem</legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[...opcoes, ...(pessoas ? [{ codigo: "pessoas", rotulo: "Pessoas específicas", detalhe: "Escolha a dedo", qtd: escolhidas.length }] : [])].map((o) => {
                  const ativa = o.codigo === segmento;
                  const Icone = ICONE[o.codigo] ?? Route;
                  const vazio = o.codigo !== "pessoas" && o.qtd === 0;
                  return (
                    <button
                      key={o.codigo} type="button" onClick={() => setSegmento(o.codigo)} aria-pressed={ativa}
                      className={`relative flex items-start gap-3 rounded-2xl p-3.5 pr-8 text-left transition active:scale-[.985] ${ativa ? "bg-amber-50 shadow-[0_8px_24px_-10px_rgba(180,83,9,.55)] ring-2 ring-amber-600/70" : "bg-white shadow-[0_1px_2px_rgba(28,25,23,.08),0_0_0_1px_rgba(28,25,23,.04)] hover:shadow-md"} ${vazio && !ativa ? "opacity-60" : ""}`}
                    >
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ativa ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-500"}`}><Icone size={17} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight">{o.rotulo}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{o.codigo === "pessoas" ? (o.qtd ? `${o.qtd} escolhida${o.qtd > 1 ? "s" : ""}` : o.detalhe) : `${o.qtd} ${o.qtd === 1 ? "pessoa" : "pessoas"}`}</span>
                      </span>
                      {ativa && <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-amber-700 text-white"><Check size={11} strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>
              {porPessoas && <div className="mt-3"><SeletorPessoas escolhidas={escolhidas} aoMudar={setEscolhidas} /></div>}
              {!porPessoas && <p className="mt-2 text-xs text-stone-500">{opcao?.detalhe ? `${opcao.detalhe}. ` : ""}Quem ainda não entrou no app vê o aviso na primeira vez que entrar.</p>}
            </fieldset>
          )}
          {fixo && <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">Para: <b className="text-stone-900">{fixo.rotulo}</b></p>}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">{!fixo && <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-[11px] text-white">2</span>}Mensagem</legend>
            {gaveta && modelos.length > 0 && !titulo && !corpo ? (
              <div>
                <div className="mb-2 text-xs font-medium text-stone-500">Comece por um modelo ou escreva do zero</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modelos.slice(0, 6).map((m) => (
                    <button key={m.id} type="button" onClick={() => usarModelo(m)} className="rounded-2xl bg-white p-3.5 text-left shadow-[0_0_0_1px_rgba(28,25,23,.07)] transition hover:bg-amber-50 hover:shadow-md active:scale-[.985]">
                      <span className="block text-sm font-semibold">{m.nome}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-stone-500">{m.corpo}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : modelos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-stone-500">Modelos:</span>
                {modelos.map((m) => (
                  <button key={m.id} type="button" onClick={() => usarModelo(m)} className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.09)] transition hover:bg-amber-50 hover:text-amber-900">{m.nome}</button>
                ))}
              </div>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between"><label className="rotulo !mb-0" htmlFor="aviso-titulo">Título</label><span className="text-xs tabular-nums text-stone-400">{titulo.length}/{MAX_TITULO}</span></div>
              <input id="aviso-titulo" ref={campoTitulo} className="campo" maxLength={MAX_TITULO} required value={titulo} onFocus={() => setFoco("titulo")} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pão novo na semana, {nome}" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><label className="rotulo !mb-0" htmlFor="aviso-corpo">Texto</label><span className={`text-xs tabular-nums ${corpo.length > 360 ? "text-amber-700" : "text-stone-400"}`}>{corpo.length}/{MAX_CORPO}</span></div>
              <textarea id="aviso-corpo" ref={campoCorpo} className="campo min-h-28" maxLength={MAX_CORPO} required value={corpo} onFocus={() => setFoco("corpo")} onChange={(e) => setCorpo(e.target.value)} placeholder="Escreva o recado. Use as variáveis para chamar cada pessoa pelo nome." />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                <span>Inserir no {foco === "titulo" ? "título" : "texto"}:</span>
                {VARIAVEIS_AVISO.map((v) => (
                  <button key={v.chave} type="button" title={v.descricao} onMouseDown={(e) => e.preventDefault()} onClick={() => inserir(v.chave)} className="rounded-md bg-white px-2 py-0.5 font-mono text-[12px] text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.09)] transition hover:bg-amber-50">{`{${v.chave}}`}</button>
                ))}
              </div>
            </div>
          </fieldset>

          {erro && fase === "fechado" && <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert"><AlertCircle size={16} />{erro}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {salvandoModelo === null ? (
              <button type="button" disabled={!titulo.trim() || !corpo.trim()} onClick={() => setSalvandoModelo("")} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 disabled:opacity-40"><BookmarkPlus size={15} />Salvar como modelo</button>
            ) : (
              <div className="flex items-center gap-2">
                <input className="campo !w-48 !py-1.5 text-sm" autoFocus placeholder="Nome do modelo" value={salvandoModelo} onChange={(e) => setSalvandoModelo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void guardarModelo(); } if (e.key === "Escape") setSalvandoModelo(null); }} />
                <button type="button" className="btn btn-pequeno" onClick={guardarModelo}>Salvar</button>
                <button type="button" className="btn-ghost btn-pequeno" onClick={() => setSalvandoModelo(null)}>Cancelar</button>
              </div>
            )}
            <button className="btn shrink-0 whitespace-nowrap !px-5 !py-3" disabled={!pronto || conferindo}>
              {conferindo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Revisar e enviar{qtd > 0 ? ` (${qtd})` : ""}
            </button>
          </div>
        </form>
      )}

      <dialog
        ref={dialogo} className="modal" onCancel={(e) => { if (fase === "enviando") e.preventDefault(); else setFase("fechado"); }}
        onClick={(e) => { if (e.target === dialogo.current && fase !== "enviando") fechar(); }}
      >
        <div className="px-6 py-6">
          {(fase === "conferir" || fase === "enviando") && previa && (
            <>
              <h2 className="text-lg font-semibold tracking-tight">{fase === "enviando" ? "Enviando…" : "Enviar este aviso?"}</h2>
              <p className="mt-0.5 text-sm text-stone-500">{fase === "enviando" ? "Não feche esta janela até terminar." : <>Para <b className="text-stone-800">{rotuloDestino || previa.rotulo}</b> · {previa.qtd} {previa.qtd === 1 ? "pessoa" : "pessoas"}</>}</p>
              <div className="mt-4 rounded-2xl bg-stone-50 p-4 shadow-inner">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Como chega para {nomeExemplo}</div>
                <div className="mt-1.5 font-semibold leading-snug">{personalizar(titulo, exemplo)}</div>
                <div className="mt-0.5 whitespace-pre-line text-sm text-stone-600">{personalizar(corpo, exemplo)}</div>
              </div>
              {fase === "conferir" && (
                <>
                  {previa.nomes.length > 0 && <p className="mt-3 text-sm text-stone-600">{previa.nomes.join(", ")}{previa.qtd > previa.nomes.length ? ` e mais ${previa.qtd - previa.nomes.length}` : ""}.</p>}
                  {previa.avisoPush && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{previa.avisoPush}</p>}
                  {usaCobranca && semCobranca && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{"{valor}"} e {"{vencimento}"} só são preenchidos em avisos de cobrança; neste grupo ficam em branco.</p>}
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" className="btn-sec" onClick={fechar}>Voltar e editar</button>
                    <button type="button" className="btn" onClick={enviar}><Send size={16} />Enviar para {previa.qtd}</button>
                  </div>
                </>
              )}
              {fase === "enviando" && (
                <div className="mt-5" role="status" aria-live="polite">
                  <div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-stone-600"><Loader2 size={15} className="animate-spin" />{progresso.total ? `${progresso.feitos} de ${progresso.total}` : "Preparando o envio"}</span><span className="font-semibold tabular-nums">{progresso.total ? `${pct}%` : ""}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    {progresso.total ? <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700 transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%` }} /> : <div className="h-full w-1/3 animate-[barra_1.1s_ease-in-out_infinite] rounded-full bg-amber-500" />}
                  </div>
                </div>
              )}
            </>
          )}
          {fase === "pronto" && resultado && (
            <div className="flex flex-col items-center py-2 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 [animation:entra_.3s_ease-out]"><CheckCircle2 size={30} /></span>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">Aviso enviado!</h2>
              <p className="mt-1 text-sm text-stone-600">Para <b>{resultado.total} {resultado.total === 1 ? "pessoa" : "pessoas"}</b>.</p>
              <div className="mt-4 grid w-full grid-cols-2 gap-3 text-left">
                <div className="rounded-2xl bg-emerald-50 p-3"><div className="text-2xl font-semibold tabular-nums text-emerald-800">{resultado.pushes}</div><div className="text-xs text-emerald-900/80">receberam no celular</div></div>
                <div className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-semibold tabular-nums">{Math.max(resultado.total - resultado.pushes, 0)}</div><div className="text-xs text-stone-500">verão ao abrir o app</div></div>
              </div>
              {resultado.erro && resultado.falhas > 0 && <p className="mt-3 w-full rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900"><b>{resultado.falhas} não chegaram no celular.</b> {resultado.erro}</p>}
              <button type="button" className="btn mt-5 w-full" onClick={fechar}>Concluir</button>
            </div>
          )}
          {fase === "erro" && (
            <div className="flex flex-col items-center py-2 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertCircle size={30} /></span>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">Não foi possível enviar</h2>
              <p className="mt-1 text-sm text-stone-600">{erro}</p>
              <button type="button" className="btn-sec mt-5 w-full" onClick={fechar}>Fechar</button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

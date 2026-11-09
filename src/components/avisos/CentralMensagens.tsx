"use client";

import { Check, CheckCheck, ChevronDown, Loader2, PenSquare, Repeat2, Search, Smartphone, TriangleAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { detalheAviso, type DetalheAviso } from "@/app/(app)/mensagens/actions";
import Avatar from "@/components/ui/Avatar";
import { quando } from "@/lib/avisos";
import type { ModeloAviso } from "@/lib/dados";
import ComporAviso, { type Opcao } from "./ComporAviso";
import ConviteApp from "./ConviteApp";

export type LinhaHistorico = { id: string; titulo: string; corpo: string; segmento: string; segmento_rotulo: string; destinatarios: number; pushes: number; criado_em: string; gravados: number; lidos: number };
export type NaoEntrou = { id: string; nome: string; falta: string | null };
type Inicial = { titulo: string; corpo: string; segmento?: string };

type Props = {
  opcoes: Opcao[]; modelos: ModeloAviso[]; historico: LinhaHistorico[];
  indicadores: { ativos: number; entraram: number; comAvisos: number; leitura: number | null; enviados30: number };
  naoEntraram: NaoEntrou[];
  qr: string; link: string; abrirInicial?: boolean; segmentoInicial?: string;
};

const pct = (a: number, t: number) => (t ? Math.round((a / t) * 100) : 0);

export default function CentralMensagens({ opcoes, modelos, historico, indicadores, naoEntraram, qr, link, abrirInicial, segmentoInicial }: Props) {
  const composer = useRef<HTMLElement>(null);
  const [rodada, setRodada] = useState(0);
  const [inicial, setInicial] = useState<Inicial | undefined>(undefined);

  /** "Usar de novo": recomeça o formulário com o texto de um aviso antigo e leva a tela até ele. */
  function reusar(i: Inicial) {
    setInicial(i);
    setRodada((r) => r + 1);
    composer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => { if (abrirInicial) composer.current?.scrollIntoView({ block: "start" }); }, [abrirInicial]);

  return (
    <>
      {/* números em tom baixo: contexto, não protagonistas */}
      <p className="-mt-2 mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-stone-500">
        <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-stone-400" /><b className="font-semibold text-stone-700">{indicadores.entraram}</b> de {indicadores.ativos} já entraram no app</span>
        <span className="flex items-center gap-1.5"><UserCheck size={13} className="text-stone-400" /><b className="font-semibold text-stone-700">{indicadores.comAvisos}</b> com notificações ligadas</span>
        {indicadores.leitura !== null && <span className="flex items-center gap-1.5"><CheckCheck size={13} className="text-stone-400" />leitura média de <b className="font-semibold text-stone-700">{indicadores.leitura}%</b> nos últimos 30 dias</span>}
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_330px]">
        <div className="flex min-w-0 flex-col gap-7">
          <section ref={composer} aria-label="Novo aviso" className="scroll-mt-6 rounded-3xl bg-painel p-6 ring-1 ring-stone-900/[0.04]">
            <header className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-700 text-white shadow-[0_8px_18px_-8px_rgba(180,83,9,.8)]"><PenSquare size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-tight tracking-tight">Novo aviso</h2>
                <p className="text-[13px] text-stone-500">Chega no app Amada Massa e como notificação no celular.</p>
              </div>
            </header>
            <ComporAviso key={rodada} opcoes={opcoes} modelos={modelos} inicial={inicial} segmentoInicial={segmentoInicial} />
          </section>

          <Enviados historico={historico} opcoes={opcoes} aoReusar={reusar} />
        </div>

        <aside className="xl:sticky xl:top-6">
          <section className="rounded-3xl bg-painel p-5 ring-1 ring-stone-900/[0.04]">
            <ConviteApp qr={qr} link={link} />
            <div className="my-4 h-px bg-stone-200/70" />
            <NaoEntraram lista={naoEntraram} totalAtivos={indicadores.ativos} entraram={indicadores.entraram} />
          </section>
        </aside>
      </div>
    </>
  );
}

/** Histórico enxuto: cinco linhas; o resto abre sob demanda. */
function Enviados({ historico, opcoes, aoReusar }: { historico: LinhaHistorico[]; opcoes: Opcao[]; aoReusar: (i: Inicial) => void }) {
  const [todos, setTodos] = useState(false);
  if (!historico.length) return <p className="px-1 text-sm text-stone-400">Os avisos enviados aparecem aqui, com quem já leu.</p>;
  const lista = todos ? historico : historico.slice(0, 5);
  return (
    <section aria-labelledby="enviados">
      <h2 id="enviados" className="mb-1 px-1 text-[13px] font-medium text-stone-400">Enviados recentemente</h2>
      <ul className="divide-y divide-stone-100">
        {lista.map((a) => <LinhaAviso key={a.id} a={a} aoReusar={() => aoReusar({ titulo: a.titulo, corpo: a.corpo, segmento: opcoes.some((o) => o.codigo === a.segmento) ? a.segmento : undefined })} />)}
      </ul>
      {historico.length > 5 && <button type="button" onClick={() => setTodos((t) => !t)} className="mt-1 px-1 text-xs font-medium text-stone-500 hover:text-stone-900">{todos ? "Mostrar menos" : `Ver os outros ${historico.length - 5}`}</button>}
    </section>
  );
}

/** Quem ainda não entrou: primeiro os que não conseguem (faltam dados), depois os prontos para receber o convite. */
function NaoEntraram({ lista, totalAtivos, entraram }: { lista: NaoEntrou[]; totalAtivos: number; entraram: number }) {
  const [q, setQ] = useState("");
  const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtrada = useMemo(() => lista.filter((c) => !q || sem(c.nome).includes(sem(q))), [lista, q]);
  const faltam = filtrada.filter((c) => c.falta), prontos = filtrada.filter((c) => !c.falta);
  const p = pct(entraram, totalAtivos);

  return (
    <div>
      <div className="flex items-baseline gap-2"><h2 className="font-semibold">Ainda não entraram</h2><span className="rounded-full bg-white px-2 text-xs font-medium tabular-nums text-stone-500 shadow-sm">{lista.length}</span></div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-inner" role="img" aria-label={`${p}% já entraram`}><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: `${p}%` }} /></div>
        <span className="text-xs font-medium tabular-nums text-stone-500">{p}% no app</span>
      </div>

      {!lista.length ? <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><Check size={16} />Todos os clientes ativos já entraram no app.</p> : (
        <>
          {lista.length > 8 && (
            <div className="relative mt-4">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="campo !rounded-xl !py-2 !pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nesta lista" aria-label="Buscar cliente que não entrou" />
            </div>
          )}
          <div className="mt-3 max-h-[19rem] overflow-y-auto pr-1">
            {faltam.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><TriangleAlert size={12} />Faltam dados para entrar <span className="font-normal text-stone-400">{faltam.length}</span></div>
                <ul className="flex flex-col gap-1">{faltam.map((c) => <Linha key={c.id} c={c} />)}</ul>
              </div>
            )}
            {prontos.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-stone-500"><Check size={12} />Prontos para o convite <span className="font-normal text-stone-400">{prontos.length}</span></div>
                <ul className="flex flex-col gap-1">{prontos.map((c) => <Linha key={c.id} c={c} />)}</ul>
              </div>
            )}
            {!filtrada.length && <p className="py-4 text-center text-sm text-stone-500">Ninguém com esse nome.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function Linha({ c }: { c: NaoEntrou }) {
  return (
    <li>
      <Link href={c.falta ? `/clientes/${c.id}/editar` : `/clientes/${c.id}`} className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-sm shadow-[0_0_0_1px_rgba(28,25,23,.05)] transition hover:shadow-md">
        <Avatar nome={c.nome} tamanho={26} />
        <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
        {c.falta ? <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">sem {c.falta}</span> : <span className="shrink-0 text-[11px] text-stone-400">pode entrar</span>}
      </Link>
    </li>
  );
}

/** Uma linha do histórico: título, grupo e leitura numa única linha; detalhes sob demanda. */
function LinhaAviso({ a, aoReusar }: { a: LinhaHistorico; aoReusar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheAviso | null>(null);
  const [carregando, setCarregando] = useState(false);
  const lidos = pct(a.lidos, a.gravados);

  async function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !detalhe) {
      setCarregando(true);
      try { setDetalhe(await detalheAviso(a.id)); } finally { setCarregando(false); }
    }
  }

  return (
    <li className="group py-1.5">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="min-w-0 flex-1 truncate"><b className="font-medium text-stone-700">{a.titulo}</b><span className="ml-2 text-stone-400">{a.segmento_rotulo}</span></span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={alternar} aria-expanded={aberto} className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900">Quem leu<ChevronDown size={12} className={`transition ${aberto ? "rotate-180" : ""}`} /></button>
          <button type="button" onClick={aoReusar} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Repeat2 size={12} />Usar de novo</button>
        </span>
        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-stone-400">{a.lidos}/{a.gravados} leram{a.gravados ? ` · ${lidos}%` : ""}</span>
        <span className="w-24 shrink-0 text-right text-xs text-stone-400">{quando(a.criado_em)}</span>
      </div>
      {aberto && (
        <div className="mt-1.5 grid gap-4 rounded-xl bg-stone-50 p-3 text-[13px] sm:grid-cols-2">
          {carregando || !detalhe ? <p className="flex items-center gap-2 text-stone-500 sm:col-span-2"><Loader2 size={13} className="animate-spin" />Carregando…</p> : (
            <>
              <div><div className="mb-1 text-xs font-semibold text-emerald-700">Leram ({detalhe.leram.length})</div><p className="text-stone-600">{detalhe.leram.join(", ") || "Ninguém ainda."}</p></div>
              <div><div className="mb-1 text-xs font-semibold text-stone-500">Ainda não leram ({detalhe.naoLeram.length})</div><p className="text-stone-600">{detalhe.naoLeram.join(", ") || "Todos leram."}</p></div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

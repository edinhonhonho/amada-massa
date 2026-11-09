"use client";

import { Check, CheckCheck, ChevronDown, Loader2, PenSquare, Plus, Repeat2, Search, Smartphone, TriangleAlert, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { detalheAviso, type DetalheAviso } from "@/app/(app)/mensagens/actions";
import Avatar from "@/components/ui/Avatar";
import { quando } from "@/lib/avisos";
import type { ModeloAviso } from "@/lib/dados";
import ComporAviso, { type Opcao } from "./ComporAviso";
import ConviteApp from "./ConviteApp";
import GerenciarModelos from "./GerenciarModelos";

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

/** Botão do cabeçalho da página: o gesto principal de Mensagens. */
export function BotaoNovoAviso() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("novo-aviso"))} className="btn !rounded-2xl !px-6 !py-3.5 text-[15px] shadow-[0_10px_24px_-10px_rgba(180,83,9,.7)]">
      <PenSquare size={18} />Novo aviso
    </button>
  );
}

export default function CentralMensagens({ opcoes, modelos, historico, indicadores, naoEntraram, qr, link, abrirInicial, segmentoInicial }: Props) {
  const gaveta = useRef<HTMLDialogElement>(null);
  const [rodada, setRodada] = useState(0);
  const [inicial, setInicial] = useState<Inicial | undefined>(undefined);

  function abrir(i?: Inicial) {
    setInicial(i);
    setRodada((r) => r + 1); // recomeça o formulário com o texto escolhido
    gaveta.current?.showModal();
  }

  useEffect(() => {
    if (!abrirInicial) return;
    setRodada((r) => r + 1);
    gaveta.current?.showModal();
  }, [abrirInicial]);

  useEffect(() => {
    const f = () => abrir();
    window.addEventListener("novo-aviso", f);
    return () => window.removeEventListener("novo-aviso", f);
  }, []);

  return (
    <>
      {/* números em tom baixo: contexto, não protagonistas */}
      <p className="-mt-2 mb-7 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-stone-500">
        <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-stone-400" /><b className="font-semibold text-stone-700">{indicadores.entraram}</b> de {indicadores.ativos} já entraram no app</span>
        <span className="flex items-center gap-1.5"><UserCheck size={13} className="text-stone-400" /><b className="font-semibold text-stone-700">{indicadores.comAvisos}</b> com notificações ligadas</span>
        {indicadores.leitura !== null && <span className="flex items-center gap-1.5"><CheckCheck size={13} className="text-stone-400" />leitura média de <b className="font-semibold text-stone-700">{indicadores.leitura}%</b> nos últimos 30 dias</span>}
      </p>

      <div className="grid items-start gap-8 xl:grid-cols-[1fr_360px]">
        <section aria-labelledby="enviados">
          <h2 id="enviados" className="mb-1 text-sm font-medium text-stone-500">Enviados</h2>
          {!historico.length ? (
            <div className="flex flex-col items-start gap-3 rounded-3xl bg-painel px-8 py-10">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm"><PenSquare size={22} /></span>
              <div><h3 className="text-lg font-semibold">Escreva o primeiro aviso</h3><p className="mt-1 max-w-md text-sm text-stone-500">Avise todos os clientes sobre o pão da semana, lembre quem está com a mensalidade em aberto ou fale com uma rota inteira.</p></div>
              <button type="button" onClick={() => abrir()} className="btn"><Plus size={16} />Novo aviso</button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {historico.map((a) => <LinhaAviso key={a.id} a={a} aoReusar={() => abrir({ titulo: a.titulo, corpo: a.corpo, segmento: opcoes.some((o) => o.codigo === a.segmento) ? a.segmento : undefined })} />)}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          <ConviteApp qr={qr} link={link} />
          <NaoEntraram lista={naoEntraram} totalAtivos={indicadores.ativos} entraram={indicadores.entraram} />
        </aside>
      </div>

      <dialog ref={gaveta} className="gaveta" aria-label="Novo aviso" onClick={(e) => { if (e.target === gaveta.current) gaveta.current?.close(); }}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">Novo aviso</h2>
              <p className="text-sm text-stone-500">Chega no app Amada Massa e como notificação no celular.</p>
            </div>
            <GerenciarModelos modelos={modelos} />
            <button type="button" onClick={() => gaveta.current?.close()} className="btn-ghost -mr-2 !p-2" aria-label="Fechar"><X size={19} /></button>
          </header>
          <div className="min-h-0 flex-1">
            <ComporAviso key={rodada} opcoes={opcoes} modelos={modelos} inicial={inicial} segmentoInicial={segmentoInicial} aoConcluir={() => gaveta.current?.close()} />
          </div>
        </div>
      </dialog>
    </>
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
    <section className="rounded-3xl bg-painel p-5 ring-1 ring-stone-900/[0.04]">
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
          <div className="mt-3 max-h-[22rem] overflow-y-auto pr-1">
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
    </section>
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

/** Uma linha do histórico: discreta; os detalhes aparecem sob demanda. */
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
    <li className="group py-3">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-sm font-medium text-stone-800">{a.titulo}</h3>
            <span className="text-xs text-stone-400">{a.segmento_rotulo}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-stone-500">{a.corpo}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-stone-400">
          <div>{quando(a.criado_em)}</div>
          <div className="mt-0.5 tabular-nums">{a.lidos}/{a.gravados} leram{a.gravados ? ` · ${lidos}%` : ""}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" onClick={alternar} aria-expanded={aberto} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900">Quem leu<ChevronDown size={12} className={`transition ${aberto ? "rotate-180" : ""}`} /></button>
        <button type="button" onClick={aoReusar} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Repeat2 size={12} />Usar de novo</button>
        <span className="ml-1 text-stone-300">·</span>
        <span className="flex items-center gap-1 px-1 text-stone-400"><Smartphone size={11} />{a.pushes} no celular</span>
      </div>
      {aberto && (
        <div className="mt-2 grid gap-4 rounded-xl bg-stone-50 p-3 text-[13px] sm:grid-cols-2">
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

"use client";

import { Bell, CheckCheck, ChevronDown, Inbox, Loader2, MailWarning, PenSquare, Plus, Repeat2, Smartphone, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { detalheAviso, type DetalheAviso } from "@/app/(app)/mensagens/actions";
import Avatar from "@/components/ui/Avatar";
import { quando } from "@/lib/avisos";
import type { ModeloAviso } from "@/lib/dados";
import ComporAviso, { type Opcao } from "./ComporAviso";
import CopiarLink from "./CopiarLink";

export type LinhaHistorico = { id: string; titulo: string; corpo: string; segmento: string; segmento_rotulo: string; destinatarios: number; pushes: number; criado_em: string; gravados: number; lidos: number };
export type NaoEntrou = { id: string; nome: string; falta: string | null };
type Inicial = { titulo: string; corpo: string; segmento?: string };

type Props = {
  opcoes: Opcao[]; modelos: ModeloAviso[]; historico: LinhaHistorico[];
  indicadores: { ativos: number; entraram: number; comAvisos: number; leitura: number | null; enviados30: number };
  naoEntraram: NaoEntrou[]; totalNaoEntraram: number;
  qr: string; link: string; abrirInicial?: boolean; segmentoInicial?: string;
  modelosSlot: ReactNode;
};

const pct = (a: number, t: number) => (t ? Math.round((a / t) * 100) : 0);

export default function CentralMensagens({ opcoes, modelos, historico, indicadores, naoEntraram, totalNaoEntraram, qr, link, abrirInicial, segmentoInicial, modelosSlot }: Props) {
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

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador icone={<Smartphone size={16} />} rotulo="Já entraram no app" valor={`${indicadores.entraram}`} total={indicadores.ativos} barra={pct(indicadores.entraram, indicadores.ativos)} />
          <Indicador icone={<Bell size={16} />} rotulo="Com notificações ativas" valor={`${indicadores.comAvisos}`} total={indicadores.ativos} barra={pct(indicadores.comAvisos, indicadores.ativos)} dica="É o máximo de pessoas que recebem o aviso no celular" />
          <Indicador icone={<CheckCheck size={16} />} rotulo="Leitura média (30 dias)" valor={indicadores.leitura === null ? "—" : `${indicadores.leitura}%`} barra={indicadores.leitura ?? 0} cor="bg-emerald-500" />
          <Indicador icone={<Inbox size={16} />} rotulo="Avisos em 30 dias" valor={`${indicadores.enviados30}`} />
        </div>
        <button type="button" onClick={() => abrir()} className="btn !px-5 !py-3.5 shadow-md"><PenSquare size={17} />Novo aviso</button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <section aria-labelledby="enviados">
          <h2 id="enviados" className="mb-3 text-[15px] font-semibold">Enviados</h2>
          {!historico.length ? (
            <div className="cartao flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><PenSquare size={24} /></span>
              <div><h3 className="font-semibold">Nenhum aviso enviado ainda</h3><p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">Avise todos os clientes sobre o pão da semana, lembre quem está com a mensalidade em aberto ou fale com uma rota inteira.</p></div>
              <button type="button" onClick={() => abrir()} className="btn"><Plus size={16} />Escrever o primeiro aviso</button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {historico.map((a) => <CartaoAviso key={a.id} a={a} aoReusar={() => abrir({ titulo: a.titulo, corpo: a.corpo, segmento: opcoes.some((o) => o.codigo === a.segmento) ? a.segmento : undefined })} />)}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <section className="cartao">
            <div className="cartao-titulo"><Smartphone size={16} className="text-amber-700" />Convide os clientes para o app</div>
            <div className="flex justify-center rounded-xl bg-stone-50 p-3" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code do aplicativo" role="img" />
            <p className="mt-3 text-sm text-stone-600">O cliente abre o link no celular, entra com <b>e-mail e telefone</b> do cadastro e instala o app.</p>
            <CopiarLink link={link} />
          </section>

          <section className="cartao !p-0">
            <header className="flex items-center gap-2 px-5 pb-2 pt-4 font-semibold"><MailWarning size={16} className="text-amber-700" />Ainda não entraram<span className="ml-auto text-sm font-normal text-stone-400">{totalNaoEntraram}</span></header>
            {!naoEntraram.length ? <p className="px-5 pb-5 text-sm text-stone-500">Todos os clientes ativos já entraram no app. 🎉</p> : (
              <ul className="divide-y divide-stone-100 pb-1">
                {naoEntraram.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm transition hover:bg-stone-50">
                      <Avatar nome={c.nome} tamanho={30} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.nome}</span>{c.falta && <span className="flex items-center gap-1 text-xs text-amber-700"><TriangleAlert size={11} />Falta {c.falta}</span>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {totalNaoEntraram > naoEntraram.length && <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">e mais {totalNaoEntraram - naoEntraram.length}. Quem tem “Falta e-mail/telefone” não consegue entrar até completar o cadastro.</p>}
          </section>
        </aside>
      </div>

      <dialog ref={gaveta} className="gaveta" aria-label="Novo aviso" onClick={(e) => { if (e.target === gaveta.current) gaveta.current?.close(); }}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">Novo aviso</h2>
              <p className="text-sm text-stone-500">Chega no app Amada Massa e como notificação no celular.</p>
            </div>
            {modelosSlot}
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

function Indicador({ icone, rotulo, valor, total, barra, cor = "bg-amber-600", dica }: { icone: ReactNode; rotulo: string; valor: string; total?: number; barra?: number; cor?: string; dica?: string }) {
  return (
    <div className="cartao !p-4" title={dica}>
      <div className="flex items-center gap-1.5 text-[13px] text-stone-500"><span className="text-stone-400">{icone}</span>{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{valor}{total !== undefined && <span className="text-sm font-normal text-stone-400"> / {total}</span>}</div>
      {barra !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${cor} transition-[width]`} style={{ width: `${barra}%` }} /></div>}
    </div>
  );
}

function CartaoAviso({ a, aoReusar }: { a: LinhaHistorico; aoReusar: () => void }) {
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
    <li className="cartao !p-0">
      <div className="p-4 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-semibold">{a.titulo}</h3>
          <span className="selo selo-cinza">{a.segmento_rotulo}</span>
          <span className="ml-auto text-xs text-stone-400">{quando(a.criado_em)}</span>
        </div>
        <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{a.corpo}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${lidos}% leram`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${lidos}%` }} /></div>
          <span><CheckCheck size={13} className="mr-1 inline text-emerald-600" /><b className="text-stone-700">{a.lidos}</b> de {a.gravados} leram</span>
          <span><Smartphone size={13} className="mr-1 inline" />{a.pushes} no celular</span>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" onClick={alternar} aria-expanded={aberto} className="btn-ghost !px-2 !py-1 !text-xs">Quem leu<ChevronDown size={13} className={`transition ${aberto ? "rotate-180" : ""}`} /></button>
            <button type="button" onClick={aoReusar} className="btn-ghost !px-2 !py-1 !text-xs"><Repeat2 size={13} />Usar de novo</button>
          </span>
        </div>
      </div>
      {aberto && (
        <div className="grid gap-4 border-t border-stone-100 bg-stone-50/60 p-4 text-sm sm:grid-cols-2">
          {carregando || !detalhe ? <p className="flex items-center gap-2 text-stone-500 sm:col-span-2"><Loader2 size={14} className="animate-spin" />Carregando…</p> : (
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


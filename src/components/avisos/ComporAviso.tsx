"use client";

import { Bell, Send, Users } from "lucide-react";
import { useRef, useState } from "react";
import { MODELOS_AVISO, VARIAVEIS_AVISO, personalizar } from "@/lib/avisos";
import PreviaCelular from "./PreviaCelular";

export type Opcao = { codigo: string; rotulo: string; detalhe?: string; qtd: number };

type Props = {
  opcoes: Opcao[];
  acao: (f: FormData) => void | Promise<void>;
  segmentoInicial?: string;
  voltar?: string;
  /** Modelos exibidos (ids de MODELOS_AVISO). */
  modelos?: string[];
  tituloInicial?: string;
  corpoInicial?: string;
  /** Layout enxuto, para dentro de modal. */
  compacto?: boolean;
};

const EXEMPLO = { nome: "Maria", valor: "R$ 80,00", vencimento: "10/11/2026" };

export default function ComporAviso({ opcoes, acao, segmentoInicial, voltar = "/mensagens", modelos, tituloInicial = "", corpoInicial = "", compacto }: Props) {
  const [segmento, setSegmento] = useState(segmentoInicial && opcoes.some((o) => o.codigo === segmentoInicial) ? segmentoInicial : (opcoes[0]?.codigo ?? ""));
  const [titulo, setTitulo] = useState(tituloInicial);
  const [corpo, setCorpo] = useState(corpoInicial);
  const area = useRef<HTMLTextAreaElement>(null);
  const escolhida = opcoes.find((o) => o.codigo === segmento);
  const lista = MODELOS_AVISO.filter((m) => !modelos || modelos.includes(m.id));
  const semCobranca = segmento !== "atrasados" && segmento !== "pendentes";
  const usaCobranca = /\{(valor|vencimento)\}/.test(titulo + corpo);

  function inserir(chave: string) {
    const el = area.current;
    const trecho = `{${chave}}`;
    if (!el) return setCorpo((c) => c + trecho);
    const ini = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    setCorpo(corpo.slice(0, ini) + trecho + corpo.slice(fim));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + trecho.length, ini + trecho.length); });
  }

  function confirmar(ev: React.FormEvent<HTMLFormElement>) {
    if (!escolhida) return ev.preventDefault();
    const aviso = usaCobranca && semCobranca ? "\n\nAtenção: {valor} e {vencimento} só são preenchidos em avisos de cobrança." : "";
    if (!window.confirm(`Enviar "${titulo}" para ${escolhida.qtd} ${escolhida.qtd === 1 ? "pessoa" : "pessoas"} (${escolhida.rotulo})?${aviso}`)) { ev.preventDefault(); ev.stopPropagation(); }
  }

  return (
    <form action={acao} onSubmit={confirmar} className={compacto ? "flex flex-col gap-5" : "grid gap-6 lg:grid-cols-[1fr_300px]"}>
      <input type="hidden" name="voltar" value={voltar} />
      <input type="hidden" name="segmento" value={segmento} />

      <div className="flex min-w-0 flex-col gap-5">
        <fieldset>
          <legend className="rotulo flex items-center gap-1.5"><Users size={14} />Para quem</legend>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((o) => {
              const ativa = o.codigo === segmento;
              return (
                <button
                  key={o.codigo} type="button" onClick={() => setSegmento(o.codigo)} aria-pressed={ativa}
                  className={`group rounded-xl px-3.5 py-2 text-left text-sm transition active:scale-[.98] ${
                    ativa ? "bg-amber-700 text-white shadow-md" : "bg-white text-stone-700 shadow-[0_1px_2px_rgba(28,25,23,.1),0_0_0_1px_rgba(28,25,23,.05)] hover:shadow-md"}`}
                >
                  <span className="font-semibold">{o.rotulo}</span>
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${ativa ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>{o.qtd}</span>
                </button>
              );
            })}
          </div>
          {escolhida && (
            <p className="ajuda mt-2">
              {escolhida.qtd === 0 ? "Ninguém neste grupo no momento." : `${escolhida.qtd} ${escolhida.qtd === 1 ? "pessoa recebe" : "pessoas recebem"}`}{escolhida.detalhe ? ` · ${escolhida.detalhe}` : ""}.
              {" "}O aviso fica guardado no app de quem ainda não entrou.
            </p>
          )}
        </fieldset>

        {lista.length > 0 && (
          <div>
            <div className="rotulo">Começar de um modelo</div>
            <div className="flex flex-wrap gap-1.5">
              {lista.map((m) => (
                <button key={m.id} type="button" onClick={() => { setTitulo(m.titulo); setCorpo(m.corpo); area.current?.focus(); if (m.id === "atraso" && opcoes.some((o) => o.codigo === "atrasados")) setSegmento("atrasados"); if (m.id === "pagamento" && opcoes.some((o) => o.codigo === "pendentes")) setSegmento("pendentes"); }}
                  className="rounded-full bg-stone-100 px-3 py-1 text-[13px] font-medium text-stone-700 transition hover:bg-amber-100 hover:text-amber-900">
                  {m.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="rotulo" htmlFor="aviso-titulo">Título</label>
          <input id="aviso-titulo" className="campo" name="titulo" maxLength={80} required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pão novo na semana" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="rotulo !mb-0" htmlFor="aviso-corpo">Mensagem</label>
            <span className={`text-xs tabular-nums ${corpo.length > 360 ? "text-amber-700" : "text-stone-400"}`}>{corpo.length}/400</span>
          </div>
          <textarea id="aviso-corpo" ref={area} className="campo min-h-28" name="corpo" maxLength={400} required value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Escreva o recado. Use as variáveis para chamar cada pessoa pelo nome." />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <span>Inserir:</span>
            {VARIAVEIS_AVISO.map((v) => (
              <button key={v.chave} type="button" title={v.descricao} onClick={() => inserir(v.chave)} className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[12px] text-stone-700 transition hover:bg-amber-100">{`{${v.chave}}`}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-stone-500"><Bell size={13} />Chega como notificação no celular de quem ativou os avisos.</p>
          <button className="btn shrink-0 whitespace-nowrap" disabled={!escolhida || escolhida.qtd === 0}><Send size={16} />Enviar{escolhida ? ` para ${escolhida.qtd}` : ""}</button>
        </div>
      </div>

      {!compacto && (
        <div className="hidden lg:block">
          <PreviaCelular titulo={personalizar(titulo, EXEMPLO)} corpo={personalizar(corpo, EXEMPLO)} />
        </div>
      )}
    </form>
  );
}

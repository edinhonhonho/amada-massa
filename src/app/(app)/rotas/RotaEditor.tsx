"use client";

import { AlertTriangle, Check, CheckCircle2, Loader2, Plus, Route, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { normBairro, type RotaBairros } from "@/lib/bairros";
import { DIAS } from "@/lib/horarios";
import { excluirRota, salvarRota } from "./actions";

export type PontoOrigem = { id: string; nome: string; tipo: string };
export type RotaDados = {
  id?: string; nome: string; descricao: string | null; cor: string; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null;
  entregador_id: string | null; capacidade_paes: number | null; ativa: boolean; origem_ponto_id: string | null; bairros: string[];
};

const CORES = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#4d7c0f", "#c2410c", "#0e7490"];

/**
 * Cadastro de rota: só quem é o responsável, quando sai e quais bairros cobre.
 * Quem entra, a ordem das paradas e o caminho são definidos a cada semana, na própria semana.
 */
export default function RotaEditor({
  rota, bairrosDosClientes, rotas, pontos, entregadores,
}: { rota?: RotaDados; bairrosDosClientes: { bairro: string; qtd: number }[]; rotas: RotaBairros[]; pontos: PontoOrigem[]; entregadores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const dialogoExcluir = useRef<HTMLDialogElement>(null);
  const padariaInicial = pontos.find((p) => p.tipo === "padaria")?.id ?? pontos[0]?.id ?? "";

  const [d, setD] = useState<RotaDados>(rota ?? {
    nome: "", descricao: "", cor: CORES[0], dia_semana: 3, janela_inicio: "16:00", janela_fim: "19:00", entregador_id: null,
    capacidade_paes: null, ativa: true, origem_ponto_id: padariaInicial, bairros: [],
  });
  const [novoBairro, setNovoBairro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);

  const bairrosDisponiveis = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number }>();
    for (const c of bairrosDosClientes) { const k = normBairro(c.bairro); if (k) m.set(k, { nome: c.bairro.trim(), qtd: c.qtd }); }
    for (const b of d.bairros) { const k = normBairro(b); if (!m.has(k)) m.set(k, { nome: b, qtd: 0 }); }
    return [...m.entries()].map(([chave, v]) => ({ chave, ...v })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [bairrosDosClientes, d.bairros]);
  const outraRotaDo = (chave: string) => rotas.find((r) => r.id !== d.id && r.ativa && r.bairros.some((b) => normBairro(b) === chave));
  const marcado = (chave: string) => d.bairros.some((b) => normBairro(b) === chave);
  const clientesNaRota = bairrosDisponiveis.filter((b) => marcado(b.chave)).reduce((n, b) => n + b.qtd, 0);

  const set = <K extends keyof RotaDados>(k: K, v: RotaDados[K]) => setD((s) => ({ ...s, [k]: v }));
  const alternarBairro = (nome: string, chave: string) => set("bairros", marcado(chave) ? d.bairros.filter((b) => normBairro(b) !== chave) : [...d.bairros, nome]);
  const adicionarBairro = () => {
    const t = novoBairro.trim();
    if (t && !marcado(normBairro(t))) set("bairros", [...d.bairros, t]);
    setNovoBairro("");
  };

  async function salvar() {
    setMsg(null);
    if (!d.nome.trim()) { setMsg({ tipo: "erro", texto: "Dê um nome à rota." }); return; }
    setSalvando(true);
    const r = await salvarRota({ ...d, descricao: d.descricao ?? "" });
    setSalvando(false);
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    if (d.id) { setMsg({ tipo: "ok", texto: "Rota salva." }); router.refresh(); } else router.push(`/rotas/${r.id}`);
  }

  async function excluir() {
    if (!d.id) return;
    setExcluindo(true);
    const r = await excluirRota(d.id);
    setExcluindo(false);
    if (!r.ok) { dialogoExcluir.current?.close(); setMsg({ tipo: "erro", texto: r.erro ?? "Não foi possível excluir." }); return; }
    router.push("/rotas");
  }

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="cartao flex flex-col gap-5">
          <div className="cartao-titulo !mb-0">Dados da rota</div>

          <div>
            <label className="rotulo" htmlFor="rota-nome">Nome <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: d.cor }}><Route size={18} /></span>
              <input id="rota-nome" className="campo" value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Rota Centro" />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[52px]" role="group" aria-label="Cor da rota">{CORES.map((c) => (
              <button key={c} type="button" onClick={() => set("cor", c)} aria-label={`Cor ${c}`} aria-pressed={d.cor === c} className={`flex size-6 items-center justify-center rounded-full transition ${d.cor === c ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-painel" : "hover:scale-110"}`} style={{ background: c }}>{d.cor === c && <Check size={12} className="text-white" />}</button>
            ))}</div>
          </div>

          <div>
            <label className="rotulo" htmlFor="rota-resp">Responsável pela entrega</label>
            <select id="rota-resp" className="campo" value={d.entregador_id ?? ""} onChange={(e) => set("entregador_id", e.target.value || null)}><option value="">Ainda sem responsável</option>{entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
          </div>

          <div>
            <span className="rotulo">Dia e horário de saída</span>
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Dia da semana" className="flex gap-1">
                {DIAS.map((x, i) => (
                  <button key={i} type="button" aria-pressed={d.dia_semana === i} title={x} onClick={() => set("dia_semana", d.dia_semana === i ? null : i)}
                    className={`size-9 rounded-xl text-[13px] font-semibold transition ${d.dia_semana === i ? "bg-stone-900 text-white shadow-md" : "bg-white text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.1)] hover:bg-stone-50"}`}>{x.slice(0, 1)}</button>
                ))}
              </div>
              <span className="flex items-center gap-2 text-sm text-stone-500">às <input aria-label="Horário de saída" className="campo !w-36 !px-3" type="time" value={d.janela_inicio?.slice(0, 5) ?? ""} onChange={(e) => set("janela_inicio", e.target.value || null)} /></span>
            </div>
            {d.dia_semana != null && <p className="ajuda mt-1.5">{DIAS[d.dia_semana]}{d.janela_inicio ? `, saindo às ${d.janela_inicio.slice(0, 5)}` : ""}.</p>}
          </div>

          <div>
            <label className="rotulo" htmlFor="rota-origem">Ponto de partida</label>
            <select id="rota-origem" className="campo" value={d.origem_ponto_id ?? ""} onChange={(e) => set("origem_ponto_id", e.target.value || null)}><option value="">Sem ponto de partida</option>{pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            <p className="ajuda">O caminho de cada semana começa daqui.</p>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div><label className="rotulo" htmlFor="rota-cap">Capacidade prevista</label><input id="rota-cap" className="campo" type="number" min={1} value={d.capacidade_paes ?? ""} onChange={(e) => set("capacidade_paes", e.target.value ? Number(e.target.value) : null)} placeholder="Pães por semana (opcional)" /></div>
            {d.id && <label className="flex h-[42px] items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-amber-700" checked={d.ativa} onChange={(e) => set("ativa", e.target.checked)} />Rota ativa</label>}
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">Bairros que a rota cobre <span className="font-normal text-stone-400">{d.bairros.length}</span></div>
          <p className="mb-3 text-[13px] leading-relaxed text-stone-500">Cada semana, quem tem assinatura de entrega ativa nesses bairros entra nesta rota. A ordem das paradas e o caminho são definidos na própria semana.</p>
          {bairrosDisponiveis.length === 0 && <p className="mb-3 rounded-xl bg-white p-3 text-sm text-stone-500">Ainda não há clientes de entrega com bairro. Digite os bairros abaixo.</p>}
          <div className="flex flex-wrap gap-1.5">
            {bairrosDisponiveis.map((b) => {
              const on = marcado(b.chave);
              const outra = outraRotaDo(b.chave);
              return (
                <button key={b.chave} type="button" onClick={() => alternarBairro(b.nome, b.chave)} aria-pressed={on} title={outra && !on ? `Já está na ${outra.nome}` : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition active:scale-[.97] ${on ? "bg-stone-900 text-white shadow-md" : "bg-white text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.1)] hover:bg-stone-50"} ${outra && !on ? "opacity-60" : ""}`}>
                  {on && <Check size={13} className="text-amber-300" />}{b.nome}
                  <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-stone-100 text-stone-500"}`} title="Clientes de entrega ativos hoje">{b.qtd}</span>
                </button>
              );
            })}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionarBairro(); }}>
            <input className="campo !py-2 text-sm" value={novoBairro} onChange={(e) => setNovoBairro(e.target.value)} placeholder="Adicionar outro bairro" aria-label="Adicionar bairro" />
            <button className="btn-sec btn-pequeno shrink-0"><Plus size={14} />Adicionar</button>
          </form>
          {d.bairros.length > 0 && <p className="mt-3 text-xs text-stone-500">Hoje há <b className="text-stone-700">{clientesNaRota}</b> {clientesNaRota === 1 ? "cliente de entrega ativo" : "clientes de entrega ativos"} nesses bairros.</p>}
          {d.bairros.some((b) => outraRotaDo(normBairro(b))) && <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Há bairros que outra rota também cobre: vale a rota de nome menor, a não ser que o cliente tenha sido fixado numa rota.</p>}
        </section>
      </div>

      {msg && (
        <p role={msg.tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${msg.tipo === "erro" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
          {msg.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}{msg.texto}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn !px-6" disabled={salvando} onClick={() => void salvar()}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{d.id ? "Salvar rota" : "Criar rota"}</button>
        <Link href="/rotas" className="btn-sec">Voltar</Link>
        {d.id && <button type="button" className="btn-perigo ml-auto" onClick={() => dialogoExcluir.current?.showModal()}><Trash2 size={15} />Excluir rota</button>}
      </div>

      <dialog ref={dialogoExcluir} className="modal !max-w-md" onClick={(e) => { if (e.target === dialogoExcluir.current) dialogoExcluir.current?.close(); }}>
        <div className="p-6">
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 size={20} /></span>
          <h2 className="text-lg font-semibold tracking-tight">Excluir {d.nome || "esta rota"}?</h2>
          <p className="mt-1.5 text-sm text-stone-600">As entregas das semanas abertas ficam sem rota até serem alocadas em outra. Isso não apaga clientes nem entregas já feitas.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-sec" onClick={() => dialogoExcluir.current?.close()}>Cancelar</button>
            <button type="button" className="btn !bg-red-600 hover:!bg-red-700" disabled={excluindo} onClick={() => void excluir()}>{excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Excluir rota</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

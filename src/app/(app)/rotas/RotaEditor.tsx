"use client";

import { AlertTriangle, Check, CheckCircle2, Loader2, LocateFixed, MapPin, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import { normBairro, rotaDoCliente, type RotaBairros } from "@/lib/bairros";
import { ordenarParadas, type Ponto as Coord } from "@/lib/geo";
import { geocodificar, tracarTrajeto } from "@/lib/geocode";
import { DIAS } from "@/lib/horarios";
import { excluirRota, salvarCoordenadas, salvarRota } from "./actions";

export type ClienteOpc = {
  id: string; nome: string; bairro: string | null; logradouro: string | null; numero: string | null; cep: string | null; cidade: string | null;
  lat: number | null; lng: number | null; manualRotaId: string | null;
};
export type PontoOrigem = { id: string; nome: string; tipo: string; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; cep: string | null; lat: number | null; lng: number | null };
export type RotaDados = {
  id?: string; nome: string; descricao: string | null; cor: string; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null;
  entregador_id: string | null; capacidade_paes: number | null; ativa: boolean; origem_ponto_id: string | null; bairros: string[];
};

const CORES = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#4d7c0f", "#c2410c", "#0e7490"];
const km = (m: number) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const min = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);
const enderecoCurto = (c: ClienteOpc) => [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}`, c.bairro].filter(Boolean).join(" · ") || "Sem endereço";

export default function RotaEditor({
  rota, clientes, rotas, pontos, entregadores,
}: { rota?: RotaDados; clientes: ClienteOpc[]; rotas: RotaBairros[]; pontos: PontoOrigem[]; entregadores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const dialogoExcluir = useRef<HTMLDialogElement>(null);
  const padariaInicial = pontos.find((p) => p.tipo === "padaria")?.id ?? pontos[0]?.id ?? "";

  const [d, setD] = useState<RotaDados>(rota ?? {
    nome: "", descricao: "", cor: CORES[0], dia_semana: 3, janela_inicio: "16:00", janela_fim: "19:00", entregador_id: null,
    capacidade_paes: null, ativa: true, origem_ponto_id: padariaInicial, bairros: [],
  });
  const [novoBairro, setNovoBairro] = useState("");
  const [coords, setCoords] = useState<Record<string, Coord>>(() => {
    const m: Record<string, Coord> = {};
    for (const c of clientes) if (c.lat != null && c.lng != null) m[`c:${c.id}`] = { lat: c.lat, lng: c.lng };
    for (const p of pontos) if (p.lat != null && p.lng != null) m[`p:${p.id}`] = { lat: p.lat, lng: p.lng };
    return m;
  });
  const [naoLocalizados, setNaoLocalizados] = useState<Set<string>>(new Set());
  const [trajeto, setTrajeto] = useState<{ pontos: [number, number][]; distancia_m: number | null; duracao_s: number | null; aproximado: boolean } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok" | "info"; texto: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const origem = pontos.find((p) => p.id === d.origem_ponto_id) ?? null;
  const origemCoord = origem ? coords[`p:${origem.id}`] ?? null : null;

  // bairros que os clientes de entrega têm hoje, com quantos são, e quem já os cobre
  const bairrosDisponiveis = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number }>();
    for (const c of clientes) {
      const k = normBairro(c.bairro);
      if (!k) continue;
      const e = m.get(k) ?? { nome: (c.bairro ?? "").trim(), qtd: 0 };
      e.qtd++; m.set(k, e);
    }
    for (const b of d.bairros) { const k = normBairro(b); if (!m.has(k)) m.set(k, { nome: b, qtd: 0 }); }
    return [...m.entries()].map(([k, v]) => ({ chave: k, ...v })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, d.bairros]);
  const outraRotaDo = (chave: string) => rotas.find((r) => r.id !== d.id && r.ativa && r.bairros.some((b) => normBairro(b) === chave));
  const marcado = (chave: string) => d.bairros.some((b) => normBairro(b) === chave);

  // quem entra nesta rota pela regra do sistema (bairro, ou atribuição manual), com a ordem sugerida
  const paradas = useMemo(() => {
    const id = d.id ?? "__nova__";
    const sim: RotaBairros[] = [...rotas.filter((r) => r.id !== id), { id, nome: d.nome || "Nova rota", ativa: d.ativa, bairros: d.bairros }];
    const dela = clientes.filter((c) => rotaDoCliente(c.bairro, c.manualRotaId, sim) === id);
    const com = dela.filter((c) => coords[`c:${c.id}`]);
    const sem = dela.filter((c) => !coords[`c:${c.id}`]);
    const inicio = origemCoord ?? (com[0] ? coords[`c:${com[0].id}`] : null);
    const ordem = inicio && com.length ? ordenarParadas(inicio, com.map((c) => coords[`c:${c.id}`])).map((i) => com[i]) : com;
    return [...ordem, ...sem];
  }, [clientes, rotas, d.id, d.nome, d.ativa, d.bairros, coords, origemCoord]);

  const set = <K extends keyof RotaDados>(k: K, v: RotaDados[K]) => { setD((s) => ({ ...s, [k]: v })); setTrajeto(null); };
  const alternarBairro = (nome: string, chave: string) => set("bairros", marcado(chave) ? d.bairros.filter((b) => normBairro(b) !== chave) : [...d.bairros, nome]);
  const adicionarBairro = () => {
    const t = novoBairro.trim();
    if (!t) return;
    if (!marcado(normBairro(t))) set("bairros", [...d.bairros, t]);
    setNovoBairro("");
  };

  async function localizar() {
    setMsg(null);
    const atual = { ...coords };
    const faltam: { chave: string; tipo: "cliente" | "ponto"; id: string; e: Parameters<typeof geocodificar>[0] }[] = [];
    if (origem && !atual[`p:${origem.id}`]) faltam.push({ chave: `p:${origem.id}`, tipo: "ponto", id: origem.id, e: origem });
    for (const c of paradas) if (!atual[`c:${c.id}`]) faltam.push({ chave: `c:${c.id}`, tipo: "cliente", id: c.id, e: c });
    if (!faltam.length) return;
    const achados: { tipo: "cliente" | "ponto"; id: string; lat: number; lng: number }[] = [];
    const falhas = new Set<string>();
    try {
      for (let i = 0; i < faltam.length; i++) {
        setOcupado(`Localizando endereços… ${i + 1}/${faltam.length}`);
        const f = faltam[i];
        const p = await geocodificar(f.e);
        if (p) { atual[f.chave] = p; achados.push({ tipo: f.tipo, id: f.id, ...p }); } else falhas.add(f.chave);
      }
    } finally { setOcupado(null); }
    setCoords(atual); setNaoLocalizados(falhas);
    if (achados.length) void salvarCoordenadas(achados).catch(() => {});
    setMsg(falhas.size ? { tipo: "info", texto: `${falhas.size} endereço(s) não foram localizados. Arraste o ponto no mapa depois de posicioná-lo, ou confira o CEP e o número na ficha.` } : { tipo: "ok", texto: "Endereços localizados e guardados." });
  }

  async function tracar() {
    setMsg(null);
    const pts = paradas.map((c) => coords[`c:${c.id}`]).filter(Boolean);
    if (!pts.length) { setMsg({ tipo: "erro", texto: "Nenhuma parada tem localização ainda. Use “Localizar endereços”." }); return; }
    setOcupado("Traçando o caminho de bicicleta…");
    try {
      const t = await tracarTrajeto([...(origemCoord ? [origemCoord] : []), ...pts]);
      setTrajeto({ pontos: t.pontos, distancia_m: t.distancia_m, duracao_s: t.duracao_s, aproximado: t.aproximado });
      setMsg(t.aproximado ? { tipo: "info", texto: "O serviço de rotas não respondeu: o mapa mostra linhas retas." } : { tipo: "ok", texto: `Caminho de exemplo: ${km(t.distancia_m)}${t.duracao_s ? ` · cerca de ${min(t.duracao_s)} de bicicleta` : ""}.` });
    } finally { setOcupado(null); }
  }

  /** Corrige a localização de um ponto arrastando-o no mapa. */
  function aoMover(id: string, lat: number, lng: number) {
    const chave = id === "origem" ? (origem ? `p:${origem.id}` : null) : `c:${id}`;
    if (!chave) return;
    setCoords((c) => ({ ...c, [chave]: { lat, lng } }));
    setTrajeto(null);
    void salvarCoordenadas([{ tipo: id === "origem" ? "ponto" : "cliente", id: id === "origem" ? origem!.id : id, lat, lng }])
      .then(() => setMsg({ tipo: "ok", texto: "Localização corrigida e guardada." })).catch(() => setMsg({ tipo: "erro", texto: "Não foi possível guardar a nova localização." }));
  }

  async function salvar() {
    setMsg(null);
    if (!d.nome.trim()) { setMsg({ tipo: "erro", texto: "Dê um nome à rota." }); return; }
    setOcupado("Salvando…");
    const r = await salvarRota({ ...d, descricao: d.descricao ?? "" });
    setOcupado(null);
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

  const mapaParadas = paradas.filter((p) => coords[`c:${p.id}`]).map((p) => ({ id: p.id, nome: p.nome, ...coords[`c:${p.id}`] }));
  const faltamCoord = paradas.filter((p) => !coords[`c:${p.id}`]).length + (origem && !origemCoord ? 1 : 0);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[460px_1fr]">
      <div className="flex flex-col gap-5">
        <section className="cartao">
          <div className="cartao-titulo">Dados da rota</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div className="col-span-2"><label className="rotulo">Nome <span className="text-red-500">*</span></label><input className="campo" value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Rota Centro" /></div>
            <div className="col-span-2"><label className="rotulo">Responsável</label>
              <select className="campo" value={d.entregador_id ?? ""} onChange={(e) => set("entregador_id", e.target.value || null)}><option value="">Sem responsável</option>{entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div><label className="rotulo">Dia</label>
                <select className="campo" value={d.dia_semana ?? ""} onChange={(e) => set("dia_semana", e.target.value === "" ? null : Number(e.target.value))}><option value="">—</option>{DIAS.map((x, i) => <option key={i} value={i}>{x}</option>)}</select></div>
              <div><label className="rotulo">Saída</label><input className="campo !px-3" type="time" value={d.janela_inicio?.slice(0, 5) ?? ""} onChange={(e) => set("janela_inicio", e.target.value || null)} /></div>
              <div><label className="rotulo">Fim previsto</label><input className="campo !px-3" type="time" value={d.janela_fim?.slice(0, 5) ?? ""} onChange={(e) => set("janela_fim", e.target.value || null)} /></div>
            </div>
            <div className="col-span-2"><label className="rotulo">Ponto de partida</label>
              <select className="campo" value={d.origem_ponto_id ?? ""} onChange={(e) => set("origem_ponto_id", e.target.value || null)}><option value="">Sem ponto de partida</option>{pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div>
              <label className="rotulo">Cor</label>
              <div className="flex flex-wrap gap-1.5">{CORES.map((c) => (
                <button key={c} type="button" onClick={() => set("cor", c)} aria-label={`Cor ${c}`} className={`flex size-7 items-center justify-center rounded-full transition ${d.cor === c ? "ring-4 ring-stone-300" : "hover:scale-110"}`} style={{ background: c }}>{d.cor === c && <Check size={14} className="text-white" />}</button>
              ))}</div>
            </div>
            <div><label className="rotulo">Capacidade (pães)</label><input className="campo" type="number" min={1} value={d.capacidade_paes ?? ""} onChange={(e) => set("capacidade_paes", e.target.value ? Number(e.target.value) : null)} placeholder="Opcional" /></div>
            {d.id && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-amber-700" checked={d.ativa} onChange={(e) => set("ativa", e.target.checked)} />Rota ativa</label>}
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">Bairros que a rota cobre <span className="font-normal text-stone-400">{d.bairros.length}</span></div>
          <p className="mb-3 text-[13px] leading-relaxed text-stone-500">Cada semana, quem tem assinatura de entrega ativa nesses bairros entra nesta rota. A ordem e o caminho são definidos sozinhos.</p>
          {bairrosDisponiveis.length === 0 && <p className="mb-3 rounded-xl bg-white p-3 text-sm text-stone-500">Ainda não há clientes de entrega com bairro. Cadastre-os ou digite os bairros abaixo.</p>}
          <div className="flex flex-wrap gap-1.5">
            {bairrosDisponiveis.map((b) => {
              const on = marcado(b.chave);
              const outra = outraRotaDo(b.chave);
              return (
                <button key={b.chave} type="button" onClick={() => alternarBairro(b.nome, b.chave)} aria-pressed={on} title={outra && !on ? `Já está na ${outra.nome}` : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition active:scale-[.97] ${on ? "bg-stone-900 text-white shadow-md" : "bg-white text-stone-700 shadow-[0_0_0_1px_rgba(28,25,23,.1)] hover:bg-stone-50"} ${outra && !on ? "opacity-60" : ""}`}>
                  {on && <Check size={13} className="text-amber-300" />}{b.nome}
                  <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>{b.qtd}</span>
                </button>
              );
            })}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionarBairro(); }}>
            <input className="campo !py-2 text-sm" value={novoBairro} onChange={(e) => setNovoBairro(e.target.value)} placeholder="Adicionar outro bairro" aria-label="Adicionar bairro" />
            <button className="btn-sec btn-pequeno shrink-0"><Plus size={14} />Adicionar</button>
          </form>
          {d.bairros.some((b) => outraRotaDo(normBairro(b))) && <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Há bairros que outra rota também cobre: vale a rota de nome menor, a não ser que o cliente tenha sido fixado numa rota.</p>}
        </section>

        {msg && (
          <p role={msg.tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${msg.tipo === "erro" ? "bg-red-50 text-red-800" : msg.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            {msg.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}{msg.texto}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn !px-6" disabled={!!ocupado} onClick={() => void salvar()}>{ocupado === "Salvando…" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{d.id ? "Salvar rota" : "Criar rota"}</button>
          <Link href="/rotas" className="btn-sec">Voltar</Link>
          {d.id && <button type="button" className="btn-perigo ml-auto" onClick={() => dialogoExcluir.current?.showModal()}><Trash2 size={15} />Excluir</button>}
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-6">
        <div className="cartao !p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">Paradas previstas <span className="font-normal text-stone-400">{paradas.length}</span></h2>
            <button type="button" className="btn-sec btn-pequeno" disabled={!!ocupado || !faltamCoord} onClick={() => void localizar()}><LocateFixed size={14} />Localizar endereços{faltamCoord ? ` (${faltamCoord})` : ""}</button>
            <button type="button" className="btn-sec btn-pequeno" disabled={!!ocupado || !paradas.length} onClick={() => void tracar()}><RouteIcon size={14} />Ver caminho de exemplo</button>
          </div>
          {ocupado && ocupado !== "Salvando…" && <p className="mb-2 flex items-center gap-2 text-sm text-stone-600"><Loader2 size={14} className="animate-spin" />{ocupado}</p>}
          <div className="h-[420px] overflow-hidden rounded-2xl">
            <MapaRotaDinamico origem={origem && origemCoord ? { ...origemCoord, nome: origem.nome } : null} paradas={mapaParadas} trajeto={trajeto?.pontos ?? null} cor={d.cor} aoMover={aoMover} />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {trajeto ? <>{trajeto.distancia_m != null && <b className="text-stone-700">{km(trajeto.distancia_m)}</b>}{trajeto.duracao_s != null && <> · {min(trajeto.duracao_s)} de bicicleta</>} · </> : null}
            Esta é a prévia de hoje. <b>Arraste um ponto</b> para corrigir onde o endereço está no mapa.
          </p>
        </div>

        <div className="cartao !p-0">
          {!paradas.length ? (
            <p className="px-5 py-6 text-sm text-stone-500">{d.bairros.length ? "Nenhum cliente de entrega ativo nesses bairros por enquanto." : "Escolha os bairros para ver quem entraria nesta rota."}</p>
          ) : (
            <ol className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
              {origem && <li className="flex items-center gap-3 bg-stone-50/70 px-4 py-2 text-sm"><span className="flex size-6 items-center justify-center rounded-lg bg-stone-900 text-xs text-white">🍞</span><span className="font-medium">{origem.nome}</span><span className="text-xs text-stone-500">partida</span>{!origemCoord && <span className="ml-auto text-xs text-amber-800">sem localização</span>}</li>}
              {paradas.map((c, i) => {
                const ok = !!coords[`c:${c.id}`];
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: d.cor }}>{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.nome}</span><span className="block truncate text-xs text-stone-500">{enderecoCurto(c)}</span></span>
                    {c.manualRotaId === d.id && <span className="selo selo-cinza shrink-0" title="Fixado nesta rota">fixado</span>}
                    {naoLocalizados.has(`c:${c.id}`) ? <span title="Endereço não encontrado" className="text-amber-700"><AlertTriangle size={14} /></span>
                      : <span title={ok ? "Localizado no mapa" : "Ainda não localizado"} className={ok ? "text-emerald-600" : "text-stone-300"}><MapPin size={14} /></span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
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

"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, Loader2, LocateFixed, MapPin, Route as RouteIcon, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import { ordenarParadas, type Ponto as Coord } from "@/lib/geo";
import { geocodificar, tracarTrajeto } from "@/lib/geocode";
import { DIAS } from "@/lib/horarios";
import { salvarCoordenadas, salvarRotaCompleta } from "./actions";

export type ClienteOpc = {
  id: string; nome: string; bairro: string | null; logradouro: string | null; numero: string | null; cep: string | null; cidade: string | null;
  lat: number | null; lng: number | null; rotaId: string | null; rotaNome: string | null;
};
export type PontoOrigem = { id: string; nome: string; tipo: string; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; cep: string | null; lat: number | null; lng: number | null };
export type RotaDados = {
  id?: string; nome: string; descricao: string | null; cor: string; dia_semana: number | null; janela_inicio: string | null; janela_fim: string | null;
  entregador_id: string | null; capacidade_paes: number | null; ativa: boolean; origem_ponto_id: string | null;
  trajeto: [number, number][] | null; distancia_m: number | null; duracao_s: number | null;
};

const CORES = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#4d7c0f", "#c2410c", "#0e7490"];
const km = (m: number) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const min = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);
const enderecoCurto = (c: ClienteOpc) => [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}`, c.bairro].filter(Boolean).join(" · ") || "Sem endereço";

export default function RotaEditor({
  rota, selecionadosInicial, clientes, pontos, entregadores, totalEntrega,
}: { rota?: RotaDados; selecionadosInicial: string[]; clientes: ClienteOpc[]; pontos: PontoOrigem[]; entregadores: { id: string; nome: string }[]; totalEntrega: number }) {
  const router = useRouter();
  const padariaInicial = pontos.find((p) => p.tipo === "padaria")?.id ?? pontos[0]?.id ?? "";

  const [d, setD] = useState<RotaDados>(rota ?? {
    nome: "", descricao: "", cor: CORES[0], dia_semana: 3, janela_inicio: "16:00", janela_fim: "19:00", entregador_id: null,
    capacidade_paes: null, ativa: true, origem_ponto_id: padariaInicial, trajeto: null, distancia_m: null, duracao_s: null,
  });
  const [sel, setSel] = useState<string[]>(selecionadosInicial);
  const [busca, setBusca] = useState("");
  const [soSemRota, setSoSemRota] = useState(false);
  const [coords, setCoords] = useState<Record<string, Coord>>(() => {
    const m: Record<string, Coord> = {};
    for (const c of clientes) if (c.lat != null && c.lng != null) m[`c:${c.id}`] = { lat: c.lat, lng: c.lng };
    for (const p of pontos) if (p.lat != null && p.lng != null) m[`p:${p.id}`] = { lat: p.lat, lng: p.lng };
    return m;
  });
  const [naoLocalizados, setNaoLocalizados] = useState<Set<string>>(new Set());
  const [trajeto, setTrajeto] = useState<{ pontos: [number, number][]; distancia_m: number | null; duracao_s: number | null; aproximado: boolean } | null>(
    rota?.trajeto ? { pontos: rota.trajeto, distancia_m: rota.distancia_m, duracao_s: rota.duracao_s, aproximado: false } : null,
  );
  const [desatualizado, setDesatualizado] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok" | "info"; texto: string } | null>(null);

  const porId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const origem = pontos.find((p) => p.id === d.origem_ponto_id) ?? null;
  const origemCoord = origem ? coords[`p:${origem.id}`] ?? null : null;
  const paradas = sel.map((id) => porId.get(id)).filter((c): c is ClienteOpc => !!c);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => (!soSemRota || !c.rotaId || sel.includes(c.id)) && (!q || `${c.nome} ${c.bairro ?? ""} ${c.logradouro ?? ""}`.toLowerCase().includes(q)));
  }, [clientes, busca, soSemRota, sel]);

  const set = <K extends keyof RotaDados>(k: K, v: RotaDados[K]) => setD((s) => ({ ...s, [k]: v }));
  const invalida = () => { if (trajeto) setDesatualizado(true); };
  const alternar = (id: string) => { setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); invalida(); };
  const mover = (i: number, dir: -1 | 1) => {
    setSel((s) => { const j = i + dir; if (j < 0 || j >= s.length) return s; const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    invalida();
  };

  /** Encontra no mapa quem ainda não tem coordenadas (1 consulta/s, política do serviço gratuito). */
  async function localizar(): Promise<Record<string, Coord>> {
    const atual = { ...coords };
    const faltam: { chave: string; tipo: "cliente" | "ponto"; id: string; e: Parameters<typeof geocodificar>[0]; nome: string }[] = [];
    if (origem && !atual[`p:${origem.id}`]) faltam.push({ chave: `p:${origem.id}`, tipo: "ponto", id: origem.id, e: origem, nome: origem.nome });
    for (const c of paradas) if (!atual[`c:${c.id}`]) faltam.push({ chave: `c:${c.id}`, tipo: "cliente", id: c.id, e: c, nome: c.nome });
    if (!faltam.length) return atual;

    const achados: { tipo: "cliente" | "ponto"; id: string; lat: number; lng: number }[] = [];
    const falhas = new Set<string>();
    for (let i = 0; i < faltam.length; i++) {
      setOcupado(`Localizando endereços… ${i + 1}/${faltam.length}`);
      const f = faltam[i];
      const p = await geocodificar(f.e);
      if (p) { atual[f.chave] = p; achados.push({ tipo: f.tipo, id: f.id, ...p }); } else falhas.add(f.chave);
    }
    setCoords(atual);
    setNaoLocalizados(falhas);
    if (achados.length) void salvarCoordenadas(achados).catch(() => {});
    if (falhas.size) setMsg({ tipo: "info", texto: `${falhas.size} endereço(s) não foram localizados. Confira o CEP e o número na ficha do cliente.` });
    return atual;
  }

  async function executar(passos: { localizar?: boolean; ordenar?: boolean; tracar?: boolean }) {
    setMsg(null);
    try {
      const c = passos.localizar ? await localizar() : coords;
      const comCoord = () => paradas.filter((p) => c[`c:${p.id}`]);
      const o = origem ? c[`p:${origem.id}`] : undefined;
      if (passos.ordenar) {
        if (!o) { setMsg({ tipo: "erro", texto: "Não consegui localizar o ponto de partida. Confira o endereço em Pontos de coleta." }); return; }
        const localizados = comCoord();
        const ordem = ordenarParadas(o, localizados.map((p) => c[`c:${p.id}`]));
        const novos = ordem.map((i) => localizados[i].id);
        const semCoord = sel.filter((id) => !novos.includes(id));
        setSel([...novos, ...semCoord]);
        setTrajeto(null);
        if (!passos.tracar) setDesatualizado(false);
        // a ordem acabou de mudar: o traçado precisa usar a nova
        if (passos.tracar) await tracar(c, [...novos], o);
        return;
      }
      if (passos.tracar) await tracar(c, sel, o);
    } finally {
      setOcupado(null);
    }
  }

  async function tracar(c: Record<string, Coord>, ids: string[], o?: Coord) {
    const pts = ids.map((id) => c[`c:${id}`]).filter(Boolean);
    if (!pts.length) { setMsg({ tipo: "erro", texto: "Nenhuma parada tem localização no mapa ainda. Use “Localizar endereços”." }); return; }
    setOcupado("Traçando o caminho de bicicleta…");
    const t = await tracarTrajeto([...(o ? [o] : []), ...pts]);
    setTrajeto({ pontos: t.pontos, distancia_m: t.distancia_m, duracao_s: t.duracao_s, aproximado: t.aproximado });
    setDesatualizado(false);
    setMsg(t.aproximado
      ? { tipo: "info", texto: "O serviço de rotas não respondeu: o mapa mostra linhas retas entre as paradas. Tente de novo em instantes." }
      : { tipo: "ok", texto: `Rota traçada: ${km(t.distancia_m)}${t.duracao_s ? ` · cerca de ${min(t.duracao_s)} de bicicleta` : ""}.` });
  }

  async function salvar() {
    setMsg(null);
    if (!d.nome.trim()) { setMsg({ tipo: "erro", texto: "Dê um nome à rota." }); return; }
    setOcupado("Salvando…");
    const r = await salvarRotaCompleta({
      id: d.id, nome: d.nome, descricao: d.descricao ?? "", cor: d.cor, dia_semana: d.dia_semana, janela_inicio: d.janela_inicio, janela_fim: d.janela_fim,
      entregador_id: d.entregador_id, capacidade_paes: d.capacidade_paes, ativa: d.ativa, origem_ponto_id: d.origem_ponto_id,
      clientes: sel, trajeto: trajeto && !desatualizado ? trajeto.pontos : null, distancia_m: trajeto && !desatualizado ? trajeto.distancia_m : null, duracao_s: trajeto && !desatualizado ? trajeto.duracao_s : null,
    });
    setOcupado(null);
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    if (d.id) { setMsg({ tipo: "ok", texto: "Rota salva." }); router.refresh(); } else router.push(`/rotas/${r.id}`);
  }

  const mapaParadas = paradas.filter((p) => coords[`c:${p.id}`]).map((p) => ({ id: p.id, nome: p.nome, ...coords[`c:${p.id}`] }));
  const faltamCoord = paradas.filter((p) => !coords[`c:${p.id}`]).length + (origem && !origemCoord ? 1 : 0);

  return (
    <div className="grid grid-cols-[480px_1fr] items-start gap-5">
      <div className="flex flex-col gap-4">
        <section className="cartao">
          <div className="cartao-titulo">Dados da rota</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            <div className="col-span-2"><label className="rotulo">Nome <span className="text-red-500">*</span></label><input className="campo" value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Rota Centro" /></div>
            <div className="col-span-2">
              <label className="rotulo">Cor no mapa e nas listas</label>
              <div className="flex gap-2">{CORES.map((c) => (
                <button key={c} type="button" onClick={() => set("cor", c)} aria-label={`Cor ${c}`} className={`flex size-8 items-center justify-center rounded-full transition ${d.cor === c ? "ring-4 ring-stone-300" : "hover:scale-110"}`} style={{ background: c }}>{d.cor === c && <Check size={15} className="text-white" />}</button>
              ))}</div>
            </div>
            <div><label className="rotulo">Dia da semana</label>
              <select className="campo" value={d.dia_semana ?? ""} onChange={(e) => set("dia_semana", e.target.value === "" ? null : Number(e.target.value))}><option value="">—</option>{DIAS.map((x, i) => <option key={i} value={i}>{x}</option>)}</select></div>
            <div><label className="rotulo">Entregador</label>
              <select className="campo" value={d.entregador_id ?? ""} onChange={(e) => set("entregador_id", e.target.value || null)}><option value="">Sem entregador</option>{entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
            <div><label className="rotulo">Saída</label><input className="campo" type="time" value={d.janela_inicio?.slice(0, 5) ?? ""} onChange={(e) => set("janela_inicio", e.target.value || null)} /></div>
            <div><label className="rotulo">Fim previsto</label><input className="campo" type="time" value={d.janela_fim?.slice(0, 5) ?? ""} onChange={(e) => set("janela_fim", e.target.value || null)} /></div>
            <div className="col-span-2"><label className="rotulo">Ponto de partida</label>
              <select className="campo" value={d.origem_ponto_id ?? ""} onChange={(e) => { set("origem_ponto_id", e.target.value || null); invalida(); }}><option value="">Sem ponto de partida</option>{pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div><label className="rotulo">Capacidade (pães)</label><input className="campo" type="number" min={1} value={d.capacidade_paes ?? ""} onChange={(e) => set("capacidade_paes", e.target.value ? Number(e.target.value) : null)} placeholder="Opcional" /></div>
            {d.id && <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="size-4 accent-amber-700" checked={d.ativa} onChange={(e) => set("ativa", e.target.checked)} />Rota ativa</label>}
            <div className="col-span-2"><label className="rotulo">Descrição</label><textarea className="campo" rows={2} value={d.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} placeholder="Bairros, ponto de partida, observações" /></div>
          </div>
        </section>

        <section className="cartao !p-0">
          <header className="border-b border-stone-100 px-5 py-3.5">
            <h2 className="font-semibold">1. Escolha os clientes <span className="font-normal text-stone-400">{sel.length} selecionado(s)</span></h2>
            <p className="text-xs text-stone-500">Clientes ativos com plano de <b>entrega em casa</b>. Quem já está em outra rota é movido para esta ao salvar.</p>
          </header>
          {clientes.length === 0 ? (
            <div className="px-5 py-6 text-sm text-stone-600">
              <p className="mb-2 flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />Nenhum cliente ativo com plano de entrega.</p>
              <p>Só aparecem aqui clientes ativos cuja assinatura é de <b>Entrega em casa</b> (clientes de coleta retiram no ponto e não entram em rota). <Link className="link" href="/clientes/novo">Cadastre um cliente</Link> com esse plano.</p>
              {totalEntrega === 0 && <p className="mt-2 text-xs text-stone-500">Dica: crie antes um plano de “Entrega em casa” em Planos e preços.</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input className="campo !py-1.5 !pl-8 text-sm" placeholder="Buscar nome, bairro ou rua" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-stone-600"><input type="checkbox" className="size-3.5 accent-amber-700" checked={soSemRota} onChange={(e) => setSoSemRota(e.target.checked)} />só sem rota</label>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { setSel((s) => [...s, ...visiveis.filter((c) => !s.includes(c.id)).map((c) => c.id)]); invalida(); }}>Todos</button>
              </div>
              <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
                {visiveis.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-amber-50/50">
                      <input type="checkbox" className="size-4 accent-amber-700" checked={sel.includes(c.id)} onChange={() => alternar(c.id)} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.nome}</span><span className="block truncate text-xs text-stone-500">{enderecoCurto(c)}</span></span>
                      {c.rotaId && c.rotaId !== d.id ? <span className="selo selo-cinza shrink-0">{c.rotaNome}</span> : !c.rotaId && <span className="selo selo-ambar shrink-0">sem rota</span>}
                    </label>
                  </li>
                ))}
                {!visiveis.length && <li className="px-4 py-4 text-sm text-stone-500">Nenhum cliente encontrado.</li>}
              </ul>
            </>
          )}
        </section>

        <section className="cartao !p-0">
          <header className="border-b border-stone-100 px-5 py-3.5">
            <h2 className="font-semibold">2. Ordene e trace no mapa</h2>
            <p className="text-xs text-stone-500">A ordem abaixo é a do entregador. O traçado segue ciclovias e ruas de bicicleta (OpenStreetMap).</p>
          </header>
          <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 py-3">
            <button type="button" className="btn btn-pequeno" disabled={!!ocupado || !paradas.length} onClick={() => void executar({ localizar: true, ordenar: true, tracar: true })}>
              <Sparkles size={14} />Sugerir ordem e traçar
            </button>
            <button type="button" className="btn-sec btn-pequeno" disabled={!!ocupado || !faltamCoord} onClick={() => void executar({ localizar: true })}><LocateFixed size={14} />Localizar endereços{faltamCoord ? ` (${faltamCoord})` : ""}</button>
            <button type="button" className="btn-sec btn-pequeno" disabled={!!ocupado || !paradas.length} onClick={() => void executar({ localizar: true, tracar: true })}><RouteIcon size={14} />Traçar na ordem atual</button>
          </div>
          {ocupado && <p className="flex items-center gap-2 bg-stone-50 px-5 py-2 text-sm text-stone-600"><Loader2 size={14} className="animate-spin" />{ocupado}</p>}
          {!paradas.length ? <p className="px-5 py-5 text-sm text-stone-500">Selecione clientes acima para montar a sequência de paradas.</p> : (
            <ol className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
              {origem && <li className="flex items-center gap-3 bg-stone-50/70 px-4 py-2 text-sm"><span className="flex size-6 items-center justify-center rounded-lg bg-stone-900 text-xs text-white">🍞</span><span className="font-medium">{origem.nome}</span><span className="text-xs text-stone-500">ponto de partida</span>
                {origem && !origemCoord && <span className="ml-auto text-xs text-amber-800">sem localização</span>}</li>}
              {paradas.map((c, i) => {
                const ok = !!coords[`c:${c.id}`];
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: d.cor }}>{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.nome}</span><span className="block truncate text-xs text-stone-500">{enderecoCurto(c)}</span></span>
                    {naoLocalizados.has(`c:${c.id}`) ? <span title="Endereço não encontrado" className="text-amber-700"><AlertTriangle size={14} /></span>
                      : ok ? <span title="Localizado no mapa" className="text-emerald-600"><MapPin size={14} /></span> : <span title="Ainda não localizado" className="text-stone-300"><MapPin size={14} /></span>}
                    <button type="button" className="btn-ghost !p-1.5" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={15} /></button>
                    <button type="button" className="btn-ghost !p-1.5" aria-label="Descer" disabled={i === paradas.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={15} /></button>
                    <button type="button" className="btn-ghost !p-1.5 hover:!bg-red-50 hover:!text-red-700" aria-label="Remover da rota" onClick={() => alternar(c.id)}><X size={15} /></button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {msg && (
          <p role={msg.tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${msg.tipo === "erro" ? "border-red-200 bg-red-50 text-red-800" : msg.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {msg.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}{msg.texto}
          </p>
        )}
        <div className="sticky bottom-0 -mx-1 flex items-center gap-3 bg-gradient-to-t from-fundo via-fundo to-transparent px-1 pb-2 pt-4">
          <button type="button" className="btn !px-6" disabled={!!ocupado} onClick={() => void salvar()}>{ocupado === "Salvando…" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{d.id ? "Salvar rota" : "Criar rota"}</button>
          <Link href="/rotas" className="btn-sec">Voltar</Link>
          {desatualizado && <span className="text-xs text-amber-800">Trajeto desatualizado: trace de novo antes de salvar.</span>}
        </div>
      </div>

      <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col gap-2">
        <div className="min-h-0 flex-1"><MapaRotaDinamico origem={origem && origemCoord ? { ...origemCoord, nome: origem.nome } : null} paradas={mapaParadas} trajeto={desatualizado ? null : trajeto?.pontos ?? null} cor={d.cor} /></div>
        <div className="cartao flex items-center gap-4 !p-3 text-sm">
          {trajeto && !desatualizado ? (
            <>
              <span><b>{trajeto.distancia_m != null ? km(trajeto.distancia_m) : "—"}</b> <span className="text-stone-500">de percurso</span></span>
              {trajeto.duracao_s != null && <span><b>{min(trajeto.duracao_s)}</b> <span className="text-stone-500">de bicicleta</span></span>}
              {trajeto.aproximado && <span className="selo selo-ambar">linhas retas</span>}
            </>
          ) : <span className="text-stone-500">{paradas.length ? `${mapaParadas.length} de ${paradas.length} paradas no mapa. Use “Sugerir ordem e traçar”.` : "Escolha clientes para vê-los no mapa."}</span>}
        </div>
      </div>
    </div>
  );
}

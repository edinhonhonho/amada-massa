"use client";

import { ChevronRight, MapPin, Navigation, Phone, Play, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { finalizarRota, iniciarRota, registrarEntrega } from "@/app/entregador/actions";
import { empilhar, lerFila, novoItemKey, remover, type ItemFila, type NovoItem } from "@/lib/fila";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import { linkGoogleMaps } from "@/lib/geo";
import { comprimirImagem } from "@/lib/imagem";
import { createBrowser } from "@/lib/supabase/browser";

export type Parada = {
  id: string; ordem: number; nome: string; telefone: string | null; endereco: string; bairro: string | null;
  instrucoes: string | null; qtd: number; status: string; ocorrencia: string | null;
  observacao: string | null; entregue_em: string | null; tem_foto: boolean; lat: number | null; lng: number | null;
  paes: { nome: string; qtd: number }[] | null;
};
type Estado = { status: string; ocorrencia: string | null; observacao: string | null; em: string | null; foto: boolean };
type Folha = { id: string; modo: "entregue" | "nao_entregue" };

const OCORRENCIAS = ["Cliente ausente", "Endereço errado", "Atraso", "Pão com problema", "Outro"];
const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";

type OrigemMapa = { lat: number; lng: number; nome: string };

export default function EntregadorApp({
  semanaId, rotaId, paradas, iniciadaEm, finalizadaEm, cor, trajeto, distanciaM, duracaoS, origem,
}: {
  semanaId: string; rotaId: string; paradas: Parada[]; iniciadaEm: string | null; finalizadaEm: string | null;
  cor: string; trajeto: [number, number][] | null; distanciaM: number | null; duracaoS: number | null; origem: OrigemMapa | null;
}) {
  const [verMapa, setVerMapa] = useState(false);
  const [estado, setEstado] = useState<Record<string, Estado>>(() =>
    Object.fromEntries(paradas.map((p) => [p.id, { status: p.status, ocorrencia: p.ocorrencia, observacao: p.observacao, em: p.entregue_em, foto: p.tem_foto }])),
  );
  const [inicio, setInicio] = useState(iniciadaEm);
  const [fim, setFim] = useState(finalizadaEm);
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [obs, setObs] = useState("");
  const [ocorr, setOcorr] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [lendoFoto, setLendoFoto] = useState(false);
  const enviando = useRef(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const sincronizar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    try {
      for (const item of await lerFila()) {
        try {
          let r: { ok: boolean; erro?: string };
          if (item.tipo === "iniciar") r = await iniciarRota({ semana: item.semana, rota: item.rota, em: item.em });
          else if (item.tipo === "finalizar") r = await finalizarRota({ semana: item.semana, rota: item.rota, em: item.em });
          else {
            let fotoPath = item.fotoPath ?? null;
            if (item.foto && !fotoPath) {
              const path = `${item.id}/${Date.now()}.jpg`;
              const { error } = await createBrowser().storage.from("entregas-fotos").upload(path, item.foto, { contentType: "image/jpeg" });
              if (error) {
                if (/security|policy|permission|bucket|not found|exceed/i.test(error.message)) setAviso(`Uma foto não pôde ser enviada (${error.message}). A entrega foi registrada sem ela.`);
                else break; // sem rede: tenta de novo depois
              } else {
                fotoPath = path;
                await empilhar({ ...item, foto: null, fotoPath }); // não reenviar a foto se o registro falhar
              }
            }
            r = await registrarEntrega({ id: item.id, status: item.status, ocorrencia: item.ocorrencia, observacao: item.observacao, fotoPath, em: item.em });
          }
          if (!r.ok) setAviso(`Não foi possível registrar uma ação: ${r.erro}`);
        } catch {
          break; // sem rede: mantém na fila
        }
        await remover(item.key);
      }
    } finally {
      enviando.current = false;
      setPendentes((await lerFila()).length);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const fila = await lerFila();
      if (!vivo) return;
      // reaplica o que ficou pendente de uma sessão sem sinal
      for (const it of fila) {
        if (it.tipo === "iniciar" && it.semana === semanaId && it.rota === rotaId) setInicio((v) => v ?? it.em);
        if (it.tipo === "finalizar" && it.semana === semanaId && it.rota === rotaId) setFim(it.em);
        if (it.tipo === "entrega" && it.id in estado)
          setEstado((s) => ({ ...s, [it.id]: { status: it.status, ocorrencia: it.ocorrencia ?? null, observacao: it.observacao ?? null, em: it.em, foto: !!(it.foto || it.fotoPath) } }));
      }
      setPendentes(fila.length);
    })();
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void sincronizar(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void sincronizar();
    return () => { vivo = false; window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sincronizar, semanaId, rotaId]);

  async function enfileirar(item: NovoItem) {
    await empilhar({ ...item, key: novoItemKey(), criado: new Date().toISOString() } as ItemFila);
    setPendentes((await lerFila()).length);
    void sincronizar();
  }

  function iniciar() {
    const em = new Date().toISOString();
    setInicio(em);
    void enfileirar({ tipo: "iniciar", semana: semanaId, rota: rotaId, em });
  }
  function finalizar() {
    if (!confirm("Finalizar a rota?")) return;
    const em = new Date().toISOString();
    setFim(em);
    void enfileirar({ tipo: "finalizar", semana: semanaId, rota: rotaId, em });
  }

  function marcar(id: string, status: "entregue" | "nao_entregue" | "programada", extra?: { ocorrencia?: string; observacao?: string; foto?: Blob | null }) {
    const em = new Date().toISOString();
    setEstado((s) => ({ ...s, [id]: { status, ocorrencia: extra?.ocorrencia ?? null, observacao: extra?.observacao ?? null, em: status === "programada" ? null : em, foto: !!extra?.foto } }));
    void enfileirar({ tipo: "entrega", id, status, ocorrencia: extra?.ocorrencia ?? null, observacao: extra?.observacao ?? null, em, foto: extra?.foto ?? null });
  }

  function abrirFolha(f: Folha) {
    setFolha(f); setObs(""); setOcorr(""); setFoto(null); setFotoUrl(null);
  }
  async function aoEscolherFoto(arquivo?: File) {
    if (!arquivo) return;
    setLendoFoto(true);
    try {
      const b = await comprimirImagem(arquivo);
      setFoto(b);
      setFotoUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); });
    } catch {
      setAviso("Não foi possível ler a foto. Tente de novo.");
    } finally {
      setLendoFoto(false);
    }
  }
  function confirmarFolha() {
    if (!folha) return;
    if (folha.modo === "nao_entregue" && !ocorr) { setAviso("Escolha o motivo da não entrega."); return; }
    marcar(folha.id, folha.modo, { ocorrencia: ocorr || undefined, observacao: obs.trim() || undefined, foto });
    setFolha(null);
  }

  const concluidas = paradas.filter((p) => ["entregue", "nao_entregue"].includes(estado[p.id].status)).length;
  const entregues = paradas.filter((p) => estado[p.id].status === "entregue").length;
  const restantes = paradas.length - concluidas;
  const emAndamento = !!inicio && !fim;
  const proximo = paradas.find((p) => ["programada", "reagendada"].includes(estado[p.id].status))?.id;
  const pendentes_ = paradas.filter((p) => ["programada", "reagendada"].includes(estado[p.id].status));
  const navegar = linkGoogleMaps(pendentes_.map((p) => (p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : `${p.endereco}, ${p.bairro ?? ""}, Porto Alegre`)));
  const paradasMapa = paradas.filter((p) => p.lat != null && p.lng != null).map((p) => ({
    id: p.id, nome: p.nome, lat: p.lat as number, lng: p.lng as number,
    cor: estado[p.id].status === "entregue" ? "#059669" : estado[p.id].status === "nao_entregue" ? "#dc2626" : cor,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-2 z-10 rounded-[28px] bg-white/90 p-4 shadow-[0_14px_34px_-18px_rgba(28,25,23,.4),0_0_0_1px_rgba(28,25,23,.04)] backdrop-blur-xl">
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{entregues}<span className="text-lg font-semibold text-stone-400">/{paradas.length}</span></span>
          <span className="text-[15px] text-stone-500">entregues</span>
          <span className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{online ? <><i className="size-1.5 rounded-full bg-emerald-500" />online</> : <><WifiOff size={12} />sem sinal</>}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${paradas.length ? (concluidas / paradas.length) * 100 : 0}%` }} /></div>
        {pendentes > 0 && <button className="mt-2.5 text-sm font-medium text-amber-800 underline" onClick={() => void sincronizar()}>{pendentes} a sincronizar</button>}
      </div>

      {(paradasMapa.length > 0 || navegar) && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2.5">
            {paradasMapa.length > 0 && <button className="btn-sec !rounded-full !py-3.5 text-[15px]" onClick={() => setVerMapa((v) => !v)}><MapPin size={17} />{verMapa ? "Ocultar mapa" : "Ver mapa"}</button>}
            {navegar && <a className="btn !rounded-full !py-3.5 text-[15px]" href={navegar} target="_blank" rel="noreferrer"><Navigation size={17} />Navegar</a>}
          </div>
          {verMapa && (
            <div className="h-80 overflow-hidden rounded-[28px] shadow-[0_14px_34px_-20px_rgba(28,25,23,.4)]">
              <MapaRotaDinamico origem={origem} paradas={paradasMapa} trajeto={trajeto} cor={cor} destaque={proximo} />
            </div>
          )}
          {verMapa && distanciaM != null && <p className="text-xs text-stone-500">{(distanciaM / 1000).toFixed(1).replace(".", ",")} km de percurso{duracaoS ? ` · cerca de ${Math.round(duracaoS / 60)} min de bicicleta` : ""}</p>}
        </div>
      )}

      {aviso && <p className="rounded-2xl bg-red-50 p-4 text-[15px] text-red-800" onClick={() => setAviso(null)}>{aviso} <span className="underline">ok</span></p>}

      {!inicio && <button className="btn !rounded-full !py-5 text-lg shadow-[0_16px_30px_-12px_rgba(180,83,9,.7)]" onClick={iniciar}><Play size={20} fill="currentColor" />Iniciar rota</button>}
      {inicio && (
        <p className="px-1 text-[15px] text-stone-500">
          Iniciada às {hora(inicio)}{fim && ` · finalizada às ${hora(fim)}`}
        </p>
      )}

      {paradas.map((p, i) => {
        const e = estado[p.id];
        const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.endereco}, ${p.bairro ?? ""}, Porto Alegre`)}`;
        const cor = e.status === "entregue" ? "!bg-emerald-50" : e.status === "nao_entregue" ? "!bg-red-50" : p.id === proximo && emAndamento ? "!bg-amber-50 !shadow-[0_22px_40px_-20px_rgba(180,83,9,.55)]" : "";
        return (
          <article key={p.id} className={`rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,.04),0_16px_34px_-22px_rgba(28,25,23,.3)] ${cor}`}>
            <div className="flex items-start gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[15px] font-bold text-stone-600">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[19px] font-semibold leading-tight">{p.nome} <span className="whitespace-nowrap font-normal text-stone-400">· {p.qtd} 🍞</span></div>
                {p.paes && p.paes.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{p.paes.map((x) => <span key={x.nome} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{x.qtd} {x.nome}</span>)}</div>}
                <a className="mt-2 block text-[15px] leading-snug text-stone-600 underline decoration-stone-300 underline-offset-2" href={mapa} target="_blank" rel="noreferrer">{p.endereco}{p.bairro && ` · ${p.bairro}`}</a>
                {p.instrucoes && <div className="mt-2 rounded-2xl bg-stone-50 px-3.5 py-2.5 text-sm text-stone-600">{p.instrucoes}</div>}
                {p.telefone && <a className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700" href={`tel:${p.telefone}`}><Phone size={13} />{p.telefone}</a>}
              </div>
            </div>

            {e.status === "entregue" || e.status === "nao_entregue" ? (
              <div className="mt-3 text-sm">
                <div className="flex items-center gap-3">
                  <b className={e.status === "entregue" ? "text-green-800" : "text-red-800"}>
                    {e.status === "entregue" ? "✔ Entregue" : `✖ Não entregue${e.ocorrencia ? ` — ${e.ocorrencia}` : ""}`} às {hora(e.em)}
                  </b>
                  {!fim && <button className="underline" onClick={() => marcar(p.id, "programada")}>desfazer</button>}
                </div>
                {(e.observacao || e.foto) && <div className="text-stone-700">{e.foto && "📷 foto registrada "}{e.observacao}</div>}
              </div>
            ) : emAndamento ? (
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <button className="btn col-span-2 !rounded-2xl py-4 text-lg" onClick={() => marcar(p.id, "entregue")}>Entregue</button>
                <button className="btn-sec !rounded-2xl py-4" onClick={() => abrirFolha({ id: p.id, modo: "nao_entregue" })}>Problema</button>
                <button className="col-span-3 flex items-center justify-center gap-1 py-1 text-sm font-medium text-stone-500" onClick={() => abrirFolha({ id: p.id, modo: "entregue" })}>Entregue com foto ou observação<ChevronRight size={14} /></button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-400">{fim ? "Rota finalizada." : "Inicie a rota para registrar."}</p>
            )}
          </article>
        );
      })}

      {emAndamento && restantes === 0 && <button className="btn !rounded-full !py-4 text-lg" onClick={finalizar}>Finalizar rota</button>}

      {folha && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={() => setFolha(null)}>
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 pb-8" onClick={(ev) => ev.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200" />
            <h2 className="mb-4 text-xl font-bold tracking-tight">{folha.modo === "entregue" ? "Entrega" : "Não foi possível entregar"} — {paradas.find((p) => p.id === folha.id)?.nome}</h2>
            {folha.modo === "nao_entregue" && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {OCORRENCIAS.map((o) => (
                  <button key={o} className={ocorr === o ? "btn !rounded-2xl py-3.5" : "btn-sec !rounded-2xl py-3.5"} onClick={() => setOcorr(o)}>{o}</button>
                ))}
              </div>
            )}
            <label className="rotulo">Observação (opcional)</label>
            <textarea className="campo mb-3" rows={3} value={obs} onChange={(ev) => setObs(ev.target.value)} />
            <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => void aoEscolherFoto(ev.target.files?.[0])} />
            <button className="btn-sec mb-2 w-full !rounded-2xl py-3.5" onClick={() => inputFoto.current?.click()}>{lendoFoto ? "Preparando foto…" : foto ? "📷 Trocar foto" : "📷 Tirar foto"}</button>
            {fotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="Foto da entrega" className="mb-3 max-h-48 w-full rounded-2xl object-cover" />
            )}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-sec !rounded-2xl py-3.5" onClick={() => setFolha(null)}>Cancelar</button>
              <button className="btn !rounded-2xl py-3.5" onClick={confirmarFolha} disabled={lendoFoto}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

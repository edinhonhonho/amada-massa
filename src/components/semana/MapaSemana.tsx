"use client";

import { Clock, Loader2, LocateFixed, Navigation, RefreshCw, Route as RouteIcon } from "lucide-react";
import { useState } from "react";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import type { Ponto } from "@/lib/geo";
import { geocodificar } from "@/lib/geocode";
import { reorganizarRotas } from "@/app/(app)/planejamento/actions";
import { salvarCoordenadas } from "@/app/(app)/rotas/actions";

export type ParadaSemana = { id: string; clienteId: string; nome: string; lat: number | null; lng: number | null; logradouro: string; bairro: string | null; ativa: boolean };
type Props = {
  semanaId: string;
  cor: string;
  origem: { nome: string; lat: number | null; lng: number | null } | null;
  trajeto: [number, number][] | null;
  distanciaM: number | null; duracaoS: number | null;
  paradas: ParadaSemana[];
};

const km = (m: number) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const min = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);

/** Mapa da rota na semana: paradas numeradas na ordem de entrega; arraste um ponto para corrigir a localização. */
export default function MapaSemana({ semanaId, cor, origem, trajeto, distanciaM, duracaoS, paradas }: Props) {
  const [coords, setCoords] = useState<Record<string, Ponto>>(() => {
    const m: Record<string, Ponto> = {};
    for (const p of paradas) if (p.lat != null && p.lng != null) m[p.clienteId] = { lat: p.lat, lng: p.lng };
    return m;
  });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);

  const ativas = paradas.filter((p) => p.ativa);
  const semLocal = ativas.filter((p) => !coords[p.clienteId]);
  const noMapa = ativas.filter((p) => coords[p.clienteId]).map((p) => ({ id: p.clienteId, nome: p.nome, ...coords[p.clienteId] }));
  const o = origem?.lat != null && origem?.lng != null ? { nome: origem.nome, lat: origem.lat, lng: origem.lng } : null;

  function aoMover(id: string, lat: number, lng: number) {
    if (id === "origem") return;
    setCoords((c) => ({ ...c, [id]: { lat, lng } }));
    setMudou(true);
    void salvarCoordenadas([{ tipo: "cliente", id, lat, lng }]).then(() => setMsg("Localização corrigida e guardada. Use “Reordenar” para refazer a sequência.")).catch(() => setMsg("Não foi possível guardar a nova localização."));
  }

  async function localizar() {
    setMsg(null);
    const novo = { ...coords };
    const achados: { tipo: "cliente"; id: string; lat: number; lng: number }[] = [];
    try {
      for (let i = 0; i < semLocal.length; i++) {
        setOcupado(`Localizando endereços… ${i + 1}/${semLocal.length}`);
        const p = semLocal[i];
        const r = await geocodificar({ logradouro: p.logradouro.split(",")[0], numero: p.logradouro.split(",")[1]?.trim(), bairro: p.bairro });
        if (r) { novo[p.clienteId] = r; achados.push({ tipo: "cliente", id: p.clienteId, ...r }); }
      }
    } finally { setOcupado(null); }
    setCoords(novo);
    if (achados.length) { void salvarCoordenadas(achados).catch(() => {}); setMudou(true); }
    setMsg(`${achados.length} de ${semLocal.length} endereços localizados.${achados.length < semLocal.length ? " Os demais não foram encontrados: arraste o ponto no mapa depois de posicioná-lo, ou confira o endereço na ficha." : ""}`);
  }

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(28,25,23,.06)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-stone-700"><RouteIcon size={14} className="text-stone-400" />Rota da semana</span>
        {distanciaM != null && <span className="flex items-center gap-1 text-xs text-stone-500"><Navigation size={12} />{km(distanciaM)}</span>}
        {duracaoS != null && <span className="flex items-center gap-1 text-xs text-stone-500"><Clock size={12} />{min(duracaoS)} de bicicleta</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {semLocal.length > 0 && <button type="button" onClick={() => void localizar()} disabled={!!ocupado} className="btn-sec btn-pequeno"><LocateFixed size={13} />Localizar endereços ({semLocal.length})</button>}
          <form action={reorganizarRotas.bind(null, semanaId)}>
            <button className={`btn-sec btn-pequeno ${mudou ? "!bg-amber-50 !text-amber-900" : ""}`}><RefreshCw size={13} />Reordenar</button>
          </form>
        </span>
      </div>
      <div className="h-[340px]">
        <MapaRotaDinamico origem={o} paradas={noMapa} trajeto={mudou ? null : trajeto} cor={cor} aoMover={aoMover} />
      </div>
      <p className="flex min-h-9 items-center gap-2 px-4 py-2 text-xs text-stone-500">
        {ocupado ? <><Loader2 size={13} className="animate-spin" />{ocupado}</> : msg ?? (semLocal.length ? `${semLocal.length} ${semLocal.length === 1 ? "parada sem localização" : "paradas sem localização"} no mapa.` : "Arraste um ponto para corrigir onde o endereço está no mapa.")}
      </p>
    </div>
  );
}

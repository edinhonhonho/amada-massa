"use client";

import { AlertTriangle, Check, Clock, Loader2, Navigation, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import type { Ponto } from "@/lib/geo";
import { geocodificar } from "@/lib/geocode";
import { reorganizarRotas } from "@/app/(app)/planejamento/actions";
import { salvarCoordenadas } from "@/app/(app)/rotas/actions";

export type ParadaSemana = { id: string; clienteId: string; nome: string; lat: number | null; lng: number | null; ativa: boolean; rua: string; numero: string; bairro: string | null; cidade: string; cep: string };
type Props = {
  semanaId: string; rotaId: string; cor: string;
  origem: { nome: string; lat: number | null; lng: number | null } | null;
  trajeto: [number, number][] | null;
  distanciaM: number | null; duracaoS: number | null;
  paradas: ParadaSemana[];
};

const km = (m: number) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const min = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);

// o que já foi tentado nesta sessão: evita repetir buscas que falharam e laços de atualização
const jaProcurados = new Set<string>();
const jaTracadas = new Set<string>();

/**
 * Mapa da rota na semana. Tudo é automático: os endereços sem localização são procurados, a ordem das paradas
 * e o caminho de bicicleta são calculados. A localização fica guardada no cliente (e pode ser corrigida no mapa).
 */
export default function MapaSemana({ semanaId, rotaId, cor, origem, trajeto, distanciaM, duracaoS, paradas }: Props) {
  const router = useRouter();
  const [coords, setCoords] = useState<Record<string, Ponto>>(() => {
    const m: Record<string, Ponto> = {};
    for (const p of paradas) if (p.lat != null && p.lng != null) m[p.clienteId] = { lat: p.lat, lng: p.lng };
    return m;
  });
  const [fase, setFase] = useState<{ tipo: "ocioso" | "localizando" | "tracando"; n?: number; de?: number }>({ tipo: "ocioso" });
  const [alterado, setAlterado] = useState(false);
  const ativo = useRef(true);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);

  const ativas = paradas.filter((p) => p.ativa);
  const semLocal = ativas.filter((p) => !coords[p.clienteId]);
  const naoAchados = semLocal.filter((p) => jaProcurados.has(p.clienteId) && fase.tipo === "ocioso");
  const noMapa = ativas.filter((p) => coords[p.clienteId]).map((p) => ({ id: p.clienteId, nome: p.nome, ...coords[p.clienteId] }));
  const o = origem?.lat != null && origem?.lng != null ? { nome: origem.nome, lat: origem.lat, lng: origem.lng } : null;

  async function retracar() {
    setFase({ tipo: "tracando" });
    try { await reorganizarRotas(semanaId); } catch { /* o mapa segue com o que já existe */ }
    if (ativo.current) { setFase({ tipo: "ocioso" }); setAlterado(false); router.refresh(); }
  }

  // ao abrir a rota: procura os endereços sem localização e refaz ordem e caminho, sem ninguém pedir
  useEffect(() => {
    const procurar = ativas.filter((p) => !p.lat && !jaProcurados.has(p.clienteId));
    const temCaminho = !!trajeto?.length;
    const chaveTraco = `${rotaId}|${ativas.length}`;
    if (!procurar.length && (temCaminho || jaTracadas.has(chaveTraco) || ativas.every((p) => !coords[p.clienteId]))) return;
    (async () => {
      const achados: { tipo: "cliente"; id: string; lat: number; lng: number }[] = [];
      const novo: Record<string, Ponto> = {};
      for (let i = 0; i < procurar.length; i++) {
        if (!ativo.current) return;
        setFase({ tipo: "localizando", n: i + 1, de: procurar.length });
        const p = procurar[i];
        jaProcurados.add(p.clienteId);
        const r = await geocodificar({ logradouro: p.rua, numero: p.numero, bairro: p.bairro, cidade: p.cidade, cep: p.cep }).catch(() => null);
        if (r) { novo[p.clienteId] = r; achados.push({ tipo: "cliente", id: p.clienteId, ...r }); }
      }
      if (!ativo.current) return;
      if (achados.length) { setCoords((c) => ({ ...c, ...novo })); await salvarCoordenadas(achados).catch(() => {}); }
      jaTracadas.add(chaveTraco);
      if (achados.length || !temCaminho) await retracar(); else setFase({ tipo: "ocioso" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaId]);

  function aoMover(id: string, lat: number, lng: number) {
    if (id === "origem") return;
    setCoords((c) => ({ ...c, [id]: { lat, lng } }));
    setAlterado(true);
    void salvarCoordenadas([{ tipo: "cliente", id, lat, lng }]).then(() => retracar()).catch(() => {});
  }

  const ocupado = fase.tipo !== "ocioso";
  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(28,25,23,.06)]">
      <div className="relative h-[380px]">
        <MapaRotaDinamico origem={o} paradas={noMapa} trajeto={alterado ? null : trajeto} cor={cor} aoMover={aoMover} />
        {ocupado && (
          <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md">
            <Loader2 size={13} className="animate-spin" />
            {fase.tipo === "localizando" ? `Localizando endereços… ${fase.n}/${fase.de}` : "Traçando o caminho…"}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-stone-100 px-4 py-2.5 text-[13px] text-stone-500">
        {distanciaM != null && !alterado && <span className="flex items-center gap-1.5"><Navigation size={13} className="text-stone-400" /><b className="font-semibold text-stone-800">{km(distanciaM)}</b></span>}
        {duracaoS != null && !alterado && <span className="flex items-center gap-1.5"><Clock size={13} className="text-stone-400" /><b className="font-semibold text-stone-800">{min(duracaoS)}</b> de bicicleta</span>}
        {!ocupado && trajeto?.length && !alterado ? <span className="flex items-center gap-1 text-emerald-700"><Check size={13} />caminho traçado</span> : null}
        {!ocupado && !trajeto?.length && noMapa.length < 2 && ativas.length > 0 && <span>Com {noMapa.length === 1 ? "uma parada localizada" : "nenhuma parada localizada"} ainda não há caminho para traçar.</span>}
        <button type="button" onClick={() => void retracar()} disabled={ocupado} className="btn-ghost ml-auto !px-2 !py-1 text-xs"><RefreshCw size={12} />Recalcular</button>
      </div>
      {naoAchados.length > 0 && (
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Não consegui localizar {naoAchados.length === 1 ? "este endereço" : "estes endereços"}:{" "}
            {naoAchados.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link className="font-medium underline" href={`/clientes/${p.clienteId}/editar`}>{p.nome}</Link></span>)}.
            Marque a casa no mapa do cadastro do cliente; fica guardado para as próximas semanas.
          </span>
        </div>
      )}
    </div>
  );
}

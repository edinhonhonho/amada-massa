"use client";

import { Check, Crosshair, Loader2, MapPinned, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MapaRotaDinamico from "@/components/MapaRotaDinamico";
import { geocodificar, type Endereco } from "@/lib/geocode";

type Props = { endereco: Endereco; lat: number | null; lng: number | null; aoMudar: (lat: number | null, lng: number | null) => void };

/**
 * Posição da casa do cliente no mapa. Sai sozinha do endereço (rua, número e cidade) e pode ser
 * corrigida clicando no mapa ou arrastando o ponto. Fica guardada: não precisa localizar de novo a cada semana.
 */
export default function LocalNoMapa({ endereco, lat, lng, aoMudar }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const manual = useRef(lat != null && lng != null);
  const chaveInicial = useRef(`${endereco.logradouro ?? ""}|${endereco.numero ?? ""}|${endereco.cidade ?? ""}|${endereco.cep ?? ""}`);
  const mudar = useRef(aoMudar);
  mudar.current = aoMudar;

  async function localizar(forcar = false) {
    const rua = (endereco.logradouro ?? "").trim();
    if (!rua && (endereco.cep ?? "").replace(/\D/g, "").length !== 8) { setAviso("Informe a rua e o número para localizar."); return; }
    setBuscando(true); setAviso(null);
    const r = await geocodificar(endereco).catch(() => null);
    setBuscando(false);
    if (r) { manual.current = false; mudar.current(r.lat, r.lng); setAviso(forcar ? "Endereço localizado. Se o ponto não estiver na casa certa, arraste-o." : null); }
    else setAviso("Não encontrei esse endereço. Clique no mapa para marcar a casa.");
  }

  // localiza sozinho quando rua/número/cidade/CEP mudam (e o ponto não foi posicionado à mão)
  const chave = `${endereco.logradouro ?? ""}|${endereco.numero ?? ""}|${endereco.cidade ?? ""}|${endereco.cep ?? ""}`;
  useEffect(() => {
    if (manual.current && chave === chaveInicial.current) return;
    if ((endereco.logradouro ?? "").trim().length < 4 || !(endereco.numero ?? "").trim()) return;
    if (manual.current && lat != null) return;
    const t = setTimeout(() => void localizar(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const marcou = (la: number, ln: number) => { manual.current = true; setAviso(null); mudar.current(la, ln); };
  const tem = lat != null && lng != null;

  return (
    <div className="col-span-2 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(28,25,23,.08)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700"><MapPinned size={15} className="text-stone-400" />Localização no mapa</span>
        <span className={`flex items-center gap-1 text-xs ${tem ? "text-emerald-700" : "text-stone-400"}`}>{buscando ? <><Loader2 size={12} className="animate-spin" />localizando…</> : tem ? <><Check size={12} />guardada</> : "ainda sem ponto"}</span>
        <button type="button" onClick={() => void localizar(true)} disabled={buscando} className="btn-sec btn-pequeno ml-auto"><Search size={13} />Localizar pelo endereço</button>
      </div>
      <div className="h-[260px]">
        <MapaRotaDinamico
          semNumero cor="#b45309" origem={null}
          paradas={tem ? [{ id: "casa", nome: "Casa do cliente", lat: lat!, lng: lng! }] : []}
          aoMover={(_, la, ln) => marcou(la, ln)} aoClicar={marcou}
        />
      </div>
      <p className="flex min-h-9 items-center gap-2 px-4 py-2 text-xs text-stone-500"><Crosshair size={13} className="shrink-0 text-stone-400" />{aviso ?? "Clique no mapa ou arraste o ponto para marcar exatamente onde o cliente mora. Esse ponto é usado para montar o caminho do entregador."}</p>
    </div>
  );
}

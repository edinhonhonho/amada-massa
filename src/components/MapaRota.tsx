"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export type ParadaMapa = { id: string; nome: string; lat: number; lng: number; cor?: string };
export type OrigemMapa = { lat: number; lng: number; nome: string };

type Props = {
  origem?: OrigemMapa | null;
  paradas: ParadaMapa[];
  trajeto?: [number, number][] | null;
  cor: string;
  /** Destaca a parada atual (ex.: próxima do entregador). */
  destaque?: string | null;
  /** Quando informado, os pontos podem ser arrastados para corrigir a localização (id da parada, ou "origem"). */
  aoMover?: (id: string, lat: number, lng: number) => void;
};

const marcador = (n: string, cor: string, destaque = false) =>
  L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${cor};color:#fff;font:600 13px system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);${destaque ? "outline:3px solid #f59e0b;" : ""}">${n}</div>`,
  });

const iconeOrigem = L.divIcon({
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:10px;background:#1c1917;color:#fff;font:600 16px system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">🍞</div>`,
});

/** Mapa (OpenStreetMap) com ponto de partida, paradas numeradas e o trajeto. */
export default function MapaRota({ origem, paradas, trajeto, cor, destaque, aoMover }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const ultimaChave = useRef("");
  const mover = useRef(aoMover);
  mover.current = aoMover;

  useEffect(() => {
    if (!el.current || mapa.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView([-30.0346, -51.2177], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    camada.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => { m.remove(); mapa.current = null; camada.current = null; };
  }, []);

  useEffect(() => {
    const m = mapa.current, g = camada.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];

    const linha: [number, number][] = trajeto?.length
      ? trajeto
      : [...(origem ? [[origem.lat, origem.lng] as [number, number]] : []), ...paradas.map((p) => [p.lat, p.lng] as [number, number])];
    if (linha.length > 1) {
      L.polyline(linha, { color: "#ffffff", weight: 8, opacity: 0.9 }).addTo(g);
      L.polyline(linha, { color: cor, weight: 5, opacity: 0.95, dashArray: trajeto?.length ? undefined : "8 8" }).addTo(g);
    }
    if (origem) {
      const mo = L.marker([origem.lat, origem.lng], { icon: iconeOrigem, title: `Partida: ${origem.nome}`, zIndexOffset: 1000, draggable: !!mover.current }).bindTooltip(`Partida: ${origem.nome}`).addTo(g);
      mo.on("dragend", () => { const ll = mo.getLatLng(); mover.current?.("origem", ll.lat, ll.lng); });
      pts.push([origem.lat, origem.lng]);
    }
    paradas.forEach((p, i) => {
      const mk = L.marker([p.lat, p.lng], { icon: marcador(String(i + 1), p.cor ?? cor, p.id === destaque), title: p.nome, draggable: !!mover.current }).bindTooltip(`${i + 1}. ${p.nome}${mover.current ? " (arraste para corrigir)" : ""}`).addTo(g);
      mk.on("dragend", () => { const ll = mk.getLatLng(); mover.current?.(p.id, ll.lat, ll.lng); });
      pts.push([p.lat, p.lng]);
    });
    for (const q of linha) pts.push(q);
    // só reenquadra quando o conjunto de pontos muda (arrastar um ponto não deve fazer o mapa pular)
    const chave = `${origem ? "o" : ""}|${paradas.map((p) => p.id).join(",")}|${trajeto?.length ?? 0}`;
    if (pts.length && chave !== ultimaChave.current) { m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 }); ultimaChave.current = chave; }
  }, [origem, paradas, trajeto, cor, destaque]);

  return <div ref={el} className="size-full min-h-64 overflow-hidden rounded-2xl bg-stone-200" />;
}

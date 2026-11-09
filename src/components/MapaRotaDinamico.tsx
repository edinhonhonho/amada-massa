"use client";

import dynamic from "next/dynamic";

/** Leaflet usa `window`: só carrega no navegador. */
const MapaRotaDinamico = dynamic(() => import("./MapaRota"), {
  ssr: false,
  loading: () => <div className="flex size-full min-h-64 items-center justify-center rounded-2xl bg-stone-100 text-sm text-stone-400">Carregando mapa…</div>,
});

export default MapaRotaDinamico;

"use client";

import { useEffect } from "react";

/** Registra o service worker de um app (arquivo na raiz de /public, escopo restrito ao app). */
export default function RegistrarSW({ arquivo, escopo }: { arquivo: string; escopo: string }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(arquivo, { scope: escopo }).catch(() => {});
  }, [arquivo, escopo]);
  return null;
}

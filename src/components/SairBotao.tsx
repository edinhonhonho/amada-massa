"use client";

import type { ReactNode } from "react";

/** Ao sair, apaga o cache offline do app (nomes e endereços) deste aparelho. */
export default function SairBotao({
  cache, className = "underline", icone, titulo, rotulo,
}: { cache?: string; className?: string; icone?: ReactNode; titulo?: string; rotulo?: string }) {
  return (
    <button className={className} title={titulo} aria-label={titulo ?? "Sair"} onClick={() => { if (cache && "caches" in window) void caches.delete(cache); }}>
      {icone}{rotulo ?? (icone ? null : "Sair")}
    </button>
  );
}

"use client";

/** Ao sair, apaga o cache offline do app (nomes e endereços) deste aparelho. */
export default function SairBotao({ cache, className = "underline" }: { cache?: string; className?: string }) {
  return (
    <button className={className} onClick={() => { if (cache && "caches" in window) void caches.delete(cache); }}>
      Sair
    </button>
  );
}

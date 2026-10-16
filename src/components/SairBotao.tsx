"use client";

/** Ao sair, apaga o cache offline (nomes e endereços) do aparelho. */
export default function SairBotao() {
  return (
    <button
      className="underline"
      onClick={() => { if ("caches" in window) void caches.delete("entregas-v1"); }}
    >
      Sair
    </button>
  );
}

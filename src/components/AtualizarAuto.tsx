"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Busca avisos novos ao voltar para o app e a cada minuto enquanto ele está aberto. */
export default function AtualizarAuto() {
  const router = useRouter();
  useEffect(() => {
    const atualizar = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", atualizar);
    const t = setInterval(atualizar, 60_000);
    return () => { document.removeEventListener("visibilitychange", atualizar); clearInterval(t); };
  }, [router]);
  return null;
}

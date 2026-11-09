"use client";

import { useEffect } from "react";
import { marcarLidas } from "@/app/membro/actions";

/** Marca as notificações como lidas pouco depois de a caixa ser aberta. */
export default function MarcarLidas({ temNaoLidas }: { temNaoLidas: boolean }) {
  useEffect(() => {
    if (!temNaoLidas) return;
    const t = setTimeout(() => { void marcarLidas(); (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [temNaoLidas]);
  return null;
}

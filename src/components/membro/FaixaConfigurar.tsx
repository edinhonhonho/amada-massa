"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useInstalado } from "@/components/InstalarApp";

/** Lembrete de uma linha, só quando falta instalar o app ou ligar os avisos. Leva aos Ajustes. */
export default function FaixaConfigurar() {
  const instalado = useInstalado();
  const [ligado, setLigado] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setLigado(true); // sem suporte: não adianta insistir
        const reg = await navigator.serviceWorker.ready;
        setLigado(!!(await reg.pushManager.getSubscription()));
      } catch { setLigado(true); }
    })();
  }, []);

  if (instalado === null || ligado === null) return null;
  if (instalado && ligado) return null;
  return (
    <Link href="/membro/ajustes" className="group flex items-center gap-3 rounded-3xl bg-stone-900 px-5 py-4 text-white shadow-[0_16px_30px_-16px_rgba(28,25,23,.8)] transition active:scale-[.985]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-300"><Sparkles size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">{instalado ? "Ligue os avisos no celular" : "Instale o app no celular"}</span>
        <span className="block text-[13px] text-stone-400">Leva menos de um minuto</span>
      </span>
      <ChevronRight size={18} className="text-stone-500 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

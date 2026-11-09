"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void> };

export function useInstalado() {
  const [instalado, setInstalado] = useState<boolean | null>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalado(standalone);
  }, []);
  return instalado;
}

/** Explica como instalar o app. Some quando já está instalado. */
export default function InstalarApp({ nome }: { nome: string }) {
  const instalado = useInstalado();
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const f = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalar); };
    window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);

  if (instalado !== false) return null;
  return (
    <div className="rounded-xl bg-amber-50 shadow-sm p-4 text-left">
      <h2 className="font-semibold">Instale o app {nome} para receber os avisos</h2>
      {evento ? (
        <button className="btn mt-2 w-full" onClick={() => void evento.prompt()}>Instalar agora</button>
      ) : ios ? (
        <ol className="mt-2 list-decimal pl-5 text-sm">
          <li>Abra esta página no <b>Safari</b>.</li>
          <li>Toque no botão de compartilhar (quadrado com seta).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
          <li>Abra o app pelo ícone novo. É preciso iOS 16.4 ou mais recente.</li>
        </ol>
      ) : (
        <p className="mt-2 text-sm">No menu do navegador (⋮), escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> e abra pelo ícone novo.</p>
      )}
    </div>
  );
}

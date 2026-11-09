"use client";

import { Battery, Download, Feather, Share, ShieldCheck, SquarePlus } from "lucide-react";
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

/** Explica como instalar o app e tranquiliza: é leve e serve só para as notificações. Some quando já está instalado. */
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
    <section className="overflow-hidden rounded-3xl bg-white shadow-[0_14px_40px_-18px_rgba(146,64,14,.45)]">
      <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-5 py-4 text-white">
        <h2 className="text-lg font-bold leading-tight">Instale o {nome}</h2>
        <p className="mt-0.5 text-sm text-amber-50/90">Para os avisos chegarem direto no seu celular.</p>
      </div>
      <ul className="flex flex-col gap-3 px-5 py-4 text-sm text-stone-700">
        <li className="flex items-start gap-3"><Feather size={18} className="mt-0.5 shrink-0 text-amber-700" /><span><b>É levinho.</b> Ocupa menos espaço que uma foto e não deixa o celular lento.</span></li>
        <li className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" /><span><b>Serve só para as notificações.</b> Não acessa suas fotos, contatos nem localização; só pede permissão para mostrar avisos.</span></li>
        <li className="flex items-start gap-3"><Battery size={18} className="mt-0.5 shrink-0 text-amber-700" /><span><b>Não gasta bateria à toa.</b> Fica quietinho até chegar um aviso do clube.</span></li>
      </ul>
      <div className="border-t border-stone-100 px-5 py-4">
        {evento ? (
          <button className="btn !rounded-2xl w-full !py-3" onClick={() => void evento.prompt()}><Download size={17} />Instalar agora</button>
        ) : ios ? (
          <ol className="flex flex-col gap-2.5 text-sm text-stone-700">
            <li className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">1</span><span>Abra esta página no <b>Safari</b>.</span></li>
            <li className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">2</span><span>Toque em <Share size={15} className="inline -translate-y-px text-sky-600" /> <b>Compartilhar</b>.</span></li>
            <li className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">3</span><span>Escolha <SquarePlus size={15} className="inline -translate-y-px" /> <b>Adicionar à Tela de Início</b>.</span></li>
            <li className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">4</span><span>Abra o app pelo ícone novo. Precisa do iOS 16.4 ou mais novo.</span></li>
          </ol>
        ) : (
          <p className="text-sm text-stone-700">No menu do navegador (<b>⋮</b>), escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> e abra pelo ícone novo.</p>
        )}
      </div>
    </section>
  );
}

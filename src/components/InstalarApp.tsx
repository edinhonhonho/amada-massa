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
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(28,25,23,.04),0_18px_40px_-24px_rgba(28,25,23,.3)]">
      <div className="px-6 pb-1 pt-6">
        <h2 className="text-xl font-bold leading-tight tracking-tight">Instale o {nome}</h2>
        <p className="mt-1 text-[15px] text-stone-500">Para os avisos chegarem direto no seu celular.</p>
      </div>
      <ul className="flex flex-col gap-4 px-6 py-5 text-[15px] leading-snug text-stone-600">
        <li className="flex items-center gap-3.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Feather size={17} /></span><span><b>É levinho.</b> Ocupa menos espaço que uma foto e não deixa o celular lento.</span></li>
        <li className="flex items-center gap-3.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><ShieldCheck size={17} /></span><span><b>Serve só para as notificações.</b> Não acessa suas fotos, contatos nem localização; só pede permissão para mostrar avisos.</span></li>
        <li className="flex items-center gap-3.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Battery size={17} /></span><span><b>Não gasta bateria à toa.</b> Fica quietinho até chegar um aviso do clube.</span></li>
      </ul>
      <div className="px-6 pb-6 pt-1">
        {evento ? (
          <button className="btn !rounded-full w-full !py-3.5 text-base" onClick={() => void evento.prompt()}><Download size={17} />Instalar agora</button>
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

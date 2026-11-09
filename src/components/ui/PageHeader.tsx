import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Migalha from "./Migalha";

export default function PageHeader({
  titulo, subtitulo, acoes, voltar, etiqueta,
}: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; voltar?: { href: string; rotulo: string }; etiqueta?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        {!voltar && <Migalha />}
        {voltar && (
          <Link href={voltar.href} className="mb-1.5 inline-flex items-center gap-0.5 text-sm text-stone-500 hover:text-stone-900">
            <ChevronLeft size={15} />{voltar.rotulo}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-stone-900">{titulo}</h1>
          {etiqueta}
        </div>
        {subtitulo && <p className="mt-1 max-w-2xl text-[15px] text-stone-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONS = {
  neutro: "bg-stone-100 text-stone-500",
  ambar: "bg-amber-100 text-amber-700",
  verde: "bg-emerald-100 text-emerald-700",
  vermelho: "bg-red-100 text-red-700",
  azul: "bg-sky-100 text-sky-700",
};

/** Indicador: cartão branco com ícone, rótulo, número grande e detalhe. Vai dentro de um painel (`.cartao`). */
export default function Stat({
  rotulo, valor, detalhe, icone: Icone, tom = "neutro",
}: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; icone?: LucideIcon; tom?: keyof typeof TONS }) {
  return (
    <div className="cartao-branco min-w-0 p-4">
      <div className="flex items-center gap-2 text-[13px] text-stone-500">
        {Icone && <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${TONS[tom]}`}><Icone size={14} /></span>}
        <span className="truncate">{rotulo}</span>
      </div>
      <div className="mt-3 truncate text-[26px] font-semibold leading-none tracking-tight tabular-nums">{valor}</div>
      {detalhe && <div className="mt-2 text-xs leading-snug text-stone-500">{detalhe}</div>}
    </div>
  );
}

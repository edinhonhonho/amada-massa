import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONS = {
  neutro: "bg-stone-100 text-stone-600",
  ambar: "bg-amber-100 text-amber-800",
  verde: "bg-emerald-100 text-emerald-700",
  vermelho: "bg-red-100 text-red-700",
  azul: "bg-sky-100 text-sky-700",
};

export default function Stat({
  rotulo, valor, detalhe, icone: Icone, tom = "neutro",
}: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; icone?: LucideIcon; tom?: keyof typeof TONS }) {
  return (
    <div className="cartao flex items-start gap-3 !p-4">
      {Icone && <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONS[tom]}`}><Icone size={19} /></span>}
      <div className="min-w-0">
        <div className="text-[13px] text-stone-500">{rotulo}</div>
        <div className="truncate text-xl font-semibold tracking-tight">{valor}</div>
        {detalhe && <div className="mt-0.5 text-xs text-stone-500">{detalhe}</div>}
      </div>
    </div>
  );
}

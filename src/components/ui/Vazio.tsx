import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function Vazio({ icone: Icone, titulo, texto, acao }: { icone?: LucideIcon; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {Icone && <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><Icone size={22} /></span>}
      <h3 className="font-semibold">{titulo}</h3>
      {texto && <p className="max-w-sm text-sm text-stone-500">{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

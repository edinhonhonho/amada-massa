"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Escolha do ano: setas para o vizinho e lista com os anos próximos. */
export default function SeletorAno({ ano, base }: { ano: number; base: string }) {
  const router = useRouter();
  const anoAtual = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));
  const anos = Array.from({ length: 8 }, (_, i) => anoAtual - 3 + i);
  if (!anos.includes(ano)) anos.push(ano);
  anos.sort((a, b) => a - b);
  return (
    <div className="flex items-center rounded-xl bg-white p-0.5 shadow-sm">
      <Link className="btn-ghost !p-2" href={`${base}?ano=${ano - 1}`} aria-label="Ano anterior"><ChevronLeft size={17} /></Link>
      <select
        aria-label="Ano" value={ano}
        onChange={(e) => router.push(`${base}?ano=${e.target.value}`)}
        className="cursor-pointer rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold outline-none hover:bg-stone-100"
      >
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <Link className="btn-ghost !p-2" href={`${base}?ano=${ano + 1}`} aria-label="Próximo ano"><ChevronRight size={17} /></Link>
    </div>
  );
}

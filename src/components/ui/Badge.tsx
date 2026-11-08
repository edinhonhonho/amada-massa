import type { ReactNode } from "react";

export type Tom = "verde" | "ambar" | "vermelho" | "laranja" | "azul" | "cinza";

export default function Badge({ tom = "cinza", children, ponto = false }: { tom?: Tom; children: ReactNode; ponto?: boolean }) {
  const cor = { verde: "bg-emerald-500", ambar: "bg-amber-500", vermelho: "bg-red-500", laranja: "bg-orange-500", azul: "bg-sky-500", cinza: "bg-stone-400" }[tom];
  return (
    <span className={`selo selo-${tom}`}>
      {ponto && <span className={`size-1.5 rounded-full ${cor}`} />}
      {children}
    </span>
  );
}

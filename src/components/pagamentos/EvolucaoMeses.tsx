import Link from "next/link";
import { reais } from "@/lib/format";

export type MesResumo = { competencia: string; esperado: number; recebido: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const compacto = (c: number) => (c >= 100_000 ? `${(c / 100_000).toFixed(1).replace(".", ",")} mil` : reais(c).replace(",00", ""));

/** Esperado x recebido dos últimos meses. Cada coluna leva ao mês; o mês aberto fica em destaque. */
export default function EvolucaoMeses({ meses, atual }: { meses: MesResumo[]; atual: string }) {
  const maximo = Math.max(...meses.map((m) => m.esperado), 1);
  return (
    <section className="cartao flex flex-col" aria-label="Últimos meses">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Esperado no mês</h2>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-emerald-600" />Recebido</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stone-300" />Em aberto</span>
        </div>
      </div>
      <p className="mb-3 text-xs text-stone-400">Toque numa coluna para abrir o mês.</p>
      <div className="flex h-44 items-end gap-2.5">
        {meses.map((m) => {
          const ativo = m.competencia === atual;
          const alturaTotal = (m.esperado / maximo) * 100;
          const recebido = Math.min(m.recebido, m.esperado);
          const parteRecebida = m.esperado ? (recebido / m.esperado) * 100 : 0;
          const [ano, mm] = m.competencia.split("-");
          const rotulo = `${MESES[Number(mm) - 1]}/${ano.slice(2)}`;
          return (
            <Link
              key={m.competencia} href={`/pagamentos?mes=${m.competencia.slice(0, 7)}`} prefetch
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5 outline-none"
              aria-label={`${rotulo}: esperado ${reais(m.esperado)}, recebido ${reais(m.recebido)}`}
            >
              <span className={`text-[11px] font-semibold tabular-nums ${ativo ? "text-stone-900" : "text-transparent group-hover:text-stone-500"}`}>{compacto(m.esperado)}</span>
              <div className={`flex w-full flex-col-reverse gap-0.5 transition ${ativo ? "" : "opacity-55 group-hover:opacity-100 group-focus-visible:opacity-100"}`} style={{ height: `${Math.max(alturaTotal, m.esperado ? 4 : 1) * 0.78}%` }}>
                <div className="min-h-[3px] rounded-[3px] bg-emerald-600" style={{ height: `${parteRecebida}%` }} />
                <div className="min-h-0 flex-1 rounded-t-lg rounded-b-[3px] bg-stone-300" />
              </div>
              <span className={`text-xs ${ativo ? "font-semibold text-stone-900" : "text-stone-500"}`}>{rotulo}</span>
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs text-white shadow-xl group-hover:block group-focus-visible:block">
                <b>{rotulo}</b> · recebido {reais(m.recebido)} de {reais(m.esperado)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

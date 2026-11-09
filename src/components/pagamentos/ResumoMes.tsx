import { reais } from "@/lib/format";

type Parte = { chave: string; rotulo: string; centavos: number; qtd: number; cor: string };

/** Quanto do mês já entrou: uma barra só, com o que foi recebido, o que ainda está no prazo e o que atrasou. */
export default function ResumoMes({ esperado, recebido, aReceber, emAtraso, cobrancas, qtdRecebidas, qtdAtraso }: {
  esperado: number; recebido: number; aReceber: number; emAtraso: number; cobrancas: number; qtdRecebidas: number; qtdAtraso: number;
}) {
  const noPrazo = Math.max(aReceber - emAtraso, 0);
  const partes: Parte[] = [
    { chave: "recebido", rotulo: "Recebido", centavos: recebido, qtd: qtdRecebidas, cor: "bg-emerald-600" },
    { chave: "prazo", rotulo: "A receber, no prazo", centavos: noPrazo, qtd: Math.max(cobrancas - qtdRecebidas - qtdAtraso, 0), cor: "bg-blue-500" },
    { chave: "atraso", rotulo: "Em atraso", centavos: emAtraso, qtd: qtdAtraso, cor: "bg-red-500" },
  ];
  const total = Math.max(esperado, recebido + noPrazo + emAtraso, 1);
  const pct = esperado ? Math.round((recebido / esperado) * 100) : 0;

  return (
    <section className="cartao flex flex-col gap-5" aria-label="Resumo do mês">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <div className="text-[13px] text-stone-500">Recebido no mês</div>
          <div className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">{reais(recebido)}</div>
        </div>
        <div className="text-right text-sm text-stone-500">
          <div><b className="text-lg font-semibold text-stone-900 tabular-nums">{pct}%</b> do esperado</div>
          <div>{reais(esperado)} em {cobrancas} {cobrancas === 1 ? "cobrança" : "cobranças"}</div>
        </div>
      </div>

      <div className="flex h-10 gap-0.5" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${reais(p.centavos)}`).join("; ")}>
        {partes.filter((p) => p.centavos > 0).map((p, i, arr) => {
          const largura = (p.centavos / total) * 100;
          return (
            <div
              key={p.chave} title={`${p.rotulo}: ${reais(p.centavos)}`}
              className={`${p.cor} flex min-w-1.5 items-center justify-center overflow-hidden text-[12px] font-semibold text-white ${i === 0 ? "rounded-l-xl" : ""} ${i === arr.length - 1 ? "rounded-r-xl" : ""} rounded-[3px] transition-[flex-basis]`}
              style={{ flexBasis: `${largura}%`, flexGrow: 0, flexShrink: 0 }}
            >
              {largura >= 12 && <span className="tabular-nums">{Math.round((p.centavos / total) * 100)}%</span>}
            </div>
          );
        })}
        {esperado === 0 && <div className="h-full w-full rounded-xl bg-stone-100" />}
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {partes.map((p) => (
          <li key={p.chave} className="flex items-start gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5">
            <span className={`${p.cor} mt-1 size-2.5 shrink-0 rounded-[3px]`} aria-hidden />
            <div className="min-w-0">
              <div className="text-xs text-stone-500">{p.rotulo}</div>
              <div className="font-semibold tabular-nums">{reais(p.centavos)}</div>
              <div className="text-xs text-stone-400">{p.qtd} {p.qtd === 1 ? "cobrança" : "cobranças"}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

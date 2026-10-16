import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { hojeISO, reais } from "@/lib/format";
import { COR_SITUACAO, ROTULO_SITUACAO, pior, situacaoCobranca, type Situacao } from "@/lib/pagamentos";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function Grade({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { supabase } = await exigirEquipe();
  const hoje = hojeISO();
  const ano = Number((await searchParams).ano) || Number(hoje.slice(0, 4));
  const faixas = await carregarFaixas(supabase);

  const { data } = await supabase
    .from("cobrancas")
    .select("competencia, valor_centavos, vencimento, status, assinaturas(cliente_id, clientes(nome, sobrenome))")
    .gte("competencia", `${ano}-01-01`)
    .lte("competencia", `${ano}-12-01`);

  const clientes = new Map<string, { nome: string; meses: Situacao[][] }>();
  const totais = Array.from({ length: 12 }, () => ({ esperado: 0, recebido: 0 }));
  for (const c of data ?? []) {
    const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never } | null;
    if (!a) continue;
    const cli = um(a.clientes) as { nome: string; sobrenome: string } | null;
    const reg = clientes.get(a.cliente_id) ?? { nome: nomeCompleto(cli), meses: Array.from({ length: 12 }, () => []) };
    const m = Number(c.competencia.slice(5, 7)) - 1;
    reg.meses[m].push(situacaoCobranca(c, hoje, faixas));
    clientes.set(a.cliente_id, reg);
    if (c.status !== "isenta" && c.status !== "cancelada") totais[m].esperado += c.valor_centavos;
    if (c.status === "paga") totais[m].recebido += c.valor_centavos;
  }
  const lista = [...clientes.entries()].sort((x, y) => x[1].nome.localeCompare(y[1].nome));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Grade {ano}</h1>
        <Link className="btn-sec ml-auto" href={`/pagamentos/grade?ano=${ano - 1}`}>←</Link>
        <Link className="btn-sec" href={`/pagamentos/grade?ano=${ano + 1}`}>→</Link>
        <Link className="btn-sec" href="/pagamentos">Mês atual</Link>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => <span key={s} className={`rounded px-2 py-0.5 ${COR_SITUACAO[s]}`}>{ROTULO_SITUACAO[s]}</span>)}
      </div>
      <div className="cartao overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left">
              <th className="p-2">Cliente</th>{MESES.map((m) => <th key={m} className="p-2 text-center">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {lista.map(([id, r]) => (
              <tr key={id} className="border-b border-stone-100">
                <td className="p-2"><Link href={`/clientes/${id}`} className="hover:underline">{r.nome}</Link></td>
                {r.meses.map((s, i) => (
                  <td key={i} className="p-1 text-center">
                    {s.length ? (
                      <Link href={`/pagamentos?mes=${ano}-${String(i + 1).padStart(2, "0")}`} title={ROTULO_SITUACAO[pior(s)]} className={`block rounded px-1 py-1 ${COR_SITUACAO[pior(s)]}`}>●</Link>
                    ) : <span className="text-stone-300">·</span>}
                  </td>
                ))}
              </tr>
            ))}
            {!lista.length && <tr><td className="p-4 text-stone-500" colSpan={13}>Sem cobranças geradas neste ano. Abra um mês em Pagamentos para gerá-las.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="font-medium"><td className="p-2">Esperado</td>{totais.map((t, i) => <td key={i} className="p-1 text-center text-xs">{reais(t.esperado)}</td>)}</tr>
            <tr className="font-medium text-green-700"><td className="p-2">Recebido</td>{totais.map((t, i) => <td key={i} className="p-1 text-center text-xs">{reais(t.recebido)}</td>)}</tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

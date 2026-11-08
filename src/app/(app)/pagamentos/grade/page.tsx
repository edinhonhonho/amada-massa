import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { hojeISO, reais } from "@/lib/format";
import { ROTULO_SITUACAO, pior, situacaoCobranca, type Situacao } from "@/lib/pagamentos";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COR: Record<Situacao, string> = {
  em_dia: "bg-emerald-500", a_vencer: "bg-sky-400", vence_hoje: "bg-amber-400",
  atrasado: "bg-orange-500", atraso_critico: "bg-red-600", sem_cobranca: "bg-stone-300",
};

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
    <>
      <PageHeader
        voltar={{ href: "/pagamentos", rotulo: "Pagamentos" }}
        titulo={`Grade de ${ano}`}
        subtitulo="O ano inteiro de relance: uma bolinha por cliente e mês. Clique para abrir o mês."
        acoes={
          <div className="flex items-center rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
            <Link className="btn-ghost !p-2" href={`/pagamentos/grade?ano=${ano - 1}`} aria-label="Ano anterior"><ChevronLeft size={17} /></Link>
            <span className="px-2 text-sm font-medium">{ano}</span>
            <Link className="btn-ghost !p-2" href={`/pagamentos/grade?ano=${ano + 1}`} aria-label="Próximo ano"><ChevronRight size={17} /></Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-stone-600">
        {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${COR[s]}`} />{ROTULO_SITUACAO[s]}</span>)}
      </div>
      <div className="cartao overflow-x-auto !p-0">
        <table className="tabela min-w-[860px]">
          <thead><tr><th>Cliente</th>{MESES.map((m) => <th key={m} className="text-center">{m}</th>)}</tr></thead>
          <tbody>
            {lista.map(([id, r]) => (
              <tr key={id}>
                <td className="font-medium"><Link href={`/clientes/${id}`} className="hover:underline">{r.nome}</Link></td>
                {r.meses.map((s, i) => (
                  <td key={i} className="text-center">
                    {s.length ? (
                      <Link href={`/pagamentos?mes=${ano}-${String(i + 1).padStart(2, "0")}`} title={ROTULO_SITUACAO[pior(s)]} className="inline-flex p-1.5">
                        <span className={`size-3.5 rounded-full ${COR[pior(s)]}`} />
                      </Link>
                    ) : <span className="text-stone-200">·</span>}
                  </td>
                ))}
              </tr>
            ))}
            {!lista.length && <tr><td className="p-8 text-center text-stone-500" colSpan={13}>Sem cobranças neste ano. Abra um mês em Pagamentos para gerá-las.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 bg-stone-50/60 text-xs"><td className="px-4 py-2 font-semibold">Esperado</td>{totais.map((t, i) => <td key={i} className="px-1 py-2 text-center">{t.esperado ? reais(t.esperado) : "—"}</td>)}</tr>
            <tr className="bg-stone-50/60 text-xs text-emerald-700"><td className="px-4 py-2 font-semibold">Recebido</td>{totais.map((t, i) => <td key={i} className="px-1 py-2 text-center">{t.recebido ? reais(t.recebido) : "—"}</td>)}</tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

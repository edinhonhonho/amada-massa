import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { RELATORIOS, gerarRelatorio } from "@/lib/relatorios";

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ r?: string; de?: string; ate?: string }> }) {
  const { supabase } = await exigirAdmin();
  const b = await searchParams;
  const hoje = hojeISO();
  const chave = b.r && RELATORIOS[b.r] ? b.r : "receita";
  const de = b.de || adicionarDias(hoje, -180);
  const ate = b.ate || hoje;
  const rel = await gerarRelatorio(supabase, chave, { de, ate, hoje });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>
      <div className="flex flex-wrap gap-2">
        {Object.entries(RELATORIOS).map(([k, v]) => (
          <Link key={k} href={`/relatorios?r=${k}&de=${de}&ate=${ate}`} className={k === chave ? "btn" : "btn-sec"}>{v}</Link>
        ))}
      </div>
      <form className="cartao grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="r" value={chave} />
        <div><label className="rotulo">De</label><input className="campo" type="date" name="de" defaultValue={de} /></div>
        <div><label className="rotulo">Até</label><input className="campo" type="date" name="ate" defaultValue={ate} /></div>
        <button className="btn self-end">Aplicar</button>
        <a className="btn-sec self-end" href={`/relatorios/csv?r=${chave}&de=${de}&ate=${ate}`}>Exportar CSV</a>
      </form>
      {rel && (
        <div className="cartao overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="border-b border-stone-200 text-left">{rel.colunas.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
            <tbody>
              {rel.linhas.map((l, i) => <tr key={i} className="border-b border-stone-100">{l.map((v, j) => <td key={j} className="p-2">{v}</td>)}</tr>)}
              {!rel.linhas.length && <tr><td className="p-4 text-stone-500" colSpan={rel.colunas.length}>Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

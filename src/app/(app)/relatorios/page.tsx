import { Download } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
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
    <>
      <PageHeader titulo="Relatórios" subtitulo="Receita, inadimplência, evolução da base, cancelamentos, entregas e produção. Tudo exportável em CSV." />
      <div className="grid grid-cols-[220px_1fr] items-start gap-5">
        <nav className="cartao flex flex-col gap-0.5 !p-2">
          {Object.entries(RELATORIOS).map(([k, v]) => (
            <Link key={k} href={`/relatorios?r=${k}&de=${de}&ate=${ate}`} className={`rounded-lg px-3 py-2 text-sm transition ${k === chave ? "bg-amber-50 font-medium text-amber-900" : "text-stone-600 hover:bg-stone-100"}`}>{v}</Link>
          ))}
        </nav>
        <div className="flex flex-col gap-4">
          <form className="cartao flex flex-wrap items-end gap-3 !p-4">
            <input type="hidden" name="r" value={chave} />
            <div><label className="rotulo">De</label><input className="campo" type="date" name="de" defaultValue={de} /></div>
            <div><label className="rotulo">Até</label><input className="campo" type="date" name="ate" defaultValue={ate} /></div>
            <button className="btn">Aplicar</button>
            <a className="btn-sec ml-auto" href={`/relatorios/csv?r=${chave}&de=${de}&ate=${ate}`}><Download size={16} />Exportar CSV</a>
          </form>
          {rel && (
            <div className="cartao overflow-hidden !p-0">
              <h2 className="border-b border-stone-100 px-5 py-3 font-semibold">{rel.titulo}</h2>
              {rel.linhas.length ? (
                <table className="tabela">
                  <thead><tr>{rel.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{rel.linhas.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                </table>
              ) : <Vazio titulo="Sem dados no período" texto="Ajuste as datas para ver resultados." />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

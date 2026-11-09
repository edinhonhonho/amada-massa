import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { segundaDe } from "@/lib/semana";
import { criarSemanasDoAno, planejarSemana } from "./actions";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Semana = { id: string; inicio: string; fim: string; status: string; sem_producao: boolean; paes_semana: { id: string; nome: string; ordem: number }[] };

export default async function Semanas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { supabase } = await exigirEquipe();
  const hoje = hojeISO();
  const ano = Number((await searchParams).ano) || Number(hoje.slice(0, 4));

  // todas as segundas-feiras cujas semanas começam neste ano (a 1ª pode cair em dezembro anterior)
  const primeira = segundaDe(`${ano}-01-01`);
  const segundas: string[] = [];
  for (let d = primeira; d <= `${ano}-12-31`; d = adicionarDias(d, 7)) segundas.push(d);

  const { data } = await supabase
    .from("semanas")
    .select("id, inicio, fim, status, sem_producao, paes_semana(id, nome, ordem)")
    .gte("inicio", primeira).lte("inicio", `${ano}-12-31`);
  const existentes = new Map(((data ?? []) as unknown as Semana[]).map((s) => [s.inicio, s]));
  const comPaes = [...existentes.values()].filter((s) => s.paes_semana.length > 0 || s.sem_producao).length;
  const faltam = segundas.filter((d) => !existentes.has(d)).length;
  const atual = segundaDe(hoje);

  // agrupa por mês da segunda-feira
  const meses: string[][] = Array.from({ length: 12 }, () => []);
  for (const d of segundas) meses[d < `${ano}-01-01` ? 0 : Number(d.slice(5, 7)) - 1].push(d);

  return (
    <>
      <PageHeader
        titulo={`Calendário ${ano}`}
        etiqueta={<Badge tom="cinza">Passo 1 · Planejar</Badge>}
        subtitulo={`${comPaes} de ${segundas.length} semanas com os pães definidos. Clique numa semana para cadastrar os pães e ingredientes.`}
        acoes={<>
          <div className="flex items-center rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
            <Link className="btn-ghost !p-2" href={`/semanas?ano=${ano - 1}`} aria-label="Ano anterior"><ChevronLeft size={17} /></Link>
            <Link className="btn-ghost !px-3" href="/semanas">Hoje</Link>
            <Link className="btn-ghost !p-2" href={`/semanas?ano=${ano + 1}`} aria-label="Próximo ano"><ChevronRight size={17} /></Link>
          </div>
          {faltam > 0 && (
            <form action={criarSemanasDoAno}><input type="hidden" name="ano" value={ano} />
              <SubmitButton className="btn-sec"><CalendarPlus size={16} />Criar as {faltam} semanas que faltam</SubmitButton></form>
          )}
        </>}
      />

      <div className="grid grid-cols-3 items-start gap-4">
        {meses.map((lista, m) => (
          <section key={m} className="cartao overflow-hidden !p-0">
            <h2 className="border-b border-stone-100 bg-stone-50/60 px-4 py-2.5 text-sm font-semibold">{MESES[m]}</h2>
            <ul className="divide-y divide-stone-100">
              {lista.map((d) => {
                const s = existentes.get(d);
                const fim = adicionarDias(d, 6);
                const eAtual = d === atual;
                const paes = s ? [...s.paes_semana].sort((a, b) => a.ordem - b.ordem) : [];
                const conteudo = (
                  <div className={`flex items-center gap-2 px-4 py-2.5 text-sm transition hover:bg-amber-50/50 ${eAtual ? "bg-amber-50/60" : ""}`}>
                    <span className={`w-[118px] shrink-0 whitespace-nowrap tabular-nums ${eAtual ? "font-semibold text-amber-900" : "text-stone-500"}`}>{dm(d)} – {dm(fim)}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {s?.sem_producao ? <span className="selo selo-cinza">Sem produção</span>
                        : paes.length ? paes.map((p) => <span key={p.id} className="selo selo-ambar">{p.nome}</span>)
                        : s ? <span className="text-stone-400">sem pães</span>
                        : <span className="flex items-center gap-1 text-stone-400"><Plus size={13} />planejar</span>}
                    </span>
                    {eAtual && <span className="size-2 shrink-0 rounded-full bg-amber-600" title="Esta semana" />}
                  </div>
                );
                return (
                  <li key={d}>
                    {s ? <Link href={`/semanas/${s.id}`} className="block">{conteudo}</Link> : (
                      <form action={planejarSemana}><input type="hidden" name="inicio" value={d} /><button className="block w-full text-left">{conteudo}</button></form>
                    )}
                  </li>
                );
              })}
              {!lista.length && <li className="px-4 py-3 text-sm text-stone-400">—</li>}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

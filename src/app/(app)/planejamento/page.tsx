import { BookOpen, CalendarPlus, Plus, Users, Wheat } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import SeletorAno from "@/components/SeletorAno";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { um } from "@/lib/dados";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { numeroSemanaISO, segundaDe } from "@/lib/semana";
import { criarSemanasDoAno, planejarSemana } from "./actions";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Semana = { id: string; inicio: string; fim: string; status: string; sem_producao: boolean; paes_semana: { ordem: number; paes: { nome: string } | { nome: string }[] | null }[]; entregas: { count: number }[] };

export default async function Planejamento({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { supabase } = await exigirEquipe();
  const hoje = hojeISO();
  const ano = Number((await searchParams).ano) || Number(hoje.slice(0, 4));

  // todas as segundas-feiras cujas semanas começam neste ano (a 1ª pode cair em dezembro anterior)
  const primeira = segundaDe(`${ano}-01-01`);
  const segundas: string[] = [];
  for (let d = primeira; d <= `${ano}-12-31`; d = adicionarDias(d, 7)) segundas.push(d);

  const { data } = await supabase
    .from("semanas")
    .select("id, inicio, fim, status, sem_producao, paes_semana(ordem, paes(nome)), entregas(count)")
    .gte("inicio", primeira).lte("inicio", `${ano}-12-31`);
  const existentes = new Map(((data ?? []) as unknown as Semana[]).map((s) => [s.inicio, s]));
  const nomesPaes = (s: Semana) => [...s.paes_semana].sort((a, b) => a.ordem - b.ordem).map((p) => (um(p.paes as never) as { nome: string } | null)?.nome).filter((x): x is string => !!x);
  const planejadas = [...existentes.values()].filter((s) => s.sem_producao || s.paes_semana.length > 0).length;
  const faltam = segundas.filter((d) => !existentes.has(d)).length;
  const atual = segundaDe(hoje);
  const semanaAtual = existentes.get(atual);

  const meses: string[][] = Array.from({ length: 12 }, () => []);
  for (const d of segundas) meses[d < `${ano}-01-01` ? 0 : Number(d.slice(5, 7)) - 1].push(d);

  return (
    <>
      <PageHeader
        titulo={`Calendário ${ano}`}
        subtitulo="Todas as semanas do ano. Abra uma para definir pães, produção, distribuição e acompanhar as entregas."
        acoes={<>
          <Link className="btn-sec" href="/planejamento/paes"><BookOpen size={16} />Catálogo de pães</Link>
          <SeletorAno ano={ano} base="/planejamento" />
          {ano !== Number(hoje.slice(0, 4)) && <Link className="btn-sec" href="/planejamento">Ano atual</Link>}
          {faltam > 0 && (
            <form action={criarSemanasDoAno}><input type="hidden" name="ano" value={ano} />
              <SubmitButton className="btn-sec"><CalendarPlus size={16} />Criar as {faltam} semanas que faltam</SubmitButton></form>
          )}
        </>}
      />

      {ano === Number(hoje.slice(0, 4)) && (
        <section className="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-amber-100/80">Esta semana · semana {numeroSemanaISO(atual)}</div>
              <div className="mb-3 text-2xl font-semibold tracking-tight">{dm(atual)} a {dm(adicionarDias(atual, 6))}</div>
              {semanaAtual && nomesPaes(semanaAtual).length ? (
                <div className="flex flex-wrap gap-2">{nomesPaes(semanaAtual).map((n) => <span key={n} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur"><Wheat size={13} />{n}</span>)}</div>
              ) : <p className="text-sm text-amber-100/80">{semanaAtual?.sem_producao ? "Semana sem produção." : "Nenhum pão definido ainda."}</p>}
            </div>
            {semanaAtual ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur"><Users size={16} /><b>{semanaAtual.entregas?.[0]?.count ?? 0}</b> clientes</div>
                <Link href={`/planejamento/${semanaAtual.id}`} className="btn !bg-white !text-stone-900 hover:!bg-amber-50">Abrir a semana</Link>
              </>
            ) : (
              <form action={planejarSemana}><input type="hidden" name="inicio" value={atual} /><SubmitButton className="btn !bg-white !text-stone-900 hover:!bg-amber-50"><Plus size={16} />Planejar esta semana</SubmitButton></form>
            )}
          </div>
        </section>
      )}

      <p className="mb-5 text-sm text-stone-500">{planejadas} de {segundas.length} semanas com os pães definidos em {ano}.</p>

      <div className="flex flex-col gap-8">
        {meses.map((lista, m) => lista.length > 0 && (
          <section key={m}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{MESES[m]}</h2>
            <div className="grid grid-cols-5 gap-3">
              {lista.map((d) => {
                const s = existentes.get(d);
                const paes = s ? nomesPaes(s) : [];
                const eAtual = d === atual;
                const passada = adicionarDias(d, 6) < hoje;
                const corpo = (
                  <div className={`flex h-full min-h-[132px] flex-col gap-2 rounded-2xl p-4 text-left transition ${s ? "bg-white shadow-md hover:-translate-y-0.5 hover:shadow-xl" : "bg-white/50 shadow-sm hover:bg-white hover:shadow-md"} ${eAtual ? "ring-2 ring-stone-900/80" : ""} ${passada ? "opacity-70" : ""}`}>
                    <div className="flex items-center justify-between text-xs text-stone-500"><span>Semana {numeroSemanaISO(d)}</span>{eAtual && <span className="size-2 rounded-full bg-amber-600" />}</div>
                    <div className="text-[15px] font-semibold tabular-nums tracking-tight">{dm(d)} – {dm(adicionarDias(d, 6))}</div>
                    <div className="flex flex-1 flex-wrap content-start gap-1">
                      {s?.sem_producao ? <span className="selo selo-cinza">Sem produção</span>
                        : paes.length ? <>{paes.slice(0, 2).map((p) => <span key={p} className="selo selo-ambar max-w-full truncate">{p}</span>)}{paes.length > 2 && <span className="selo selo-cinza">+{paes.length - 2}</span>}</>
                        : s ? <span className="text-xs text-stone-400">Sem pães</span>
                        : <span className="flex items-center gap-1 text-xs text-stone-400"><Plus size={12} />Planejar</span>}
                    </div>
                    {s && (s.entregas?.[0]?.count ?? 0) > 0 && <div className="flex items-center gap-1 text-xs text-stone-500"><Users size={12} />{s.entregas[0].count} clientes</div>}
                  </div>
                );
                return s ? <Link key={d} href={`/planejamento/${s.id}`} className="block">{corpo}</Link> : (
                  <form key={d} action={planejarSemana}><input type="hidden" name="inicio" value={d} /><button className="block h-full w-full">{corpo}</button></form>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

import { CalendarPlus, LayoutGrid, List, Plus, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import Badge from "@/components/ui/Badge";
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

type Semana = { id: string; inicio: string; fim: string; status: string; sem_producao: boolean; lista_fechada: boolean; paes_semana: { ordem: number; paes: { nome: string } | { nome: string }[] | null }[]; entregas: { count: number }[] };

export default async function Planejamento({ searchParams }: { searchParams: Promise<{ ano?: string; vista?: string }> }) {
  const { supabase } = await exigirEquipe();
  const hoje = hojeISO();
  const b = await searchParams;
  const ano = Number(b.ano) || Number(hoje.slice(0, 4));
  const vista = b.vista === "lista" ? "lista" : "matriz";

  // todas as segundas-feiras cujas semanas começam neste ano (a 1ª pode cair em dezembro anterior)
  const primeira = segundaDe(`${ano}-01-01`);
  const segundas: string[] = [];
  for (let d = primeira; d <= `${ano}-12-31`; d = adicionarDias(d, 7)) segundas.push(d);

  const { data } = await supabase
    .from("semanas")
    .select("id, inicio, fim, status, sem_producao, lista_fechada, paes_semana(ordem, paes(nome)), entregas(count)")
    .gte("inicio", primeira).lte("inicio", `${ano}-12-31`);
  const existentes = new Map(((data ?? []) as unknown as Semana[]).map((s) => [s.inicio, s]));
  const nomesPaes = (s?: Semana) => s ? [...s.paes_semana].sort((a, b) => a.ordem - b.ordem).map((p) => (um(p.paes as never) as { nome: string } | null)?.nome).filter((x): x is string => !!x) : [];
  const planejadas = [...existentes.values()].filter((s) => s.sem_producao || s.paes_semana.length > 0).length;
  const faltam = segundas.filter((d) => !existentes.has(d)).length;
  const atual = segundaDe(hoje);
  const semanaAtual = existentes.get(atual);

  const meses: string[][] = Array.from({ length: 12 }, () => []);
  for (const d of segundas) meses[d < `${ano}-01-01` ? 0 : Number(d.slice(5, 7)) - 1].push(d);
  const maxCols = Math.max(...meses.map((m) => m.length));
  const href = (v: string) => `/planejamento?ano=${ano}&vista=${v}`;

  const situacao = (s?: Semana) => !s ? { rotulo: "Não planejada", tom: "cinza" as const }
    : s.sem_producao ? { rotulo: "Sem produção", tom: "cinza" as const }
    : s.lista_fechada ? { rotulo: "Lista fechada", tom: "verde" as const }
    : s.paes_semana.length ? { rotulo: "Planejada", tom: "azul" as const }
    : { rotulo: "Sem pães", tom: "ambar" as const };

  /** Cada semana é um link (se já existe) ou um botão que cria a semana. */
  const alvo = (d: string, s: Semana | undefined, filhos: React.ReactNode, classe: string) => s
    ? <Link href={`/semana/${s.id}`} className={classe}>{filhos}</Link>
    : <form action={planejarSemana} className="contents"><input type="hidden" name="inicio" value={d} /><button className={`${classe} w-full text-left`}>{filhos}</button></form>;

  return (
    <>
      <PageHeader
        titulo={`Calendário ${ano}`}
        subtitulo={`${planejadas} de ${segundas.length} semanas com pães definidos. Abra uma semana para planejar, alocar e acompanhar.`}
        acoes={<>
          <div role="tablist" aria-label="Forma de exibir" className="flex rounded-xl bg-stone-100 p-0.5 text-sm font-medium">
            {([["matriz", "Matriz", LayoutGrid], ["lista", "Lista", List]] as const).map(([k, r, Icone]) => (
              <Link key={k} role="tab" aria-selected={vista === k} href={href(k)} className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 transition ${vista === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}><Icone size={15} />{r}</Link>
            ))}
          </div>
          <SeletorAno ano={ano} base="/planejamento" extra={`&vista=${vista}`} />
          {ano !== Number(hoje.slice(0, 4)) && <Link className="btn-sec" href={`/planejamento?vista=${vista}`}>Ano atual</Link>}
          {faltam > 0 && (
            <form action={criarSemanasDoAno}><input type="hidden" name="ano" value={ano} />
              <SubmitButton className="btn-sec"><CalendarPlus size={16} />Criar as {faltam} semanas que faltam</SubmitButton></form>
          )}
        </>}
      />

      {ano === Number(hoje.slice(0, 4)) && (
        <section className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[24px] bg-painel p-5 ring-1 ring-stone-900/[0.04]">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-stone-500">Esta semana · semana {numeroSemanaISO(atual)} · {dm(atual)} a {dm(adicionarDias(atual, 6))}</div>
            {semanaAtual && nomesPaes(semanaAtual).length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">{nomesPaes(semanaAtual).map((n) => <span key={n} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm shadow-[0_0_0_1px_rgba(28,25,23,.07)]"><Wheat size={13} className="text-amber-700" />{n}</span>)}</div>
            ) : <p className="mt-1 text-sm text-stone-500">{semanaAtual?.sem_producao ? "Semana sem produção." : "Nenhum pão definido ainda."}</p>}
          </div>
          {semanaAtual ? (
            <>
              <span className="flex items-center gap-2 text-sm text-stone-600"><Users size={16} className="text-stone-400" /><b>{semanaAtual.entregas?.[0]?.count ?? 0}</b> clientes</span>
              <Link href={`/semana/${semanaAtual.id}`} className="btn">Abrir a semana</Link>
            </>
          ) : (
            <form action={planejarSemana}><input type="hidden" name="inicio" value={atual} /><SubmitButton className="btn"><Plus size={16} />Planejar esta semana</SubmitButton></form>
          )}
        </section>
      )}

      {vista === "matriz" ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-2 text-sm" style={{ minWidth: 700 }}>
            <colgroup><col style={{ width: 104 }} />{Array.from({ length: maxCols }, (_, i) => <col key={i} />)}</colgroup>
            <thead>
              <tr><th className="text-left text-xs font-medium text-stone-400" />{Array.from({ length: maxCols }, (_, i) => <th key={i} className="text-left text-xs font-medium text-stone-400">{i + 1}ª semana</th>)}</tr>
            </thead>
            <tbody>
              {meses.map((lista, m) => lista.length > 0 && (
                <tr key={m}>
                  <th scope="row" className="align-top pt-3 text-left text-[15px] font-semibold">{MESES[m]}</th>
                  {Array.from({ length: maxCols }, (_, i) => {
                    const d = lista[i];
                    if (!d) return <td key={i} />;
                    const s = existentes.get(d);
                    const paes = nomesPaes(s);
                    const sit = situacao(s);
                    const eAtual = d === atual;
                    const passada = adicionarDias(d, 6) < hoje;
                    return (
                      <td key={i} className="align-top">
                        {alvo(d, s, (
                          <>
                            <span className="flex items-center justify-between text-[11px] text-stone-400"><span>Sem. {numeroSemanaISO(d)}</span>{eAtual && <span className="rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold text-white">hoje</span>}</span>
                            <span className="mt-0.5 block text-[13px] font-semibold tabular-nums">{d.slice(8, 10)}–{adicionarDias(d, 6).slice(8, 10)}{d.slice(5, 7) !== adicionarDias(d, 6).slice(5, 7) ? `/${adicionarDias(d, 6).slice(5, 7)}` : ""}</span>
                            <span className="mt-1.5 line-clamp-2 block min-h-[2.1rem] text-[11.5px] leading-snug">
                              {s?.sem_producao ? <span className="text-stone-400">Sem produção</span>
                                : paes.length ? <span className="text-stone-700">{paes.slice(0, 2).join(" · ")}{paes.length > 2 ? ` +${paes.length - 2}` : ""}</span>
                                : <span className="text-stone-400">{s ? "Sem pães" : "+ Planejar"}</span>}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-[10.5px] text-stone-400">{s && (s.entregas?.[0]?.count ?? 0) > 0 ? <><Users size={10} />{s.entregas[0].count}</> : <span aria-hidden>&nbsp;</span>}<span className={`ml-auto size-1.5 rounded-full ${sit.tom === "verde" ? "bg-emerald-500" : sit.tom === "azul" ? "bg-sky-500" : sit.tom === "ambar" ? "bg-amber-500" : "bg-stone-300"}`} title={sit.rotulo} /></span>
                          </>
                        ), `block rounded-xl p-2.5 transition ${s ? "bg-painel ring-1 ring-stone-900/[0.05] hover:bg-white hover:shadow-md" : "bg-white ring-1 ring-stone-900/[0.06] hover:bg-painel"} ${eAtual ? "!ring-2 !ring-amber-500/70" : ""} ${passada ? "opacity-70" : ""}`)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 flex items-center gap-4 text-xs text-stone-400"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-stone-300" />não planejada ou sem produção</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-amber-500" />sem pães</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-sky-500" />planejada</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-emerald-500" />lista fechada</span></p>
        </div>
      ) : (
        <div className="cartao overflow-hidden !p-0">
          <table className="tabela">
            <thead><tr><th className="w-24">Semana</th><th className="w-44">Período</th><th>Pães</th><th className="w-24">Clientes</th><th className="w-36">Situação</th><th className="w-28" /></tr></thead>
            <tbody>
              {meses.map((lista, m) => lista.length > 0 && (
                <Fragment key={m}>
                  <tr className="bg-painel"><td colSpan={6} className="!border-b-0 !py-2 text-[13px] font-semibold text-stone-600">{MESES[m]}</td></tr>
                  {lista.map((d) => {
                    const s = existentes.get(d);
                    const paes = nomesPaes(s);
                    const sit = situacao(s);
                    const eAtual = d === atual;
                    const passada = adicionarDias(d, 6) < hoje;
                    return (
                      <tr key={d} className={`${eAtual ? "bg-amber-50/60" : ""} ${passada ? "text-stone-500" : ""}`}>
                        <td className="tabular-nums"><span className="font-medium">{numeroSemanaISO(d)}</span>{eAtual && <span className="ml-2 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">hoje</span>}</td>
                        <td className="tabular-nums">{dm(d)} a {dm(adicionarDias(d, 6))}</td>
                        <td>{s?.sem_producao ? <span className="text-stone-400">Sem produção</span> : paes.length ? <span className="flex flex-wrap gap-1">{paes.map((n) => <span key={n} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{n}</span>)}</span> : <span className="text-stone-300">—</span>}</td>
                        <td className="tabular-nums">{s && (s.entregas?.[0]?.count ?? 0) > 0 ? s.entregas[0].count : <span className="text-stone-300">—</span>}</td>
                        <td><Badge tom={sit.tom} ponto>{sit.rotulo}</Badge></td>
                        <td className="text-right">{s ? <Link href={`/semana/${s.id}`} className="btn-sec btn-pequeno">Abrir</Link> : <form action={planejarSemana}><input type="hidden" name="inicio" value={d} /><SubmitButton className="btn-sec btn-pequeno"><Plus size={13} />Planejar</SubmitButton></form>}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

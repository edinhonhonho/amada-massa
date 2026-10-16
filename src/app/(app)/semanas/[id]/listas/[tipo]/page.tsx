import Link from "next/link";
import { notFound } from "next/navigation";
import ImprimirBotao from "@/components/ImprimirBotao";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_ENTREGA } from "@/lib/semana";
import { marcarPelaEquipe } from "../actions";

type Cli = { nome: string; sobrenome: string; whatsapp: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; referencia_portaria: string | null; instrucoes_entrega: string | null };
type Ent = { id: string; ordem: number; rota_nome: string | null; ponto_nome: string | null; qtd_prevista: number; status: string; clientes: Cli };

const ATIVAS = ["programada", "reagendada", "entregue", "retirada", "nao_entregue"];

export default async function Lista({
  params, searchParams,
}: { params: Promise<{ id: string; tipo: string }>; searchParams: Promise<{ margem?: string }> }) {
  const { id, tipo } = await params;
  if (!["producao", "entrega", "coleta"].includes(tipo)) notFound();
  const margem = Math.max(0, Number((await searchParams).margem) || 0);
  const { supabase } = await exigirEquipe();
  const { data: s } = await supabase.from("semanas").select("*").eq("id", id).single();
  if (!s) notFound();
  const { data } = await supabase
    .from("entregas")
    .select("id, ordem, rota_nome, ponto_nome, qtd_prevista, status, clientes(nome, sobrenome, whatsapp, logradouro, numero, complemento, bairro, referencia_portaria, instrucoes_entrega)")
    .eq("semana_id", id)
    .order("ordem");
  const todas = ((data ?? []) as unknown as (Omit<Ent, "clientes"> & { clientes: Cli | Cli[] })[]).map((e) => ({ ...e, clientes: um(e.clientes) as Cli }));
  const ativas = todas.filter((e) => ATIVAS.includes(e.status));
  const suspensas = todas.filter((e) => e.status === "suspensa_atraso");
  const destino = (e: Ent) => e.rota_nome ?? e.ponto_nome ?? "Sem rota definida";

  const grupos = new Map<string, Ent[]>();
  const base = tipo === "coleta" ? ativas.filter((e) => e.ponto_nome) : tipo === "entrega" ? ativas.filter((e) => !e.ponto_nome) : ativas;
  for (const e of base) grupos.set(destino(e), [...(grupos.get(destino(e)) ?? []), e]);
  const ordenados = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const titulo = { producao: "Lista de produção", entrega: "Lista de entrega", coleta: "Lista de coleta" }[tipo];
  const end = (c: Cli) => [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}`, c.complemento, c.bairro].filter(Boolean).join(" · ");
  const total = ativas.reduce((n, e) => n + e.qtd_prevista, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="nao-imprimir flex items-center gap-3">
        <Link href={`/semanas/${id}`} className="text-sm text-amber-800 underline">← Semana</Link>
        <span className="ml-auto" /><ImprimirBotao />
      </div>
      <header>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p>Semana {dataBR(s.inicio)} a {dataBR(s.fim)} · <b>{s.sabor ?? "sabor a definir"}</b></p>
        {s.alergenos && <p className="text-sm">Alérgenos: {s.alergenos}</p>}
        {s.sem_producao && <p className="font-semibold text-red-700">Semana sem produção.</p>}
      </header>

      {tipo === "producao" && (
        <>
          <form className="nao-imprimir flex items-center gap-2">
            <label className="rotulo mb-0">Margem para extras (pães)</label>
            <input className="campo w-24" type="number" min={0} name="margem" defaultValue={margem} />
            <button className="btn-sec">Aplicar</button>
          </form>
          <table className="w-full text-left">
            <thead><tr className="border-b border-stone-300"><th className="py-2">Destino</th><th>Embalagens</th><th>Pães</th></tr></thead>
            <tbody>
              {ordenados.map(([nome, es]) => (
                <tr key={nome} className="border-b border-stone-100"><td className="py-2">{nome}</td><td>{es.length}</td><td>{es.reduce((n, e) => n + e.qtd_prevista, 0)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold"><td className="py-2">Total</td><td>{ativas.length}</td><td>{total}</td></tr>
              {margem > 0 && <tr className="font-bold"><td className="py-2">Total com margem (+{margem})</td><td /><td>{total + margem}</td></tr>}
            </tfoot>
          </table>
        </>
      )}

      {tipo !== "producao" && ordenados.map(([nome, es]) => (
        <section key={nome} className="break-inside-avoid">
          <h2 className="border-b-2 border-stone-800 pb-1 text-lg font-bold">{nome} <span className="text-sm font-normal">({es.length} · {es.reduce((n, e) => n + e.qtd_prevista, 0)} pães)</span></h2>
          <ul className="divide-y divide-stone-200">
            {es.map((e, i) => (
              <li key={e.id} className="flex items-start gap-3 py-2">
                <span className="w-6 text-right">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{nomeCompleto(e.clientes)} — {e.qtd_prevista} pão(ães)</div>
                  {tipo === "entrega" && <div className="text-sm">{end(e.clientes)}{e.clientes.whatsapp && ` · ${e.clientes.whatsapp}`}</div>}
                  {tipo === "entrega" && (e.clientes.referencia_portaria || e.clientes.instrucoes_entrega) && (
                    <div className="text-sm italic">{[e.clientes.referencia_portaria, e.clientes.instrucoes_entrega].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                <span className="text-sm">{STATUS_ENTREGA[e.status]}</span>
                {tipo === "coleta" && e.status === "programada" && (
                  <form action={marcarPelaEquipe} className="nao-imprimir">
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="semana_id" value={id} /><input type="hidden" name="status" value="retirada" />
                    <button className="btn px-3 py-1.5 text-sm">Retirou</button>
                  </form>
                )}
                <span className="hidden border border-stone-500 px-3 print:inline-block">&nbsp;&nbsp;</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tipo !== "producao" && !ordenados.length && <p className="text-stone-500">Nada nesta lista.</p>}

      {suspensas.length > 0 && tipo !== "producao" && (
        <section className="break-inside-avoid">
          <h2 className="border-b-2 border-orange-600 pb-1 text-lg font-bold text-orange-800">Suspensas por atraso (não entregar)</h2>
          <p>{suspensas.map((e) => nomeCompleto(e.clientes)).join(", ")}</p>
        </section>
      )}
    </div>
  );
}

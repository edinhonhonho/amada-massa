"use client";

import { AlertTriangle, Check, MapPin, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { reais } from "@/lib/format";

export type PlanoOpcao = { id: string; nome: string; modalidade: "entrega" | "coleta_ponto" | "coleta_padaria"; paes_por_semana: number; valor_centavos: number };
export type PontoOpcao = { id: string; nome: string; tipo: "padaria" | "ponto"; endereco: string; horario_texto: string | null };

const MOD = {
  entrega: { icone: Truck, titulo: "Entrega em casa", desc: "Uma rota leva até a porta" },
  coleta_ponto: { icone: MapPin, titulo: "Ponto de coleta", desc: "Retira num ponto parceiro" },
  coleta_padaria: { icone: Store, titulo: "Na padaria", desc: "Retira na própria padaria" },
} as const;
const ORDEM: (keyof typeof MOD)[] = ["entrega", "coleta_ponto", "coleta_padaria"];
const pluralPaes = (n: number) => `${n} pão${n > 1 ? "es" : ""}`;

/**
 * Escolha em 3 passos que impede combinações inválidas:
 * modalidade → plano → onde retira (Padaria fixa na coleta na padaria; só pontos de retirada na coleta em ponto).
 */
export default function SeletorPlano({
  planos, pontos, inicial, onSelecao,
}: {
  planos: PlanoOpcao[]; pontos: PontoOpcao[];
  inicial?: { planoId?: string; pontoId?: string | null };
  onSelecao?: (s: { plano: PlanoOpcao | null; ponto: PontoOpcao | null }) => void;
}) {
  const modalidades = ORDEM.filter((m) => planos.some((p) => p.modalidade === m));
  const planoInicial = planos.find((p) => p.id === inicial?.planoId) ?? planos[0];
  const [mod, setMod] = useState<keyof typeof MOD>(planoInicial?.modalidade ?? modalidades[0] ?? "entrega");
  const [planoId, setPlanoId] = useState(planoInicial?.id ?? "");
  const [pontoId, setPontoId] = useState<string>(inicial?.pontoId ?? "");

  const doGrupo = useMemo(() => planos.filter((p) => p.modalidade === mod), [planos, mod]);
  const padarias = pontos.filter((p) => p.tipo === "padaria");
  const retiradas = pontos.filter((p) => p.tipo === "ponto");
  const plano = planos.find((p) => p.id === planoId) ?? null;

  // O ponto efetivo depende da modalidade: Padaria é automático; entrega não tem ponto.
  const ponto = mod === "entrega" ? null
    : mod === "coleta_padaria" ? (padarias.find((p) => p.id === pontoId) ?? padarias[0] ?? null)
    : (retiradas.find((p) => p.id === pontoId) ?? null);

  useEffect(() => { onSelecao?.({ plano, ponto }); }, [plano?.id, ponto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolherModalidade(m: keyof typeof MOD) {
    setMod(m);
    const primeiro = planos.find((p) => p.modalidade === m);
    setPlanoId(primeiro?.id ?? "");
    setPontoId("");
  }

  if (!planos.length) return null;
  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="plano_id" value={planoId} />
      <input type="hidden" name="ponto_coleta_id" value={ponto?.id ?? ""} />

      <fieldset>
        <legend className="rotulo">1. Como o cliente recebe o pão?</legend>
        <div className="grid grid-cols-3 gap-3">
          {modalidades.map((m) => {
            const I = MOD[m].icone;
            const menor = Math.min(...planos.filter((p) => p.modalidade === m).map((p) => p.valor_centavos));
            return (
              <label key={m} className="group relative flex cursor-pointer flex-col gap-1 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(28,25,23,.12)] transition hover:shadow-md has-[:checked]:bg-amber-50 has-[:checked]:shadow-lg has-[:checked]:ring-2 has-[:checked]:ring-amber-500/40">
                <input type="radio" name="modalidade_ui" className="sr-only" checked={mod === m} onChange={() => escolherModalidade(m)} />
                <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600 group-has-[:checked]:bg-amber-600 group-has-[:checked]:text-white"><I size={18} /></span>
                <span className="font-semibold leading-tight">{MOD[m].titulo}</span>
                <span className="text-xs text-stone-500">{MOD[m].desc}</span>
                <span className="mt-1 text-xs text-stone-500">a partir de <b className="text-stone-800">{reais(menor)}</b></span>
                {mod === m && <Check size={16} className="absolute right-3 top-3 text-amber-700" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="rotulo">2. Qual plano?</legend>
        <div className="grid grid-cols-2 gap-3">
          {doGrupo.map((p) => (
            <label key={p.id} className="relative flex cursor-pointer items-center gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(28,25,23,.12)] transition hover:shadow-md has-[:checked]:bg-amber-50 has-[:checked]:shadow-lg has-[:checked]:ring-2 has-[:checked]:ring-amber-500/40">
              <input type="radio" name="plano_ui" className="sr-only" checked={planoId === p.id} onChange={() => setPlanoId(p.id)} />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg font-semibold text-stone-700">{p.paes_por_semana}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">{pluralPaes(p.paes_por_semana)} por semana</span>
                <span className="block truncate text-xs text-stone-500">{p.nome}</span>
              </span>
              <span className="text-right"><b className="block text-lg leading-tight">{reais(p.valor_centavos)}</b><span className="text-xs text-stone-500">por mês</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {mod === "coleta_padaria" && (
        <div>
          <div className="rotulo">3. Onde retira</div>
          {padarias.length ? (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50/60 shadow-sm p-4">
              <Store size={20} className="mt-0.5 shrink-0 text-amber-800" />
              <div className="text-sm"><b>{padarias[0].nome}</b><span className="block text-stone-600">{padarias[0].endereco}</span>
                {padarias[0].horario_texto && <span className="block text-xs text-stone-500">{padarias[0].horario_texto}</span>}</div>
              <span className="ml-auto selo selo-ambar">Definido pelo plano</span>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 shadow-sm p-3 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Nenhum ponto do tipo Padaria cadastrado. <Link className="underline" href="/pontos-coleta">Cadastre em Pontos de coleta</Link>.</p>
          )}
        </div>
      )}

      {mod === "coleta_ponto" && (
        <fieldset>
          <legend className="rotulo">3. Em qual ponto de coleta? <span className="text-red-500">*</span></legend>
          {retiradas.length ? (
            <div className="grid grid-cols-2 gap-3">
              {retiradas.map((p) => (
                <label key={p.id} className="relative flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(28,25,23,.12)] transition hover:shadow-md has-[:checked]:bg-amber-50 has-[:checked]:shadow-lg has-[:checked]:ring-2 has-[:checked]:ring-amber-500/40">
                  <input type="radio" name="ponto_ui" className="sr-only" required checked={ponto?.id === p.id} onChange={() => setPontoId(p.id)} />
                  <MapPin size={18} className="mt-0.5 shrink-0 text-stone-500" />
                  <span className="text-sm"><b className="block leading-tight">{p.nome}</b><span className="block text-stone-500">{p.endereco}</span>
                    {p.horario_texto && <span className="block text-xs text-stone-400">{p.horario_texto}</span>}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 shadow-sm p-3 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Nenhum ponto de retirada cadastrado. <Link className="underline" href="/pontos-coleta">Cadastre em Pontos de coleta</Link>.</p>
          )}
        </fieldset>
      )}

      {mod === "entrega" && (
        <p className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600"><Truck size={16} className="shrink-0 text-stone-400" />Entrega no endereço do cliente. Depois do cadastro, atribua uma rota em <b>Rotas</b>.</p>
      )}
    </div>
  );
}

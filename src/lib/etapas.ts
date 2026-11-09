/** As quatro etapas da semana, em ordem de trabalho, e como saber em qual o time está. */
export type EtapaId = "paes" | "producao" | "distribuicao" | "entregas";
export const ETAPAS: { id: EtapaId; rotulo: string; curto: string }[] = [
  { id: "paes", rotulo: "Pães", curto: "Quais pães saem" },
  { id: "producao", rotulo: "Produção", curto: "Quanto produzir" },
  { id: "distribuicao", rotulo: "Distribuição", curto: "Rotas, pontos e quantidades" },
  { id: "entregas", rotulo: "Entregas", curto: "Acompanhar a semana" },
];

export type EntradaEtapas = {
  paes: number; totalPaes: number; semProducao: boolean; listaFechada: boolean;
  ativos: number; concluidas: number; semRota: number; rotasSemEntregador: number;
};
export type EstadoEtapa = { id: EtapaId; rotulo: string; curto: string; feita: boolean; detalhe: string; alerta?: string };

export function estadoEtapas(e: EntradaEtapas): EstadoEtapa[] {
  const base = Object.fromEntries(ETAPAS.map((x) => [x.id, x])) as Record<EtapaId, (typeof ETAPAS)[number]>;
  const alertaDist = e.semRota
    ? `${e.semRota} ${e.semRota === 1 ? "entrega" : "entregas"} sem rota`
    : e.rotasSemEntregador ? `${e.rotasSemEntregador} ${e.rotasSemEntregador === 1 ? "rota" : "rotas"} sem entregador` : undefined;
  return [
    { ...base.paes, feita: e.semProducao || e.paes > 0, detalhe: e.semProducao ? "Semana sem produção" : e.paes ? `${e.paes} ${e.paes === 1 ? "pão" : "pães"}` : "Defina os pães" },
    { ...base.producao, feita: e.semProducao || e.listaFechada, detalhe: e.semProducao ? "Nada a produzir" : e.listaFechada ? `Lista fechada · ${e.totalPaes} pães` : `${e.totalPaes} pães a produzir` },
    { ...base.distribuicao, feita: e.semProducao || (e.ativos > 0 && !alertaDist), detalhe: e.semProducao ? "Nada a distribuir" : `${e.ativos} ${e.ativos === 1 ? "cliente" : "clientes"}`, alerta: e.semProducao ? undefined : alertaDist },
    { ...base.entregas, feita: e.semProducao || (e.ativos > 0 && e.concluidas >= e.ativos), detalhe: e.semProducao ? "—" : `${e.concluidas} de ${e.ativos} concluídas` },
  ];
}

/** A etapa pedida na URL, ou a primeira ainda não concluída. */
export function etapaAtual(estados: EstadoEtapa[], pedida?: string): EtapaId {
  const valida = estados.find((s) => s.id === pedida);
  if (valida) return valida.id;
  return (estados.find((s) => !s.feita) ?? estados[estados.length - 1]).id;
}

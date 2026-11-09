/**
 * A semana em cinco etapas, na ordem do trabalho:
 * planejar os pães, ver quem recebe, alocar nos pontos e rotas, consolidar e enviar, acompanhar.
 */
export type EtapaId = "planejar" | "clientes" | "alocar" | "consolidar" | "acompanhar";
export const ETAPAS: { id: EtapaId; rotulo: string; curto: string }[] = [
  { id: "planejar", rotulo: "Planejar", curto: "Quais pães saem na semana" },
  { id: "clientes", rotulo: "Clientes", curto: "Quem recebe nesta semana" },
  { id: "alocar", rotulo: "Pontos e rotas", curto: "Onde cada cliente recebe" },
  { id: "consolidar", rotulo: "Consolidar e enviar", curto: "Fechar a lista e avisar" },
  { id: "acompanhar", rotulo: "Acompanhar", curto: "Entregas e retiradas" },
];

export type EntradaEtapas = {
  paes: number; totalPaes: number; semProducao: boolean; listaFechada: boolean;
  ativos: number; suspensos: number; pulados: number; concluidas: number; semRota: number; rotasSemEntregador: number;
};
export type EstadoEtapa = { id: EtapaId; rotulo: string; curto: string; feita: boolean; detalhe: string; alerta?: string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function estadoEtapas(e: EntradaEtapas): EstadoEtapa[] {
  const base = Object.fromEntries(ETAPAS.map((x) => [x.id, x])) as Record<EtapaId, (typeof ETAPAS)[number]>;
  const alertaAlocar = e.semRota
    ? `${plural(e.semRota, "entrega", "entregas")} sem rota`
    : e.rotasSemEntregador ? `${plural(e.rotasSemEntregador, "rota", "rotas")} sem entregador` : undefined;
  const nada = e.semProducao;
  return [
    { ...base.planejar, feita: nada || e.paes > 0, detalhe: nada ? "Semana sem produção" : e.paes ? plural(e.paes, "pão", "pães") : "Defina os pães" },
    { ...base.clientes, feita: nada || e.ativos > 0, detalhe: nada ? "Ninguém recebe" : plural(e.ativos, "cliente", "clientes"),
      alerta: nada || !e.suspensos ? undefined : `${plural(e.suspensos, "suspenso", "suspensos")} por atraso` },
    { ...base.alocar, feita: nada || (e.ativos > 0 && !alertaAlocar), detalhe: nada ? "Nada a alocar" : alertaAlocar ? "Falta alocar" : "Tudo alocado", alerta: nada ? undefined : alertaAlocar },
    { ...base.consolidar, feita: nada || e.listaFechada, detalhe: nada ? "Nada a enviar" : e.listaFechada ? `Fechada · ${e.totalPaes} pães` : `${e.totalPaes} pães a produzir` },
    { ...base.acompanhar, feita: nada || (e.ativos > 0 && e.concluidas >= e.ativos), detalhe: nada ? "—" : `${e.concluidas} de ${e.ativos} concluídas` },
  ];
}

/** A etapa pedida na URL, ou a primeira ainda não concluída. */
export function etapaAtual(estados: EstadoEtapa[], pedida?: string): EtapaId {
  const valida = estados.find((s) => s.id === pedida);
  if (valida) return valida.id;
  return (estados.find((s) => !s.feita) ?? estados[estados.length - 1]).id;
}

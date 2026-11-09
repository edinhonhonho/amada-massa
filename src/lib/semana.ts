import { adicionarDias } from "./pagamentos.ts";

export const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0=domingo

/** Segunda-feira da semana de `iso`. */
export const segundaDe = (iso: string) => adicionarDias(iso, -((diaDaSemana(iso) + 6) % 7));

export const STATUS_ENTREGA: Record<string, string> = {
  programada: "Programada", entregue: "Entregue", retirada: "Retirada", nao_entregue: "Não entregue",
  pulada: "Pulada", reagendada: "Reagendada", suspensa_atraso: "Suspensa por atraso",
};
export const OCORRENCIAS = ["Cliente ausente", "Endereço errado", "Atraso", "Pão com problema", "Outro"];
export const STATUS_SEMANA: Record<string, string> = {
  planejada: "Planejada", em_producao: "Em produção", entregue: "Entregue", encerrada: "Encerrada",
};

/** Número da semana ISO (a semana 1 é a que contém a primeira quinta-feira do ano). */
export function numeroSemanaISO(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // quinta-feira da semana
  const quinta1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - quinta1.getTime()) / 86_400_000 - 3 + ((quinta1.getUTCDay() + 6) % 7)) / 7);
}

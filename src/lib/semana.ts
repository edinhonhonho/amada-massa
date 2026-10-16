import { adicionarDias } from "./pagamentos";

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

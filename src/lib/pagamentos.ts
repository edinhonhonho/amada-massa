export type Faixas = { aVencerDias: number; atrasoCriticoDias: number; carenciaDias: number };
export const FAIXAS_PADRAO: Faixas = { aVencerDias: 3, atrasoCriticoDias: 15, carenciaDias: 0 };

export type Situacao = "em_dia" | "a_vencer" | "vence_hoje" | "atrasado" | "atraso_critico" | "sem_cobranca";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  em_dia: "Em dia",
  a_vencer: "A vencer",
  vence_hoje: "Vence hoje",
  atrasado: "Atrasado",
  atraso_critico: "Atraso crítico",
  sem_cobranca: "Sem cobrança",
};

export const COR_SITUACAO: Record<Situacao, string> = {
  em_dia: "bg-green-100 text-green-800",
  a_vencer: "bg-sky-100 text-sky-800",
  vence_hoje: "bg-amber-100 text-amber-900",
  atrasado: "bg-orange-100 text-orange-900",
  atraso_critico: "bg-red-100 text-red-800",
  sem_cobranca: "bg-stone-200 text-stone-700",
};

/** Dias entre duas datas "aaaa-mm-dd" (b - a), sem depender de fuso. */
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function adicionarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Situação de uma cobrança em `hoje` (spec 6). Atraso conta depois da carência. */
export function situacaoCobranca(
  c: { status: "pendente" | "paga" | "isenta" | "cancelada"; vencimento: string },
  hoje: string,
  f: Faixas = FAIXAS_PADRAO,
): Situacao {
  if (c.status === "isenta" || c.status === "cancelada") return "sem_cobranca";
  if (c.status === "paga") return "em_dia";
  const atraso = diasEntre(c.vencimento, hoje) - f.carenciaDias; // >0: venceu além da carência
  if (atraso > f.atrasoCriticoDias) return "atraso_critico";
  if (atraso > 0) return "atrasado";
  const dias = diasEntre(hoje, c.vencimento);
  if (dias === 0) return "vence_hoje";
  if (dias <= f.aVencerDias && dias > 0) return "a_vencer";
  if (dias < 0) return "vence_hoje"; // vencida, mas dentro da carência: ainda pede ação
  return "em_dia";
}

const GRAVIDADE: Situacao[] = ["sem_cobranca", "em_dia", "a_vencer", "vence_hoje", "atrasado", "atraso_critico"];
/** A pior situação entre várias cobranças. */
export const pior = (xs: Situacao[]): Situacao =>
  xs.reduce((p, x) => (GRAVIDADE.indexOf(x) > GRAVIDADE.indexOf(p) ? x : p), "sem_cobranca" as Situacao);

export const ordemSituacao: Situacao[] = ["atraso_critico", "atrasado", "vence_hoje", "a_vencer", "em_dia", "sem_cobranca"];

export function primeiroDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
export function somarMeses(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

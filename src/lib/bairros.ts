/** Mesma regra do banco (norm_bairro): sem acento, sem caixa e sem espaços sobrando. */
export const normBairro = (t?: string | null): string =>
  (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export type RotaBairros = { id: string; nome: string; ativa: boolean; bairros: string[] };

/**
 * Rota de um cliente de entrega: a atribuição manual vale mais; senão, a primeira rota ativa (por nome)
 * que cobre o bairro dele. Espelha a função rota_do_cliente do banco.
 */
export function rotaDoCliente(bairro: string | null | undefined, manual: string | null | undefined, rotas: RotaBairros[]): string | null {
  if (manual && rotas.some((r) => r.id === manual && r.ativa)) return manual;
  const b = normBairro(bairro);
  if (!b) return null;
  return [...rotas].filter((r) => r.ativa).sort((x, y) => x.nome.localeCompare(y.nome)).find((r) => r.bairros.some((x) => normBairro(x) === b))?.id ?? null;
}

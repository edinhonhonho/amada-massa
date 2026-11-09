/**
 * Chave para comparar telefones digitados de jeitos diferentes: DDD + últimos 8 dígitos.
 * Ignora "+55", parênteses, traços e o nono dígito, que muita gente esquece ou acrescenta.
 * Devolve null quando não há DDD (curto demais) para comparar com segurança.
 */
export function chaveTelefone(entrada?: string | null): string | null {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length < 10 || d.length > 11) return null;
  return d.slice(0, 2) + d.slice(-8);
}

/** "(51) 99999-8888" para exibir. */
export function formatarTelefone(entrada?: string | null): string {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return entrada ?? "";
}

export type EnderecoCep = { logradouro: string; bairro: string; cidade: string; uf: string };

/** "90010-000" a partir de qualquer texto (aceita colar com ou sem hífen). */
export function mascaraCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Consulta o ViaCEP (gratuito, direto do navegador). Devolve null se o CEP não existir ou a consulta falhar. */
export async function consultarCep(cep: string): Promise<EnderecoCep | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return { logradouro: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "dd/mm/aaaa" a partir de "aaaa-mm-dd" (sem passar por Date, evita deslocar o fuso). */
export const dataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export const hojeISO = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Converte "80,00" / "80.50" / "1.080,00" em centavos inteiros. */
export function paraCentavos(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "").replace("R$", "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const linkWhatsApp = (whatsapp?: string | null, texto?: string) => {
  if (!whatsapp) return null;
  const d = soDigitos(whatsapp);
  const numero = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};

export const MODALIDADES = {
  coleta_padaria: "Coleta na padaria",
  coleta_ponto: "Ponto de coleta",
  entrega: "Entrega em casa",
} as const;
export type Modalidade = keyof typeof MODALIDADES;

export const STATUS_CLIENTE = { ativo: "Ativo", pausado: "Pausado", cancelado: "Cancelado" } as const;
export const CANAIS = { whatsapp: "WhatsApp", email: "E-mail", presencial: "Presencial", outro: "Outro" } as const;
export const ORIGENS = ["site", "instagram", "indicação", "feira", "outro"] as const;

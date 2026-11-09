/** Textos das notificações para os membros. Puro, para ser testável. */
export type Aviso = { cliente_id: string; tipo: string; titulo: string; corpo: string; url?: string; ref?: string; aviso_id?: string };

/** "20/10 às 14:32", no fuso de Porto Alegre. */
export function quando(iso: string): string {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${data} às ${hora}`;
}

export const primeiroNomeDe = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const primeiroNome = primeiroNomeDe;

export const textoRotaIniciada = (p: { sabor?: string | null; entregador: string }) => ({
  titulo: "Sua rota iniciou 🚲",
  corpo: `${p.sabor ? `Hoje o pão é ${p.sabor}. ` : ""}Seu entregador é ${primeiroNome(p.entregador)}.`,
});

export const textoProximo = (p: { entregador: string }) => ({
  titulo: "Você é o próximo!",
  corpo: `${primeiroNome(p.entregador)} está a caminho da sua casa.`,
});

export const textoEntregue = (p: { entregador: string; em: string }) => ({
  titulo: "Seu pão chegou 🍞",
  corpo: `Entregue em ${quando(p.em)} por ${primeiroNome(p.entregador)}.`,
});

export const textoNaoEntregue = (p: { entregador: string; em: string }) => ({
  titulo: "Não conseguimos entregar",
  corpo: `${primeiroNome(p.entregador)} tentou em ${quando(p.em)}. Vamos entrar em contato para combinar a reposição.`,
});

export const textoSabor = (sabor: string) => ({
  titulo: "Pão da semana",
  corpo: `O pão desta semana é ${sabor}.`,
});

/** Variáveis que o texto de um aviso aceita; cada cliente recebe com os próprios dados. */
export const VARIAVEIS_AVISO = [
  { chave: "nome", exemplo: "Maria", descricao: "Primeiro nome" },
  { chave: "valor", exemplo: "R$ 80,00", descricao: "Valor em aberto (só em avisos de cobrança)" },
  { chave: "vencimento", exemplo: "10/11/2026", descricao: "Vencimento mais antigo em aberto" },
] as const;

/** Substitui {variavel}; sem valor, vira vazio e os espaços sobrando são limpos. */
export function personalizar(texto: string, vars: Record<string, string | undefined>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

/** Emoji de cada tipo de aviso na caixa de entrada do app. */
export const EMOJI_TIPO: Record<string, string> = {
  rota_iniciada: "🚲", proximo: "📍", entregue: "🍞", nao_entregue: "📦", sabor: "🥖", aviso: "📣",
};

/** "Hoje", "Ontem" ou "20/10", no fuso de Porto Alegre. */
export function rotuloDia(iso: string, agora: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
  const dia = f.format(new Date(iso));
  if (dia === f.format(agora)) return "Hoje";
  if (dia === f.format(new Date(agora.getTime() - 86_400_000))) return "Ontem";
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** "14:32", no fuso de Porto Alegre. */
export const horaCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

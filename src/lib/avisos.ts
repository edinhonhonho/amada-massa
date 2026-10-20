/** Textos das notificações para os membros. Puro, para ser testável. */
export type Aviso = { cliente_id: string; tipo: string; titulo: string; corpo: string; url?: string; ref?: string };

/** "20/10 às 14:32", no fuso de Porto Alegre. */
export function quando(iso: string): string {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${data} às ${hora}`;
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;

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

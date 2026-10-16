/** Substitui {variavel} no modelo; variável sem valor vira vazio. */
export function montarMensagem(texto: string, vars: Record<string, string | undefined>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/[ \t]+\n/g, "\n").trim();
}

export const VARIAVEIS = ["nome", "plano", "valor", "vencimento", "dia_pagamento", "sabor", "dia_horario", "endereco"];

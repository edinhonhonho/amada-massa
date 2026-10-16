/** CSV para Excel pt-BR: separador ";", BOM UTF-8, e proteção contra fórmulas (=, +, -, @). */
export function toCsv(colunas: string[], linhas: (string | number | null | undefined)[][]): string {
  const cel = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [colunas, ...linhas].map((l) => l.map(cel).join(";")).join("\r\n");
}

export const csvResponse = (nome: string, conteudo: string) =>
  new Response(conteudo, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}.csv"`,
    },
  });

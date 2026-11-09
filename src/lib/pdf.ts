import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ColunaPdf = {
  titulo: string;
  /** Largura relativa da coluna. */
  peso: number;
  alinhar?: "esq" | "centro" | "dir";
  /** "caixa": quadradinho para marcar; "linha": espaço para escrever à mão. */
  tipo?: "texto" | "caixa" | "linha";
};
export type DocPdf = {
  titulo: string;
  subtitulo?: string;
  info?: [string, string][];
  /** Resumo do que levar/produzir: nome do pão e quantidade. */
  levar?: { nome: string; qtd: number }[];
  totalPaes?: number;
  colunas: ColunaPdf[];
  linhas: string[][];
  totais?: string[];
  rodape?: string;
};

const A4 = { w: 841.89, h: 595.28 }; // paisagem
const M = 36;
const MARCA = rgb(0.706, 0.325, 0.035);
const CINZA = rgb(0.45, 0.43, 0.41);
const ESCURO = rgb(0.11, 0.1, 0.09);
const LINHA = rgb(0.88, 0.87, 0.85);

/** Troca caracteres que a fonte padrão do PDF não sabe desenhar. */
function limpar(fonte: PDFFont, texto: string): string {
  const ok = new Set(fonte.getCharacterSet());
  return [...texto.normalize("NFC")].map((c) => (ok.has(c.codePointAt(0)!) ? c : c === "→" ? ">" : c === "✓" ? "v" : "?")).join("");
}

function caber(fonte: PDFFont, texto: string, tamanho: number, largura: number): string {
  if (fonte.widthOfTextAtSize(texto, tamanho) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && fonte.widthOfTextAtSize(`${t}…`.replace("…", "..."), tamanho) > largura) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

export async function gerarPdf(doc: DocPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.titulo);
  pdf.setProducer("Amada Massa");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const L = (t: string, f: PDFFont = regular) => limpar(f, t);

  const larguraUtil = A4.w - 2 * M;
  const somaPesos = doc.colunas.reduce((s, c) => s + c.peso, 0);
  const larg = doc.colunas.map((c) => (c.peso / somaPesos) * larguraUtil);
  const x0 = doc.colunas.map((_, i) => M + larg.slice(0, i).reduce((s, v) => s + v, 0));

  const paginas: PDFPage[] = [];
  const novaPagina = () => { const p = pdf.addPage([A4.w, A4.h]); paginas.push(p); return p; };

  const texto = (p: PDFPage, t: string, x: number, y: number, tam: number, f: PDFFont = regular, cor = ESCURO) =>
    p.drawText(L(t, f), { x, y, size: tam, font: f, color: cor });

  const cabecalhoTabela = (p: PDFPage, y: number) => {
    p.drawRectangle({ x: M, y: y - 6, width: larguraUtil, height: 22, color: rgb(0.99, 0.95, 0.86) });
    doc.colunas.forEach((c, i) => {
      const t = L(caber(negrito, c.titulo, 8.5, larg[i] - 10), negrito);
      const w = negrito.widthOfTextAtSize(t, 8.5);
      const x = c.alinhar === "centro" ? x0[i] + (larg[i] - w) / 2 : c.alinhar === "dir" ? x0[i] + larg[i] - 5 - w : x0[i] + 5;
      p.drawText(t, { x, y: y + 1, size: 8.5, font: negrito, color: ESCURO });
    });
    return y - 14;
  };

  // ------------------------------------------------------------ cabeçalho
  let p = novaPagina();
  let y = A4.h - M;
  texto(p, "Amada Massa", M, y - 10, 11, negrito, MARCA);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const geradoEm = L(`Gerado em ${hoje}`);
  p.drawText(geradoEm, { x: A4.w - M - regular.widthOfTextAtSize(geradoEm, 8.5), y: y - 10, size: 8.5, font: regular, color: CINZA });
  y -= 36;
  texto(p, doc.titulo, M, y, 20, negrito);
  y -= 18;
  if (doc.subtitulo) { texto(p, caber(regular, L(doc.subtitulo), 10, larguraUtil), M, y, 10, regular, CINZA); y -= 16; }

  if (doc.info?.length) {
    let x = M;
    for (const [k, v] of doc.info) {
      const rot = L(`${k}: `, regular), val = L(v, negrito);
      texto(p, rot, x, y, 9, regular, CINZA);
      const wr = regular.widthOfTextAtSize(rot, 9);
      texto(p, val, x + wr, y, 9, negrito);
      x += wr + negrito.widthOfTextAtSize(val, 9) + 22;
    }
    y -= 22;
  }

  if (doc.levar?.length) {
    y -= 6;
    let x = M;
    for (const l of doc.levar) {
      const nome = L(caber(regular, l.nome, 10, 170)), qtd = String(l.qtd);
      const w = regular.widthOfTextAtSize(nome, 10) + negrito.widthOfTextAtSize(qtd, 13) + 30;
      if (x + w > A4.w - M) { x = M; y -= 34; }
      p.drawRectangle({ x, y: y - 10, width: w, height: 28, color: rgb(0.99, 0.95, 0.86), borderColor: rgb(0.96, 0.86, 0.62), borderWidth: 0.6 });
      texto(p, nome, x + 10, y, 10, regular);
      texto(p, qtd, x + 10 + regular.widthOfTextAtSize(nome, 10) + 10, y - 1, 13, negrito, MARCA);
      x += w + 8;
    }
    if (doc.totalPaes != null) {
      const t = L(`Total: ${doc.totalPaes} pães`, negrito);
      if (x + negrito.widthOfTextAtSize(t, 11) > A4.w - M) { x = M; y -= 34; }
      texto(p, t, x + 6, y, 11, negrito);
    }
    y -= 34;
  }

  // --------------------------------------------------------------- tabela
  y -= 4;
  y = cabecalhoTabela(p, y);
  const alturaLinha = doc.colunas.some((c) => c.tipo === "linha" || c.tipo === "caixa") ? 26 : 20;
  doc.linhas.forEach((linha, n) => {
    if (y - alturaLinha < M + 52) { p = novaPagina(); y = A4.h - M; y = cabecalhoTabela(p, y); }
    if (n % 2 === 1) p.drawRectangle({ x: M, y: y - alturaLinha + 6, width: larguraUtil, height: alturaLinha, color: rgb(0.975, 0.972, 0.965) });
    doc.colunas.forEach((c, i) => {
      if (c.tipo === "caixa") {
        p.drawRectangle({ x: x0[i] + larg[i] / 2 - 6, y: y - alturaLinha / 2 + 1, width: 12, height: 12, borderColor: CINZA, borderWidth: 0.9 });
      } else if (c.tipo === "linha") {
        p.drawLine({ start: { x: x0[i] + 5, y: y - alturaLinha / 2 + 2 }, end: { x: x0[i] + larg[i] - 8, y: y - alturaLinha / 2 + 2 }, thickness: 0.6, color: CINZA });
      } else {
        const bruto = linha[i] ?? "";
        const t = L(caber(regular, L(bruto), 9, larg[i] - 10));
        const w = regular.widthOfTextAtSize(t, 9);
        const x = c.alinhar === "centro" ? x0[i] + (larg[i] - w) / 2 : c.alinhar === "dir" ? x0[i] + larg[i] - 5 - w : x0[i] + 5;
        p.drawText(t, { x, y: y - alturaLinha / 2 + 3, size: 9, font: regular, color: ESCURO });
      }
    });
    p.drawLine({ start: { x: M, y: y - alturaLinha + 6 }, end: { x: M + larguraUtil, y: y - alturaLinha + 6 }, thickness: 0.4, color: LINHA });
    y -= alturaLinha;
  });

  if (doc.totais) {
    if (y - 30 < M + 52) { p = novaPagina(); y = A4.h - M; }
    p.drawLine({ start: { x: M, y: y + 6 }, end: { x: M + larguraUtil, y: y + 6 }, thickness: 1, color: ESCURO });
    doc.colunas.forEach((c, i) => {
      const t = L(doc.totais![i] ?? "", negrito);
      if (!t) return;
      const w = negrito.widthOfTextAtSize(t, 9.5);
      const x = c.alinhar === "centro" ? x0[i] + (larg[i] - w) / 2 : c.alinhar === "dir" ? x0[i] + larg[i] - 5 - w : x0[i] + 5;
      p.drawText(t, { x, y: y - 8, size: 9.5, font: negrito, color: ESCURO });
    });
    y -= 26;
  }

  if (doc.rodape) {
    if (y - 50 < M + 20) { p = novaPagina(); y = A4.h - M; }
    y -= 14;
    const partes = ["Conferido por", "Data", "Observações"];
    const w = larguraUtil / partes.length;
    partes.forEach((t, i) => {
      p.drawLine({ start: { x: M + i * w, y: y - 14 }, end: { x: M + (i + 1) * w - 16, y: y - 14 }, thickness: 0.6, color: CINZA });
      texto(p, t, M + i * w, y - 25, 8, regular, CINZA);
    });
  }

  paginas.forEach((pg, i) => {
    const t = L(`${doc.rodape ?? doc.titulo} · página ${i + 1} de ${paginas.length}`.replace(/^Conferido.*? · /, ""));
    pg.drawText(t, { x: M, y: 18, size: 7.5, font: regular, color: CINZA });
  });
  return pdf.save();
}

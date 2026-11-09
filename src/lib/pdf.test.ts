import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { gerarPdf } from "./pdf.ts";

test("gera um PDF válido, com acentos e muitas linhas em várias páginas", async () => {
  const linhas = Array.from({ length: 60 }, (_, i) => [String(i + 1), `Cliente ${i + 1} Conceição ação`, "(51) 99999-0000", "1", "1", "2", ""]);
  const bytes = await gerarPdf({
    titulo: "Retirada — Zona Sul · Loja Residence",
    subtitulo: "Av. Wenceslau Escobar, 1766 · Qua 11h30–18h",
    info: [["Semana", "09/11 a 15/11"], ["Pontos", "1"]],
    levar: [{ nome: "Centeio com sementes", qtd: 60 }, { nome: "Integral de mel", qtd: 60 }],
    totalPaes: 120,
    colunas: [
      { titulo: "#", peso: 0.5, alinhar: "centro" }, { titulo: "Cliente", peso: 3 }, { titulo: "Telefone", peso: 1.6 },
      { titulo: "Centeio", peso: 1, alinhar: "centro" }, { titulo: "Integral", peso: 1, alinhar: "centro" }, { titulo: "Total", peso: 0.8, alinhar: "centro" },
      { titulo: "Retirou", peso: 0.9, alinhar: "centro", tipo: "caixa" },
    ],
    linhas, totais: ["", "Total", "", "60", "60", "120", ""], rodape: "Retirada",
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.length > 2000);
  const paginas = (await PDFDocument.load(bytes)).getPageCount();
  assert.ok(paginas >= 2, `esperava várias páginas, veio ${paginas}`);
});

test("caracteres fora da fonte padrão não quebram o PDF", async () => {
  const bytes = await gerarPdf({ titulo: "Teste ☐ 日本 😀", colunas: [{ titulo: "A", peso: 1 }], linhas: [["ok ☐ 日本"]] });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});

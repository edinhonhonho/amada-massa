import { test } from "node:test";
import assert from "node:assert/strict";
import { quando, textoEntregue, textoRotaIniciada } from "./avisos.ts";

test("horário no fuso de Porto Alegre", () => {
  assert.equal(quando("2026-10-20T17:32:00Z"), "20/10 às 14:32");
});

test("textos usam só o primeiro nome do entregador", () => {
  assert.equal(textoEntregue({ entregador: "Marcelo Silva", em: "2026-10-20T17:32:00Z" }).corpo, "Entregue em 20/10 às 14:32 por Marcelo.");
  assert.equal(textoRotaIniciada({ sabor: "Tananã", entregador: "Marcelo" }).corpo, "Hoje o pão é Tananã. Seu entregador é Marcelo.");
  assert.equal(textoRotaIniciada({ entregador: "Marcelo" }).corpo, "Seu entregador é Marcelo.");
});

test("rótulo do dia: hoje, ontem e data", async () => {
  const { rotuloDia, personalizar } = await import("./avisos.ts");
  const agora = new Date("2026-11-09T15:00:00Z");
  assert.equal(rotuloDia("2026-11-09T13:00:00Z", agora), "Hoje");
  assert.equal(rotuloDia("2026-11-08T13:00:00Z", agora), "Ontem");
  assert.equal(rotuloDia("2026-11-01T13:00:00Z", agora), "01/11");
  assert.equal(personalizar("Oi, {nome}! Você deve {valor}.", { nome: "Ana" }), "Oi, Ana! Você deve .");
  assert.equal(personalizar("Oi, {nome}!", { nome: "Ana" }), "Oi, Ana!");
});

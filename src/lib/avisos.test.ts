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

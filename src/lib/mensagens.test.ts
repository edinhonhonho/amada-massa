import { test } from "node:test";
import assert from "node:assert/strict";
import { montarMensagem } from "./mensagens.ts";

test("substitui variáveis", () => {
  assert.equal(montarMensagem("Oi, {nome}! Vence {vencimento}.{extra}", { nome: "Ana", vencimento: "10/10/2026" }), "Oi, Ana! Vence 10/10/2026.");
});

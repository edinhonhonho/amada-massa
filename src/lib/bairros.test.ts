import assert from "node:assert/strict";
import { test } from "node:test";
import { normBairro, rotaDoCliente } from "./bairros.ts";

const rotas = [
  { id: "b", nome: "Rota B", ativa: true, bairros: ["Tristeza", "Bom Fim"] },
  { id: "a", nome: "Rota A", ativa: true, bairros: ["Centro Histórico", "Bom Fim"] },
  { id: "x", nome: "Rota X", ativa: false, bairros: ["Azenha"] },
];

test("normaliza acento, caixa e espaços", () => {
  assert.equal(normBairro("  Centro   HISTÓRICO "), "centro historico");
  assert.equal(normBairro(null), "");
});
test("rota pelo bairro, sem acento nem caixa", () => {
  assert.equal(rotaDoCliente("centro historico", null, rotas), "a");
  assert.equal(rotaDoCliente("Tristeza", null, rotas), "b");
});
test("bairro em duas rotas: a de nome menor ganha; inativa e desconhecido ficam sem rota", () => {
  assert.equal(rotaDoCliente("Bom Fim", null, rotas), "a");
  assert.equal(rotaDoCliente("Azenha", null, rotas), null);
  assert.equal(rotaDoCliente("Lugar nenhum", null, rotas), null);
  assert.equal(rotaDoCliente(null, null, rotas), null);
});
test("atribuição manual vale mais, se a rota estiver ativa", () => {
  assert.equal(rotaDoCliente("Tristeza", "a", rotas), "a");
  assert.equal(rotaDoCliente("Tristeza", "x", rotas), "b");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { estadoEtapas, etapaAtual } from "./etapas.ts";

const base = { paes: 0, totalPaes: 0, semProducao: false, listaFechada: false, ativos: 0, suspensos: 0, pulados: 0, concluidas: 0, semRota: 0, rotasSemEntregador: 0 };

test("semana nova começa em Planejar", () => {
  assert.equal(etapaAtual(estadoEtapas(base)), "planejar");
});
test("com pães definidos mas sem clientes, fica em Clientes", () => {
  assert.equal(etapaAtual(estadoEtapas({ ...base, paes: 2 })), "clientes");
});
test("pães e clientes prontos: segue para Pontos e rotas quando há entrega sem rota", () => {
  const e = estadoEtapas({ ...base, paes: 2, ativos: 40, semRota: 3 });
  assert.equal(etapaAtual(e), "alocar");
  assert.equal(e[2].alerta, "3 entregas sem rota");
});
test("rota sem entregador também trava a alocação", () => {
  const e = estadoEtapas({ ...base, paes: 1, ativos: 10, rotasSemEntregador: 1 });
  assert.equal(e[2].alerta, "1 rota sem entregador");
  assert.equal(e[2].feita, false);
});
test("tudo alocado leva a Consolidar; lista fechada leva a Acompanhar", () => {
  assert.equal(etapaAtual(estadoEtapas({ ...base, paes: 1, ativos: 10 })), "consolidar");
  const fechada = estadoEtapas({ ...base, paes: 1, ativos: 10, listaFechada: true });
  assert.equal(etapaAtual(fechada), "acompanhar");
  assert.equal(estadoEtapas({ ...base, paes: 1, ativos: 10, listaFechada: true, concluidas: 10 })[4].feita, true);
});
test("suspensos por atraso aparecem como alerta em Clientes", () => {
  assert.equal(estadoEtapas({ ...base, paes: 1, ativos: 8, suspensos: 2 })[1].alerta, "2 suspensos por atraso");
});
test("semana sem produção está toda resolvida e a URL manda", () => {
  const e = estadoEtapas({ ...base, semProducao: true });
  assert.ok(e.every((x) => x.feita));
  assert.equal(etapaAtual(e, "consolidar"), "consolidar");
  assert.equal(etapaAtual(e, "inexistente"), "acompanhar");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { estadoEtapas, etapaAtual } from "./etapas.ts";

const base = { paes: 0, totalPaes: 0, semProducao: false, listaFechada: false, ativos: 0, concluidas: 0, semRota: 0, rotasSemEntregador: 0 };

test("semana nova começa pelos pães", () => {
  assert.equal(etapaAtual(estadoEtapas(base)), "paes");
});
test("com pães definidos, segue para a produção", () => {
  assert.equal(etapaAtual(estadoEtapas({ ...base, paes: 2, totalPaes: 90, ativos: 40 })), "producao");
});
test("lista fechada mas entrega sem rota fica na distribuição, com alerta", () => {
  const e = estadoEtapas({ ...base, paes: 2, listaFechada: true, ativos: 40, semRota: 3 });
  assert.equal(etapaAtual(e), "distribuicao");
  assert.equal(e[2].alerta, "3 entregas sem rota");
});
test("rota sem entregador também trava a distribuição", () => {
  const e = estadoEtapas({ ...base, paes: 1, listaFechada: true, ativos: 10, rotasSemEntregador: 1 });
  assert.equal(e[2].alerta, "1 rota sem entregador");
  assert.equal(e[2].feita, false);
});
test("tudo pronto cai em entregas; concluídas fecham a etapa", () => {
  const e = estadoEtapas({ ...base, paes: 1, listaFechada: true, ativos: 10 });
  assert.equal(etapaAtual(e), "entregas");
  assert.equal(estadoEtapas({ ...base, paes: 1, listaFechada: true, ativos: 10, concluidas: 10 })[3].feita, true);
});
test("semana sem produção está toda resolvida e a URL manda", () => {
  const e = estadoEtapas({ ...base, semProducao: true });
  assert.ok(e.every((x) => x.feita));
  assert.equal(etapaAtual(e, "producao"), "producao");
  assert.equal(etapaAtual(e, "inexistente"), "entregas");
});

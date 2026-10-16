import { test } from "node:test";
import assert from "node:assert/strict";
import { adicionarDias, diasEntre, pior, situacaoCobranca, somarMeses } from "./pagamentos.ts";

const pend = (vencimento: string) => ({ status: "pendente" as const, vencimento });

test("situação por faixa de dias", () => {
  const hoje = "2026-10-10";
  assert.equal(situacaoCobranca(pend("2026-10-20"), hoje), "em_dia");
  assert.equal(situacaoCobranca(pend("2026-10-13"), hoje), "a_vencer");
  assert.equal(situacaoCobranca(pend("2026-10-10"), hoje), "vence_hoje");
  assert.equal(situacaoCobranca(pend("2026-10-09"), hoje), "atrasado");
  assert.equal(situacaoCobranca(pend("2026-09-25"), hoje), "atrasado"); // 15 dias
  assert.equal(situacaoCobranca(pend("2026-09-24"), hoje), "atraso_critico"); // 16 dias
  assert.equal(situacaoCobranca({ status: "paga", vencimento: "2026-01-01" }, hoje), "em_dia");
  assert.equal(situacaoCobranca({ status: "isenta", vencimento: "2026-01-01" }, hoje), "sem_cobranca");
});

test("carência adia o atraso", () => {
  const f = { aVencerDias: 3, atrasoCriticoDias: 15, carenciaDias: 2 };
  assert.equal(situacaoCobranca(pend("2026-10-08"), "2026-10-10", f), "vence_hoje");
  assert.equal(situacaoCobranca(pend("2026-10-07"), "2026-10-10", f), "atrasado");
});

test("datas", () => {
  assert.equal(diasEntre("2026-02-27", "2026-03-02"), 3);
  assert.equal(adicionarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarMeses("2026-12-01", 1), "2027-01-01");
  assert.equal(pior(["em_dia", "atrasado", "a_vencer"]), "atrasado");
});

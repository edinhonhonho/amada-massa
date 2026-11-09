import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroSemanaISO, segundaDe } from "./semana.ts";

test("número da semana ISO", () => {
  assert.equal(numeroSemanaISO("2026-11-02"), 45);
  assert.equal(numeroSemanaISO("2026-01-05"), 2);
  assert.equal(numeroSemanaISO("2025-12-29"), 1); // pertence à semana 1 de 2026
  assert.equal(numeroSemanaISO("2024-12-30"), 1);
  assert.equal(numeroSemanaISO("2021-01-04"), 1);
  assert.equal(numeroSemanaISO("2021-01-01"), 53);
});

test("segunda-feira da semana", () => {
  assert.equal(segundaDe("2026-11-08"), "2026-11-02");
  assert.equal(segundaDe("2026-11-02"), "2026-11-02");
});

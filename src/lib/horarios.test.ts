import { test } from "node:test";
import assert from "node:assert/strict";
import { janelaValida, resumoHorarios } from "./horarios.ts";

test("resumo dos horários por dia", () => {
  const r = resumoHorarios([
    { dia: 3, abre: "11:00", fecha: "18:30" },
    { dia: 2, abre: "16:30", fecha: "18:30" },
    { dia: 2, abre: "11:00", fecha: "14:00" },
  ]);
  assert.equal(r, "Ter 11h–14h e 16h30–18h30; Qua 11h–18h30");
  assert.equal(resumoHorarios([]), "");
});

test("janela inválida", () => {
  assert.equal(janelaValida({ dia: 2, abre: "11:00", fecha: "10:00" }), false);
  assert.equal(janelaValida({ dia: 9, abre: "10:00", fecha: "11:00" }), false);
  assert.equal(janelaValida({ dia: 0, abre: "10:00", fecha: "11:00" }), true);
});

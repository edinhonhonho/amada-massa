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

test("agrupa dias com o mesmo horário", async () => {
  const { agruparHorarios } = await import("./horarios.ts");
  const j = (dia: number, abre: string, fecha: string) => ({ dia, abre, fecha });
  assert.deepEqual(agruparHorarios([j(2, "11:00", "14:00"), j(2, "16:30", "18:30"), j(3, "11:00", "18:30")]), [
    { dias: "Ter", horas: "11h–14h e 16h30–18h30" }, { dias: "Qua", horas: "11h–18h30" },
  ]);
  assert.deepEqual(agruparHorarios([j(1, "09:00", "12:00"), j(2, "09:00", "12:00"), j(3, "09:00", "12:00")]), [{ dias: "Seg a Qua", horas: "9h–12h" }]);
  assert.deepEqual(agruparHorarios([j(2, "09:00", "12:00"), j(4, "09:00", "12:00")]), [{ dias: "Ter e Qui", horas: "9h–12h" }]);
  assert.deepEqual(agruparHorarios([]), []);
});

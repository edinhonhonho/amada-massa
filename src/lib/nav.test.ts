import assert from "node:assert/strict";
import { test } from "node:test";
import { GRUPOS, TODOS_ITENS } from "./nav.ts";

test("atalhos do menu: duas letras, únicos, e a 1ª é a inicial do grupo", () => {
  const vistos = new Set<string>();
  for (const g of GRUPOS) {
    for (const i of g.itens) {
      assert.match(i.atalho, /^[a-z]{2}$/, i.rotulo);
      assert.equal(i.atalho[0], g.titulo!.normalize("NFD")[0].toLowerCase(), `${i.rotulo}: 1ª letra deve ser a do grupo ${g.titulo}`);
      assert.ok(!vistos.has(i.atalho), `atalho repetido: ${i.atalho}`);
      vistos.add(i.atalho);
    }
  }
  assert.equal(TODOS_ITENS.find((i) => i.href === "/mensagens")?.atalho, "cm");
});

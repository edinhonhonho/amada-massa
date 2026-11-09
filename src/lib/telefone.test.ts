import assert from "node:assert/strict";
import { test } from "node:test";
import { chaveTelefone, formatarTelefone } from "./telefone.ts";

test("telefones digitados de formas diferentes têm a mesma chave", () => {
  const k = chaveTelefone("51999998888");
  assert.equal(k, "5199998888");
  for (const v of ["(51) 99999-8888", "+55 51 99999-8888", "55 (51) 9 9999 8888", "051 99999-8888", "(51) 9999-8888"]) assert.equal(chaveTelefone(v), k, v);
});
test("sem DDD ou inválido não gera chave", () => {
  for (const v of ["99999-8888", "", null, undefined, "123", "5199999888812345"]) assert.equal(chaveTelefone(v), null, String(v));
});
test("telefones diferentes não colidem", () => {
  assert.notEqual(chaveTelefone("51999998888"), chaveTelefone("51999998889"));
  assert.notEqual(chaveTelefone("51999998888"), chaveTelefone("11999998888"));
});
test("formata para exibir", () => {
  assert.equal(formatarTelefone("51999998888"), "(51) 99999-8888");
  assert.equal(formatarTelefone("+555133334444"), "(51) 3333-4444");
});

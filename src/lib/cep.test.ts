import { test } from "node:test";
import assert from "node:assert/strict";
import { mascaraCep } from "./cep.ts";

test("máscara de CEP", () => {
  assert.equal(mascaraCep("90010000"), "90010-000");
  assert.equal(mascaraCep("90010-000"), "90010-000");
  assert.equal(mascaraCep("900"), "900");
  assert.equal(mascaraCep("90010-000999"), "90010-000");
});

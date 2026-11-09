import assert from "node:assert/strict";
import { generateKeyPairSync, createECDH } from "node:crypto";
import { test } from "node:test";
import { limparChavePrivada, limparChavePublica, problemasVapid } from "./vapid.ts";

function par() {
  const e = createECDH("prime256v1"); e.generateKeys();
  const u = (b: Buffer) => b.toString("base64url");
  return { pub: u(e.getPublicKey()), priv: u(e.getPrivateKey()) };
}
void generateKeyPairSync;

test("chaves limpas passam", () => {
  const { pub, priv } = par();
  assert.deepEqual(problemasVapid(pub, priv), []);
});
test("aceita aspas, nome da variável, quebra de linha e '=' no fim", () => {
  const { pub, priv } = par();
  for (const v of [`"${priv}"`, `VAPID_PRIVATE_KEY=${priv}`, `${priv}\n`, `${priv}=`, `Private Key:\n${priv}`, `VAPID_PRIVATE_KEY="${priv}"`, `  ${priv}  `]) {
    assert.equal(limparChavePrivada(v), priv, v);
    assert.deepEqual(problemasVapid(pub, v), [], v);
  }
  assert.equal(limparChavePublica(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pub}`), pub);
});
test("base64 comum vira base64 de URL", () => {
  const { priv } = par();
  assert.equal(limparChavePrivada(priv.replace(/-/g, "+").replace(/_/g, "/") + "="), priv);
});
test("chave de outro par é detectada", () => {
  const a = par(), b = par();
  assert.match(problemasVapid(a.pub, b.priv)[0], /não é par/);
});
test("faltando e tamanho errado", () => {
  assert.equal(problemasVapid(undefined, undefined).length, 2);
  assert.match(problemasVapid(par().pub, "curta")[0], /43/);
});

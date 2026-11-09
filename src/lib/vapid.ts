import { createECDH } from "node:crypto";

/**
 * Chaves VAPID chegam coladas de muitos jeitos: com aspas, com o nome da variável junto
 * ("VAPID_PRIVATE_KEY=abc…"), com "=" de preenchimento no fim, quebras de linha ou em base64 comum.
 * Procura dentro do texto o pedaço com o tamanho certo e o devolve em base64 "seguro para URL".
 */
export function limparChaveVapid(bruto: string | undefined, tamanho: 43 | 87): string {
  const urlSafe = (t: string) => t.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const partes = (bruto ?? "").split(/[\s"'`:]+|(?:^|[A-Z_]+)=(?=[A-Za-z0-9_+/-]{20,})/).map((p) => p.trim()).filter(Boolean);
  const candidatas = partes.flatMap((p) => p.split(/=+(?=[A-Za-z0-9_+/-])/)).map(urlSafe);
  return candidatas.find((c) => c.length === tamanho && /^[A-Za-z0-9_-]+$/.test(c)) ?? urlSafe((bruto ?? "").replace(/\s|["'`]/g, ""));
}

export const limparChavePublica = (v?: string) => limparChaveVapid(v, 87);
export const limparChavePrivada = (v?: string) => limparChaveVapid(v, 43);

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Problemas das chaves, em português e sem revelar nenhuma delas. Lista vazia: tudo certo. */
export function problemasVapid(publica?: string, privada?: string): string[] {
  const pub = limparChavePublica(publica), priv = limparChavePrivada(privada);
  const out: string[] = [];
  if (!pub) out.push("Falta a variável NEXT_PUBLIC_VAPID_PUBLIC_KEY na Vercel.");
  if (!priv) out.push("Falta a variável VAPID_PRIVATE_KEY na Vercel.");
  if (out.length) return out;
  if (!/^[A-Za-z0-9_-]{87}$/.test(pub)) out.push(`A chave pública tem ${pub.length} caracteres e deveria ter 87. Copie de novo a linha “Public Key” do npm run vapid.`);
  if (!/^[A-Za-z0-9_-]{43}$/.test(priv)) out.push(`A chave privada tem ${priv.length} caracteres e deveria ter 43. Copie de novo a linha “Private Key” do npm run vapid, sem o nome da variável.`);
  if (out.length) return out;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(b64(priv));
    if (!ecdh.getPublicKey().equals(b64(pub))) out.push("A chave privada não é par da chave pública. Use as duas do mesmo npm run vapid (rodar de novo gera outro par).");
  } catch {
    out.push("A chave privada não é válida. Gere um par novo com npm run vapid.");
  }
  return out;
}

"use server";

import webpush from "web-push";
import { exigirAdmin } from "@/lib/auth";

/** Gera um par novo de chaves de notificação. Nada é guardado: o administrador copia para a Vercel. */
export async function gerarChavesVapid(): Promise<{ publica: string; privada: string }> {
  await exigirAdmin();
  const k = webpush.generateVAPIDKeys();
  return { publica: k.publicKey, privada: k.privateKey };
}

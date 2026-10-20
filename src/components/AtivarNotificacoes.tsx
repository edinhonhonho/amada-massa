"use client";

import { useEffect, useState } from "react";
import { removerInscricao, salvarInscricao } from "@/app/membro/actions";
import { useInstalado } from "@/components/InstalarApp";

function chave(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Situacao = "carregando" | "sem_suporte" | "inativo" | "ativo" | "negado";

export default function AtivarNotificacoes({ publicKey }: { publicKey: string }) {
  const instalado = useInstalado();
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSituacao("sem_suporte");
      if (Notification.permission === "denied") return setSituacao("negado");
      try {
        const reg = await navigator.serviceWorker.ready;
        setSituacao((await reg.pushManager.getSubscription()) ? "ativo" : "inativo");
      } catch { setSituacao("sem_suporte"); }
    })();
  }, []);

  async function ativar() {
    setErro(null); setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setSituacao("negado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(publicKey) }));
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await salvarInscricao(j, navigator.userAgent);
      if (!r.ok) { setErro(r.erro ?? "Não foi possível salvar."); return; }
      setSituacao("ativo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally { setOcupado(false); }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removerInscricao(sub.endpoint); await sub.unsubscribe(); }
      setSituacao("inativo");
    } finally { setOcupado(false); }
  }

  if (!publicKey) return null;
  if (instalado === false) return null; // a tela mostra o passo de instalação
  return (
    <div className="cartao flex flex-col gap-2">
      {situacao === "ativo" ? (
        <>
          <p className="font-medium text-green-800">🔔 Avisos ativados neste aparelho</p>
          <button className="text-left text-sm underline" onClick={desativar} disabled={ocupado}>Desativar avisos</button>
        </>
      ) : situacao === "negado" ? (
        <p className="text-red-800">As notificações estão bloqueadas. Libere nas configurações do aparelho para este app.</p>
      ) : situacao === "sem_suporte" ? (
        <p className="text-stone-700">Este aparelho ou navegador não aceita avisos. Você ainda vê tudo aqui dentro do app.</p>
      ) : (
        <>
          <p>Ative os avisos para saber quando sua rota sair e quando seu pão chegar.</p>
          <button className="btn py-3" onClick={ativar} disabled={ocupado || situacao === "carregando"}>{ocupado ? "Ativando…" : "Ativar avisos"}</button>
        </>
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </div>
  );
}

"use client";

import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { removerInscricao, salvarInscricao, testarNotificacao } from "@/app/membro/actions";
import { useInstalado } from "@/components/InstalarApp";

function chave(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const base64Url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Situacao = "carregando" | "sem_suporte" | "inativo" | "ativo" | "negado";

/** Cartão com o interruptor das notificações deste aparelho. */
export default function AtivarNotificacoes({ publicKey }: { publicKey: string }) {
  const instalado = useInstalado();
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [testando, setTestando] = useState(false);

  /** Inscreve este aparelho com a chave atual e avisa o servidor. */
  async function inscrever(): Promise<{ ok: boolean; erro?: string }> {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(publicKey) }));
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    return salvarInscricao(j, navigator.userAgent);
  }

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSituacao("sem_suporte");
      if (Notification.permission === "denied") return setSituacao("negado");
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return setSituacao("inativo");
        const usada = sub.options?.applicationServerKey ? base64Url(sub.options.applicationServerKey) : null;
        if (publicKey && usada && usada !== publicKey) {
          // as chaves do clube mudaram: a inscrição antiga nunca mais recebe avisos, então renova sozinha
          await sub.unsubscribe();
          if (Notification.permission === "granted") {
            const r = await inscrever();
            return setSituacao(r.ok ? "ativo" : "inativo");
          }
          return setSituacao("inativo");
        }
        setSituacao("ativo");
        void inscrever(); // garante que o servidor tem esta inscrição (ela some quando é recusada)
      } catch { setSituacao("sem_suporte"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ativar() {
    setErro(null); setTeste(null); setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setSituacao("negado"); return; }
      const r = await inscrever();
      if (!r.ok) { setErro(r.erro ?? "Não foi possível salvar."); return; }
      setSituacao("ativo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally { setOcupado(false); }
  }

  async function desativar() {
    setOcupado(true); setTeste(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removerInscricao(sub.endpoint); await sub.unsubscribe(); }
      setSituacao("inativo");
    } finally { setOcupado(false); }
  }

  async function enviarTeste() {
    setTestando(true); setTeste(null);
    try { setTeste(await testarNotificacao()); } finally { setTestando(false); }
  }

  if (instalado === false) return null; // a tela mostra o passo de instalação
  const ligado = situacao === "ativo";
  const pode = situacao === "ativo" || situacao === "inativo";

  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_8px_28px_-14px_rgba(120,53,15,.4)]">
      <div className="flex items-center gap-3.5">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${ligado ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
          {ligado ? <BellRing size={22} /> : situacao === "negado" ? <BellOff size={22} /> : <Bell size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">Avisos no celular</h2>
          <p className="text-sm text-stone-500">
            {situacao === "carregando" ? "Verificando…" : ligado ? "Ligados neste aparelho" : situacao === "negado" ? "Bloqueados nas configurações" : situacao === "sem_suporte" ? "Indisponíveis neste aparelho" : "Desligados"}
          </p>
        </div>
        {situacao === "carregando" ? (
          <Loader2 size={20} className="animate-spin text-stone-300" />
        ) : (
          <button
            type="button" role="switch" aria-checked={ligado} aria-label="Avisos no celular" disabled={!pode || ocupado || !publicKey}
            onClick={ligado ? desativar : ativar}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${ligado ? "bg-emerald-500" : "bg-stone-300"}`}
          >
            <span className={`absolute left-0.5 top-0.5 flex size-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ${ligado ? "translate-x-6" : ""}`}>
              {ocupado && <Loader2 size={14} className="animate-spin text-stone-400" />}
            </span>
          </button>
        )}
      </div>

      {!publicKey && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Os avisos no celular ainda não foram liberados pelo clube. Você continua vendo tudo aqui dentro do app.</p>}
      {situacao === "negado" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">Libere as notificações do Amada Massa nas configurações do celular e volte aqui.</p>}
      {situacao === "sem_suporte" && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Este aparelho ou navegador não aceita notificações. Você ainda vê tudo aqui dentro do app. No iPhone, abra o app pelo ícone da tela de início (iOS 16.4 ou mais novo).</p>}
      {situacao === "inativo" && <p className="mt-3 text-sm text-stone-500">Ligue para saber na hora quando sua rota sair e seu pão chegar.</p>}
      {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{erro}</p>}

      {ligado && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <button type="button" onClick={enviarTeste} disabled={testando} className="flex items-center gap-2 text-sm font-medium text-amber-800 hover:underline disabled:opacity-60">
            {testando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Enviar uma notificação de teste
          </button>
          {teste && <p className={`mt-2 rounded-xl p-3 text-sm ${teste.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`} role="status">{teste.mensagem}</p>}
        </div>
      )}
    </section>
  );
}

"use client";

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { gerarChavesVapid } from "@/app/(app)/configuracoes/actions";

function Linha({ nome, valor }: { nome: string; valor: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="cartao-branco p-3">
      <div className="mb-1 flex items-center gap-2">
        <code className="text-xs font-semibold text-stone-700">{nome}</code>
        <span className="text-xs text-stone-400">{valor.length} caracteres</span>
        <button
          type="button" className="btn-sec btn-pequeno ml-auto"
          onClick={async () => { try { await navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 2000); } catch { window.prompt("Copie o valor:", valor); } }}
        >{ok ? <><Check size={14} className="text-emerald-600" />Copiado</> : <><Copy size={14} />Copiar valor</>}</button>
      </div>
      <p className="break-all font-mono text-xs text-stone-600">{valor}</p>
    </div>
  );
}

/** Gera as chaves VAPID na tela, com botões de copiar (evita o erro de copiar só um pedaço no terminal). */
export default function GeradorVapid({ problema }: { problema?: string }) {
  const [chaves, setChaves] = useState<{ publica: string; privada: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  return (
    <section className="cartao mt-6 max-w-2xl !p-6">
      <div className="cartao-titulo"><KeyRound size={16} className="text-amber-700" />Notificações no celular</div>
      <p className={`mb-4 rounded-xl p-3 text-sm ${problema ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
        {problema ?? "As chaves estão configuradas e combinam entre si."}
      </p>
      {!chaves ? (
        <button type="button" className="btn-sec" disabled={gerando} onClick={async () => { setGerando(true); try { setChaves(await gerarChavesVapid()); } finally { setGerando(false); } }}>
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}Gerar um par de chaves novo
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <Linha nome="NEXT_PUBLIC_VAPID_PUBLIC_KEY" valor={chaves.publica} />
          <Linha nome="VAPID_PRIVATE_KEY" valor={chaves.privada} />
          <ol className="list-decimal pl-5 text-sm text-stone-600">
            <li>Na Vercel, em <b>Settings → Environment Variables</b>, crie (ou edite) as duas variáveis acima. O valor é só o texto copiado, sem o nome e sem aspas.</li>
            <li>Faça um <b>Redeploy</b>.</li>
            <li>Quem já ligou os avisos precisa desligar e ligar de novo no app.</li>
          </ol>
          <p className="text-xs text-stone-500">Esta tela não guarda as chaves. Se gerar outro par, use as duas novas juntas: um par só funciona com a própria metade.</p>
        </div>
      )}
    </section>
  );
}

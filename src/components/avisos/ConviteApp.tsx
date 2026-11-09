"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Convite compacto: QR code pequeno, uma linha de instrução e atalhos para copiar ou compartilhar o link do app. */
export default function ConviteApp({ qr, link }: { qr: string; link: string }) {
  const [ok, setOk] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  useEffect(() => setPodeCompartilhar(typeof navigator.share === "function"), []);

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 2000); } catch { window.prompt("Copie o link:", link); }
  }

  return (
    <div className="flex items-center gap-3.5">
      <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(28,25,23,.07)] [&>svg]:block [&>svg]:size-[84px]" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code do aplicativo" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold leading-tight">Convide os clientes</h2>
        <p className="mt-0.5 text-xs leading-snug text-stone-500">Abrir o link, entrar com e-mail e telefone do cadastro e ligar os avisos.</p>
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={copiar} className="btn-sec btn-pequeno">{ok ? <><Check size={13} className="text-emerald-600" />Copiado</> : <><Copy size={13} />Copiar link</>}</button>
          {podeCompartilhar && <button type="button" onClick={() => void navigator.share({ title: "Amada Massa", text: "Entre no app do Clube do Pão para receber seus avisos:", url: link }).catch(() => {})} className="btn-sec btn-pequeno"><Share2 size={13} />Enviar</button>}
        </div>
      </div>
    </div>
  );
}

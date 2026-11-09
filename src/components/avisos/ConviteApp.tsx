"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Cartão de convite: QR code, passos e atalhos para copiar ou compartilhar o link do app. */
export default function ConviteApp({ qr, link }: { qr: string; link: string }) {
  const [ok, setOk] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  useEffect(() => setPodeCompartilhar(typeof navigator.share === "function"), []);

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 2000); } catch { window.prompt("Copie o link:", link); }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-5 text-white shadow-[0_22px_44px_-22px_rgba(146,64,14,.8)]">
      <i className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10" aria-hidden />
      <i className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/[0.07]" aria-hidden />
      <div className="relative">
        <h2 className="text-lg font-bold leading-tight">Convide os clientes para o app</h2>
        <p className="mt-0.5 text-sm text-amber-50/90">É por ele que os avisos chegam no celular.</p>

        <div className="mt-4 flex items-center gap-4">
          <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-lg [&>svg]:block [&>svg]:size-[132px]" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code do aplicativo" />
          <ol className="flex flex-col gap-2.5 text-[13px] leading-snug">
            {["Abrir o link no celular", "Entrar com e-mail e telefone do cadastro", "Instalar e ligar os avisos"].map((t, i) => (
              <li key={t} className="flex items-start gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">{i + 1}</span><span>{t}</span></li>
            ))}
          </ol>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={copiar} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-amber-900 shadow-md transition hover:bg-amber-50 active:scale-[.98]">
            {ok ? <><Check size={15} className="text-emerald-600" />Link copiado</> : <><Copy size={15} />Copiar link</>}
          </button>
          {podeCompartilhar && (
            <button type="button" onClick={() => void navigator.share({ title: "Amada Massa", text: "Entre no app do Clube do Pão para receber seus avisos:", url: link }).catch(() => {})} className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25 active:scale-[.98]"><Share2 size={15} />Compartilhar</button>
          )}
        </div>
        <p className="mt-2.5 truncate text-[11px] text-amber-100/80">{link}</p>
      </div>
    </section>
  );
}

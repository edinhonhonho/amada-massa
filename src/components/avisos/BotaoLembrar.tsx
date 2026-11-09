"use client";

import { BellRing, Check, Loader2, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { lembrarCobranca } from "@/app/(app)/mensagens/actions";

/** Sino da linha de cobrança: envia o lembrete pelo app, sem recarregar a tela. */
export default function BotaoLembrar({ cobrancaId, nome }: { cobrancaId: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  const [estado, setEstado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  return (
    <span className="relative inline-flex">
      <button
        type="button" disabled={pendente} title={estado?.mensagem ?? "Lembrar pelo app"} aria-label={`Lembrar ${nome} pelo app`}
        className={`btn-ghost !p-2 ${estado?.ok ? "!text-emerald-600" : estado ? "!text-red-600" : ""}`}
        onClick={() => iniciar(async () => {
          setEstado(await lembrarCobranca(cobrancaId).catch(() => ({ ok: false, mensagem: "Não foi possível enviar." })));
          setTimeout(() => setEstado(null), 4000);
        })}
      >
        {pendente ? <Loader2 size={17} className="animate-spin" /> : estado?.ok ? <Check size={17} /> : estado ? <TriangleAlert size={17} /> : <BellRing size={17} />}
      </button>
      {estado && <span role="status" className="pointer-events-none absolute -top-2 right-0 z-10 w-max max-w-56 -translate-y-full rounded-lg bg-stone-900 px-3 py-2 text-xs text-white shadow-xl [animation:entra_.2s_ease-out]">{estado.mensagem}</span>}
    </span>
  );
}

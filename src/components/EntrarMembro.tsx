"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { solicitarCodigo, verificarCodigo } from "@/app/membro/actions";

export default function EntrarMembro() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function pedir(ev?: React.FormEvent) {
    ev?.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await solicitarCodigo(email);
      if (r.ok) setEtapa("codigo"); else setErro(r.erro ?? "Erro.");
    });
  }
  function confirmar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await verificarCodigo(email, codigo);
      if (r.ok) router.replace("/membro"); else setErro(r.erro ?? "Erro.");
    });
  }

  return (
    <div className="cartao flex flex-col gap-4">
      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">{erro}</p>}
      {etapa === "email" ? (
        <form onSubmit={pedir} className="flex flex-col gap-3">
          <div>
            <label className="rotulo" htmlFor="email">Seu e-mail</label>
            <input className="campo" id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-sm text-stone-600">Use o e-mail que você informou ao assinar o clube.</p>
          </div>
          <button className="btn py-3 text-lg" disabled={pendente}>{pendente ? "Enviando…" : "Receber código"}</button>
        </form>
      ) : (
        <form onSubmit={confirmar} className="flex flex-col gap-3">
          <p>Se <b>{email}</b> estiver cadastrado, enviamos um código. Confira também o spam.</p>
          <div>
            <label className="rotulo" htmlFor="codigo">Código</label>
            <input className="campo text-center text-2xl tracking-widest" id="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
          <button className="btn py-3 text-lg" disabled={pendente}>{pendente ? "Verificando…" : "Entrar"}</button>
          <button type="button" className="text-sm underline" onClick={() => { setEtapa("email"); setCodigo(""); setErro(null); }}>Trocar e-mail</button>
          <button type="button" className="text-sm underline" onClick={() => pedir()}>Reenviar código</button>
        </form>
      )}
    </div>
  );
}

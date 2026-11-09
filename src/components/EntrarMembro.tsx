"use client";

import { Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { entrarNoApp } from "@/app/membro/actions";

/** Máscara (51) 99999-8888 enquanto digita; aceita colar com +55. */
function mascara(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function EntrarMembro() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await entrarNoApp(email, telefone);
      if (r.ok) router.replace("/membro");
      else setErro(r.erro ?? "Não foi possível entrar.");
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_20px_50px_-20px_rgba(120,53,15,.35)]">
      {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{erro}</p>}
      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <div className="relative">
          <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="campo !pl-10" id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="rotulo" htmlFor="telefone">Telefone</label>
        <div className="relative">
          <Phone size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="campo !pl-10" id="telefone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="(51) 99999-8888" value={telefone} onChange={(e) => setTelefone(mascara(e.target.value))} />
        </div>
        <p className="ajuda">Os mesmos dados que você informou ao assinar o clube.</p>
      </div>
      <button className="btn !rounded-2xl !py-3.5 text-base" disabled={pendente}>{pendente ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

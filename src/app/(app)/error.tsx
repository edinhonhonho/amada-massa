"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/** Se uma tela falhar (banco fora do ar, dado inesperado), mostra algo útil em vez de uma página em branco. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><TriangleAlert size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">Não foi possível abrir esta tela</h1>
      <p className="text-sm text-stone-600">
        Pode ser uma falha passageira de conexão com o banco de dados. Tente de novo; se continuar, confira se as migrações do Supabase foram executadas em ordem.
      </p>
      {error.digest && <p className="text-xs text-stone-400">Código do erro: {error.digest}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="btn"><RotateCw size={15} />Tentar de novo</button>
        <Link href="/semana" className="btn-sec">Ir para Esta semana</Link>
      </div>
    </div>
  );
}

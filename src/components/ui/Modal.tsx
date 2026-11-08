"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

type Props = {
  titulo: string;
  descricao?: string;
  /** Conteúdo do botão que abre o modal. */
  gatilho: ReactNode;
  gatilhoClasse?: string;
  largo?: boolean;
  children: ReactNode;
};

/**
 * Janela modal com <dialog> nativo: foco preso, Esc fecha, clique fora fecha.
 * Formulários com server action dentro dela fecham o modal ao enviar.
 */
export default function Modal({ titulo, descricao, gatilho, gatilhoClasse = "btn-sec", largo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={gatilhoClasse} onClick={() => ref.current?.showModal()}>{gatilho}</button>
      <dialog
        ref={ref}
        className={`modal ${largo ? "modal-largo" : ""}`}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        onSubmit={() => setTimeout(() => ref.current?.close(), 0)}
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start gap-3 border-b border-stone-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
              {descricao && <p className="mt-0.5 text-sm text-stone-500">{descricao}</p>}
            </div>
            <button type="button" tabIndex={-1} onClick={() => ref.current?.close()} className="btn-ghost -mr-2 !p-1.5" aria-label="Fechar">
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </dialog>
    </>
  );
}

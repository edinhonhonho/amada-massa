"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Botão de envio que mostra "carregando" enquanto a server action roda. */
export default function SubmitButton({
  children, className = "btn", name, value, formNoValidate,
}: { children: ReactNode; className?: string; name?: string; value?: string; formNoValidate?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} name={name} value={value} formNoValidate={formNoValidate}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

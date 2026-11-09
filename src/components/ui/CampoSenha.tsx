"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Campo de senha com botão para mostrar ou esconder o que foi digitado. */
export default function CampoSenha({
  id, name, autoComplete = "current-password", required = true, minLength, placeholder,
}: { id: string; name: string; autoComplete?: string; required?: boolean; minLength?: number; placeholder?: string }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input
        className="campo !pr-11" id={id} name={name} type={visivel ? "text" : "password"}
        autoComplete={autoComplete} required={required} minLength={minLength} placeholder={placeholder}
      />
      <button
        type="button" onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"} aria-pressed={visivel}
        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        {visivel ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

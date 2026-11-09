"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CopiarLink({ link }: { link: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button" className="btn-sec mt-3 w-full"
      onClick={async () => {
        try { await navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 2000); } catch { window.prompt("Copie o link:", link); }
      }}
    >
      {ok ? <><Check size={16} className="text-emerald-600" />Link copiado</> : <><Copy size={16} />Copiar link do app</>}
    </button>
  );
}

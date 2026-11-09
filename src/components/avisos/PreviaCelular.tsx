/** Como o aviso aparece na tela bloqueada do celular. */
export default function PreviaCelular({ titulo, corpo }: { titulo: string; corpo: string }) {
  const hora = "09:41";
  return (
    <div className="sticky top-6">
      <div className="mb-2 text-center text-xs font-medium text-stone-400">Prévia no celular</div>
      <div className="mx-auto w-[260px] rounded-[2.2rem] bg-stone-900 p-2 shadow-[0_24px_50px_-18px_rgba(28,25,23,.55)]">
        <div className="relative h-[430px] overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-amber-200 via-amber-100 to-stone-100">
          <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-stone-900" />
          <div className="mt-12 text-center text-stone-800">
            <div className="text-5xl font-light tracking-tight">{hora}</div>
            <div className="mt-1 text-xs text-stone-600">segunda-feira</div>
          </div>
          <div className="mx-3 mt-8 rounded-2xl bg-white/85 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-[11px] text-stone-500">
              <span className="flex size-4 items-center justify-center rounded bg-amber-700 text-[9px] font-bold text-white">A</span>
              <span className="font-medium uppercase tracking-wide">Amada Massa</span>
              <span className="ml-auto">agora</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-stone-900">{titulo || "Título do aviso"}</div>
            <div className="mt-0.5 line-clamp-5 text-[12px] leading-snug text-stone-700">{corpo || "O texto aparece aqui enquanto você escreve."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

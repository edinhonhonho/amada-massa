/** Marca do app: pão estilizado sobre o âmbar da marca. */
export default function LogoApp({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-800 text-white shadow-[0_8px_20px_-6px_rgba(146,64,14,.6)]"
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.28 }}
      aria-hidden
    >
      <svg width={tamanho * 0.58} height={tamanho * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12c0-3.3 3.6-6 8-6s8 2.7 8 6c0 1.2-.6 2.2-1.5 3V18a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18v-3C4.6 14.2 4 13.2 4 12Z" />
        <path d="M9 10.5 8 13M12.5 10l-1 3M16 10.5 15 13" />
      </svg>
    </span>
  );
}

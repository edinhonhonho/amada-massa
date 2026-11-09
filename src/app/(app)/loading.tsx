/** Esqueleto mostrado na hora, enquanto a próxima tela carrega no servidor. */
export default function Carregando() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="mb-2 h-7 w-56 rounded-lg bg-stone-200/80" />
      <div className="mb-7 h-4 w-96 max-w-full rounded bg-stone-200/60" />
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-stone-200/50" />)}
      </div>
      <div className="h-72 rounded-2xl bg-stone-200/40" />
    </div>
  );
}

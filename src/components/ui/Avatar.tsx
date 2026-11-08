const CORES = ["bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-orange-100 text-orange-800"];

export default function Avatar({ nome, tamanho = 36 }: { nome: string; tamanho?: number }) {
  const partes = nome.trim().split(/\s+/);
  const iniciais = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${CORES[h % CORES.length]}`}
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}>
      {iniciais}
    </span>
  );
}

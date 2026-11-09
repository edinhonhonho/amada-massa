"use client";

/** Atalhos para marcar de uma vez os clientes de um bairro dentro de um formulário. */
export default function ChipsBairro({ formId, bairros }: { formId: string; bairros: { nome: string; n: number }[] }) {
  function alternar(nome: string | null) {
    const form = document.getElementById(formId);
    if (!form) return;
    const caixas = [...form.querySelectorAll<HTMLInputElement>('input[name="entrega_id"]')];
    const alvo = nome === null ? caixas : caixas.filter((c) => c.dataset.bairro === nome);
    const todas = alvo.every((c) => c.checked);
    alvo.forEach((c) => { c.checked = !todas; });
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-stone-500">Marcar:</span>
      <button type="button" className="selo selo-cinza cursor-pointer hover:bg-stone-200" onClick={() => alternar(null)}>todos</button>
      {bairros.map((b) => (
        <button key={b.nome} type="button" className="selo selo-ambar cursor-pointer hover:bg-amber-100" onClick={() => alternar(b.nome)}>{b.nome} · {b.n}</button>
      ))}
    </div>
  );
}

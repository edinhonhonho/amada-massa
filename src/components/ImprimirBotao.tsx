"use client";

export default function ImprimirBotao() {
  return <button type="button" className="btn nao-imprimir" onClick={() => window.print()}>Imprimir</button>;
}

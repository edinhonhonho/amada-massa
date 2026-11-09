export type Janela = { dia: number; abre: string; fecha: string };

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Ordem de exibição: segunda a domingo. */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

const hora = (t: string) => {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

export function janelaValida(j: Janela): boolean {
  return Number.isInteger(j.dia) && j.dia >= 0 && j.dia <= 6 && /^\d{2}:\d{2}$/.test(j.abre) && /^\d{2}:\d{2}$/.test(j.fecha) && j.abre < j.fecha;
}

/** "Ter 11h–14h e 16h30–18h30; Qua 11h–18h30" */
export function resumoHorarios(horarios: Janela[]): string {
  return ORDEM_DIAS.map((d) => {
    const js = horarios.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
    return js.length ? `${DIAS_CURTO[d]} ${js.map((j) => `${hora(j.abre)}–${hora(j.fecha)}`).join(" e ")}` : null;
  }).filter(Boolean).join("; ");
}

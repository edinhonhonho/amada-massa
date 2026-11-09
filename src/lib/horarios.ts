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

/**
 * Agrupa dias com o mesmo horário: [{ dias: "Seg a Qua", horas: "11h–14h e 16h30–18h30" }, ...].
 * Dias consecutivos viram "Seg a Qua"; de dois em dois, "Ter e Qui"; senão, separados por vírgula.
 */
export function agruparHorarios(horarios: Janela[]): { dias: string; horas: string }[] {
  const porHora = new Map<string, number[]>();
  for (const d of ORDEM_DIAS) {
    const js = horarios.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
    if (!js.length) continue;
    const h = js.map((j) => `${hora(j.abre)}–${hora(j.fecha)}`).join(" e ");
    (porHora.get(h) ?? porHora.set(h, []).get(h)!).push(d);
  }
  return [...porHora.entries()].map(([horas, dias]) => {
    const pos = dias.map((d) => ORDEM_DIAS.indexOf(d));
    const seguidos = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1);
    const nome = (d: number) => DIAS_CURTO[d];
    const txt = dias.length === 1 ? nome(dias[0]) : dias.length === 2 ? `${nome(dias[0])} e ${nome(dias[1])}` : seguidos ? `${nome(dias[0])} a ${nome(dias[dias.length - 1])}` : dias.map(nome).join(", ");
    return { dias: txt, horas };
  });
}

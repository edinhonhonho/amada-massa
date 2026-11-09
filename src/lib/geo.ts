export type Ponto = { lat: number; lng: number };

const R = 6371000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em metros entre dois pontos (linha reta sobre a esfera). */
export function distancia(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function comprimento(pontos: Ponto[]): number {
  let t = 0;
  for (let i = 1; i < pontos.length; i++) t += distancia(pontos[i - 1], pontos[i]);
  return t;
}

/**
 * Ordem de visita a partir de `origem` (sem voltar): vizinho mais próximo, refinado por 2-opt.
 * Devolve os índices de `paradas` na ordem sugerida. Bom o bastante para rotas de poucas dezenas de paradas.
 */
export function ordenarParadas(origem: Ponto, paradas: Ponto[]): number[] {
  const n = paradas.length;
  const livre = new Set(paradas.map((_, i) => i));
  const ordem: number[] = [];
  let atual = origem;
  while (livre.size) {
    let melhor = -1, md = Infinity;
    for (const i of livre) { const d = distancia(atual, paradas[i]); if (d < md) { md = d; melhor = i; } }
    ordem.push(melhor); livre.delete(melhor); atual = paradas[melhor];
  }
  const custo = (o: number[]) => comprimento([origem, ...o.map((i) => paradas[i])]);
  let melhorou = n > 3;
  while (melhorou) {
    melhorou = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const nova = [...ordem.slice(0, i), ...ordem.slice(i, j + 1).reverse(), ...ordem.slice(j + 1)];
        if (custo(nova) + 1e-6 < custo(ordem)) { ordem.splice(0, n, ...nova); melhorou = true; }
      }
    }
  }
  return ordem;
}

/**
 * Link do Google Maps para navegar por até 10 paradas (limite do Maps: 9 pontos intermediários).
 * Sem origem, o Maps usa a localização atual de quem abre.
 */
export function linkGoogleMaps(paradas: (Ponto | string)[], origem?: Ponto): string | null {
  if (!paradas.length) return null;
  const txt = (p: Ponto | string) => (typeof p === "string" ? p : `${p.lat},${p.lng}`);
  const lote = paradas.slice(0, 10);
  const destino = lote[lote.length - 1];
  const meio = lote.slice(0, -1);
  const q = new URLSearchParams({ api: "1", destination: txt(destino), travelmode: "bicycling" });
  if (origem) q.set("origin", txt(origem));
  if (meio.length) q.set("waypoints", meio.map(txt).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

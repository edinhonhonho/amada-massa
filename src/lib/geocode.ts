import { distancia, type Ponto } from "./geo";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function buscar(url: string): Promise<Ponto | null> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat: string; lon: string }[];
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  } catch {
    return null;
  }
}

export type Endereco = { logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; cep?: string | null };

/**
 * Converte um endereço em coordenadas (OpenStreetMap/Nominatim, gratuito, até 1 consulta por segundo).
 * Tenta rua + número, depois rua sem número, depois só o CEP.
 */
export async function geocodificar(e: Endereco): Promise<Ponto | null> {
  const base = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR";
  const cidade = e.cidade || "Porto Alegre";
  const rua = (e.logradouro ?? "").trim();
  const tentativas: string[] = [];
  if (rua) {
    tentativas.push(`${base}&street=${encodeURIComponent(`${e.numero ? e.numero + " " : ""}${rua}`)}&city=${encodeURIComponent(cidade)}`);
    tentativas.push(`${base}&q=${encodeURIComponent(`${rua} ${e.numero ?? ""}, ${e.bairro ?? ""}, ${cidade}, Brasil`)}`);
    if (e.numero) tentativas.push(`${base}&street=${encodeURIComponent(rua)}&city=${encodeURIComponent(cidade)}`);
  }
  const cep = (e.cep ?? "").replace(/\D/g, "");
  if (cep.length === 8) tentativas.push(`${base}&postalcode=${cep.slice(0, 5)}-${cep.slice(5)}&country=Brasil`);

  for (const url of tentativas) {
    const p = await buscar(url);
    await sleep(1100); // política de uso do Nominatim: no máximo 1 consulta por segundo
    if (p) return p;
  }
  return null;
}

export type Trajeto = { pontos: [number, number][]; distancia_m: number; duracao_s: number | null; aproximado: boolean };

/**
 * Traça o caminho de bicicleta passando pelas paradas na ordem dada (serviço gratuito do OpenStreetMap).
 * Se o serviço falhar, devolve linhas retas entre as paradas (marcado como aproximado).
 */
export async function tracarTrajeto(paradas: Ponto[]): Promise<Trajeto> {
  const reta = (): Trajeto => ({
    pontos: paradas.map((p) => [p.lat, p.lng]),
    distancia_m: Math.round(paradas.slice(1).reduce((t, p, i) => t + distancia(paradas[i], p), 0)),
    duracao_s: null,
    aproximado: true,
  });
  if (paradas.length < 2) return reta();
  try {
    const coords = paradas.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const r = await fetch(`https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!r.ok) return reta();
    const j = (await r.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
    const rota = j.routes?.[0];
    if (!rota) return reta();
    return {
      pontos: rota.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distancia_m: Math.round(rota.distance),
      duracao_s: Math.round(rota.duration),
      aproximado: false,
    };
  } catch {
    return reta();
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { comprimento, distancia, linkGoogleMaps, ordenarParadas } from "./geo.ts";

test("distância conhecida: 1° de latitude ≈ 111 km", () => {
  const d = distancia({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(d - 111195) < 200, String(d));
});

test("ordena do mais perto ao mais longe numa linha reta", () => {
  const origem = { lat: 0, lng: 0 };
  const paradas = [{ lat: 0, lng: 3 }, { lat: 0, lng: 1 }, { lat: 0, lng: 2 }];
  assert.deepEqual(ordenarParadas(origem, paradas), [1, 2, 0]);
});

test("2-opt não piora o caminho do vizinho mais próximo", () => {
  const origem = { lat: 0, lng: 0 };
  const paradas = [{ lat: 0, lng: 5 }, { lat: 4, lng: 1 }, { lat: 1, lng: 4 }, { lat: 5, lng: 5 }, { lat: 2, lng: 2 }, { lat: 3, lng: 0 }];
  const o = ordenarParadas(origem, paradas);
  assert.equal(new Set(o).size, paradas.length);
  const ingenuo = comprimento([origem, ...paradas]);
  assert.ok(comprimento([origem, ...o.map((i) => paradas[i])]) <= ingenuo);
});

test("link do Google Maps: destino, paradas intermediárias e limite de 10", () => {
  const ps = Array.from({ length: 12 }, (_, i) => ({ lat: -30 + i / 100, lng: -51 }));
  const url = new URL(linkGoogleMaps(ps)!);
  assert.equal(url.searchParams.get("destination"), "-29.91,-51");
  assert.equal(url.searchParams.get("waypoints")!.split("|").length, 9);
  assert.equal(url.searchParams.get("travelmode"), "bicycling");
  assert.equal(linkGoogleMaps([]), null);
});

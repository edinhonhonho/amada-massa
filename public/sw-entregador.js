// App do entregador: abre sem sinal. Guarda o código do app e a última tela de rota aberta.
const CACHE = "entregador-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("entregador")).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; })),
    );
    return;
  }
  // Tela da rota: rede primeiro, última versão guardada se estiver sem sinal.
  if (req.mode === "navigate" && url.pathname === "/entregador") {
    e.respondWith(
      fetch(req).then((r) => { if (r.ok && !r.redirected) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
  }
});

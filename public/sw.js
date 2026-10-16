// Service worker mínimo: abre a tela do entregador sem sinal.
const CACHE = "entregas-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Código estático: cache primeiro.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; })),
    );
    return;
  }
  // Só a tela de entregas é guardada para uso offline: rede primeiro, cache se falhar.
  if (req.mode === "navigate" && url.pathname === "/entregas") {
    e.respondWith(
      fetch(req).then((r) => { if (r.ok && !r.redirected) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
  }
});

// App do membro: recebe e mostra as notificações push.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { dados = { title: "Amada Massa", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    (async () => {
      // mostrar o aviso vem primeiro: o contador no ícone é só um complemento
      await self.registration.showNotification(dados.title || "Amada Massa", {
        body: dados.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: dados.tag || undefined,
        renotify: !!dados.tag,
        data: { url: dados.url || "/membro" },
      });
      try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (e) { /* sem suporte */ }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/membro";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) if (c.url.includes("/membro") && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});

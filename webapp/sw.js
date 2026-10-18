// webapp/sw.js — Service worker del app-shell (PWA instalable, #epic-download-web-like-app-from-browser).
// Estrategia: el HTML va NETWORK-PRIMERO (una release nueva llega al refrescar; el caché es
// sólo el respaldo sin conexión) y los assets cache-primero con red para lo nuevo. Bug del
// 2026-10-19: sí servimos los cambios, pero la PWA del iPhone seguía mostrando el shell
// ANTERIOR porque el índice salía del caché y el sw.js del navegador pasaba por la caché HTTP
// de GitHub Pages (max-age 600): el update se detectaba tarde. Ahora (a) v2 invalida el shell
// viejo al activarse y (b) el índice pide red primero, así que el refresco ve los fixes YA.
// PERO: para recibir el fetch handler el contexto debe ser SEGURO (https:// o localhost/127.0.0.1);
// el registro en file:// no existe (ver guard en index.html) y aquí no hay nada que hacer.
const CACHE = "mrcheff-v2";                       // +1 al tocar ficheros del shell para refrescar a los ya instalados

const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "logo.png",
  "manifest.webmanifest",
  "data/data.js",
  "data/recetas-espanolas-data.js",
  "modules/priority.js",
  "modules/classify.js",
  "modules/recipe-analysis.js",
  "modules/origen-recetas.js",
  "modules/innovations.js",
  "modules/util.js",
  "modules/backup.js",
  "modules/ingredient-matching.js",
  "modules/busqueda-recetas.js",
  "modules/planner.js",
  "modules/menu-semanal.js",
  "modules/recipe-missing.js",
  "modules/recipe-editor.js",
  "modules/swipe-tabs.js",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                               // sólo lectura: la app no tiene escritura en red
  if (!req.url.startsWith(self.location.origin)) return;          // fuera de scope (analytics no hay; por si acaso)
  const navega = req.mode === "navigate" || req.destination === "document";
  if (navega) {
    // Índice NETWORK-PRIMERO: la release nueva llega AL REFRESCAR (el caché es el respaldo
    // offline, no la primera opción). Sin red: cae al shell cacheado y la app sigue viva.
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }
  // Assets (módulos, css, iconos): cache-primero con red para lo nuevo y popular en caliente.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit ||
      fetch(req).then(res => {
        if (res.ok) {                                             // popular el caché en caliente (lo no precacheado)
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit)
    )
  );
});

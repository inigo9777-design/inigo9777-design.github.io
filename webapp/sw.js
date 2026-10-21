// webapp/sw.js — Service worker del app-shell (PWA instalable).
// Estrategia de ENTREGA (fix 2026-10-19 del bug "la release no llega a la PWA"): TODO va
// NETWORK-FIRST con revalidación forzada y el caché es sólo el respaldo SIN CONEXIÓN:
//   • fetch(req, { cache: "no-cache" }) — el navegador revalida contra el servidor
//     (fichero sin cambios: 304 barato; con cambios: 200 con los bytes nuevos).
//   • Sin conexión: cae al caché y la app sigue viva; en cada acierto de red el caché se
//     repuebla, así que el respaldo nunca queda una release atrás del público.
// Por qué el cache-primero de assets era el bug: con el sw.js byte-idéntico entre releases
// el navegador NO re-instala el worker, el install (addAll) no se repite y el caché servía
// los ficheros de la PRIMERA instalación para siempre — el índice llegaba fresco pero todos
// los css/js/módulos salían viejos. Ni siquiera con "?v=N" en las URLs: el matcher del
// caché ignoraba la query (ignoreSearch). Ahora lo nuevo SIEMPRE viene de la red cuando
// hay conexión; el número del caché sólo ronda el shell (SHELL) y su estrategia, no la
// frescura de cada release.
// CACHE v4 (2026-10-19, feature sync-buzón): los 3 módulos nuevos del sync entran al shell
// precacheado (sync-crypto/diff-merge/sync); el nombre SUBE +1 para forzar la re-instalación
// del worker aunque el fichero byte-idéntico y el respaldo offline ya los traiga.
// CACHE v5 (2026-10-20, tutorial interactivo): entra modules/tutorial.js al shell.
// CACHE v6 (2026-10-21, botón flotante "subir encima"): entra modules/scroll-arriba.js al shell.
const CACHE = "mrcheff-v6";

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
  "modules/scroll-arriba.js",
  "modules/tutorial.js",
  "modules/sync-crypto.js",
  "modules/diff-merge.js",
  "modules/sync.js",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then(nombres => Promise.all(nombres.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                               // sólo lectura: la app no tiene escritura en red
  if (!req.url.startsWith(self.location.origin)) return;          // fuera de scope (analytics no hay; por si acaso)
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then(res => {               // siempre por red, revalidada
      if (res.ok) {                                               // sube la copia fresca al respaldo offline
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;                                                 // un 404 es honesto: no lo tapa el caché viejo
    }).catch(() => caches.match(req, { ignoreSearch: true })      // sin conexión: el respaldo del caché
                       .then(hit => hit || Response.error()))
  );
});

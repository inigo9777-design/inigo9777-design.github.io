// e2e/pwa-instalable.mjs — Verificación de la PWA instalable con Brave REAL.
// Ejecutar:   node e2e/pwa-instalable.mjs    (el propio script levanta el servidor http de localhost)
//
// ══════════════ CÓMO PROBAR EL "INSTALAR APP" EN EL MUNDO REAL (2 opciones) ══════════════
// La opción ⋮ → "Instalar aplicación" del navegador SÓLO aparece si la app se sirve por
// https:// (o localhost en escritorio). Con file:// NUNCA aparece: no es cosa del código.
//
//   OPCIÓN A — permanente (recomendada): alojarla en https gratis
//     1. Subir el CONTENIDO de webapp/ a GitHub Pages (Settings → Pages) o arrastrar la
//        carpeta a Netlify Drop (https://app.netlify.com/drop). Cero configuración, https automático.
//     2. En el MÓVIL (misma cuenta nada que instalar): abrir esa URL en Brave/Chrome.
//     3. Menú ⋮ → "Instalar aplicación" (Android) / Safari → Compartir → "Añadir a pantalla
//        de inicio" (iPhone). La app abre a pantalla completa con icono de Mr Cheff.
//
//   OPCIÓN B — red local (LAN, sin subir nada):
//     1. En el Mac:   cd webapp && python3 -m http.server 8000
//        (o cualquier servidor estático; el que arrastra este propio script usa el mismo principio)
//     2. En el MAC (localhost SÍ es contexto seguro): http://localhost:8000 → Brave ⋮ →
//        "Guardar y compartir" → "Instalar página como aplicación…" — ya hoy.
//     3. En el MÓVIL con http://<IP-del-Mac>:8000: ojo — http a una IP de LAN NO es contexto
//        seguro, Android no registra el service worker y Brave puede no ofrecer "Instalar"
//        (a lo sumo "Añadir a pantalla de inicio" como atajo). Para probar el flujo completo
//        en un móvil real usar la OPCIÓN A. Chrome de escritorio tiene el flag
//        UnsafelyTreatInsecureOriginAsSecure si insistes con la IP, pero no es lo natural.
//
// Lo que este script automatiza (equivalente a los requisitos de instalabilidad):
//   (1) manifest servido y bien compuesto (campos, iconos, standalone), (2) service worker activo,
//   (3) precache del app-shell completo, (4) la app sigue viva SIN conexión (reload offline),
//   (5) iconos 192/512 accesibles. Captura en reports/ui-brave/22-*.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));  // webapp/
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".json": "application/json"
};

// Servidor estático mínimo: aquí HTTP a 127.0.0.1 es CONTEXTO SEGURO (como localhost) y el
// service worker registra sin trucos. Es exactamente la OPCIÓN B, pasos para el Mac.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  let file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ) || !existsSync(file) || !file.includes(".")) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const PUERTO = server.address().port;
const APP = `http://127.0.0.1:${PUERTO}/index.html`;
console.log("(servidor local de pruebas en " + APP + " — mimic OPCIÓN B)");

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");

  // (1) manifest en el <head> y bien compuesto
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    const j = await (await fetch(link.href)).json();
    return j;
  });
  ok(!!manifest, "(1) <link rel=manifest> presente y descargable");
  ok(manifest?.name?.includes("Mr Cheff") && manifest?.display === "standalone", "(1) manifest: nombre + display standalone");
  ok(manifest?.icons?.some(i => parseInt(i.sizes) >= 192), "(1) manifest: icono ≥192px");

  // (2) service worker REGISTRADO y ACTIVO (requisito de instalabilidad en Android)
  await page.waitForFunction(async () => {
    if (!navigator.serviceWorker.controller) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  }, { timeout: 15000 });
  const swEstado = await page.evaluate(async () => (await navigator.serviceWorker.ready).active.state);
  ok(swEstado === "activated", "(2) service worker ACTIVADO (estado: " + swEstado + ")");

  // (3) app-shell precacheado COMPLETO (offline…)
  const cacheado = await page.evaluate(async () => {
    const nombres = await caches.keys();
    const cache = await caches.open(nombres[0]);
    const claves = (await cache.keys()).map(k => new URL(k.url).pathname);
    return {
      cache: nombres[0],
      claves,
      núcleo: ["index.html", "app.js", "style.css", "logo.png"].every(p => claves.some(k => k.includes(p))),
      modulos: claves.filter(k => k.includes("/modules/")).length,
      iconos: claves.filter(k => k.includes("/icons/")).length,
    };
  });
  ok(cacheado.núcleo, `(3) cache '${cacheado.cache}' con el núcleo (index/app/style/logo)`);
  ok(cacheado.modulos >= 13, `(3) 13 módulos puros precacheados (hay ${cacheado.modulos})`);
  ok(cacheado.iconos >= 2, `(3) iconos 192/512 precacheados (hay ${cacheado.iconos})`);

  // (4) OFFLINE: cortar la red y recargar — la app DESDE el cache sigue viva (aseña=0 pérdida)
  try {
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector(".topbar .tab", { timeout: 10000 });
    const vivOffline = await page.evaluate(() => document.title.includes("Mr Cheff"));
    ok(vivOffline, "(4) recarga SIN conexión: la app sigue viva desde el caché");
    await ctx.setOffline(false);
  } catch (e) {
    ok(false, "(4) offline no verificable en este Brave headless: " + e.message.split("\n")[0]);
  }

  // (5) captura para el informe
  await page.screenshot({ path: path.join(OUT_DIR, "22-pwa-servida-localhost.png"), fullPage: false });

  // (extra) apple-touch-icon para el "Añadir a pantalla de inicio" de iPhone
  const apple = await page.evaluate(() => !!document.querySelector('link[rel="apple-touch-icon"]'));
  ok(apple, "(extra) apple-touch-icon presente (iOS Safari)");

  if (fallos) throw new Error(fallos + " comprobaciones PWA fallidas");
  console.log("\nPWA OK — en https (OPCIÓN A) el ⋮ → 'Instalar aplicación' será un hecho.");
  console.log("Captura: reports/ui-brave/22-pwa-servida-localhost.png");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

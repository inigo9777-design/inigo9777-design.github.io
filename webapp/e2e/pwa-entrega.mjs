// e2e/pwa-entrega.mjs — LA ENTREGA al PWA: un asset cambiado en el "servidor" se ve con
// un reload normal. Libera definitivamente el bug del 2026-10-19 (assets cache-primero +
// sw.js byte-idéntico entre releases = shell viejo en la PWA hasta el ritual manual "+1").
// Ejecutar:   node e2e/pwa-entrega.mjs    (el propio script levanta el servidor de localhost)
// Comprobaciones:
//   (1) El worker está activo, con el caché MrCheff (mrcheff-v3) y data.js precacheado.
//   (2) Cambia data.js EN EL SERVIDOR (release v2) → un reload normal la ve (red sobre caché).
//   (3) El respaldo OFFLINE del caché se ha repoblado con la copia nueva (cache.put del acierto).
//   (4) OFFLINE real (servidor cerrado): la app abre con la release NUEVA desde el caché.
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

// data/data.js mutable EN MEMORIA: el test la reescribe entre cargas como un deploy nuevo.
// (leer el fichero en cada petición mataría el experimento: la gracia es falsificar 2 releases).
const dataOriginal = readFileSync(path.join(RAIZ, "data", "data.js"), "utf8");
let dataServida = dataOriginal;

// Servidor estático mínimo (mismo principio que e2e/pwa-instalable.mjs) con /data/data.js mutable.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  if (url === "/data/data.js") {                                  // la pieza mutable del experimento
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    return res.end(dataServida);
  }
  const file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ) || !existsSync(file) || !file.includes(".")) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;
console.log("(servidor local de pruebas en " + APP + ")");

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
  await page.waitForFunction(async () => {
    if (!navigator.serviceWorker.controller) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  }, { timeout: 15000 });

  // (1) worker activo y shell precacheado
  const estado = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const nombres = await caches.keys();
    const cacheN = await caches.open(nombres[0]);
    const claves = (await cacheN.keys()).map(k => new URL(k.url).pathname);
    return {
      estado: reg.active.state,
      cache: nombres[0],
      dataEnCache: claves.some(k => k.endsWith("/data.js"))
    };
  });
  ok(estado.estado === "activated", "(1) service worker ACTIVADO");
  ok(estado.cache.startsWith("mrcheff-v"), "(1) caché del shell '" + estado.cache + "'");
  ok(estado.dataEnCache, "(1) data.js precacheado (release v1)");

  // (2) DEPLOY en caliente: en el "servidor" muere la v1 y nace la v2 → un reload la ve
  const MARCADOR = 'window.__mrcheffRelease = "v2";';
  dataServida = dataOriginal + "\n" + MARCADOR + " // marcador e2e\n";
  await page.reload();
  await page.waitForSelector(".topbar .tab");
  const vista = await page.evaluate(() => window.__mrcheffRelease);
  ok(vista === "v2", "(2) asset cambió en el servidor y un RELOAD sencillo lo ve (red sobre caché)");
  await page.screenshot({ path: path.join(OUT_DIR, "30-pwa-entrega.png"), fullPage: false });

  // (3) el respaldo offline del caché quedó repoblado con la copia nueva
  const respaldo = await page.evaluate(async (marcador) => {
    const res = await caches.match("/data/data.js", { ignoreSearch: true });
    const texto = res ? await res.text() : "";
    return { nuevo: texto.includes(marcador), bytes: texto.length };
  }, MARCADOR);
  ok(respaldo.nuevo, "(3) respaldo offline del caché repoblado con la release v2");

  // (4) OFFLINE de verdad: cerramos el servidor (ni red ni parodia de red) y la app debe
  // abrir con la release NUEVA servida por el caché respaldo.
  if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await ctx.setOffline(true);
  try {
    await page.reload();
    await page.waitForSelector(".topbar .tab", { timeout: 10000 });
    const vivOffline = await page.evaluate(() => window.__mrcheffRelease);
    ok(vivOffline === "v2", "(4) sin conexión: la app abre viva y con la release NUEVA del caché");
  } catch (e) {
    ok(false, "(4) offline no verificable en este Brave headless: " + e.message.split("\n")[0]);
  }

  if (fallos) throw new Error(fallos + " comprobaciones de entrega fallidas");
  console.log("\nENTREGA OK — la release nueva llega a la PWA al refrescar, con el respaldo");
  console.log("offline repoblado. Captura: reports/ui-brave/30-pwa-entrega.png");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

// e2e/dialogos-movil-reticula.mjs — GUARDIA del bugfix 2026-10-23 (móvil/PWA 390×844, Brave real):
// los DOS diálogos del escáner dejan de salir descuadrados — vuelve la retícula de líneas (nada
// aplastado a 1 letra por línea) y los campos de cantidad/importancia/mínimo/incluir quedan
// ENCIMA del campo del nombre (la modificación pedida sobre el buen estado que se restaura).
// Ejecutar:  node e2e/dialogos-movil-reticula.mjs
import { chromium } from "playwright-core";
import http from "node:http";
import path from "node:path";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const OUT = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  const file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  let data, code = 200, tipo;
  try { data = readFileSync(file); tipo = MIME[path.extname(file)] || "application/octet-stream"; }
  catch { code = 404; data = "no"; tipo = "text/plain"; }
  res.on("error", () => {});
  res.writeHead(code, { "Content-Type": tipo });
  res.end(data);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};
const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "es-ES" });
await ctx.addInitScript(() => {
  localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
  localStorage.setItem("mrcheff.foods", JSON.stringify([
    { id: "s1", name: "Yogur natural", score: 4, qty: 2, min: 2, checked: false, createdAt: 1 }
  ]));
});
const page = await ctx.newPage();
await page.goto(APP, { waitUntil: "domcontentloaded" });

const TEXTO = [
  "MERCADONA S.A.",
  "2 YOGUR NATURAL 1,35",     // exacto del inventario → DIÁLOGO 1
  "3 PAÑUELO 4,05",           // nuevo → fila de revisión
  "2 YOGUR 1,35"              // duda (comparte "Yogur" con la despensa)
].join("\n");
await page.evaluate(t => window.__mrcheffProcesarTextoOcr(t), TEXTO);
await page.waitForSelector(".modal-content h2", { timeout: 5000 });

// ─── DIÁLOGO 1 (exactos, fila flex): campos encima del nombre
const d1 = await page.evaluate(() => {
  const fila = document.querySelector(".ocr-item");
  const nombre = fila.querySelector(".ocr-nombre");
  const qty = fila.querySelector(".rev-celda-qty");
  return {
    titulo: document.querySelector(".modal-content h2").textContent.trim(),
    camposArriba: qty.getBoundingClientRect().top < nombre.getBoundingClientRect().top,
    nombreAncho: nombre.getBoundingClientRect().width,
    anchoExplota: fila.getBoundingClientRect().width > window.innerWidth
  };
});
ok(d1.titulo.includes("Ya lo tienes en el inventario"), "diálogo 1 de exactos abierto");
ok(d1.camposArriba, `diálogo 1: cantidad/incluir ENCIMA del nombre (Δ ${Math.round(d1.nombreAncho)}px de nombre)`);
ok(!d1.anchoExplota, "diálogo 1: la fila no desborda el viewport");
await page.screenshot({ path: path.join(OUT, "51-dialogo1-movil-reticula.png") });

// confirmar exactos → DIÁLOGO 2 (retículas grid de revisión)
await page.locator("[data-confirmar-exactos]").click();
await page.waitForSelector(".rev-fila-nueva", { timeout: 5000 });

const d2 = await page.evaluate(() => {
  const leer = fila => {
    const celda = cls => fila.querySelector(cls);
    const rect = el => el.getBoundingClientRect();
    const nombre = celda(".rev-celda-nombre");
    const qty = celda(".rev-celda-qty");
    const sub = celda(".rev-sub");
    const pistas = getComputedStyle(fila).gridTemplateColumns.split(" ").length;
    const anchoFila = rect(fila).width;
    return {
      camposArriba: rect(qty).top < rect(nombre).top,
      nombreLlena: rect(nombre).width >= anchoFila - 40,   // su línea COMPLETA (menos el calzo)
      nombreAncho: rect(nombre).width,
      altoNombre: rect(nombre).height,
      subAbajo: sub ? rect(sub).top > rect(nombre).bottom : true,
      pistas,
      anchoFila,
      ph: anchoFila > window.innerWidth
    };
  };
  return {
    titulo: document.querySelector(".modal-content h2").textContent.trim(),
    nueva: leer(document.querySelector(".rev-fila-nueva")),
    duda: leer(document.querySelector(".rev-fila-duda")),
    varianteAbajo: (() => {
      const fila = document.querySelector(".rev-fila-duda");
      const v = fila.querySelector(".rev-celda-variante");
      const n = fila.querySelector(".rev-celda-nombre");
      return v.getBoundingClientRect().top > n.getBoundingClientRect().bottom
        && v.getBoundingClientRect().top < fila.getBoundingClientRect().bottom;
    })(),
    nombrePrimeroEnDuda: (() => {
      const fila = document.querySelector(".rev-fila-duda");
      return fila.querySelector(".rev-celda-nombre").getBoundingClientRect().top
        < fila.querySelector(".rev-celda-qty").getBoundingClientRect().top;
    })(),
    subUltimo: (() => {
      const fila = document.querySelector(".rev-fila-duda");
      const sub = fila.querySelector(".rev-sub");
      const v = fila.querySelector(".rev-celda-variante");
      return sub.getBoundingClientRect().top > v.getBoundingClientRect().bottom - 2;
    })(),
    varianteAncho: (() => {
      const fila = document.querySelector(".rev-fila-duda");
      return fila.querySelector(".rev-celda-variante").getBoundingClientRect().width;
    })()
  };
});
ok(d2.titulo.includes("Añade lo nuevo"), "diálogo 2 de revisión abierto");
ok(d2.nueva.pistas === 4, `revisión NUEVOS: 4 columnas de verdad (${d2.nueva.pistas} pistas — nada de los 6 fantasma del bug)`);
ok(d2.nueva.camposArriba, "revisión NUEVOS: cantidad/importancia/mínimo/incluir ENCIMA del nombre");
ok(d2.nueva.nombreLlena && d2.nueva.altoNombre < 80, `revisión NUEVOS: nombre en su línea completa (${Math.round(d2.nueva.nombreAncho || 0)}px de ${Math.round(d2.nueva.anchoFila)}px de fila — nada de 1 letra por línea)`);
ok(d2.nueva.subAbajo, "revisión NUEVOS: tag + línea del ticket al final");
ok(!d2.nueva.ph, "revisión NUEVOS: sin desborde horizontal");
ok(d2.duda.nombreLlena, "revisión DUDAS: nombre en su línea completa");
ok(d2.nombrePrimeroEnDuda, "revisión DUDAS: el NOMBRE ES LO PRIMERO (intercambio 2026-10-23 con el desplegable)");
ok(d2.varianteAbajo, "revisión DUDAS: el desplegable «De tu despensa» baja DEBAJO del conmutador de tipo");
ok(d2.subUltimo && d2.duda.subAbajo, "revisión DUDAS: tag de categoría + línea del ticket quedan lo ÚLTIMO");
ok(d2.varianteAncho >= d2.duda.anchoFila - 40, `revisión DUDAS: desplegable aprovecha la línea (${Math.round(d2.varianteAncho)}px de ${Math.round(d2.duda.anchoFila)}px)`);
ok(d2.duda.nombreLlena, "revisión DUDAS: nombre también en su línea completa");

// el conmutador 🍎/🏠 del alta vive debajo de los campos y encima del nombre
const conmutador = await page.evaluate(() => {
  const fila = document.querySelector(".rev-fila-nueva");
  const cat = fila.querySelector(".rev-celda-cat");
  const nombre = fila.querySelector(".rev-celda-nombre");
  const campos = fila.querySelector(".rev-celda-qty");
  if (!cat) return null;
  return {
    presente: true,
    entreCamposYnombre: cat.getBoundingClientRect().top > campos.getBoundingClientRect().bottom - 2
      && cat.getBoundingClientRect().top < nombre.getBoundingClientRect().top
  };
});
ok(conmutador && conmutador.presente && conmutador.entreCamposYnombre,
  "el conmutador 🍎/🏠 del alta lleva su línea completa ENTRE los campos y el nombre");
await page.screenshot({ path: path.join(OUT, "52-dialogo2-movil-reticula.png"), fullPage: false });

await browser.close();
server.close();
console.log(fallos ? `${fallos} comprobaciones FALLARON` : "Retícula móvil de los diálogos restaurada — capturas 51-52");
process.exit(fallos ? 1 : 0);

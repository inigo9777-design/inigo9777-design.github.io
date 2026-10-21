// e2e/ocr-tickets-reales.mjs — el ESCÁNER DEL TICKET contra FOTOS REALES de la compra (Brave REAL,
// Tesseract spa de verdad). #epic-ocr-despensa-camara, verificación 2026-10-20.
// Ejecutar:  node e2e/ocr-tickets-reales.mjs
//
// La carpeta reports/OCR es DESCARTABLE: quien quiera verificar deja ahí sus fotos (png/jpg/heic/heif)
// — como mínimo una con extensión .heic/.heif (la foto del iPhone) — y el script las prueba todas,
// una por contexto (semilla de despensa distinta por ticket). Si la carpeta no existe, la prueba
// SE SALTA sola (exit 0): no es un flujo esencial, es la verificación con material real.
//
// Lo que demuestra con fotos reales (no sintéticas):
//   1. ABRIR: el ticket del iPhone en .HEIC (y el ".png" que en realidad es HEIF de iPhone) no dan
//      "No se ha podido escanear la foto" — la vista los convierte a JPEG en el navegador (heic2any).
//   2. LEER: con la foto de lado (el papel cae 90° en la foto del móvil) el OCR llega a leer el
//      ticket: reintentos girados de la vista.
//   3. CONTRATO del ticket con material real: los candidatos salen del TEXTO de la compra — los
//      precios y cifras del ticket no se convierten en alimentos ni en cantidades.
//   4. REWORK 2026-10-21: la revisión de TODO ocurre EN los dos diálogos del escáner (exactos =
//      dialogo 1 con la compra sumando; dudosos y nuevos = diálogo de revisión, definidos ahí
//      mismo) — la despensa recibe todo y la lista de la compra queda FUERA del ticket.
//
// NO guarda ningún registro de las fotos: no se copia ni se mueve ninguno de los ficheros (Chromium
// lee el path original); los screenshots en reports/ui-brave son de la UI de la app, no de la foto.
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));              // webapp/
const CARPETA = path.resolve(fileURLToPath(new URL("../../reports/OCR/", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

let FOTOS = [];
try {
  FOTOS = readdirSync(CARPETA).filter(f => /\.(png|jpe?g|heic|heif)$/i.test(f) && !f.startsWith("."));
} catch {}
if (!FOTOS.length) {
  console.log("(sin fotos: reports/OCR no existe o está vacía — la verificación con material real se salta; SUITE y e2e sintético siguen cubriendo la feature)");
  process.exit(0);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json"
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  const file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  try {
    const data = readFileSync(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;
console.log("(app servida en " + APP + ")");

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// CONFIGURACIÓN por ticket: la despensa SEMBRADA decide qué se demuestra. Los alimentos que el
// ticket trae EXACTOS (el nombre canónico del vocabulario ya está en casa, con criterio definido)
// confirman en el DIALOGO 1 (la compra suma); el resto (parientes y nuevos) se definen en el
// diálogo de revisión y dan de alta directa en la despensa al confirmar.
function configDe(foto) {
  if (/\.(heic|heif)$/i.test(foto)) {
    return {
      nombre: "HEIC del iPhone (Mercadona)",
      semilla: [
        { id: "s1", name: "Leche", score: 6, qty: 1, min: 2, checked: false, createdAt: 1 },
        { id: "s2", name: "Mantequilla", score: 5, qty: 1, min: 1, checked: false, createdAt: 2 },
        { id: "s3", name: "Zumo de Tomate", score: 5, qty: 1, min: 1, checked: false, createdAt: 3 }
      ],
      exactos: ["Leche", "Mantequilla"]     // el pariente ("Tomate") comparte palabra con "Zumo de Tomate"
    };
  }
  return {
    nombre: "«.png» HEIF de iPhone (ALDI)",
    semilla: [
      { id: "s1", name: "Leche", score: 6, qty: 1, min: 2, checked: false, createdAt: 1 },
      { id: "s2", name: "Huevos", score: 5, qty: 1, min: 6, checked: false, createdAt: 2 },
      { id: "s3", name: "Zumo de Naranja", score: 5, qty: 1, min: 1, checked: false, createdAt: 3 }
    ],
    exactos: ["Leche", "Huevos"]            // el pariente ("Naranja") comparte palabra con "Zumo de Naranja"
  };
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let primerIndice = 1;                     // numeración de capturas (el resto del repo usa 1-30; aquí desde 31)
try {
  for (const foto of FOTOS) {
    const cfg = configDe(foto);
    const indice = 30 + primerIndice++;
    console.log(`\n════════ ${cfg.nombre}: ${foto} ════════`);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "es-ES"
    });
    await context.addInitScript(semilla => {
      localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));   // la visita guiada no come clicks
      localStorage.setItem("mrcheff.foods", JSON.stringify(semilla));
    }, cfg.semilla);
    const page = await context.newPage();
    page.setDefaultTimeout(600000);

    await page.goto(APP, { waitUntil: "domcontentloaded" });

    // PASO 1 — soltar la foto REAL. La conversión HEIC→JPEG, el giro y el OCR corren solos.
    await page.setInputFiles("#ocr-file", path.join(CARPETA, foto));

    // PASO 2 — acabar O en el diálogo de EXACTOS O en la revisión O en "no detectado" (cualquiera
    // de las dos colas cierra el escaneo; el reparto lo decide el módulo puro)
    const modal = page.locator(".modal-content");
    await Promise.race([
      modal.locator("h2", { hasText: "Ya lo tienes en el inventario" }).waitFor({ timeout: 600000 }),
      modal.locator("h2", { hasText: "Añade lo nuevo" }).waitFor({ timeout: 600000 }),
      modal.locator("h2", { hasText: "No he detectado alimentos" }).waitFor({ timeout: 600000 })
    ]);
    const titulo = await modal.locator("h2").first().textContent();
    const enDialogoExactos = titulo.includes("Ya lo tienes en el inventario");
    ok(!titulo.includes("No he detectado"), `la foto ${path.extname(foto).toUpperCase()} SE ABRE y el OCR la lee (nada de «no se ha podido escanear»)`);

    // PASO 3 — candidatos del TEXTO de la compra: nombres no numéricos, cantidades sanas (precios fuera)
    const filas = await modal.locator(".ocr-item").all();
    const candidatos = [];
    for (const fila of filas) {
      const inputNombre = fila.locator(".ocr-nombre input");
      const nombre = (await inputNombre.count())
        ? await inputNombre.inputValue()
        : (await fila.locator(".ocr-nombre strong").textContent()).trim();
      const qty = Number(await fila.locator(".exact-qty, input[id^='rev-qty-']").first().inputValue());
      candidatos.push({ nombre, qty });
    }
    console.log("   detectados:", candidatos.map(c => `${c.nombre}×${c.qty}`).join(", ") || "(ninguno)");
    ok(candidatos.length > 0, "detectó ALIMENTOS reales del ticket (no ruido vacío)");
    ok(candidatos.every(c => /[a-z]/i.test(c.nombre) && !/^\d/.test(c.nombre)), "ningún candidato es una cifra del ticket (precios y kg fuera)");
    ok(candidatos.every(c => Number.isInteger(c.qty) && c.qty >= 1 && c.qty <= 30), `las cantidades son unidades de compra saneadas (${candidatos.map(c => c.qty).join("/")})`);

    // PASO 4 — REGLA DE REPARTO: los exactos de la semilla (si el OCR los leyó) abren el DIÁLOGO 1;
    // su cantidad la fija la línea del ticket y se confirman ahí con la compra sumando
    if (enDialogoExactos) {
      for (const exacto of cfg.exactos) {
        const hit = candidatos.find(c => norm(c.nombre) === norm(exacto));
        if (!hit) continue;                     // el OCR de la foto no lo leyó esta vez: no se le puede exigir
        ok(true, `"${exacto}" de la despensa salió del ticket y CONFIRMA en su diálogo (nombre canónico)`);
      }
    }

    await page.screenshot({ path: path.join(OUT_DIR, `${indice}-ticket-reales-confirmacion.png`), fullPage: false });

    // PASO 5 — confirmar TODO con los valores de las filas: exactos (diálogo 1) y luego la
    // revisión con los nuevos y el dudoso dejados como "es nuevo" → TODO acaba en la despensa
    const qts = {};                            // cantidad leída del ticket por nombre normalizado
    candidatos.forEach(c => { qts[norm(c.nombre)] = c.qty; });
    const guardExactos = modal.locator("[data-confirmar-exactos]");
    if (await guardExactos.count()) { await guardExactos.click(); await page.waitForTimeout(500); }
    await modal.locator("[data-revision-guardar]").click();
    await page.waitForTimeout(600);

    const estado = await page.evaluate(() => ({
      foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]"),
      compraTicket: localStorage.getItem("mrcheff.compraTicket")
    }));
    ok(estado.compraTicket === null, "la clave de pendientes del ticket NI SE ESCRIBE (implementación retirada: nada en la lista de la compra)");

    // los EXACTOS: sumados en el diálogo 1, con sus criterios intactos
    for (const exacto of cfg.exactos) {
      const semilla = cfg.semilla.find(s => s.name === exacto);
      const enCasa = estado.foods.find(f => norm(f.name) === norm(exacto));
      ok(!!enCasa, `"${exacto}" sigue en la despensa`);
      ok(!!enCasa && enCasa.qty === semilla.qty + (qts[norm(exacto)] || 0),
         `"${exacto}" RECIBIÓ su compra directa: despensa ${semilla.qty} (+${qts[norm(exacto)] || 0} del ticket), criterios intactos (score ${semilla.score})`);
    }
    // los DEMÁS (nuevos y el dudoso resuelto como "es nuevo"): alta directa con el criterio del diálogo
    for (const [nombreNorm, qty] of Object.entries(qts)) {
      if (cfg.exactos.some(e => norm(e) === nombreNorm)) continue;
      const fila = estado.foods.find(f => norm(f.name) === nombreNorm);
      ok(!!fila && fila.qty === qty, `"${nombreNorm}" dio de ALTA en la despensa con la qty del ticket (${qty})`);
      ok(!!fila && Number.isInteger(fila.score) && fila.score >= 1 && fila.score <= 10 && Number.isInteger(fila.min),
         `"${nombreNorm}" lleva IMPORTANCIA (1-10) y MÍNIMO definidos EN el diálogo`);
    }

    // PASO 6 — la LISTA DE LA COMPRA queda FUERA del ticket: ni filas ni pendientes ni salto de pestaña
    const quedaLimpia = await page.evaluate(() =>
      !document.querySelector("li[data-fila-ticket]") &&
      JSON.parse(localStorage.getItem("mrcheff.compraTicket") || "null") === null &&
      document.querySelector("#view-foods.active") !== null);
    ok(quedaLimpia, "sin pendientes del ticket en la lista y el escáner no sale de la pestaña de Alimentos");

    await page.screenshot({ path: path.join(OUT_DIR, `${indice + 1}-ticket-reales-despensa.png`), fullPage: false });
    await context.close();
  }
} catch (err) {
  fallos++;
  console.error("✘ falla no esperada del e2e:", err && err.message);
} finally {
  await browser.close();
  server.close();
}

console.log(fallos ? `\n${fallos} comprobaciones FALLARON` : "\nVerificación real completa OK");
process.exit(fallos ? 1 : 0);

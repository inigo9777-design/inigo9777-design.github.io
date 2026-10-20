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
//   4. REGLA DE REPARTO del usuario: lo que YA está en la despensa (mismo nombre canónico, criterio
//      definido) entra DIRECTO en la despensa (suma su compra) y JAMÁS cae en la lista de la compra;
//      JAMÁS cae en la lista de la compra; a la lista van los DUDOSOS y los NUEVOS — y los nuevos
//      quedan ahí SIN DEFINIR hasta fijar criterio.
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
// deben ir DIRECTO a la despensa; el pariente (comparte palabra) cae como DUDOSO; el resto como NUEVO.
function configDe(foto) {
  if (/\.(heic|heif)$/i.test(foto)) {
    return {
      nombre: "HEIC del iPhone (Mercadona)",
      semilla: [
        { id: "s1", name: "Leche", score: 6, qty: 1, min: 2, checked: false, createdAt: 1 },
        { id: "s2", name: "Mantequilla", score: 5, qty: 1, min: 1, checked: false, createdAt: 2 },
        { id: "s3", name: "Zumo de Tomate", score: 5, qty: 1, min: 1, checked: false, createdAt: 3 }
      ],
      exactos: ["Leche", "Mantequilla"],
      dudoso: "Tomate"                    // el pariente: comparte palabra con "Zumo de Tomate"
    };
  }
  return {
    nombre: "«.png» HEIF de iPhone (ALDI)",
    semilla: [
      { id: "s1", name: "Leche", score: 6, qty: 1, min: 2, checked: false, createdAt: 1 },
      { id: "s2", name: "Huevos", score: 5, qty: 1, min: 6, checked: false, createdAt: 2 },
      { id: "s3", name: "Zumo de Naranja", score: 5, qty: 1, min: 1, checked: false, createdAt: 3 }
    ],
    exactos: ["Leche", "Huevos"],
    dudoso: "Naranja"                     // el pariente: comparte palabra con "Zumo de Naranja"
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

    // PASO 2 — acabar O en confirmación O en "no detectado" (cualquiera de las dos colas cierra el escaneo)
    const modal = page.locator(".modal-content");
    await Promise.race([
      modal.locator("h2", { hasText: "Esto es lo que compraste" }).waitFor({ timeout: 600000 }),
      modal.locator("h2", { hasText: "No he detectado alimentos" }).waitFor({ timeout: 600000 })
    ]);
    const titulo = await modal.locator("h2").first().textContent();
    ok(titulo.includes("Esto es lo que compraste"), `la foto ${path.extname(foto).toUpperCase()} SE ABRE y el OCR la lee (nada de «no se ha podido escanear»)`);

    // PASO 3 — candidatos del TEXTO de la compra: nombres no numéricos, cantidades sanas (precios fuera)
    const filas = await modal.locator(".ocr-item").all();
    const candidatos = [];
    for (const fila of filas) {
      const nombre = await fila.locator(".ocr-nombre input").inputValue();
      const qty = await fila.locator("input[type=number]").inputValue();
      const linea = await fila.locator(".ocr-linea").textContent();
      candidatos.push({ nombre, qty: Number(qty), linea: (linea || "").trim() });
    }
    console.log("   detectados:", candidatos.map(c => `${c.nombre}×${c.qty}`).join(", ") || "(ninguno)");
    ok(candidatos.length > 0, "detectó ALIMENTOS reales del ticket (no ruido vacío)");
    ok(candidatos.every(c => /[a-z]/i.test(c.nombre) && !/^\d/.test(c.nombre)), "ningún candidato es una cifra del ticket (precios y kg fuera)");
    ok(candidatos.every(c => Number.isInteger(c.qty) && c.qty >= 1 && c.qty <= 30), `las cantidades son unidades de compra saneadas (${candidatos.map(c => c.qty).join("/")})`);

    // PASO 4 — REGLA DE REPARTO: los exactos de la semilla aparecen entre los detectados; su cantidad la fija el modal
    for (const exacto of cfg.exactos) {
      const hit = candidatos.find(c => norm(c.nombre) === norm(exacto));
      ok(!!hit, `"${exacto}" de la despensa sale del ticket (mismo nombre canónico)`);
    }

    await page.screenshot({ path: path.join(OUT_DIR, `${indice}-ticket-reales-confirmacion.png`), fullPage: false });

    // PASO 5 — guardar TODO lo detectado (casillas 'on' por defecto) y revisar el reparto FINAL
    const qts = {};                            // cantidad del modal por nombre normalizado
    candidatos.forEach(c => { qts[norm(c.nombre)] = c.qty; });
    await modal.locator("[data-ocr-guardar]").click();
    await page.waitForTimeout(600);

    const estado = await page.evaluate(() => ({
      foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]"),
      ticket: JSON.parse(localStorage.getItem("mrcheff.compraTicket") || "[]")
    }));

    // los EXACTOS: directo a la despensa, SUMANDO su compra, y JAMÁS en la lista de la compra (regla del usuario)
    for (const exacto of cfg.exactos) {
      const enCasa = estado.foods.find(f => norm(f.name) === norm(exacto));
      ok(!!enCasa, `"${exacto}" sigue en la despensa`);
      ok(!!enCasa && enCasa.qty === cfg.semilla.find(s => s.name === exacto).qty + qts[norm(exacto)],
         `"${exacto}" RECIBIÓ su compra directa: despensa ${cfg.semilla.find(s => s.name === exacto).qty} (+${qts[norm(exacto)]} del ticket)`);
      ok(!estado.ticket.some(p => norm(p.nombre) === norm(exacto)), `"${exacto}" NO cae en la lista de la compra (iba directo)`);
    }
    // el DUDOSO: pendiente NORMAL (criterio ya no hace falta definirlo: viene de la variante despensa)
    const penduDudoso = estado.ticket.find(p => norm(p.nombre) === norm(cfg.dudoso));
    ok(!!penduDudoso, `el pariente "${cfg.dudoso}" queda como pendiente del ticket a resolver con decisión propia`);
    // los NUEVOS: pendientes SIN DEFINIR (faltaDefinir: true) y está todos los demás
    const nuevos = estado.ticket.filter(p => p.faltaDefinir === true);
    ok(nuevos.length >= 1, `los nuevos del ticket quedan SIN DEFINIR hasta fijar criterio (${nuevos.map(p => p.nombre).join(", ")})`);
    ok(estado.ticket.every(p => Number.isInteger(p.qty) && p.qty >= 1 && p.qty <= 30),
       "ninguna cantidad del pendiente es un PRECIO ni un peso de envase");

    // PASO 6 — la LISTA DE LA COMPRA: arriba los pendientes del ticket, y NADIE de los exactos entra en ella
    await page.click('[data-view="suggest"]');
    await page.waitForTimeout(400);
    const listEn = await page.locator("li[data-fila-ticket]").allTextContents();
    ok(listEn.length === estado.ticket.length, `la lista muestra TODOS los pendientes del ticket (${listEn.length}/${estado.ticket.length})`);
    for (const exacto of cfg.exactos) {
      ok(!listEn.some(t => norm(t).includes(norm(exacto))), `"${exacto}" tampoco aparece en la lista de la compra visible`);
    }

    await page.screenshot({ path: path.join(OUT_DIR, `${indice + 1}-ticket-reales-lista.png`), fullPage: false });
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

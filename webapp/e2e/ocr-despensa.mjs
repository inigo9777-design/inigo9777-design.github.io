// e2e/ocr-despensa.mjs — Verificación del ESCÁNER DEL TICKET de la compra (OCR) con Brave REAL. #epic-ocr-despensa-camara
// Ejecutar:  node e2e/ocr-despensa.mjs     (levanta su propio servidor en http://127.0.0.1 — necesario
// para que Tesseract.js cargue su worker desde el CDN; por file:// el worker no arranca)
//
// ══════════════ CÓMO PROBARLO EN EL MUNDO REAL ══════════════
//   MÓVIL (lo que pide el epic: la cámara SÓLO se ofrece en la vista móvil):
//     1. Sirve la app por https (Netlify Drop / GitHub Pages — ver e2e/pwa-instalable.mjs) y ábrela en Brave.
//     2. Vista Alimentos → botón "📷 Escanear el ticket con la cámara" (SÓLO aparece en móvil).
//     3. Se abre la app de la cámara del sistema SIN pedir permisos ni https extra: fotógrafo el
//        ticket del super (o el frigorífico: la vía es la misma), de frente y con buena luz.
//     4. En el modal aparece la lista detectada con la CANTIDAD leída del ticket: el NOMBRE es
//        editable y hay cantidad / mínimo para avisar / importancia (1–10) + casilla "Incluir".
//     5. "Añadir lo confirmado": los alimentos claros entran (los exactos SUMAN su compra) y
//        los dudosos —¿es el mismo que uno de la despensa?— quedan ARRIBA en la lista de la compra
//        con el mismo botón "🛒 Despensa?" que cualquier fila.
//   ESCRITORIO (Mac): botón "🖼️ Escanear foto del ticket" → eliges una foto del disco → mismo modal.
//   La primera vez Tesseract.js descarga su motor/español del CDN (unos megas, una sola vez); la
//   FOTO nunca sale del dispositivo: todo el reconocimiento corre en el navegador.
//
// Lo que automatiza esta prueba:
//   (A) Escritorio: botón cámara OCULTO, botón foto visible (la cámara sólo sale en móvil).
//   (B) Móvil emulado (UA iPhone): botón cámara VISIBLE.
//   (C) Flujo REAL de OCR (foto sintética de texto dibujada en canvas → PNG): modal de
//       confirmación con ≥2 candidatos REALES detectados por Tesseract (spa), nombre editado y
//       guardado con cantidad propia, y la despensa refrescada. Capturas 23-*, 24-*.
//   (D) FLUJO DEL TICKET con texto inyectado por la ventanilla §6 (sin depender de la conexión):
//       cantidad por línea, claros directo a la despensa, dudoso ARRIBA de la lista con "🛒
//       Despensa?" (misma máquina de la lista) y salida al resolver. Capturas 25-*, 26-*.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));  // webapp/
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

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

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let tmpPng = null;      // NO se borra hasta el final: Chromium lee el archivo SUBIDO con pereza y el OCR lo necesita vivo
try {
  // ── (A) ESCRITORIO: la cámara NO se ofrece; la vía foto, sí ──
  // (el TUTORIAL auto-abre en http — y este e2e vive por http: para el motor del OCR hace falta
  // red (el worker del CDN); marcamos la visita guía como vista para que no coma los clicks))
  const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxDesk.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
  });
  const page = await ctxDesk.newPage();
  page.on("pageerror", e => console.log("[pageerror]", String(e).slice(0, 300)));
  page.on("requestfailed", r => console.log("[reqfail]", r.url().slice(0, 100), r.failure()?.errorText));
  await page.goto(APP);
  await page.waitForSelector("#view-foods.active");
  ok(await page.isHidden("#btn-ocr-camara"), "(A) escritorio: botón de cámara OCULTO (la cámara sólo en móvil)");
  ok(await page.isVisible("#btn-ocr-foto"), "(A) escritorio: botón de foto VISIBLE (misma función, otra vía)");

  // ── (B) MÓVIL EMULADO (UA de iPhone): el botón de cámara APARECE ──
  const ctxMovil = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  await ctxMovil.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
  });
  const pageM = await ctxMovil.newPage();
  pageM.on("pageerror", e => console.log("[pageerror movil]", String(e).slice(0, 300)));
  pageM.on("requestfailed", r => console.log("[reqfail movil]", r.url().slice(0, 100), r.failure()?.errorText));
  await pageM.goto(APP);
  await pageM.waitForSelector("#view-foods.active");
  ok(await pageM.isVisible("#btn-ocr-camara"), "(B) móvil emulado: botón de cámara VISIBLE (política del epic)");
  // El click debe ABRIR UN FILE CHOOSER (en el móvil real, la app de cámara del sistema): lo
  // consumimos limpiamente para no dejar un diálogo a medias colgado del navegador.
  const chooserMovil = pageM.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
  await pageM.click("#btn-ocr-camara");
  const chooser = await chooserMovil;
  ok(!!chooser, "(B) móvil: el botón de cámara abre el file chooser (input con capture='environment')");
  const capture = await pageM.getAttribute("#ocr-file", "capture");
  ok(capture === "environment", "(B) móvil: el input de la foto lleva capture='environment' (abre la cámara del sistema)");
  await pageM.screenshot({ path: path.join(OUT_DIR, "24-ocr-camara-visible-movil.png") });
  await ctxMovil.close();

  // ── (C) FLUJO REAL: foto sintética (¡canvas!) → OCR Tesseract spa → modal → editar nombre → guardar ──
  // ¿Hay red hacia el CDN? Si no, saltamos esta parte con aviso (el resto ya ha validado el epic).
  let hayRed = true;
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    const r = await fetch("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/package.json", { signal: ctl.signal });
    hayRed = r.ok;
  } catch { hayRed = false; }
  if (!hayRed) {
    ok(false, "sin conexión al CDN de jsdelivr: el paso (C) queda SKIPPED (lo demás ya validado)");
  } else {
    // La foto la PINTA el propio navegador (no hay fixture de imagen en el repo): texto de nevera.
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 900; c.height = 300;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, 900, 300);
      x.fillStyle = "#111111"; x.font = "bold 40px Arial";
      x.fillText("NEVERA - SEMANA 44", 30, 60);
      x.fillText("Leche entera 1L", 30, 130);
      x.fillText("Huevos docena XL", 30, 190);
      x.fillText("Cebollas 2 bolsas", 30, 250);
      return c.toDataURL("image/png");
    });
    const tmpPng = path.join(os.tmpdir(), "mrcheff-ocr-foto.png");
    writeFileSync(tmpPng, Buffer.from(dataUrl.split(",")[1], "base64"));

    const chooserFoto = page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
    await page.click("#btn-ocr-foto");
    await chooserFoto;                              // consumir el chooser limpio (headless no tiene UI)
    await page.setInputFiles("#ocr-file", tmpPng);

    // 1ª vez: descarga del motor (puede tardar ~1 min). Modal de progreso → modal de confirmación.
    try {
      await page.waitForSelector(".ocr-item", { timeout: 180000 });
    } catch {
      const estado = await page.evaluate(() => ({
        tesseract: !!window.Tesseract,
        modal: document.getElementById("modal-content").innerText.slice(0, 240).replace(/\n+/g, " | ")
      })).catch(e => ({ tesseract: "?", modal: String(e).slice(0, 120) }));
      throw new Error("(C) el modal de confirmación no apareció tras el OCR — diagnóstico: " + JSON.stringify(estado));
    }
    const nCand = await page.locator(".ocr-item").count();
    ok(nCand >= 2, `(C) OCR real en Brave: modal con ${nCand} candidatos detectados de la foto (≥2)`);

    // Requisito del epic: el NOMBRE es editable hasta guardar → renombrar la 1ª fila y cambiar cantidad.
    const fila1 = page.locator(".ocr-item").first();
    const nombreOriginal = await fila1.locator("input[type='text']").inputValue();
    ok(nombreOriginal.length > 1, `(C) el nombre detectado sale editable (valor actual: "${nombreOriginal}")`);
    await fila1.locator("input[type='text']").fill("Prueba OCR renombrada");
    await fila1.locator("input[type='number']").first().fill("7");
    await page.screenshot({ path: path.join(OUT_DIR, "23-ocr-confirmar-candidatos.png") });

    await page.click("[data-ocr-guardar]");
    await page.waitForSelector("#modal.hidden", { state: "attached" });
    const abierto = await page.$eval("#modal", m => !m.classList.contains("hidden"));
    ok(!abierto, "(C) tras guardar, el modal se cierra");

    // La fila confirmada (renombrada) vive en la despensa con su cantidad: "7 / 1".
    const fila = page.locator("#food-list .food-item", { hasText: "Prueba OCR renombrada" });
    ok(await fila.count() === 1, "(C) el candidato renombrado está GUARDADO en la despensa (nombre editable respetado)");
    ok((await fila.first().textContent()).includes("7 / 1"), "(C) la cantidad confirmada (7) ha entrado también");
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.foods")));
    const fueGuardado = ls.some(f => f.name === "Prueba OCR renombrada" && f.qty === 7 && Number.isFinite(f.score) && f.min >= 0);
    ok(fueGuardado, "(C) localStorage: registro nuevo con qty=7 y min/score de los inputs (mismo shape del formulario)");

    // ¿Duplicados? El resto de candidatos reales detectados debería haber entrado sin pisarse.
    const nombresLs = ls.map(f => f.name.toLowerCase());
    ok(new Set(nombresLs).size === nombresLs.length, "(C) sin nombres duplicados en la despensa tras el guardado");
  }

  // ── (D) FLUJO DEL TICKET (propósito 2026-10-20): alimento+cantidad a la despensa; lo DUDOSO —
  //    ¿es el mismo que uno de la despensa?— va ARRIBA a la lista de la compra con "🛒 Despensa?")
  //    El texto entra por la inyección §6 (los datos que pasaría el OCR tras leer la foto): así la
  //    sección NO depende de la conexión; el motor REAL ya queda cubierto en (C).
  const ctxTicket = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxTicket.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify([
      { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 }
    ]));
  });
  const pageT = await ctxTicket.newPage();
  pageT.on("pageerror", e => console.log("[pageerror ticket]", String(e).slice(0, 300)));
  await pageT.goto(APP);
  await pageT.waitForSelector("#view-foods.active");

  await pageT.evaluate(t => window.__mrcheffProcesarTextoOcr(t),
    ["3 Leche entera 1,29 €", "2 x Yogur", "1 Pan de pueblo", "TOTAL 12,40 €. GRACIAS"].join("\n"));
  ok(await pageT.locator(".ocr-item").count() === 3, "(D) modal del ticket: 3 candidatos reconocidos");
  ok((await pageT.inputValue("#ocr-qty-0")) === "3", "(D) la CANTIDAD la fija la línea del ticket ('3 Leche' → 3)");
  ok((await pageT.inputValue("#ocr-qty-1")) === "2", "(D) '2 x Yogur' → 2");
  await pageT.screenshot({ path: path.join(OUT_DIR, "25-ocr-ticket-confirmar.png") });
  await pageT.click("[data-ocr-guardar]");
  await pageT.waitForSelector("#modal.hidden", { state: "attached" });

  const d = await pageT.evaluate(() => ({
    pend: JSON.parse(localStorage.getItem("mrcheff.compraTicket") || "[]"),
    foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]")
  }));
  ok(d.pend.length === 1 && d.pend[0].nombre === "Yogur" && d.pend[0].qty === 2, "(D) el DUDOSO ('Yogur' vs 'Yogur natural') queda como pendiente del ticket (qty 2 del ticket)");
  ok(!d.foods.some(f => f.name === "Yogur"), "(D) NO se creó ningún alimento 'Yogur' por su cuenta");
  ok(d.foods.some(f => f.name === "Leche" && f.qty === 3), "(D) 'Leche' nueva entra directo con su cantidad (3)");
  ok(d.foods.find(f => f.name === "Yogur natural").qty === 2, "(D) la despensa queda sin tocar hasta el veredicto del usuario");

  // La fila del ticket en la lista de la compra: la primera, con el MISMO botón "🛒 Despensa?"
  await pageT.evaluate(() => document.querySelector('[data-view="suggest"]').click());
  await pageT.waitForSelector("li[data-fila-ticket='Yogur']", { timeout: 5000 });
  const primeraFila = await pageT.$eval("#shopping-list li.alert-row", el => el.getAttribute("data-fila-ticket"));
  ok(primeraFila === "Yogur", "(D) el pendiente del ticket es la PRIMERA fila de la lista (esperamos 'Yogur')");
  ok(await pageT.isVisible("li[data-fila-ticket='Yogur'] [data-despensa]"), "(D) la fila del ticket lleva el MISMO botón '🛒 Despensa?' (hay variante en despensa)");
  await pageT.screenshot({ path: path.join(OUT_DIR, "26-ocr-ticket-lista-despensa.png") });

  await pageT.click("li[data-fila-ticket='Yogur'] [data-despensa]");
  await pageT.waitForSelector("[data-despensa-elegir='Yogur natural']");
  await pageT.click("[data-despensa-elegir='Yogur natural']");
  ok((await pageT.inputValue("#compra-qty")) === "2", "(D) el diálogo de compra abre con la CANTIDAD del ticket (2)");
  await pageT.click("[data-buy-confirm]");
  await pageT.waitForSelector("li[data-fila-ticket='Yogur']", { state: "detached" }).catch(() => {});
  const dr = await pageT.evaluate(() => ({
    pend: JSON.parse(localStorage.getItem("mrcheff.compraTicket") || "[]"),
    foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]"),
    filaViva: !!document.querySelector("li[data-fila-ticket='Yogur']")
  }));
  ok(dr.pend.length === 0, "(D) resuelto: sin pendientes del ticket");
  ok(!dr.filaViva, "(D) resuelto: la fila sale de la lista de la compra");
  ok(dr.foods.some(f => f.name === "Yogur natural" && f.qty === 2) && !dr.foods.some(f => f.name === "Yogur"),
    "(D) la compra fue IN-SITU a 'Yogur natural' (misma cosa con otra variante), sin alimento nuevo");
  await ctxTicket.close();

  await ctxDesk.close();
  if (fallos) throw new Error(fallos + " comprobaciones del escáner fallidas");
  console.log("\nESCÁNER DEL TICKET OK — cámara sólo en móvil ✔ + OCR real en navegador ✔ + ticket→despensa/pendientes ✔");
  console.log("Capturas: reports/ui-brave/23-ocr-confirmar-candidatos.png · 24-ocr-camara-visible-movil.png · 25-ocr-ticket-confirmar.png · 26-ocr-ticket-lista-despensa.png");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (tmpPng) rmSync(tmpPng, { force: true });
  server.close();
}

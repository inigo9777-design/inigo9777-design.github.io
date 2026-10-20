// e2e/ocr-ticket-video.mjs — VÍDEO DEMO del ESCÁNER DEL TICKET (petición del usuario 2026-10-20):
// grabar la feature funcionando de verdad (Playwright recordVideo → reports/ui-brave/) para VERLA.
// Ejecutar:  node e2e/ocr-ticket-video.mjs   →  reports/ui-brave/video-ocr-ticket/demo-escaner-ticket.webm
//
// Recorrido (beats pausados, con OCR Tesseract REAL contra una foto sintética):
//   1. Pestaña Alimentos: los botones de la cámara/foto del ticket.
//   2. 🖼️ Escanear foto del ticket → foto sintética (canvas) → motor REAL "Leyendo el ticket…"
//      (la primera vez descarga el motor del CDN: ese tramo largo queda en el vídeo tal cual).
//   3. Modal de confirmación: candidatos + CANTIDAD leída por línea.
//   4. Guardar: nada entra solo — pendientes del ticket ARRIBA de la lista de la compra.
//   5. NUEVO sin definir (atenuado, aviso) → definir importancia y mínimo EN LA FILA → ✅ comprado
//      (diálogo pre-cargado con cantidad definida) → alta en la despensa.
//   6. DUDOSO con "🛒 Despensa?" → variante de la despensa → compra IN-SITU.
//   7. plano final de la despensa actualizada.
import { chromium } from "playwright-core";
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));  // webapp/
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
const VIDEO_DIR = path.join(OUT_DIR, "video-ocr-ticket");
mkdirSync(VIDEO_DIR, { recursive: true });

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

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let tmpPng = null;
try {
  // ¿Hay red hacia el CDN? Sin ella el motor no carga y el vídeo no puede ser un demo real.
  let hayRed = true;
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    const r = await fetch("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/package.json", { signal: ctl.signal });
    hayRed = r.ok;
  } catch { hayRed = false; }
  if (!hayRed) throw new Error("sin conexión al CDN de jsdelivr: el vídeo necesita el motor OCR real");

  // Grabación de TODO el recorrido: 1024×768 fijo (igual al viewport, sin escalado borroso).
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1024, height: 768 } }
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify([
      { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 }
    ]));
  });
  const page = await ctx.newPage();
  const pausa = ms => page.waitForTimeout(ms);

  // ── 1. Alimentos: la card del escáner ──
  await page.goto(APP);
  await page.waitForSelector("#view-foods.active");
  await page.locator("#btn-ocr-foto").scrollIntoViewIfNeeded();
  await pausa(2500);

  // ── 2. Foto sintética del TICKET (canvas → PNG): la imagen que "fotografía" la demo ──
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 420;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, 900, 420);
    x.fillStyle = "#111111"; x.font = "bold 38px Arial";
    x.fillText("MERCADO EL RINCON", 30, 55);
    x.font = "30px Arial";
    x.fillText("20/10/2026  TICKET 00123", 30, 105);
    x.font = "34px Arial";
    x.fillText("2  LECHE ENTERA 1L    1,29", 30, 170);
    x.fillText("3 x YOGUR              1,80", 30, 225);
    x.fillText("1  PAN DE PUEBLO       0,95", 30, 280);
    x.font = "32px Arial";
    x.fillText("TOTAL                 12,40", 30, 345);
    x.font = "24px Arial";
    x.fillText("GRACIAS POR SU VISITA", 30, 395);
    return c.toDataURL("image/png");
  });
  tmpPng = path.join(os.tmpdir(), "mrcheff-ocr-ticket-video.png");
  writeFileSync(tmpPng, Buffer.from(dataUrl.split(",")[1], "base64"));

  await page.click("#btn-ocr-foto");
  await pausa(1200);                                     // (el chooser no se ve en headless; el modal del progreso sí)
  await page.setInputFiles("#ocr-file", tmpPng);
  await pausa(4000);                                     // beat del modal "Leyendo el ticket…" (descarga del motor la 1ª vez)
  await page.waitForSelector(".ocr-item", { timeout: 180000 });
  await pausa(3000);                                     // beat del modal de confirmación (candidatos + cantidad)

  // ── 3. Guardar: pendientes del ticket (nada entra solo) ──
  await page.click("[data-ocr-guardar]");
  await pausa(2500);                                     // toast + despensa quietecita

  // ── 4. La lista de la compra: nuevos SIN DEFINIR atenuados + dudoso con su botón ──
  await page.evaluate(() => document.querySelector('[data-view="suggest"]').click());
  await page.waitForSelector("li[data-fila-ticket='Leche']");
  await pausa(3500);                                     // plano largo de las filas (fade visible)

  // Definir el NUEVO 'Leche' EN LA FILA: importancia 7, mínimo 1 → normal → ✅ comprado
  const filaLeche = page.locator("li[data-fila-ticket='Leche']");
  await filaLeche.locator(".tick-score").fill("7");
  await filaLeche.locator(".tick-min").fill("1");
  await pausa(1500);
  await filaLeche.locator("[data-tick-definir]").click();
  await pausa(2000);                                     // la fila pasa a normal (se va el fade)
  await filaLeche.locator("[data-buy]").click();
  await page.waitForSelector("#compra-qty");
  await pausa(2500);                                     // el diálogo pre-cargado: cantidad del ticket + criterio definido
  await page.click("[data-buy-confirm]");
  await pausa(2000);

  // El DUDOSO 'Yogur' con el mismo botón "🛒 Despensa?" → variante → compra IN-SITU
  await page.click("li[data-fila-ticket='Yogur'] [data-despensa]");
  await page.waitForSelector("[data-despensa-elegir='Yogur natural']");
  await pausa(1800);                                     // el diálogo de variantes
  await page.click("[data-despensa-elegir='Yogur natural']");
  await pausa(1800);                                     // el diálogo de compra (cantidad del ticket)
  await page.click("[data-buy-confirm]");
  await pausa(2200);                                     // fila fuera; 'Pan' (sin definir) queda a la espera

  // ── 5. Plano final: la despensa con lo resuelto ──
  await page.evaluate(() => document.querySelector('[data-view="foods"]').click());
  await page.waitForSelector("#view-foods.active");
  await pausa(3500);

  const videoCrudo = await page.video().path();          // nombre interno de playwright-core (¡Promesa!)
  await ctx.close();                                     // cerrar VUELCA el vídeo al fichero final
  const destino = path.join(VIDEO_DIR, "demo-escaner-ticket.webm");
  try { renameSync(videoCrudo, destino); } catch { copyFileSync(videoCrudo, destino); rmSync(videoCrudo, { force: true }); }
  console.log("VÍDEO grabado: " + destino);
  console.log("Capturas del recorrido en reports/ui-brave/23..26 (e2e/ocr-despensa.mjs)");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (tmpPng) rmSync(tmpPng, { force: true });
  server.close();
}

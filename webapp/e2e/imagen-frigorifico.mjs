// e2e/imagen-frigorifico.mjs — Genera la foto DE EJEMPLO de un frigorífico abierto para probar el
// escáner de despensa (#epic-ocr-despensa-camara) sin necesidad de móvil.
//   Ejecutar:  node e2e/imagen-frigorifico.mjs
//   Salida:    webapp/data/frigorifico-ejemplo.png  (imagen dibujada por código: libre de derechos)
// Y de verificación: en la MISMA ejecución la sube a la app servida en 127.0.0.1 y comprueba que el
// escáner (Tesseract spa) detecta los alimentos etiquetados — lista impresa en consola.
// Si se quiere una FOTO real de frigorífico, el flujo real es el del móvil (ver e2e/ocr-despensa.mjs).
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const SALIDA = path.join(RAIZ, "data", "frigorifico-ejemplo.png");
mkdirSync(path.dirname(SALIDA), { recursive: true });

// ── 1) DIBUJAR el frigorífico abierto en un canvas del navegador ──
const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const page = await browser.newPage({ viewport: { width: 1020, height: 1140 }, deviceScaleFactor: 1 });
const dataUrl = await page.evaluate(() => {
  const W = 1020, H = 1140;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const unoMas = (px, py, pw, ph, pr) => {           // rectángulo redondeado (por si no hay ctx.roundRect)
    x.beginPath();
    x.moveTo(px + pr, py);
    x.arcTo(px + pw, py, px + pw, py + ph, pr);
    x.arcTo(px + pw, py + ph, px, py + ph, pr);
    x.arcTo(px, py + ph, px, py, pr);
    x.arcTo(px, py, px + pw, py, pr);
    x.closePath();
  };

  // Cocina de fondo: pared cálida + encimera sutil
  x.fillStyle = "#eee7da"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#ddd5c5"; x.fillRect(0, 985, W, 155);

  // ── Carcasa del mueble (acero) e interior blanco con luz fría ──
  const cx = 280, cy = 120, cw = 470, ch = 900;
  unoMas(cx - 42, cy - 28, cw + 84, ch + 130, 20); x.fillStyle = "#8b96a2"; x.fill();
  unoMas(cx, cy, cw, ch, 10); x.fillStyle = "#f7f9fc"; x.fill();
  const glow = x.createLinearGradient(0, cy, 0, cy + ch);
  glow.addColorStop(0, "rgba(168,212,255,0.55)");
  glow.addColorStop(1, "rgba(214,236,255,0.18)");
  unoMas(cx, cy, cw, ch, 10); x.fillStyle = glow; x.fill();

  // Baldas (4) y cajones bajos (2)
  [340, 530, 700, 855].forEach(y => { x.fillStyle = "#ccd6e2"; x.fillRect(cx + 6, y, cw - 12, 15); });
  unoMas(cx + 16, 875, cw / 2 - 30, 130, 10); x.fillStyle = "rgba(196,219,241,0.9)"; x.fill();
  unoMas(cx + cw / 2 + 14, 875, cw / 2 - 30, 130, 10); x.fillStyle = "rgba(196,219,241,0.9)"; x.fill();

  // ── Puertas abiertas a los lados (paneles con baldas de puerta) ──
  const puerta = (dx) => {
    unoMas(dx, cy - 20, 165, ch + 110, 18); x.fillStyle = "#b3bdc7"; x.fill();
    ["#e6edf3", "#e6edf3"].forEach((col, i) => { x.fillStyle = col; x.fillRect(dx + 14, cy + 60 + i * 380, 137, 10); });
  };
  puerta(70); puerta(785);

  // ── Utilidades de comida + etiqueta (pill blanca, texto negrito — OCR-friendly) ──
  const etq = (texto, px, py) => {
    x.font = "bold 26px Arial";
    const w = x.measureText(texto).width + 26;
    unoMas(px - w / 2, py - 21, w, 42, 21);
    x.fillStyle = "rgba(255,255,255,0.97)"; x.fill();
    x.strokeStyle = "#5b6672"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#23303c"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(texto, px, py + 1);
  };
  const huevoEnBand = (px, py, w, h, col = "#f9f6f0") => { unoMas(px, py, w, h, 6); x.fillStyle = col; x.fill(); };
  const bola = (px, py, r, col) => { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };

  // Balda 1 (lácteos): cartón de leche, yogures, cuña de queso
  huevoEnBand(cx + 40, cy + 60, 84, 150);
  x.fillStyle = "#7aa7d8"; x.fillRect(cx + 40, cy + 60, 84, 34);
  etq("LECHE", cx + 82, cy + 245);
  [-1, 0, 1].forEach((i) => {
    const px = cx + 175 + i * 42;
    unoMas(px, cy + 150, 36, 60, 8); x.fillStyle = "#fff"; x.fill();
    x.fillStyle = "#e7a2b4"; x.fillRect(px, cy + 168, 36, 16);
  });
  etq("YOGUR", cx + 217, cy + 245);
  x.beginPath(); x.moveTo(cx + 335, cy + 235); x.lineTo(cx + 432, cy + 230); x.lineTo(cx + 398, cy + 172); x.closePath();
  x.fillStyle = "#f0c84b"; x.fill();
  etq("QUESO", cx + 385, cy + 245);

  // Balda 2 (huevos + frutas): huevera abierta, tomates, manzana
  unoMas(cx + 30, cy + 300, 165, 90, 8); x.fillStyle = "#d9c49a"; x.fill();
  for (let i = 0; i < 4; i++) bola(cx + 62 + i * 39, cy + 335, 15, "#f5efdf");
  unoMas(cx + 30, cy + 300, 165, 30, 8); x.fillStyle = "#c9b184"; x.fill();
  etq("HUEVOS", cx + 108, cy + 430);
  bola(cx + 245, cy + 352, 29, "#d9453a"); bola(cx + 273, cy + 368, 22, "#c93a30");
  x.fillStyle = "#3c7a3f"; x.fillRect(cx + 239, cy + 316, 6, 16);
  etq("TOMATE", cx + 262, cy + 430);
  bola(cx + 408, cy + 350, 31, "#c2453f");
  x.fillStyle = "#3c7a3f"; x.fillRect(cx + 404, cy + 312, 8, 20);
  etq("MANZANA", cx + 409, cy + 430);

  // Balda 3 (verdura + proteína): cebollas, zanahorias, muslo de pollo
  bola(cx + 58, cy + 565, 25, "#d8b06a"); bola(cx + 96, cy + 580, 21, "#cfa558");
  etq("CEBOLLA", cx + 70, cy + 640);
  [0, 1].forEach((i) => {
    const bx = cx + 185 + i * 58;
    x.beginPath(); x.moveTo(bx, cy + 610); x.lineTo(bx + 44, cy + 610); x.lineTo(bx + 22, cy + 515); x.closePath();
    x.fillStyle = "#e8862f"; x.fill();
    x.fillStyle = "#3f8f43"; x.fillRect(bx + 13, cy + 492, 6, 26);
  });
  etq("ZANAHORIA", cx + 245, cy + 640);
  x.beginPath(); x.ellipse(cx + 378, cy + 568, 36, 23, -0.5, 0, Math.PI * 2); x.fillStyle = "#c98f52"; x.fill();
  x.beginPath(); x.arc(cx + 408, cy + 536, 14, 0, Math.PI * 2); x.fillStyle = "#b9803f"; x.fill();
  etq("POLLO", cx + 395, cy + 640);

  // Cajón izquierdo: salmón. Cajón derecho: lechuga (DENTRO de los cajones, sobre el fondo azul)
  x.beginPath(); x.ellipse(cx + 116, 938, 60, 24, -0.2, 0, Math.PI * 2); x.fillStyle = "#e88451"; x.fill();
  x.beginPath(); x.moveTo(cx + 168, 924); x.lineTo(cx + 202, 908); x.lineTo(cx + 202, 944); x.closePath();
  x.fillStyle = "#dd7440"; x.fill();
  etq("SALMON", cx + 118, 985);
  bola(cx + 351, 936, 32, "#7fb069");
  etq("LECHUGA", cx + 351, 985);

  // Puerta izquierda: botella de aceite. Puerta derecha: mantequilla
  unoMas(110, cy + 120, 46, 150, 10); x.fillStyle = "#c7d96b"; x.fill();
  x.fillRect(126, cy + 96, 14, 30);
  etq("ACEITE", 133, cy + 320);
  unoMas(840, cy + 140, 110, 70, 8); x.fillStyle = "#f3e6a8"; x.fill();
  x.fillStyle = "#d9c670"; x.fillRect(840, cy + 140, 110, 22);
  etq("MANTEQUILLA", 895, cy + 262);

  // Pie informativo (no casará con el vocabulario de alimentos)
  x.font = "26px Arial"; x.fillStyle = "#8a8377"; x.textAlign = "center";
  x.fillText("Ejemplo para el escáner de despensa · Mr Cheff", W / 2, 1090);

  return c.toDataURL("image/png");
});
writeFileSync(SALIDA, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log("✔ imagen generada: " + path.relative(RAIZ, SALIDA));
await browser.close();

// ── 2) VERIFICAR: subirla al escáner servido en localhost y listar lo detectado ──
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  try {
    const d = readFileSync(path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url)));
    res.writeHead(200, { "Content-Type": MIME[path.extname(url)] || "application/octet-stream" });
    res.end(d);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;
const b2 = await chromium.launch({ executablePath: BRAVE, headless: true });
try {
  const p = await b2.newPage();
  await p.goto(APP);
  await p.waitForSelector("#btn-ocr-foto");
  const chooser = p.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
  await p.click("#btn-ocr-foto");
  await chooser;
  await p.setInputFiles("#ocr-file", SALIDA);
  await p.waitForSelector(".ocr-item", { timeout: 180000 });
  const nombres = await p.$$eval(".ocr-item input[type='text']", els => els.map(e => e.value));
  console.log(`✔ el escáner detecta ${nombres.length} candidatos en la imagen: ` + nombres.join(", "));
} catch (e) {
  console.error("FALLO en la verificación:", e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await b2.close();
  server.close();
}

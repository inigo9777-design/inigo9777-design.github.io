// e2e/scroll-caja-fuerte.mjs — BUGFIX 2026-10-24 (#bugfix/scroll-caja-fuerte-pwa): en la
// vista Caja fuerte (Copia de seguridad) la BARRA del scroll del documento se veía en el PWA
// (sus dos tarjetas miden ~283px más que el viewport y era la única scrollbar nativa sin
// esconder; nav de pestañas, modal y nombre de alimento ya la esconden).
// Ejecutar:   node e2e/scroll-caja-fuerte.mjs   (levanta su servidor local de localhost)
// Comprobaciones (espejo de la regla de style.css):
//   (1) Con view-backup ACTIVA: html queda con scrollbar-width:none (la barra del documento
//       ya no se pinta) — y el document sigue scrolleando hasta el fondo (la barra muere,
//       el scroll no).
//   (2) Al salir de la vista (Alimentos): la barra nativa VUELVE (scrollbar-width:auto) —
//       el alcance es SOLO la caja fuerte.
//   (3) De vuelta a la caja fuerte: vuelve a esconderse (el :has() se sigue evaluando en
//       cada activación de vista).
//   (4) Sin tocar La otra cara del documento: el viewport no gana una barra horizontal
//       (html scrollWidth sigue == clientWidth).
import { chromium } from "playwright-core";
import http from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
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
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  const file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ) || !existsSync(file) || !file.includes(".")) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");
  // el tutorial abre SOLO la primera visita: fuera del pase (rs no es lo que se verifica)
  await page.evaluate(() => localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true })));
  await page.reload();
  await page.waitForSelector(".topbar .tab");

  // (1) Caja fuerte activa: barra del documento escondida Y el scroll sigue vivo
  await page.click('[data-view="backup"]');
  await page.waitForSelector("#view-backup.active");
  const enBackup = await page.evaluate(() => {
    const st = getComputedStyle(document.documentElement);
    document.documentElement.scrollTo(0, 999999);
    return {
      scrollbarWidth: st.scrollbarWidth,
      scrollY: document.documentElement.scrollTop,                    // > 0 ⇒ el scroll respira
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,             // igual a innerWidth ⇒ sin barra horizontal nueva
      innerWidth: window.innerWidth
    };
  });
  ok(enBackup.scrollbarWidth === "none", `caja fuerte activa: scrollbar-width del documento = ${enBackup.scrollbarWidth} (esperado "none")`);
  ok(enBackup.scrollY > 0, `el scroll del documento SIGUE vivo con la barra escondida (scrollTop ${Math.round(enBackup.scrollY)} en un alto de ${enBackup.scrollHeight})`);
  ok(enBackup.scrollHeight > enBackup.scrollY, "el documento no perdió su alto (sin colapso de layout)");
  ok(enBackup.innerWidth === enBackup.clientWidth, `sin barra horizontal nueva (innerWidth ${enBackup.innerWidth} == clientWidth ${enBackup.clientWidth})`);

  // (2) Alimentar/otra vista: la barra nativa vuelve
  await page.click('[data-view="foods"]');
  await page.waitForSelector("#view-foods.active");
  const enAlimentos = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
  ok(enAlimentos === "auto", `alimentos activa: scrollbar-width del documento = ${enAlimentos} (esperado "auto" — el alcance es SOLO la caja fuerte)`);

  // (3) Y de vuelta: se vuelve a esconder
  await page.click('[data-view="backup"]');
  await page.waitForSelector("#view-backup.active");
  const deVuelta = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
  ok(deVuelta === "none", `vuelta a la caja fuerte: scrollbar-width = ${deVuelta} (el :has se re-evalúa en cada activación)`);

  await page.screenshot({ path: path.join(OUT_DIR, "scroll-caja-fuerte.png") });
  console.log("(captura: reports/ui-brave/scroll-caja-fuerte.png)");
} finally {
  await browser.close();
  server.close();
}
if (fallos) { console.log(`\n${fallos} check(s) en rojo`); process.exit(1); }
console.log("\n6 checks en verde");

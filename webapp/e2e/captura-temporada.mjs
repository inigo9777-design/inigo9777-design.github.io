// e2e/captura-temporada.mjs — captura de la vista Temporada en escritorio y móvil
// para el rediseño de 2026-10-23 (iconos reales + 3 por fila en móvil).
// Uso: node e2e/captura-temporada.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });

async function captura(nombre, viewport) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width < 700 });
  await page.goto(APP);
  await page.evaluate(() => {
    document.querySelector('[data-view="seasonal"]').click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, nombre), fullPage: false });
  await page.close();
  console.log("captura:", nombre);
}

await captura("79-temporada-desktop.png", { width: 1280, height: 900 });
await captura("79-temporada-movil.png", { width: 360, height: 800 });
await browser.close();

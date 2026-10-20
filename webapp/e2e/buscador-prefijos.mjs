// e2e/buscador-prefijos.mjs — MATCH por PREFIJO del buscador del catálogo con Brave REAL.
// Ejecutar: node e2e/buscador-prefijos.mjs   (feature petición 2026-10-20 "menos letras")
//  1) "croqu" (5 letras) ya muestra Croquetas — antes requería la palabra completa.
//  2) "gamb" muestra Gambas al ajillo — match por TÍTULO.
//  3) escribir la palabra COMPLETA sigue mandando: el exacto ranquea antes que el prefijo.
//  4) SÓLO TÍTULO (fix 2026-10-20): "mascarpone" (sólo ingrediente del Tiramisú) NO saca resultados.
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++; };

try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");
  await page.evaluate(() => document.querySelector('[data-view="recipes"]').click());   // la card vive en la vista Recetas
  await page.waitForSelector("#recipe-catalog-search", { state: "visible" });

  const titulos = async () => page.$$eval("#recipe-catalog-results .recipe-card h3", els => els.map(e => e.textContent));
  const hayResultados = async (consulta, contiene, etiqueta) => {
    await page.fill("#recipe-catalog-search", "");
    await page.type("#recipe-catalog-search", consulta);
    await page.waitForTimeout(120);
    const lista = await titulos();
    ok(lista.some(t => t.includes(contiene)), `${etiqueta}: "${consulta}" muestra "${contiene}" (${lista.length} resultados)`);
    return lista;
  };

  await hayResultados("croqu", "Croquetas", "(1) prefijo corto");
  await hayResultados("gamb", "Gambas al ajillo", "(2) prefijo 4 letras");
  // (3) afinidad: el exacto de título (3 pts) ranquea antes que el prefijo (2 pts)
  await page.fill("#recipe-catalog-search", "");
  await page.type("#recipe-catalog-search", "tortilla");
  await page.waitForTimeout(120);
  const exactos = await titulos();
  ok(exactos[0].includes("Tortilla"), `(3) exacto manda: 1ª con "tortilla" completa es "${exactos[0]}"`);
  // (4) SÓLO TÍTULO: lo que sólo está en los ingredientes ya no cuenta
  await page.fill("#recipe-catalog-search", "");
  await page.type("#recipe-catalog-search", "mascarpone");
  await page.waitForTimeout(120);
  ok((await titulos()).length === 0, `(4) sólo título: "mascarpone" (sólo ingrediente del Tiramisú) NO saca resultados`);
  await page.screenshot({ path: path.join(OUT, "67-buscador-prefijos.png") });
  await browser.close();
} catch (e) {
  fallos++;
  console.error("EXCEPCIÓN:", e.message);
}
console.log(fallos ? "\nFALLOS: " + fallos : "\nTODO OK");
process.exit(fallos ? 1 : 0);

// e2e/analisis-texto.mjs — Verificación del análisis de texto (3ª gen.) con Brave REAL.
// Ejecutar:  node e2e/analisis-texto.mjs
// El usuario escribe la receta A MANO en la vista Crear receta; el análisis local (sin red)
// NO puede dejar fuera ingredientes ni pasos. Se verifica con receta realista en el textarea
// y se comprueba lo que llegue a la PREVISUALIZACIÓN (lo que el usuario ve y confirma).
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const RECETA = `Tortilla de camarones para 2 personas

2 huevos, 200 gramos de harina, un puñado de chirlas y media cebolla.

Bate los huevos con sal hasta que espume.
Cuando la cebolla esté dorada, añade las chirlas y vierte la masa.
Fríe a fuego medio durante 3 minutos por cada lado.`;

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");
  await page.click(".tab[data-view='recipes']");
  await page.waitForSelector("#recipe-desc");

  // Escribir la receta A MANO (los caracteres entran por teclado: es exactamente lo que hace el usuario)
  await page.fill("#recipe-desc", RECETA);
  await page.selectOption("#recipe-meal", "cena");
  await page.click("#btn-generate");
  await page.waitForSelector("#recipe-preview:not(.hidden)");

  const prev = await page.evaluate(() => ({
    title: document.getElementById("pv-title").value,
    ing: document.getElementById("pv-ingredients").value,
    met: document.getElementById("pv-method").value,
  }));

  // (1) NINGÚN ingrediente se pierde — dict, fuera-de-dict por cantidad y despensa no hacen falta
  const ing = prev.ing.split("\n").filter(Boolean);
  ok(ing.includes("Tortilla de camarones") && ing.includes("Camarones"), "(1) plato compuesto 'Tortilla de camarones' + camarones (sin perder la inicial en mayúscula)");
  ok(ing.includes("Huevos") && ing.includes("Cebolla"), "(1) huevos y cebolla del listado con comas");
  ok(ing.includes("Harina") && ing.includes("Chirlas"), "(1) harina y chirlas (antes sólo diccionario/falla=0 de 2)");
  ok(ing.includes("Sal"), "(1) sal del paso 1");

  // (2) NINGÚN paso se pierde ni se descuelga
  const pasos = prev.met.split("\n").filter(Boolean);
  ok(pasos[0]?.includes("Bate los huevos con sal hasta que espume"), "(2) paso 1: 'Bate' (imperativo irregular) completo con su cola 'hasta que espume'");
  ok(pasos.some(p => p.includes("Cuando la cebolla esté dorada, añade las chirlas")), "(2) intro anclada al paso que le sigue");
  ok(pasos.some(p => p.includes("Vierte la masa")), "(2) 'Vierte' (imperativo irregular) capturado");
  ok(pasos.some(p => p.includes("Fríe a fuego medio durante 3 minutos por cada lado")), "(2) 'Fríe' con tiempo/fuego completos");
  ok(!pasos.some(p => /^2\.\s*Cuando la cebolla esté dorada\.$/.test(p)), "(2) la intro ya NO sale como paso suelto sin acción");

  // (3) Imagen de la previsualización tal como la ve el usuario
  const prevBox = await page.locator("#recipe-preview").boundingBox();
  await page.screenshot({
    path: path.join(OUT_DIR, "21-analisis-texto-previsualizacion.png"),
    clip: { x: prevBox.x - 8, y: prevBox.y - 8, width: prevBox.width + 16, height: prevBox.height + 16 },
  });

  // (4) Caracteres como el usuario los escribe: copia/adaptación con ŵords fuera de diccionario
  await page.fill("#recipe-desc", "50 g de pesto, una cucharada de pimentón dulce. Mezclar, servir al momento en un bol.");
  await page.click("#btn-generate");
  const prev2 = await page.evaluate(() => ({
    ing: document.getElementById("pv-ingredients").value,
    met: document.getElementById("pv-method").value,
  }));
  ok(prev2.ing.includes("Pesto") && prev2.ing.includes("Pimentón dulce"), "(4) pesto (fuera de diccionario) + 'Pimentón dulce' compuesto");
  ok(prev2.ing.split("\n").filter(Boolean).every(l => !/\bbol\b|minuto/i.test(l)), "(4) ni 'bol' ni 'minuto' cuelan como ingrediente");
  ok(prev2.met.startsWith("1. Mezclar"), "(4) pasos mantienen su numeración");

  if (fallos) throw new Error(fallos + " comprobaciones del análisis fallidas");
  console.log("\nANÁLISIS OK — captura: reports/ui-brave/21-analisis-texto-previsualizacion.png");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

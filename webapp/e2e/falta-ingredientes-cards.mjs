// e2e/falta-ingredientes-cards.mjs — Verificación en Brave REAL del feature 2026-10-24:
// la línea "⚠️ Falta / ✅ Todos los ingredientes en casa" en las cards de Mis Recetas, ideas
// de Innovación, lote de Sugerencias (Card 1) y en la FICHA desde cualquier vista (los
// "⚠️ No lo tienes" dejaron de ser exclusivos de Sugerencias/Menú).
// Ejecutar:  node e2e/falta-ingredientes-cards.mjs
import { chromium } from "playwright-core";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const WEBAPP = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");   // …/webapp (el fichero vive en webapp/e2e/)
const OUT = path.resolve(WEBAPP, "../reports/ui-brave");
const APP = "http://localhost:8631/";

let aciertos = 0, fallos = 0;
const ok = (cond, texto) => {
  if (cond) { aciertos += 1; console.log("  ✓", texto); }
  else { fallos += 1; console.log("  ✘", texto); }
};

const server = spawn("python3", ["-m", "http.server", "8631"], { cwd: WEBAPP, stdio: ["ignore", "ignore", "inherit"] });
server.on("error", e => console.log("[server error]", String(e)));
// Sondeo de arranque: las navegaciones esperan a que el servidor conteste 200 (a los 800 ms no siempre está)
let servida = false;
for (let i = 0; i < 50 && !servida; i += 1) {
  try { const r = await fetch(APP); servida = r.ok; } catch { await new Promise(r => setTimeout(r, 200)); }
}
if (!servida) { console.log("FALLO: el servidor no arrancó"); process.exit(1); }

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", e => errores.push(String(e)));

  // (1) Siembra: despensa con faltas (Espinacas qty 0; "Crema de manos" es HOGAR) + 3 recetas.
  await page.goto(APP, { waitUntil: "load" });
  await page.waitForSelector(".topbar .tab");
  await page.evaluate(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify([
      { id: "f1", name: "Pan", qty: 3, min: 1, score: 3 },
      { id: "f2", name: "Huevos", qty: 4, min: 1, score: 5 },
      { id: "f3", name: "Sal", qty: 2, min: 1, score: 4 },
      { id: "f4", name: "Espinacas", qty: 0, min: 1, score: 8 },
      { id: "f5", name: "Crema de manos", qty: 5, min: 0, score: 5, categoria: "hogar" }
    ]));
    localStorage.setItem("mrcheff.recipes", JSON.stringify([
      { id: "r1", title: "Huevos escalfados sobre espinacas", meal: "comida",
        ingredients: ["Pan", "Espinacas", "Vino blanco", "Sal"], method: ["Escalda los huevos con vino", "Sirve sobre las espinacas"], createdAt: 1 },
      { id: "r2", title: "Huevos duros con sal", meal: "desayuno",
        ingredients: ["Huevos", "Sal"], method: ["Cuece", "Pela"], createdAt: 2 },
      { id: "r3", title: "Crema de nada", meal: "cena",
        ingredients: ["Crema"], method: ["Bate"], createdAt: 3 }
    ]));
    localStorage.setItem("mrcheff.innov", JSON.stringify([
      { id: "i1", title: "Tortilla de Espinacas", meal: "comida", source: "nueva",
        ingredients: ["Huevos", "Espinacas"], method: ["Bate", "Cuaja"], createdAt: Date.now(), uses: ["Huevos"] }
    ]));
    localStorage.setItem("mrcheff.innov.date", new Date().toISOString().slice(0, 10));
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".topbar .tab");
  console.log("[diag] tabs tras reload:", await page.locator(".topbar .tab").count(),
    "| html len:", await page.evaluate(() => document.documentElement.outerHTML.length));
  if (errores.length) console.log("[pageerror]", errores.join(" || ").slice(0, 600));
  ok(await page.evaluate(() => document.getElementById("view-foods").classList.contains("active")),
    "(1) la app arrancó en Alimentos");

  // (2) Mis Recetas: Falta en la card con Espinacas+Vino; verde en la completa; el HOGAR no cubre.
  ok(await page.locator("#recipe-list .recipe-card").count() === 3,
    "(2) Mis Recetas pinta 3 tarjetas");
  ok(await page.locator("#recipe-list .recipe-card", { hasText: "escalfados" }).textContent().then(t => t.includes("Falta: Espinacas, Vino blanco")),
    "(2) la card escalfada muestra '⚠️ Falta: Espinacas, Vino blanco'");
  ok(await page.locator("#recipe-list .recipe-card", { hasText: "duros" }).textContent().then(t => t.includes("Todos los ingredientes en casa")),
    "(2) la card completa muestra la línea verde '✅ Todos los ingredientes en casa'");
  ok(await page.locator("#recipe-list .recipe-card", { hasText: "Crema de nada" }).textContent().then(t => t.includes("Falta: Crema")),
    "(2) el producto de HOGAR no cubre cocina: la card de 'Crema' sigue en Falta");
  await page.locator('[data-view="recipes"]').click();
  await page.locator("#recipe-list .recipe-card", { hasText: "escalfados" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "82-falta-mis-recetas.png") });

  // (3) Ficha desde Mis Recetas: los '⚠️ No lo tienes' salen también aquí (antes sólo Sugerencias/Menú).
  await page.locator("#recipe-list .recipe-card", { hasText: "escalfados" }).click();
  await page.waitForSelector("#modal:not(.hidden)");
  const marcadosFuera = await page.locator("#modal-content li.meal-missing .missing-badge").count();
  ok(marcadosFuera === 2,
    `(3) la ficha desde Mis Recetas marca ${marcadosFuera} (2) ingredientes con '⚠️ No lo tienes'`);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(OUT, "82-falta-ficha-mis-recetas.png") });
  await page.locator("#modal .modal-close").click();

  // (4) Innovación: la card de la idea también respira la despensa.
  await page.locator('[data-view="innovation"]').click();
  ok(await page.locator("#innovation-list .recipe-card").textContent().then(t => t.includes("Falta: Espinacas")),
    "(4) Innovación: la idea sembrada enseña 'Falta: Espinacas'");

  // (5) REPINTADO en vivo: ➕ de Espinacas (Alimentos) → la card de Mis Recetas dice 'Falta: Vino blanco'.
  await page.locator('[data-view="foods"]').click();
  const filaEspinacas = page.locator("#food-list li", { hasText: "Espinacas" }).first();
  await filaEspinacas.locator("button[data-inc]").first().click();
  await page.locator('[data-view="recipes"]').click();
  ok(await page.locator("#recipe-list .recipe-card", { hasText: "escalfados" }).textContent()
    .then(t => t.includes("Falta: Vino blanco") && !t.includes("Espinacas")),
    "(5) tras ➕ de Espinacas la card se repinta al momento a 'Falta: Vino blanco'");
  await page.locator("#recipe-list .recipe-card", { hasText: "escalfados" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "82-falta-repintado.png") });

  // (6) Card 1 sugerencias: cada tarjeta con UNA de las dos líneas.
  await page.locator('[data-view="suggest"]').click();
  await page.locator("#btn-suggest-generate").click();
  const tarjetas = await page.locator("#suggest-list .recipe-card").count();
  ok(tarjetas > 0, "(6) Card 1 sugiere tarjetas");
  const conLinea = await page.evaluate(() => [...document.querySelectorAll("#suggest-list .recipe-card")].every(c =>
    [...c.querySelectorAll(".innov-uses")].some(e => e.textContent.includes("Falta:") || e.textContent.includes("Todos los ingredientes en casa"))));
  ok(conLinea, "(6) todas las tarjetas del lote llevan la línea Falta / todo-en-casa");
  await page.screenshot({ path: path.join(OUT, "82-falta-sugerencias.png") });
} finally {
  await browser.close();
  server.kill();
}
console.log(fallos === 0 ? `\nTODO OK — ${aciertos} comprobaciones verdes (capturas reports/ui-brave/82-*)` : `\nFALLO: ${fallos} de ${aciertos + fallos} comprobaciones fallidas`);
process.exit(fallos === 0 ? 0 : 1);

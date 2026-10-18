// e2e/ui-brave.mjs — Pruebas UI + capturas con Brave REAL (no Chromium de Playwright).
// Ejecutar:  node e2e/ui-brave.mjs
// Cubre: (1) pestaña compacta de Copia de seguridad (reposo/hover/activa), (2) rotación del
// botón "↻ Sugerir ahora" (2 clicks ⇒ landings distintas), (3) modal de detalle de receta.
// Las capturas van a reports/ui-brave/ en la raíz del repo.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const shots = [];
async function snap(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  shots.push(name);
}

// Aforo sembrado (perfiles frescos de Brave no tienen nada en localStorage por file://):
// Se construye desde el propio CATÁLOGO CURADO: unión de los ingredientes de las 4 primeras
// recetas con qty>0 → garantiza que haya recetas 100% cocinables para "↻ Sugerir ahora".
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const catalogo = require("../data/recetas-espanolas-data.js");
const nombresAforo = [...new Set(catalogo.slice(0, 20).flatMap(r => r.ingredients || []))];
const PANTRY = nombresAforo.map((n, i) => JSON.stringify({ id: "f-" + i, name: n, qty: 5, min: 1, score: 5, checked: false, createdAt: i }));

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
try {
  // ============ (1) TOPBAR: pestaña Copia de seguridad compacta ============
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.addInitScript(`localStorage.setItem("mrcheff.foods", JSON.stringify([${PANTRY}]));`);
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab-side");

  // (1a) Reposo: sólo el icono, a la derecha del alternador de tema.
  const side = page.locator(".tab-side");
  const toggle = page.locator("#theme-toggle");
  const boxT = await toggle.boundingBox();
  const boxB = await side.boundingBox();
  if (!boxT || !boxB) throw new Error("No se encontraron theme-toggle / tab-side en el topbar");
  const aLaIzquierda = boxB.x + boxB.width <= boxT.x + 2;        // backup JUSTO a la izquierda del toggle
  const pegado = (boxT.x - (boxB.x + boxB.width)) < 30;          // y sin hueco raro entre ambos
  const estiloToggle = await side.evaluate(el => {
    const cs = getComputedStyle(el);
    return cs.height === "38px" && parseFloat(cs.borderRadius) >= 19 && cs.borderStyle === "solid";
  });
  const etiquetaOculta = await side.locator(".tab-label").evaluate(el => getComputedStyle(el).opacity === "0");
  // Tabs centrados en el header: el centro de .tabs debe coincidir con el centro del .topbar (±6px)
  // y el clúster derecho sigue pegado al borde derecho (pegado del toggle ≈ padding del header).
  const geoHeader = await page.evaluate(() => {
    const bar = document.querySelector(".topbar").getBoundingClientRect();
    const tabs = document.querySelector(".tabs").getBoundingClientRect();
    return { centroTabs: tabs.x + tabs.width / 2, centroBarra: bar.x + bar.width / 2, barRight: bar.right };
  });
  const bordeDerechoToggle = geoHeader.barRight - (boxT.x + boxT.width);   // pegado del toggle al borde del header
  const tabsCentrados = Math.abs(geoHeader.centroTabs - geoHeader.centroBarra) <= 6;
  const toggleEnSuSitio = bordeDerechoToggle >= 0 && bordeDerechoToggle <= 30;
  await snap(page, "01-topbar-reposo.png");
  console.log("1a. reposo: aLaIzquierda=" + aLaIzquierda + " pegado=" + pegado + " estiloToggle=" + estiloToggle +
    " anchoPill=" + Math.round(boxB.width) + "px etiquetaOculta=" + etiquetaOculta +
    " | tabsCentrados=" + tabsCentrados + " (desvío " + Math.round(geoHeader.centroTabs - geoHeader.centroBarra) + "px) toggleEnSuSitio=" + toggleEnSuSitio);
  if (!aLaIzquierda || !pegado || !estiloToggle || !etiquetaOculta) throw new Error("El icono de backup no está como se pidió");
  if (!tabsCentrados) throw new Error("Los tabs NO están centrados en el header");
  if (!toggleEnSuSitio) throw new Error("El clúster derecho (backup+tema) se movió del borde");

  // (1b) Hover: la etiqueta "Copia de seguridad" se despliega.
  await side.hover();
  await page.waitForTimeout(400);                      // deja terminar la transición de max-width
  const etiquetaHover = await side.locator(".tab-label").evaluate(el => {
    const cs = getComputedStyle(el); return cs.opacity === "1" && parseFloat(cs.maxWidth) > 5;
  });
  await snap(page, "02-topbar-hover-etiqueta.png");
  console.log("1b. hover: etiquetaDesplegada=" + etiquetaHover);

  // (1c) Click: activa la vista backup Y el estado activo mantiene la etiqueta visible.
  await side.click();
  await page.waitForTimeout(400);
  const vistaActiva = await page.locator("#view-backup.active").count();
  const etiquetaActiva = await side.locator(".tab-label").evaluate(el => {
    const cs = getComputedStyle(el); return cs.opacity === "1" && parseFloat(cs.maxWidth) > 5;
  });
  await snap(page, "03-backup-activa.png");
  console.log("1c. activa: vistaBackup=" + (vistaActiva === 1) + " etiquetaVisible=" + etiquetaActiva);
  await ctx.close();

  // ============ (2) Sugerencias y menú: "↻ Sugerir ahora" ROTA ============
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(`localStorage.setItem("mrcheff.foods", JSON.stringify([${PANTRY}]));`);
  await p2.goto(APP);
  await p2.locator('.tab[data-view="suggest"]').click();
  await p2.waitForSelector("#btn-suggest-generate");

  const tanda = async () => {
    await p2.locator("#btn-suggest-generate").click();
    await p2.waitForTimeout(250);
    const cards = p2.locator("#suggest-list .recipe-card");
    const n = await cards.count();
    const titulos = await p2.locator("#suggest-list h3").allTextContents();
    const comidas = await cards.locator(".tag[class*='meal-']").evaluateAll(els =>
      els.map(e => ([...e.classList].find(c => c.startsWith("meal-")) || "").slice(5)));
    return { n, titulos, comidas };
  };
  const t1 = await tanda();
  await snap(p2, "04-sugerencias-click1.png");
  const t2 = await tanda();
  await snap(p2, "05-sugerencias-click2.png");
  const t3 = await tanda();
  const nuevosEnT2 = t2.titulos.filter(t => !t1.titulos.includes(t));
  const nuevosEnT3 = t3.titulos.filter(t => !t2.titulos.includes(t));
  console.log("2. click1=" + t1.n + " | click2=" + t2.n + " (nuevos=" + nuevosEnT2.length + ") | click3=" + t3.n + " (nuevos=" + nuevosEnT3.length + ")");
  if (!t1.n || !t2.n || !t3.n) throw new Error("Alguna tanda de sugerencias quedó vacía");
  if (t1.n > 4 || t2.n > 4 || t3.n > 4) throw new Error("El lote supera las 4 tarjetas permitidas");
  for (const t of [t1, t2, t3]) {
    const tipos = new Set(t.comidas);
    if (tipos.size < 3) throw new Error("El lote no cubre 1 desayuno + 1 comida + 1 cena (tuvo: " + [...tipos].join(",") + ")");
  }
  if (nuevosEnT2.length === 0) throw new Error("El segundo click NO trajo recetas nuevas");
  if (nuevosEnT3.length === 0) throw new Error("El tercer click NO trajo recetas nuevas");

  // ============ (3) Modal de detalle (verificación final con estilos nuevos) ============
  const primera = p2.locator("#suggest-list .recipe-card").first();
  if (await primera.count()) {
    await primera.click();
    await p2.waitForSelector("#modal:not(.hidden)");
    await snap(p2, "06-modal-detalle.png");
    await p2.keyboard.press("Escape");
  }
  await p2.locator("#btn-suggest-clear").click().catch(() => p2.locator("#btn-suggest-clear").click()); // tolera toasts superpuestos
  await ctx2.close();

  // ============ (4) Móvil con Brave (viewport real de CDP, sin el mínimo de ventana) ============
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.addInitScript(`localStorage.setItem("mrcheff.foods", JSON.stringify([${PANTRY}]));`);
  await p3.goto(APP);
  await snap(p3, "07-movil-topbar.png");
  const sinScrollX = await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  console.log("4. móvil 390px: sinScrollHorizontal=" + sinScrollX);
  await ctx3.close();

  writeFileSync(path.join(OUT_DIR, "resumen.txt"),
    "Resultados Brave UI\n" +
    "1a. icono toggle-like a la izquierda del tema: " + (aLaIzquierda && pegado && estiloToggle && etiquetaOculta) + "\n" +
    "1b. hover despliega etiqueta: " + etiquetaHover + "\n" +
    "1c. activa muestra etiqueta y vista: " + etiquetaActiva + " / " + vistaActiva + "\n" +
    "2.  lotes ≤4 con 1 desayuno+1 comida+1 cena: click2 +" + nuevosEnT2.length + " nuevos, click3 +" + nuevosEnT3.length + " nuevos\n" +
    "4.  móvil sin scroll-x: " + sinScrollX + "\n");
  console.log("\nOK — capturas en " + OUT_DIR);
} finally {
  await browser.close();
}

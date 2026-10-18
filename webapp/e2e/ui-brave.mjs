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

  // ============ (2b) Etiqueta de origen (Española/Italiana) en todas las vistas de recetas ============
  // Contexto PROPIO: su aforo restringido (sólo tiramisú) NO debe tocar el localStorage que usa la sección 3 (p2).
  const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p4 = await ctx4.newPage();
  // Aforo EXACTO del tiramisú: la única receta 100% cubierta es él → la primera idea saldrá italiana (determinista).
  const tiramisu = catalogo.find(r => r.id === "tiramisu-casero");
  const pantryIt = [...new Set(tiramisu.ingredients)].map((n, i) => JSON.stringify({ id: "i-" + i, name: n, qty: 5, min: 1, score: 5, checked: false, createdAt: i }));
  await p4.addInitScript(`localStorage.setItem("mrcheff.foods", JSON.stringify([${pantryIt}]));`);
  await p4.goto(APP);
  await p4.locator('.topbar .tab[data-view="innovation"]').click();
  await p4.waitForSelector("#btn-generate-innov");
  // Decisión vía ns global (la de producción): módulo cargado + dataset con ids italianos
  const origenGlobal = await p4.evaluate(() => {
    const m = window.MRCheff.origenRecetas;
    const it = window.MRCheff.recetasEspanolas.find(r => r.id === "tiramisu-casero");
    const es = window.MRCheff.recetasEspanolas.find(r => r.id === "tostada-tomate-ajo");
    return { ita: m.etiquetaOrigen(it), esp: m.etiquetaOrigen(es), idea: m.etiquetaOrigen({ id: "uid-x", title: "Tiramisú casero" }) };
  });
  console.log("2b-global:", JSON.stringify(origenGlobal));
  if (origenGlobal.ita !== "Receta italiana" || origenGlobal.esp !== "Receta española" || origenGlobal.idea !== "Receta italiana")
    throw new Error("etiquetaOrigen por global NO distingue origen: " + JSON.stringify(origenGlobal));
  // Badge VIVO en Innovación: la ETIQUETA existente ("Receta española" fija) debe actualizarse a italiana
  await p4.locator("#btn-generate-innov").click();
  await p4.waitForSelector("#innovation-list .recipe-card");
  const badgesInnov = await p4.evaluate(() => [...document.querySelectorAll("#innovation-list .recipe-card")].map(c => {
    const tag = c.querySelector('[class*="tag-origen-"]');
    if (!tag) return null;
    return { txt: tag.textContent.trim(), ita: tag.className.includes("tag-origen-italiana") };
  }));
  if (badgesInnov.some(b => !b)) throw new Error("Hay tarjetas de Innovación SIN badge de origen");
  if (!badgesInnov.some(b => b.ita && b.txt === "Receta italiana"))
    throw new Error("La etiqueta de Innovación NO se actualizó a 'Receta italiana'");
  const resumo = await p4.locator("#innov-summary").textContent();
  if (!resumo.includes("Receta italiana")) throw new Error("El resumen de Innovación no menciona 'Receta italiana'");
  await snap(p4, "11-innovacion-etiqueta-italiana.png");
  // Sugerencias (~misma wiring en app.js): TODAS las tarjetas llevan badge de origen
  await p4.locator('.topbar .tab[data-view="suggest"]').click();
  await p4.locator("#btn-suggest-generate").click();
  await p4.waitForSelector("#suggest-list .recipe-card");
  const sinBadgeSug = await p4.locator("#suggest-list .recipe-card:not(:has([class*='tag-origen-']))").count();
  if (sinBadgeSug > 0) throw new Error(sinBadgeSug + " tarjetas de Sugerencias sin badge de origen");
  // Menú semanal: generar plan 7×3 y comprobar badges en los huecos
  await p4.locator("#btn-menu-generate").click();
  await p4.waitForSelector(".menu-meal-row .menu-meal-title");
  const slotsSinBadge = await p4.locator(".menu-meal-row[data-meal-idx]:not(:has([class*='tag-origen-']))").count();
  if (slotsSinBadge > 0) throw new Error(slotsSinBadge + " huecos del plan sin badge de origen");
  await snap(p4, "12-menu-etiquetas-origen.png");
  // Modal de detalle: badge de origen presente junto a la comida
  await p4.locator("#suggest-list .recipe-card").first().click();
  await p4.waitForSelector("#modal:not(.hidden)");
  const badgeModal = await p4.locator("#modal-content [class*='tag-origen-']").count();
  if (badgeModal !== 1) throw new Error("El modal de detalle NO lleva badge de origen");
  await p4.keyboard.press("Escape");
  await ctx4.close();

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
  await p3.waitForSelector(".food-item");
  await snap(p3, "07-movil-topbar.png");
  const sinScrollX = await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  // El NOMBRE del alimento no debe partirse en vertical: su altura de caja debe ser la de pocas
  // líneas de texto (≤ 3 líneas ≈ 66px), no una torreta de 1 carácter por línea.
  const nombreVertical = await p3.evaluate(() => {
    const nombres = [...document.querySelectorAll(".food-item .food-name")];
    return nombres.filter(el => el.getBoundingClientRect().height > 66).length;
  });
  const accionesEnSuFila = await p3.evaluate(() => {
    const [item] = document.querySelectorAll(".food-item");
    const name = item.querySelector(".food-name").getBoundingClientRect();
    const acts = item.querySelector(".food-actions").getBoundingClientRect();
    return acts.top >= name.bottom - 2;   // acciones en la 2ª línea, debajo del nombre
  });
  console.log("4. móvil 390px: sinScrollHorizontal=" + sinScrollX + " nombresEnVertical=" + nombreVertical + " accionesFila2=" + accionesEnSuFila);
  if (nombreVertical > 0) throw new Error("Hay nombres de alimentos partidos en vertical en móvil");
  if (!accionesEnSuFila) throw new Error("Las acciones no quedaron en la segunda línea");
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

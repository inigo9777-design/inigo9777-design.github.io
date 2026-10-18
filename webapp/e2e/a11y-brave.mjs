// e2e/a11y-brave.mjs — Verificación de accesibilidad con Brave REAL (no Chromium de Playwright).
// Ejecutar:  node e2e/a11y-brave.mjs
// Cubre: (1) navegación honesta con aria-current en el topbar, (2) teclado: tarjeta clicable abre
// el modal con Enter y el foco vuelve a la tarjeta al cerrar, (3) modal dialog/aria-modal con su
// nombre accesible, (4) toast role=status aria-live, (5) botones de icono con aria-label,
// (6) capturas del anillo de foco en claro y oscuro.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");

  // (1) Navegación: sin patrón tab incompleto + aria-current en la activa
  const nav = await page.evaluate(() => {
    const navEl = document.querySelector(".tabs");
    return {
      tieneTablist: !!navEl?.getAttribute("role"),
      ariaLabel: navEl?.getAttribute("aria-label"),
      activa: navEl?.querySelector(".tab[aria-current='true']")?.dataset.view || null,
    };
  });
  ok(!nav.tieneTablist, "(1) .tabs sin role incompleto de tablist");
  ok(nav.ariaLabel === "Secciones", "(1) .tabs con aria-label='Secciones'");
  ok(nav.activa === "foods", "(1) pestaña activa con aria-current (foods)");
  await page.click(".tab[data-view='seasonal']");
  const activa2 = await page.evaluate(() => document.querySelector(".tab[aria-current='true']")?.dataset.view);
  ok(activa2 === "seasonal", "(1) aria-current sigue a la vista al cambiar de pestaña");
  await page.click(".tab[data-view='foods']");

  // (5) Botones de icono con aria-label (despensa sembrada por la UI: escribo 1 alimento)
  await page.fill("#food-name", "Huevos");
  await page.click("#food-form button[type='submit']");
  await page.waitForSelector(".food-item");
  const labelsIconos = await page.evaluate(() => {
    const li = document.querySelector(".food-item");
    const botones = [...li.querySelectorAll("button")];
    return {
      todosEtiquetados: botones.every(b => (b.getAttribute("aria-label") || "").length > 0),
      checkout: li.querySelector("input[type='checkbox']")?.getAttribute("aria-label") || "",
    };
  });
  ok(labelsIconos.todosEtiquetados, "(5) ➕/➖/🗑 de la fila de alimentos tienen aria-label");
  ok(labelsIconos.checkout.includes("Huevos"), "(5) checkbox 'Hoy está en casa' nombrado con el alimento");

  // (6a) Indicadores de foco en modo OSCURO: por teclado, los campos usan halo (box-shadow) + borde
  // de marca (con prefers-contrast: more ganan además outline); los botones/tarjetas usan el anillo.
  await page.keyboard.press("Tab");
  const focoVisible = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { halo: cs.boxShadow !== "none", detalle: cs.boxShadow.slice(0, 48) };
  });
  const focoEn = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  console.log("   (foco tras 1×Tab →", focoEn, "halo=" + focoVisible.halo, focoVisible.detalle + ")");
  ok(focoVisible.halo, "(6) indicador de foco visible al navegar por teclado (halo del campo)");
  // Captura del foco real por teclado sobre el filtro (clip con margen: el halo/borde vive dentro
  // del elemento, pero dejamos aire para leerlo en contexto).
  const filtroBox = await page.locator("#food-filter").boundingBox();
  await page.screenshot({
    path: path.join(OUT_DIR, "18-a11y-foco-topbar-oscuro.png"),
    clip: { x: filtroBox.x - 14, y: filtroBox.y - 14, width: filtroBox.width + 28, height: filtroBox.height + 28 },
  });

  // Modo CLARO + captura del foco en una tarjeta de receta
  await page.click("#theme-toggle");
  await page.click(".tab[data-view='recipes']");
  await page.click("#recipe-meal-filter");
  const recetaSemilla = { id: "seed-a11y", title: "Tortilla de prueba", meal: "comida", ingredients: ["Huevos", "Aceite"], method: ["Batir", "Freír"], createdAt: 1 };
  await page.evaluate((r) => { localStorage.setItem("mrcheff.recipes", JSON.stringify([r])); }, recetaSemilla);
  await page.reload();
  await page.click(".tab[data-view='recipes']");
  await page.waitForSelector("#recipe-list .recipe-card");
  const card = page.locator("#recipe-list .recipe-card").first();
  // Foco real por teclado: Tab desde el filtro ⇒ seguinte focusable es la tarjeta. Sólo así
  // :focus-visible dibuja su anillo (el .focus() programático no lo activa en Chromium).
  await page.click("#recipe-filter");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => (document.activeElement?.dataset?.id || "") === "seed-a11y")) break;
  }
  // Verificar que el foco real está en la tarjeta (y no cayó en otro focusable intermedio)
  const focoEnTarjeta = await page.evaluate(() => document.activeElement?.dataset?.id || "");
  ok(focoEnTarjeta === "seed-a11y", "(6) Tab alcanza la tarjeta (foco real, no programático)");
  const anilloTarjeta = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return { estilo: cs.outlineStyle, ancho: cs.outlineWidth, color: cs.outlineColor };
  });
  ok(anilloTarjeta.estilo === "solid" && parseFloat(anilloTarjeta.ancho) >= 2 && anilloTarjeta.color === "rgb(47, 107, 69)",
    "(6) anillo :focus-visible de la tarjeta en verde marca (" + anilloTarjeta.color + ", " + anilloTarjeta.ancho + ")");

  // El outline dibuja FUERA del border-box: un screenshot del elemento lo recorta.
  // capturamos un clip con margen para que el anillo sea visible de verdad.
  await card.scrollIntoViewIfNeeded();
  const boxCard = await card.boundingBox();
  await page.screenshot({
    path: path.join(OUT_DIR, "19-a11y-foco-tarjeta-claro.png"),
    clip: { x: boxCard.x - 10, y: boxCard.y - 10, width: boxCard.width + 20, height: boxCard.height + 20 },
  });

  // (2)+(3) Teclado abre el modal de detalle; el foco entra al botón Cerrar y vuelve al cerrar
  await card.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#modal:not(.hidden)");
  const modalInfo = await page.evaluate(() => {
    const box = document.querySelector(".modal-box");
    return {
      dialog: box.getAttribute("role"),
      ariaModal: box.getAttribute("aria-modal"),
      nombre: box.getAttribute("aria-label"),
      foco: document.activeElement?.className || "",
      tabindexTarjeta: document.querySelector("#recipe-list .recipe-card")?.getAttribute("tabindex"),
    };
  });
  ok(modalInfo.dialog === "dialog" && modalInfo.ariaModal === "true", "(3) modal role=dialog + aria-modal");
  ok((modalInfo.nombre || "").includes("Tortilla de prueba"), "(3) modal con nombre accesible del título");
  ok(modalInfo.foco.includes("modal-close"), "(3) el foco entra al modal (botón cerrar)");
  ok(modalInfo.tabindexTarjeta === "0", "(2) tarjeta alcance por Tab (tabindex=0)");
  await page.keyboard.press("Escape");
  const trasCerrar = await page.evaluate(() => ({
    oculto: document.getElementById("modal").classList.contains("hidden"),
    foco: document.activeElement?.dataset?.id || document.activeElement?.className || "",
  }));
  ok(trasCerrar.oculto, "(2) Esc cierra el modal");
  ok(String(trasCerrar.foco).includes("seed-a11y"), "(2) el foco VUELVE a la tarjeta que lo abrió");
  await snapCard(page, "20-a11y-recetas-post-modal.png");

  // (4) Toast annonceable
  const toastInfo = await page.evaluate(() => {
    const t = document.getElementById("toast");
    return { status: t.getAttribute("role"), live: t.getAttribute("aria-live") };
  });
  ok(toastInfo.status === "status" && toastInfo.live === "polite", "(4) toast role=status + aria-live=polite");

  if (fallos) throw new Error(fallos + " comprobaciones de accesibilidad fallidas");
  console.log("\nA11Y OK — capturas: reports/ui-brave/18, 19, 20");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

async function snapCard(page, name) {
  const el = page.locator("#recipe-list");
  await el.screenshot({ path: path.join(OUT_DIR, name) });
}

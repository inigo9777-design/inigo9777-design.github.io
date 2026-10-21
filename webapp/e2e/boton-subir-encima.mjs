// e2e/boton-subir-encima.mjs — Brave: botón flotante "subir al principio" (feature 2026-10-21).
// Con listas largas, al bajar aparece (fade) el círculo con flecha abajo a la derecha y un toque
// devuelve ARRIBA con animación; se vuelve a ocultar al quedar al principio. En TODAS las
// pestañas (van de un mismo scroll del documento) — aquí se demuestra en Alimentos y Sugerencias.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)), "reports/ui-brave");
fs.mkdirSync(OUT_DIR, { recursive: true });

let contadas = 0;
const ok = (cond, msg) => { if (cond) { contadas++; console.log("✔ " + msg); } else { console.log("✘ " + msg); process.exitCode = 1; } };

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  // Mobile-ish phone: the request narrative is "listas muy largas EN MÓVIL".
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const foods = [
    ["Pan", 2], ["Tomate", 3], ["Aceite de oliva", 4], ["Huevos", 3],
    ["Leche", 3], ["Patata", 4], ["Cebolla", 2], ["Ajo", 1], ["Queso", 2],
    ["Jamón", 2], ["Arroz", 1], ["Pollo", 2], ["Yogur", 4], ["Manzana", 4],
    ["Puerro", 2], ["Zanahoria", 3], ["Gambas", 3], ["Merluza", 2]
  ].map(([name, qty], i) => ({ id: "f" + i, name, qty, min: 1, score: 5, checked: false, createdAt: i }));
  await p.addInitScript((g) => {
    if (!localStorage.getItem("mrcheff.foods")) {
      localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
      localStorage.setItem("mrcheff.foods", JSON.stringify(g.foods));
    }
  }, { foods });

  await p.goto(APP);
  await p.waitForSelector("#view-foods.active");

  const oculto = await p.evaluate(() => {
    const fab = document.getElementById("btn-subir-encima");
    return { hay: !!fab, visible: fab.classList.contains("visible"), opacidad: getComputedStyle(fab).opacity };
  });
  ok(oculto.hay, "(1) el botón flotante vive en la app (una sola pieza, no por pestaña)");
  ok(!oculto.visible && oculto.opacidad === "0", "(2) arriba del todo: OCULTO y sin captar toques (opacity 0)");

  // BAJAR por la lista: rueda del ratón (Playwright), gesto real de las listas largas
  await p.mouse.wheel(0, 1800);
  await p.waitForTimeout(400);                       // la ráfaga de scroll + el fade del botón
  const bajado = await p.evaluate(() => ({
    y: window.scrollY,
    visible: document.getElementById("btn-subir-encima").classList.contains("visible"),
    objetivo: (() => { const r = document.getElementById("btn-subir-encima").getBoundingClientRect(); return { w: r.width, h: r.height, der: r.right, abajo: r.bottom }; })(),
    pointer: getComputedStyle(document.getElementById("btn-subir-encima")).pointerEvents
  }));
  ok(bajado.y > 1000 && bajado.visible, "(3) tras bajar por la lista, APARECE (clase .visible)");
  ok(bajado.objetivo.w >= 40 && bajado.objetivo.h >= 40 && bajado.objetivo.der >= 300 && bajado.objetivo.abajo >= 750,
    "(4) círculo de ≥46px pegado a la esquina inferior derecha (objetivo táctil y lugar pedidos)");
  ok(bajado.pointer === "auto", "(5) bajado: atrapa toques (pointer-events auto)");
  await p.screenshot({ path: path.join(OUT_DIR, "36-boton-subir-encima.png") });   // estado con el botón visible

  // TOCAR el botón: vuelve ARRIBA con animación y VUELVE A SU ESTADO OCULTO
  await p.locator("#btn-subir-encima").click();
  await p.waitForFunction(() => window.scrollY === 0, null, { timeout: 5000 });
  await p.waitForTimeout(350);                        // el fade de salida tras llegar
  const deVuelta = await p.evaluate(() => ({
    y: window.scrollY,
    visible: document.getElementById("btn-subir-encima").classList.contains("visible")
  }));
  ok(deVuelta.y === 0, "(6) el toque lleva AL PRINCIPIO de la pestaña (y=0 animado)");
  ok(!deVuelta.visible, "(7) arriba del todo se VUELVE A OCULTAR (se re-fadea hacia fuera)");

  // TODAS las pestañas: el mismo botón SIRVE en otra vista (Sugerencias). Primero asentamos la
  // animación "click del nav sube a lo alto" (si no, la rueda interrumpiría a mitad de bajada);
  // luego con el plan 7×3 generado la pestaña tiene contenido LARGO de verdad para bajarla.
  await p.locator('.topbar .tab[data-view="suggest"]').click();
  await p.waitForFunction(() => window.scrollY === 0, null, { timeout: 5000 });
  await p.locator("#btn-menu-generate").click();
  await p.waitForSelector("#menu-plan-list .menu-day");
  const ocultoEnSug = await p.evaluate(() => document.getElementById("btn-subir-encima").classList.contains("visible"));
  ok(!ocultoEnSug, "(8) al cambiar de pestaña (el click del nav sube a lo alto): arranca oculta");
  await p.mouse.wheel(0, 1400);
  await p.waitForTimeout(400);
  const enSug = await p.evaluate(() => ({
    y: window.scrollY,
    visible: document.getElementById("btn-subir-encima").classList.contains("visible")
  }));
  ok(enSug.y > 800 && enSug.visible, "(9) en Sugerencias (y todas las pestañas): la misma regla de visibilidad");
} finally {
  await browser.close();
  console.log(`\nBOTÓN "SUBIR AL PRINCIPIO" — ${contadas} checks ✔ (baja por la lista: el círculo te ofrece la vuelta arriba)`);
}

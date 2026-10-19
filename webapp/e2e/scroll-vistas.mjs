// e2e/scroll-vistas.mjs — Verificación de la memoria de scroll POR VISTA del viewpager
// con Brave REAL (no Chromium de Playwright). Ejecutar: node e2e/scroll-vistas.mjs
// Cubre la feature 2026-10-20: (1) el CLICK en la categoría del topbar sube a la parte
// superior CON ANIMACIÓN, (2) el SWIPE del viewpager RESTAURA la posición individual que
// la vista dejó, (3) posiciones INDEPENDIENTES por vista (ir y volver con swipes no las
// confunde), (4) default: vista nunca visitada por swipe → arriba.
  // Reglas y condiciones del harnés:
//  - alto scrolleable constante en TODAS las vistas (::after de 3000px en .content).
//  - clicks con page.mouse + coordenadas del tab: page.click(selector) ejecuta el
//    scrollIntoViewIfNeeded de Playwright que MUEVE el scroll del documento antes del
//    gesto (medida: 800px quedaban en 774) — clicks a tabs de las SIEMPRE visibles en
//    390px (foods/recipes; "seasonal" es la 5ª pill y queda fuera del scroller del header).
//  - las animaciones y el traqueteo del compositor en headless se ESPERAN por sondeo
//    (scrollQuieto / esperarHasta): un timeout fijo llega tarde y muestra a mitad de vuelo.
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

// Swipe sintético REAL touch (Brave trae Touch/TouchEvent; contexto hasTouch).
async function swipe(page, sel, x1, y1, x2, y2) {
  await page.evaluate(({ s, ax, ay, bx, by }) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("sin elemento para swipe: " + s);
    const mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const a = mk(ax, ay);
    const b = mk(bx, by);
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [a], targetTouches: [a], changedTouches: [a] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [b] }));
  }, { s: sel, ax: x1, ay: y1, bx: x2, by: y2 });
}
const scrollY = (page) => page.evaluate(() => window.scrollY);
const vistaActiva = (page) => page.evaluate(() => document.querySelector(".view.active")?.id || "");
const bajarInstato = (page, y) => page.evaluate((v) => window.scrollTo(0, v), y);
// Click CRUDO por coordenadas del centro del tab (sin scrollIntoViewIfNeeded de Playwright).
async function clickCrud(page, sel) {
  const punto = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  await page.mouse.click(punto.x, punto.y);
}
// El scroll (instantáneo o el rabillo de una animación) se lee QUIETO al repetir lectura.
async function scrollQuieto(page) {
  let anterior = await scrollY(page);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(120);
    const v = await scrollY(page);
    if (Math.abs(v - anterior) < 2) return v;
    anterior = v;
  }
  return anterior;
}
// Espera a que el scroll llegue a CERCA de `y` (animación) y quede estable ahí.
async function esperarHasta(page, y, margen = 20) {
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(120);
    const v = await scrollY(page);
    if (Math.abs(v - y) <= margen) return await scrollQuieto(page);
  }
  return await scrollQuieto(page);
}

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },   // tamaño de móvil "de bolsillo"
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");

  // Alto garantizado en TODAS las vistas: ::after de 3000px colgando de .content
  await page.evaluate(() => {
    const s = document.createElement("style");
    s.id = "empujon-scroll-e2e";
    s.textContent = ".content::after { content: ''; display: block; height: 3000px; }";
    document.head.appendChild(s);
  });
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  ok(alto > 3000, `(0) alto scrolleable constante en todas las vistas (${alto}px)`);

  // (1) CLICK en otra categoría: arriba CON animación (y capta la posición de la vista saliente)
  await bajarInstato(page, 800);
  await page.waitForTimeout(100);
  await clickCrud(page, '[data-view="recipes"]');
  const y1 = await esperarHasta(page, 0);
  ok(Math.abs(y1) < 20, `(1) click en otra categoría → ARRIBA animado (scrollY=${y1.toFixed(0)})`);
  ok(await vistaActiva(page) === "view-recipes", "(1b) la vista cambia (view-recipes)");

  // (2) SWIPE derecha desde recipes → foods RESTAURA los 800px que dejó al click
  await swipe(page, ".content", 140, 300, 360, 295);
  const y2 = await scrollQuieto(page);
  ok(await vistaActiva(page) === "view-foods", "(2) swipe derecha → view-foods");
  ok(Math.abs(y2 - 800) < 15, `(2b) swipe RESTAURA la posición de foods (${y2.toFixed(0)} ≈ 800)`);

  // (3) salir de foods recordó la posición; volver por swipe a recipes → SU posición (0:
  //     al click quedó arriba y el touchend de la ida ya captó ese 0)
  await swipe(page, ".content", 360, 300, 140, 295);
  const y3 = await scrollQuieto(page);
  ok(await vistaActiva(page) === "view-recipes" && Math.abs(y3) < 15,
    `(3) recipes vuelve a su posición (${y3.toFixed(0)} ≈ 0, quedó arriba al click y salió desde ahí)`);

  // (4) posiciones INDEPENDIENTES: recipes baja a 2500, swipe a innovation (nunca visitada:
  //     arriba con el default) y el swipe de vuelta recupera LOS 2500 de recipes
  await bajarInstato(page, 2500);
  await page.waitForTimeout(100);
  await swipe(page, ".content", 360, 300, 140, 295);          // recipes → innovation
  const y4 = await scrollQuieto(page);
  ok(await vistaActiva(page) === "view-innovation" && Math.abs(y4) < 15,
    `(4) innovation nunca visitada por swipe → arriba (${y4.toFixed(0)}), recipes recuerda 2500`);
  await swipe(page, ".content", 140, 300, 360, 295);          // innovation → recipes (vuelta)
  const y4b = await scrollQuieto(page);
  ok(Math.abs(y4b - 2500) < 20, `(4b) recipes recupera SUS 2500 (${y4b.toFixed(0)})`);

  // (5) click en el tab YA activo → arriba también (empezar de nuevo en el mismo tab)
  await clickCrud(page, '[data-view="recipes"]');
  const y5 = await esperarHasta(page, 0);
  ok(Math.abs(y5) < 20, `(5) click en el tab ya ACTIVO → arriba (${y5.toFixed(0)})`);

  // Captura de la vista con la posición restaurada (recuerdo visual)
  await page.screenshot({ path: OUT_DIR + "66-scroll-foods-restaurado.png" });

  await browser.close();
} catch (e) {
  fallos++;
  console.error("EXCEPCIÓN:", e.message);
}

console.log(fallos ? "\nFALLOS: " + fallos : "\nTODO OK");
process.exit(fallos ? 1 : 0);

// e2e/swipe-vistas.mjs — Verificación del viewpager móvil con Brave REAL (no Chromium de
// Playwright). Ejecutar:  node e2e/swipe-vistas.mjs
// Cubre la feature móvil 2026-10-18: (1) el documento ya no tiene overflow-x (la página ya
// no se desplaza entera), (2) el swipe horizontal cambia de vista (viewpager) con wrap,
// (3) exclusiones: gesto vertical y gestos bajo inputs/botones NO cambian de vista,
// (4) modal abierto congela el scroll del documento (clase + overflow y contención del box),
// (5) el theme-color de la franja del sistema sigue al tema, (6) el fondo del canvas usa el
// token del tema (nunca el negro del splash "asomando").
// Los swipes se emulan con TouchEvent sintéticos sobre .content (contexto hasTouch).
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

// Swipe sintético: touchstart + touchend sobre el elemento `sel` (el gesto no intermedio).
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
const vistaActiva = (page) => page.evaluate(() => document.querySelector(".view.active")?.id || "");

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },   // tamaño de móvil "de bolsillo"
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");

  // (1) El documento ya NO scrollea horizontal: sin "la pantalla se mueve entera"
  const doc = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  ok(doc.sw <= doc.cw, `(1) sin overflow-x del documento (${doc.sw} <= ${doc.cw})`);
  const fondoDark = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(fondoDark === "rgb(23, 21, 15)", `(6) fondo del canvas = token del tema oscuro (${fondoDark})`);

  // (2) Viewpager: swipe a la IZQUIERDA dentro del contenido → vista siguiente
  ok((await vistaActiva(page)) === "view-foods", "(2) arrancamos en Alimentos (foods)");
  await swipe(page, ".content", 300, 320, 80, 322);        // ← 220px horizontales, 2 de deriva
  ok((await vistaActiva(page)) === "view-recipes", "(2) swipe izquierda: foods → recipes");
  await swipe(page, ".content", 300, 320, 80, 322);
  ok((await vistaActiva(page)) === "view-innovation", "(2) swipe izquierda: recipes → innovation");

  // (2b) Swipe a la DERECHA → vista anterior
  await swipe(page, ".content", 80, 320, 300, 318);
  ok((await vistaActiva(page)) === "view-recipes", "(2b) swipe derecha: innovation → recipes");
  await swipe(page, ".content", 80, 320, 300, 318);
  ok((await vistaActiva(page)) === "view-foods", "(2b) swipe derecha: recipes → foods");

  // (2c) WRAP del viewpager: desde la última (Temporada), avanzar vuelve a la primera
  await page.click(".tab[data-view='seasonal']");
  await swipe(page, ".content", 300, 320, 80, 322);
  ok((await vistaActiva(page)) === "view-foods", "(2c) wrap: seasonal → foods");

  // (7) El header SIGUE al viewpager (bug 2026-10-19: el pill activo quedaba a 0px de la
  //     ventana del scroller-x invisible del nav y el usuario veía aún "Alimentos y Recetas").
  await page.click(".tab[data-view='foods']");
  for (let i = 0; i < 4; i++) await swipe(page, ".content", 300, 320, 80, 322);   // foods → seasonal
  await page.waitForTimeout(500);            // el recentre es smooth: deja terminar la animación
  const header = await page.evaluate(() => {
    const barra = document.querySelector(".tabs");
    const activo = barra.querySelector(".active");
    const rb = barra.getBoundingClientRect();
    const rt = activo.getBoundingClientRect();
    const visible = Math.max(0, Math.min(rt.right, rb.right) - Math.max(rt.left, rb.left));
    return { activo: activo.dataset.view, scrollLeft: barra.scrollLeft, visible, ancho: rt.width };
  });
  ok(header.activo === "seasonal" && header.visible >= header.ancho - 1 && header.scrollLeft > 0,
    `(7) swipe hasta Temporada: el pill activo VISIBLE (scrollLeft=${Math.round(header.scrollLeft)}, visible=${Math.round(header.visible)}/${Math.round(header.ancho)}px)`);
  await page.screenshot({ path: path.join(OUT_DIR, "28-header-sigue-al-swipe.png"), clip: { x: 0, y: 0, width: 390, height: 140 } });
  await swipe(page, ".content", 300, 320, 80, 322);            // seasonal → foods (wrap otra vez)
  await page.waitForTimeout(500);
  const vuelve = await page.evaluate(() => ({
    activo: document.querySelector(".tabs .active")?.dataset.view,
    scrollLeft: document.querySelector(".tabs").scrollLeft,
  }));
  ok(vuelve.activo === "foods" && Math.round(vuelve.scrollLeft) <= 1,
    `(7) vuelta a foods: el header vuelve al principio (scrollLeft=${Math.round(vuelve.scrollLeft)})`);

  // (3a) El gesto VERTICAL no cambia de vista (es scroll, no swipe)
  await swipe(page, ".content", 200, 150, 200, 620);       // hacia abajo, dx=0
  ok((await vistaActiva(page)) === "view-foods", "(3a) arrastre vertical: sigue en foods");

  // (3b) El gesto bajo un elemento INTERACTIVO no cambia de vista (el botón manda)
  await page.waitForSelector("#food-form button[type='submit']");
  await swipe(page, "#food-form button[type='submit']", 300, 320, 80, 322);
  ok((await vistaActiva(page)) === "view-foods", "(3b) swipe sobre el botón del formulario: foods sigue");

  // (4) Modal abierto: scroll del documento CONGELADO + contiene su propio scroll
  const receta = { id: "seed-swipe", title: "Lentejas de prueba", meal: "comida", ingredients: ["Lentejas", "Cebolla"], method: ["Remojar", "Cocer"], createdAt: 1 };
  await page.evaluate((r) => localStorage.setItem("mrcheff.recipes", JSON.stringify([r])), receta);
  await page.reload();
  await page.click(".tab[data-view='recipes']");
  await page.waitForSelector("#recipe-list .recipe-card");
  await page.click("#recipe-list .recipe-card");
  await page.waitForSelector("#modal:not(.hidden)");
  const modalEstado = await page.evaluate(() => ({
    clase: document.body.classList.contains("modal-abierto"),
    overflowBody: getComputedStyle(document.body).overflow,
    containBox: getComputedStyle(document.querySelector(".modal-box")).overscrollBehavior,
  }));
  ok(modalEstado.clase && modalEstado.overflowBody === "hidden",
    `(4) modal abierto: body scroll congelado (${modalEstado.clase}, overflow=${modalEstado.overflowBody})`);
  ok(modalEstado.containBox === "contain", "(4) modal-box con overscroll-behavior:contain (no arrastra al documento)");
  // (El gesto real del usuario no puede scrollear un overflow:hidden — comprobado por las
  // invariantes CSS de arriba; un scrollTo PROGRAMÁTICO sí funciona y no indica nada.)
  await page.click("#modal-content [data-close]");
  await page.waitForFunction(() => document.getElementById("modal").classList.contains("hidden"));
  const modalCerrado = await page.evaluate(() => {
    return {
      body: document.body.classList.contains("modal-abierto"),
      html: document.documentElement.classList.contains("modal-abierto"),
      overflowHtml: getComputedStyle(document.documentElement).overflow,
    };
  });
  ok(!modalCerrado.body && !modalCerrado.html && modalCerrado.overflowHtml !== "hidden",
    "(4) modal cerrado: scroll del documento vuelve a estar vivo");
  await page.evaluate(() => localStorage.removeItem("mrcheff.recipes"));

  // (5) El theme-color de la franja del sistema sigue al tema (dark ↔ light)
  const tcInicial = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content);
  ok(tcInicial === "#1b1913", `(5) theme-color inicial (dark) = ${tcInicial}`);
  await page.click("#theme-toggle");
  const tcClaro = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content);
  const fondoClaro = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  ok(tcClaro === "#ffffff" && fondoClaro === "rgb(246, 244, 239)",
    `(5) tema claro: theme-color=${tcClaro}, fondo canvas=${fondoClaro}`);
  await page.click("#theme-toggle");

  // Captura del topbar con su respirillo inferior en ancho móvil
  await page.screenshot({ path: path.join(OUT_DIR, "26-pwa-movil-topbar.png"), clip: { x: 0, y: 0, width: 390, height: 140 } });

  await ctx.close();
} catch (err) {
  fallos++;
  console.error("✘ error inesperado:", err.message);
} finally {
  await browser.close();
}
console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);

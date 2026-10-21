// e2e/tutorial.mjs — TUTORIAL interactivo de entrada con Brave REAL (feature 2026-10-20,
// afinación 2026-10-21). Ejecutar: node e2e/tutorial.mjs   (sirve la webapp por
// http://localhost:8617: el auto-open de la primera visita SÓLO existe en web http(s), no en file://)
// Comprueba: (1) auto-apertura en la primera visita, (2) ✕ cierra y SE RECUERDA (recarga sin
// tutorial), (3) reabrir con el 🎓 de la cabecera, (4) recorrido REAL del guion: cada paso
// accionable se avanza tocando SU elemento (con los campos de formulario SILENCIADOS: el toque
// avanza pero NO enfoca — el teclado del PWA no abre; el select de Temporada tampoco abre) y
// cada paso informativo con el botón; (5) el aro envuelve al elemento (geometría), (6) el swipe
// del viewpager NO cambia de vista durante la visita, (7) el guion completo (16 pasos) termina
// y (8) los pasos de objetivo ALTO (inventario, "Mis recetas", lote de Innovación y "Buena
// fruta") muestran la tarjeta ENCIMA del aro con el contenido vivo debajo — no tapando la
// lista/cuadrícula (petición 2026-10-21, pantallazos de referencia del usuario).
import { chromium } from "playwright-core";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const WEBAPP = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
const PUERTO = 8617;

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++; };

const server = spawn("python3", ["-m", "http.server", String(PUERTO)], { cwd: WEBAPP });
await new Promise(r => setTimeout(r, 800));                       // deja arrancar el servidor

try {
  const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();

  // Click SEGURO: coords del centro del elemento (NUNCA page.click: su scrollIntoView-previo
  // movía el scroll del documento y ensuciaba las medidas — patrón de scroll-vistas.mjs).
  const C = async (sel) => {
    const caja = await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(caja.x, caja.y);
  };
  const paso = () => page.$eval("#tutorial-anuncio", el => el.textContent);
  const tituloPaso = () => page.$eval("#tutorial-titulo", el => el.textContent);
  const avanzaBoton = () => page.evaluate(() => document.getElementById("tutorial-avanzar").click());
  // El scrollIntoView del paso anima: se espera a que scroll Y y el aro dejen de moverse
  // antes de medir o hacer click (polling de estabilidad, patrón de scroll-vistas.mjs).
  const esEsperaFocoFijo = async () => {
    let firma = "";
    for (let i = 0; i < 40; i++) {
      const ahora = await page.evaluate(() => Math.round(window.scrollY) + "|" + Math.round(document.getElementById("tutorial-foco").getBoundingClientRect().top) + "|" + Math.round(document.getElementById("tutorial-foco").getBoundingClientRect().left));
      if (ahora === firma) return true;
      firma = ahora;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  };

  // Geometría de los pasos de objetivo ALTO (tarjeta: "arriba"): la misma sonda para los
  // cuatro pasos de lista larga — tarjeta encima del aro, arranque del contenido en media
  // pantalla inferior y cabecera asomando atenuada (petición 2026-10-21).
  const geoTresZonas = () => page.evaluate(() => {
    const t = document.getElementById("tutorial-tarjeta").getBoundingClientRect();
    const f = document.getElementById("tutorial-foco").getBoundingClientRect();
    const bar = document.querySelector(".topbar").getBoundingClientRect();
    return { cardTop: t.top, cardBottom: t.bottom, ringTop: f.top, topbarBottom: bar.bottom, vp: window.innerHeight };
  });
  await page.goto(`http://localhost:${PUERTO}/`);
  await page.waitForSelector(".topbar .tab");
  await page.waitForSelector("#tutorial:not(.hidden)", { timeout: 5000 });
  ok(true, "(1) primera visita: el tutorial se abre solo tras cargar");
  const centrada = await page.$eval("#tutorial-tarjeta", el => el.classList.contains("tutorial-centrado"));
  ok(centrada, "(1b) bienvenida: tarjeta centrada sin foco");
  await page.screenshot({ path: path.join(OUT, "68-tutorial-primera-visita.png") });

  // (2) la ✕ cierra y la visita se recuerda: recarga SIN tutorial
  await page.evaluate(() => document.getElementById("tutorial-cerrar").click());
  await page.waitForSelector("#tutorial.hidden", { timeout: 2000, state: "attached" });
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.tutorial") || "{}").visto);
  ok(guardado === true, "(2a) cerrar con ✕ graba visto en localStorage");
  await page.reload();
  await page.waitForSelector(".topbar .tab");
  await new Promise(r => setTimeout(r, 1600));                     // margen amplio para el auto-open que NO debe llegar
  const reoculta = await page.$eval("#tutorial", el => el.classList.contains("hidden"));
  ok(reoculta, "(2) segunda visita: no reaparece solo (se respeta el cierre)");

  // (3) reabrir con el 🎓 del clúster derecho (entre caja fuerte y tema)
  await C("#btn-tutorial");
  await page.waitForSelector("#tutorial:not(.hidden)", { timeout: 2000 });
  ok(true, "(3) el 🎓 reabre el tutorial cuando la persona quiera");

  // (4) RECORRIDO REAL del guion (16 pasos): accionable = tocar su elemento; informativo = botón.
  await avanzaBoton();                                             // 1 bienvenida → 2 cabecera
  await avanzaBoton();                                             // 2 cabecera → 3 alimentos#1 (Empecemos)
  await esEsperaFocoFijo();
  ok((await tituloPaso()).includes("Apunta lo que tienes"), "el guion llega a Alimentos (paso 3)");

  // el aro envuelve a #food-name: casi el mismo rect del elemento (+8 px de aire por lado)
  const focoFood = await page.evaluate(() => {
    const r = document.getElementById("food-name").getBoundingClientRect();
    const f = document.getElementById("tutorial-foco").getBoundingClientRect();
    return { el: { t: r.top, w: r.width }, foco: { t: f.top, w: f.width } };
  });
  const cercaFoco = Math.abs(focoFood.foco.t - (focoFood.el.t - 8)) <= 3 && Math.abs(focoFood.foco.w - (focoFood.el.w + 16)) <= 4;
  ok(cercaFoco, "(4a) el aro envuelve a #food-name (geometría ± aire de 8 px)");

  // 3 alimentos#1: click REAL en el campo (dentro del hueco) → avanza. El campo queda
  // SILENCIADO (preventDefault en pointerdown/mousedown): sin focus, el teclado del PWA
  // instalable no abre y el paso siguiente no se descuelgue (petición 2026-10-21).
  await C("#food-name");
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 4"), "(4b) el click en el target avanza (paso 4: importancia)");
  const focoInput = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(focoInput !== "food-name", "(4c) el campo quedó SILENCIADO: sin focus (teclado del PWA fuera)");
  await page.screenshot({ path: path.join(OUT, "69-tutorial-alimentos.png") });

  // 4 alimentos#2 → 5 inventario (informativo + tarjeta ARRIBA) → 6 recetas#1 (salto de vista)
  await C("#food-score");
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 5"), "(4l) Inventario y alerta semanal (paso 5 de 16)");
  const geoInv = await geoTresZonas();
  ok(geoInv.cardBottom <= geoInv.ringTop + 2, "(4m) la tarjeta queda ENCIMA del aro del inventario (NO tapa la lista)");
  ok(geoInv.ringTop > geoInv.vp * 0.45, "(4n) el arranque del inventario queda visible en media pantalla inferior");
  ok(geoInv.cardTop >= geoInv.topbarBottom - 4, "(4o) la cabecera no queda tapada por la tarjeta");
  await page.screenshot({ path: path.join(OUT, "74-tutorial-inventario.png") });
  await avanzaBoton();                                             // 5 → 6
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 6"), "(4d) salto a Recetas (crear receta, paso 6 de 16)");
  ok(await page.$eval("#view-recipes", el => el.classList.contains("active")), "(4e) la vista cambió a Recetas");

  // 6 recetas#1: el textarea se toca (silenciado: sin focus) → 7 buscador
  await C("#recipe-desc");
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 7"), "(4f) buscador del catálogo (paso 7)");
  const focoTexto = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(focoTexto !== "recipe-desc", "(4g) el textarea también silenciado (tocar avanza, teclado nunca abre)");
  await page.screenshot({ path: path.join(OUT, "70-tutorial-recetas.png") });

  // 7 buscador → 8 mis recetas (informativo + tarjeta ARRIBA) → 9 innovación#1
  await C("#recipe-catalog-search");
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 8"), "(4h) Mis recetas y su origen (paso 8 de 16)");
  // Geometría del paso de objetivo ALTO (petición 2026-10-21): la tarjeta flota ENCIMA del aro,
  // el arranque de la lista se asienta a media pantalla inferior Y la cabecera asoma atenuada.
  const geoLista = await geoTresZonas();
  ok(geoLista.cardBottom <= geoLista.ringTop + 2, "(4i) la tarjeta queda ENCIMA del aro (la lista NO está tapada)");
  ok(geoLista.ringTop > geoLista.vp * 0.45, "(4j) el arranque de la lista vive por debajo de la mitad de la ventana, visible");
  ok(geoLista.cardTop >= geoLista.topbarBottom - 4, "(4k) arriba de la tarjeta asoma la cabecera (logo y clúster) atenuada");
  await page.screenshot({ path: path.join(OUT, "72-tutorial-mis-recetas.png") });
  await avanzaBoton();                                             // 8 → 9
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 9"), "(5a) el guion salta a Innovación");

  // innovación: el generador con despensa vacía avisa (toast honesto) y el paso avanza igual
  await C("#btn-generate-innov");
  await new Promise(r => setTimeout(r, 300));
  const aviso = await page.$eval("#toast", el => el.textContent);
  ok(aviso.includes("Añade alimentos"), "(5b) con despensa vacía el toast pide primero anotar alimentos");
  // 10 lote (informativo + tarjeta ARRIBA): el lote/cuadrícula se mira SIN taparse
  await esEsperaFocoFijo();
  ok((await paso()).includes("Paso 10"), "(5c) Un lote listo para mirar (paso 10 de 16)");
  const geoLote = await geoTresZonas();
  ok(geoLote.cardBottom <= geoLote.ringTop + 2, "(5d) la tarjeta queda ENCIMA del aro del lote (NO tapa el listado)");
  ok(geoLote.ringTop > geoLote.vp * 0.45, "(5e) el arranque del listado queda visible en media pantalla inferior");
  ok(geoLote.cardTop >= geoLote.topbarBottom - 4, "(5f) la cabecera no queda tapada por la tarjeta");
  await page.screenshot({ path: path.join(OUT, "75-tutorial-lote.png") });
  await avanzaBoton();                                             // 10 lote (informativo) → 11 menú#1
  await esEsperaFocoFijo();

  // (6) el swipe del viewpager NO cambia de vista durante la visita (guard del wiring)
  ok((await paso()).includes("Paso 11"), "(6a) el guion llega a Sugerencias y menú (paso 11)");
  const vistaAntes = await page.$eval(".view.active", el => el.id);
  await page.evaluate(() => {                                      // gesto táctil sintético sobre .content
    const mkTouch = (tipo, x) => new TouchEvent(tipo, {
      bubbles: true, cancelable: true,
      touches: tipo === "touchend" ? [] : [new Touch({ identifier: 1, target: document.querySelector(".content"), clientX: x, clientY: 300 })],
      changedTouches: [new Touch({ identifier: 1, target: document.querySelector(".content"), clientX: x, clientY: 300 })],
    });
    document.querySelector(".content").dispatchEvent(mkTouch("touchstart", 330));
    document.querySelector(".content").dispatchEvent(mkTouch("touchmove", 110));
    document.querySelector(".content").dispatchEvent(mkTouch("touchend", 110));
  });
  await new Promise(r => setTimeout(r, 250));
  const vistaTras = await page.$eval(".view.active", el => el.id);
  ok(vistaAntes === vistaTras, "(6) swipe durante la visita no cambia de vista (" + vistaTras + " se queda)");
  await page.screenshot({ path: path.join(OUT, "71-tutorial-menu.png") });

  // 11 menú#1 → 12 menú#2 → 13 aprobar (informativo) → 14 temporada#1
  await C("#btn-suggest-generate");
  await esEsperaFocoFijo();
  await C("#btn-menu-generate");
  await avanzaBoton();
  await esEsperaFocoFijo();
  ok(await page.$eval("#view-seasonal", el => el.classList.contains("active")), "(7a) última pantalla: Temporada");

  // 14 temporada#1 → 15 cuadrícula (informativo + tarjeta ARRIBA) → 16 listo (Terminar)
  await C("#season-month");                                        // click del select → avanza
  const focoSelect = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(focoSelect !== "season-month", "(7c) el select quedó SILENCIADO: sin focus no abre la lista de meses");
  await esEsperaFocoFijo();
  const geoGrid = await geoTresZonas();
  ok(geoGrid.cardBottom <= geoGrid.ringTop + 2, "(7d) \"Buena fruta\": tarjeta encima del aro, cuadrícula viva debajo");
  ok(geoGrid.ringTop > geoGrid.vp * 0.45, "(7e) el arranque de la cuadrícula queda visible en el tercio inferior");
  ok(geoGrid.cardTop >= geoGrid.topbarBottom - 4, "(7f) la cabecera no queda tapada por la tarjeta");
  await page.screenshot({ path: path.join(OUT, "73-tutorial-temporada-grid.png") });
  await avanzaBoton();
  await new Promise(r => setTimeout(r, 120));
  const cta = await page.$eval("#tutorial-avanzar", el => el.textContent);
  ok(cta === "Terminar", "(7b) el último paso dice Terminar");
  await avanzaBoton();
  await page.waitForSelector("#tutorial.hidden", { timeout: 2000, state: "attached" });
  ok(true, "(7) recorrido completo terminado (16 pasos) y cerrado");

  await browser.close();
} catch (e) {
  fallos++;
  console.error("EXCEPCIÓN:", e.message);
} finally {
  server.kill();
}
console.log(fallos ? "\nFALLOS: " + fallos : "\nTODO OK");
process.exit(fallos ? 1 : 0);

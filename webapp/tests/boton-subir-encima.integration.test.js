// tests/boton-subir-encima.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS.md §6 Capa 2).
// Arranca la app REAL vía bootApp() y ejercita el botón flotante "subir al principio" en su vista:
//   1) Arranque arriba del todo → OCULTO (regla del módulo, no herencia CSS).
//   2) El DOM scrollea "hacia abajo" (scrollY stub + evento scroll) → Pasa UNA pantallita → VISIBLE
//      (clase .visible: fade en CSS, aquí clase; la animación visual misma va e2e en Brave).
//   3) Click al botón → window.scrollTo({top:0, behavior:"smooth"}) (el sustituto de boot aplica el
//      efecto final) y al emitirse el scroll de vuelta (scrollY 0) → OCULTO otra vez.
//   4) Cambio de tab: la regla es IGUAL (mismo scroll del documento) — vale en todas las pestañas.
const { bootApp } = require("./boot");

async function asentarRaf(ms = 30) {
  // rAF del harness (pretendToBeVisual ~16 ms) + un tick para que la ráfaga del scroll se derrame.
  await new Promise(r => setTimeout(r, ms));
}

describe("Botón flotante 'subir al principio' (feature 2026-10-21)", () => {
  const foodsSeed = [
    ["Pan", 2], ["Tomate", 3], ["Aceite de oliva", 4], ["Huevos", 3],
    ["Leche", 3], ["Patata", 4], ["Cebolla", 2], ["Ajo", 1], ["Queso", 2],
    ["Jamón", 2], ["Arroz", 1], ["Pollo", 2], ["Yogur", 4], ["Manzana", 4],
    ["Puerro", 2], ["Zanahoria", 3], ["Gambas", 3], ["Merluza", 2]
  ].map(([name, qty], i) =>
    JSON.stringify({ id: "f" + i, name, qty, min: 1, score: 5, checked: false, createdAt: i }));

  function scrollearA(app, y) {
    Object.defineProperty(app.window, "scrollY", { configurable: true, value: y });
    app.window.dispatchEvent(new app.window.Event("scroll"));
  }

  it("oculto en el arranque → visible tras bajar una pantallita → click al botón devuelve arriba y lo oculta", async () => {
    const app = bootApp({ seed: { foods: foodsSeed } });
    const { window, document } = app;
    const fab = document.getElementById("btn-subir-encima");
    expect(fab).not.toBeNull();
    expect(fab.classList.contains("visible")).toBe(false);       // (1) arriba del todo: oculto

    const saltos = [];
    const scrollToPrevia = window.scrollTo;
    window.scrollTo = (...a) => { saltos.push(a[0] && typeof a[0] === "object" ? a[0] : { top: a[1] }); scrollToPrevia(...a); };

    scrollearA(window, 900);                                      // (2) más de una pantalla
    await asentarRaf();
    expect(fab.classList.contains("visible")).toBe(true);

    scrollearA(window, 400);                                      // menos que el umbral → vuelve a ocultarse
    await asentarRaf();
    expect(fab.classList.contains("visible")).toBe(false);

    scrollearA(window, 1600);                                     // baja otra vez y ahora SÍ toca el botón
    await asentarRaf();
    expect(fab.classList.contains("visible")).toBe(true);
    fab.click();
    expect(saltos).toContainEqual({ top: 0, behavior: "smooth" }); // (3) con animación, vertical
    expect(window.scrollY).toBe(0);                               // el sustituto de boot aplicó el salto
  });

  it("la regla vale en TODAS las pestañas: bajado en Sugerencias también aparece (mismo scroll del doc)", async () => {
    const app = bootApp({ seed: { foods: foodsSeed } });
    const { document, window } = app;
    document.querySelector('[data-view="suggest"]').click();
    scrollearA(window, 1100);
    await asentarRaf();
    expect(document.getElementById("btn-subir-encima").classList.contains("visible")).toBe(true);
    scrollearA(window, 0);                                        // (4) arriba del todo: oculto
    await asentarRaf();
    expect(document.getElementById("btn-subir-encima").classList.contains("visible")).toBe(false);
  });
});

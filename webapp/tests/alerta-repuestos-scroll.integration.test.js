// tests/alerta-repuestos-scroll.integration.test.js — integración (Capa 2, CODING_STANDARDS.md §6).
// Arranca la app REAL vía ./boot.js y verifica el rediseño 2026-10-19 de la alerta semanal:
//   1) la lista pintada ya NO se recorta a 8 items (antes el 9º pendiente parecía no existir);
//   2) a partir de 8: cap de alto + botón candado (con aria-pressed) que congela el scroll del
//      DOCUMENTO con la clase `scroll-candado` SOLO en <html> (el sticky del topbar no se rompe);
//   3) el candado se suelta por clic (toggle), por cambio de vista y si la lista cae bajo 8;
//   4) con menos de 8 items NO hay candado NI cap de alto (la lista crece libre como siempre).
// En jsdom no hay layout: getBoundingClientRect da 0 y el cap EXACTO inline no se aplica
// (queda el retén del CSS en producción). El candado es SÓLO MÓVIL (2026-10-19, afinación tras
// probarlo: en escritorio la rueda recorre la lista sin ayuda) — por eso la movilidad va
// INYECTADA con `bootApp({ esMovil })` (jsdom no evalúa mediaqueries); los tests fijan el wiring
// del candado en móvil y su AUSENCIA en desktop con el mismo render.

const { bootApp } = require("./boot");

// n alimentos todos pendientes de reponer (qty 0 / min 1): los n entran en la alerta semanal.
const pendientes = (n) => Array.from({ length: n }, (_, i) => ({
  id: "f" + i, name: "Alimento " + i, score: 5 + (i % 6), qty: 0, min: 1, checked: false
}));

describe("alerta semanal — cap físico a 8 filas + candado de scroll (integración)", () => {
  it("con 9 pendientes pinta los 9 (sin el recorte antiguo a 8) y salen candado + caja de scroll", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    const alerta = app.document.getElementById("weekly-alert");
    expect(alerta.classList.contains("hidden")).toBe(false);
    expect(alerta.querySelectorAll(".alert-scroll li.alert-row")).toHaveLength(9);
    const candado = alerta.querySelector("#candado-alerta");
    expect(candado).toBeTruthy();
    expect(candado.getAttribute("aria-pressed")).toBe("false");
    expect(alerta.querySelector(".alert-cabecera h3").textContent).toContain("Repuestos urgentes esta semana");
    // en jsdom no hay layout: sin medida no hay maxHeight inline (el retén es CSS de producción)
    expect(alerta.querySelector(".alert-scroll").style.maxHeight).toBe("");
  });

  it("con 7 pendientes: sin candado y sin congelación (menos de 8, nada que recortar)", () => {
    const app = bootApp({ seed: { foods: pendientes(7) }, esMovil: true });
    const alerta = app.document.getElementById("weekly-alert");
    expect(alerta.querySelectorAll(".alert-scroll li.alert-row")).toHaveLength(7);
    expect(alerta.querySelector("#candado-alerta")).toBeNull();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(false);
  });

  it("el candado es un TOGGLE: 1er clic congela el documento (html.scroll-candado), 2º lo suelta", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    const candado = app.document.getElementById("candado-alerta");
    candado.click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    expect(candado.getAttribute("aria-pressed")).toBe("true");
    expect(candado.textContent).toBe("🔒");
    candado.click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(false);
    expect(candado.getAttribute("aria-pressed")).toBe("false");
    expect(candado.textContent).toBe("🔓");
  });

  it("el candado CAE al cambiar de vista (el congelado no tiene sentido fuera de Alimentos)", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    app.document.getElementById("candado-alerta").click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    app.document.querySelector('[data-view="recipes"]').click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(false);
  });

  it("el candado SOBREVIVE a los re-renders (➕/➖ de una fila no lo suelta a la espalda del usuario)", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    app.document.getElementById("candado-alerta").click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    // borrar un alimento de la lista: renderFoods + renderWeeklyAlert re-pintan el clúster entero
    const del1 = app.document.querySelector("#food-list [data-del]");
    expect(del1).toBeTruthy();
    del1.click();
    // el 🗑 pasa por el diálogo de confirmación (2026-10-23): el borrado ocurre al confirmar
    app.document.querySelector("[data-eliminar-confirmar]").click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    const candado = app.document.getElementById("candado-alerta");
    expect(candado.getAttribute("aria-pressed")).toBe("true");
    expect(candado.textContent).toBe("🔒");
  });

  it("si la lista CAE bajo 8 items al resolver filas, el candado se suelta solo", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    app.document.getElementById("candado-alerta").click();
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    // borrar 1 alimento: quedan 8 pendientes, seguimos con candado (aún toca scrollear);
    // borrar otro: quedan 7 → el candado cae solo (nada que congelar).
    const dels = app.document.querySelectorAll("#food-list [data-del]");
    expect(dels.length).toBe(9);
    dels[0].click();   // 8 pendientes: sigue con candado
    app.document.querySelector("[data-eliminar-confirmar]").click();   // confirmar el borrado
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(true);
    app.document.querySelectorAll("#food-list [data-del]")[0].click();   // 7 pendientes: fuera candado
    app.document.querySelector("[data-eliminar-confirmar]").click();
    expect(app.document.querySelector("#candado-alerta")).toBeNull();
  });
});

describe("alerta semanal — el candado es SÓLO MÓVIL (afinación 2026-10-19)", () => {
  it("DESKTOP con 9 pendientes: el cap y el scroll quedan, el candado NO se pinta y nada se congela", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: false });
    const alerta = app.document.getElementById("weekly-alert");
    expect(alerta.querySelectorAll(".alert-scroll li.alert-row")).toHaveLength(9);   // lista completa
    expect(alerta.querySelector(".alert-scroll")).toBeTruthy();                     // cap de alto sigue
    expect(alerta.querySelector("#candado-alerta")).toBeNull();                     // ni candado en la UI
    expect(app.window.document.documentElement.classList.contains("scroll-candado")).toBe(false);
  });

  it("MÓVIL con 9 pendientes: el candado SÍ está (control negativo del anterior)", () => {
    const app = bootApp({ seed: { foods: pendientes(9) }, esMovil: true });
    expect(app.document.getElementById("weekly-alert").querySelector("#candado-alerta")).toBeTruthy();
  });
});

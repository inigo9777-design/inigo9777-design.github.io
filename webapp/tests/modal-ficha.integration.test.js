// tests/modal-ficha.integration.test.js — integración (Capa 2, CODING_STANDARDS.md §6).
// Ficha de receta en el modal (#modal-content) + grupo de acciones de la compra (2026-10-19):
//  - el div del modal lleva la clase .modal-content: si la pierde, TODO el bloque editorial del
//    CSS (secciones con filete, sangrías, pie) muere — fue el bug de "la ficha no se ve bien".
//  - filete con fade (.receta-linea) justo debajo del título, ANTES de las etiquetas.
//  - SOLO el botón "🍳 Cocinar hoy" lleva data-tip (consejero); el resto del pie va limpio
//    y SIN title (petición 2026-10-19: los consejos solo en Cocinar hoy).
//  - consejero: hover muestra, mouseout oculta (delegado en #modal-content).
//  - táctil: long-press (450 ms) muestra el consejo y ESE toque largo NO acciona el botón; el
//    toque corto sigue accionando; y tras un long-press el SIGUIENTE tap tampoco queda
//    envenenado por la bandera de supresión.
//  - la fila de la compra agrupa "🛒 Despensa?" y "✅ comprado" en .alert-acciones.

const { bootApp } = require("./boot");

const RECETA = {
  id: "r1", title: "Tortilla de patatas", meal: "comida",
  ingredients: ["4 huevos", "patatas"],
  method: ["Bate y cuaja.", "Deja la tortilla perfecta y llévala a la mesa."],
  createdAt: 1,
};

function bootConReceta(extraSeed = {}, opts = {}) {
  return bootApp({ seed: { recipes: [RECETA], ...extraSeed }, ...opts });
}

describe("ficha de receta en el modal — presente, ordenada y bien botones (integración)", () => {
  it("el div del modal conserva la clase .modal-content (el bloque editorial depende de ella)", () => {
    const app = bootConReceta();
    expect(app.document.getElementById("modal-content").classList.contains("modal-content")).toBe(true);
  });

  it("el detalle abre con el filete con fade entre el título y las etiquetas", () => {
    const app = bootConReceta();
    app.document.querySelector('[data-view="recipes"]').click();
    app.document.querySelector("#recipe-list .recipe-card").click();
    const ficha = app.document.getElementById("modal-content");
    expect(ficha.querySelector("h2").textContent).toContain("Tortilla de patatas");
    const linea = ficha.querySelector(".receta-linea");
    expect(linea).toBeTruthy();
    expect(linea.classList.contains("receta-linea")).toBe(true);
    // orden pedido: título → filete → etiquetas
    expect(ficha.children[0].tagName).toBe("H2");
    expect(ficha.children[1]).toBe(linea);
    expect(ficha.children[2].classList.contains("recipe-meta")).toBe(true);
  });

  it("solo '🍳 Cocinar hoy' lleva consejero (data-tip), el resto del pie va limpio y sin title", () => {
    const app = bootConReceta();
    app.document.querySelector('[data-view="recipes"]').click();
    app.document.querySelector("#recipe-list .recipe-card").click();
    const botones = [...app.document.querySelectorAll("#modal-content .modal-footer .btn")];
    expect(botones.map(b => b.textContent.trim())).toEqual(["Cerrar", "✏️ Editar", "🍳 Cocinar hoy", "📋 Copiar"]);
    const conTip = botones.filter(b => b.dataset.tip != null);
    expect(conTip.map(b => b.textContent.trim())).toEqual(["🍳 Cocinar hoy"]);
    botones.forEach(b => expect(b.hasAttribute("title")).toBe(false));
  });

  it("consejero: hover muestra el consejo y quitar el ratón lo retira", () => {
    const app = bootConReceta();
    app.document.querySelector('[data-view="recipes"]').click();
    app.document.querySelector("#recipe-list .recipe-card").click();
    const ficha = app.document.getElementById("modal-content");
    const btn = ficha.querySelector("[data-cook]");
    btn.dispatchEvent(new app.window.MouseEvent("mouseover", { bubbles: true }));
    const tip = app.document.getElementById("tip-chef");
    expect(tip).toBeTruthy();
    expect(tip.classList.contains("show")).toBe(true);
    expect(tip.textContent).toContain("7 días");
    btn.dispatchEvent(new app.window.MouseEvent("mouseout", { bubbles: true }));
    expect(tip.classList.contains("show")).toBe(false);
  });

  it("cerrar el modal con la píldora activa la RETIRA (el botón muerto no deja consejo colgado)", () => {
    const app = bootConReceta();
    app.document.querySelector('[data-view="recipes"]').click();
    app.document.querySelector("#recipe-list .recipe-card").click();
    const btn = app.document.querySelector("#modal-content [data-cook]");
    btn.dispatchEvent(new app.window.MouseEvent("mouseover", { bubbles: true }));
    expect(app.document.getElementById("tip-chef").classList.contains("show")).toBe(true);
    // Escape: sin foco en el botón no hay focusout, y el hover moriría sin mouseout al deskapearse el DOM
    app.document.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.document.getElementById("tip-chef").classList.contains("show")).toBe(false);
  });
});

describe("consejero táctil — long-press muestra y el toque largo no acciona (integración)", () => {
  function adelantar(ms) { jest.advanceTimersByTime(ms); }

  function abrirFicha(app) {
    app.document.querySelector('[data-view="recipes"]').click();
    app.document.querySelector("#recipe-list .recipe-card").click();
  }
  function toque(app, btn, type) {
    // jsdom no tiene Touch: al handler de app.js basta el target (no lee touches)
    btn.dispatchEvent(new app.window.TouchEvent(type, { bubbles: true, cancelable: true, touches: [] }));
  }

  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  // la píldora se crea LAZY (sólo cuando se muestra): ausencia == oculto
  const tipVisible = (app) => {
    const t = app.document.getElementById("tip-chef");
    return !!t && t.classList.contains("show");
  };

  it("long-press (≥450 ms) enseña el consejo; al soltar se va y NADA se cocina", () => {
    const app = bootConReceta();
    abrirFicha(app);
    const btn = app.document.querySelector("#modal-content [data-cook]");
    toque(app, btn, "touchstart");
    adelantar(449);
    expect(tipVisible(app)).toBe(false);                                                       // aún no
    adelantar(20);                                                                             // 469 ms: largo de veras
    expect(tipVisible(app)).toBe(true);
    toque(app, btn, "touchend");
    expect(tipVisible(app)).toBe(false);
    expect(app.document.querySelectorAll("#modal-content .receta-linea")).toHaveLength(1);     // el modal sigue igual
    // el click que generaría el finger-up tras leer NO acciona el botón
    btn.click();
    expect(JSON.parse(app.localStorage.getItem("mrcheff.cooked") || "[]")).toHaveLength(0);
  });

  it("el toque corto (por debajo de 450 ms) sigue accionando el botón", () => {
    const app = bootConReceta();
    abrirFicha(app);
    const btn = app.document.querySelector("#modal-content [data-cook]");
    toque(app, btn, "touchstart");
    adelantar(100);                                                                            // corto
    toque(app, btn, "touchend");
    expect(tipVisible(app)).toBe(false);
    btn.click();                                                                               // el finger-up natural
    expect(JSON.parse(app.localStorage.getItem("mrcheff.cooked") || "[]")).toHaveLength(1);
  });

  it("tras un long-press, el SIGUIENTE tap no queda envenenado por la supresión", () => {
    const app = bootConReceta();
    abrirFicha(app);
    const btn = app.document.querySelector("#modal-content [data-cook]");
    toque(app, btn, "touchstart");
    adelantar(500);
    toque(app, btn, "touchend");                                                               // long-press leído, bandera armada
    toque(app, btn, "touchstart");                                                             // contacto NUEVO: se confía otra vez
    adelantar(100);
    toque(app, btn, "touchend");
    btn.click();
    expect(JSON.parse(app.localStorage.getItem("mrcheff.cooked") || "[]")).toHaveLength(1);
  });
});

describe("fila de la compra — «🛒 Despensa?» agrupada con «✅ comprado» (integración)", () => {
  const DESPENSA = [{ id: "ib1", name: "Jamón ibérico", qty: 0, min: 1, score: 5, checked: false }];
  const SEMANA = {
    approved: true, generatedOn: "2026-10-19", includeUnavailable: false,
    plan: Array.from({ length: 7 }, () => ({ dayLabel: "Lunes", meals: [] })),
    needyFoods: [{ name: "Jamón serrano" }],
  };

  it("los dos botones de la fila viven en el GRUPO .alert-acciones (pegados, nunca sueltos)", () => {
    const app = bootApp({ seed: { foods: DESPENSA, weekmenu: SEMANA } });
    const fila = app.document.querySelector("#shopping-list li.alert-row");
    expect(fila).toBeTruthy();
    const grupo = fila.querySelector(".alert-acciones");
    expect(grupo).toBeTruthy();
    expect(grupo.querySelector("[data-despensa]")).toBeTruthy();
    expect(grupo.querySelector("[data-buy]")).toBeTruthy();
    // nada de acciones queda fuera del grupo
    expect(fila.querySelectorAll("[data-despensa], [data-buy]")).toHaveLength(2);
    expect(fila.querySelectorAll(":scope > [data-despensa], :scope > [data-buy]")).toHaveLength(0);
  });
});

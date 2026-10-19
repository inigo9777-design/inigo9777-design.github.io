// tests/despensa-candidatos.integration.test.js — integración (Capa 2, CODING_STANDARDS.md §6).
// Arranca la app REAL vía ./boot.js con un menú APROBADO sembrado en localStorage y recorre el
// flujo completo del feature "🛒 Despensa?" (2026-10-19):
//   needyFoods "Jamón serrano"  →  fila de la compra con botón "🛒 Despensa?" (el casador de
//   tokens diff no une solo "Jamón serrano" con despensa "Jamón ibérico")  →  modal de candidatos
//   ("¿Despensa?")  →  el usuario elige "Jamón ibérico"  →  modal de compra (misma forma del
//   2026-10-18)  →  confirmar: la compra va IN-SITU al alimento ELEGIDO (mismo id/nombre, sin
//   alta nueva) y el ítem SALE de needyFoods.
// También fija la cara negativa: items sin variantes plausibles (nada puede ser candidato) NO
// llevan botón — la regla simple y la decisión final quedan en el usuario, sóla la duda se ofrece.
// jsdom no tiene layout: nada de mediaqueries aquí — el feature no usa el candado ni cap de alto.

const { bootApp } = require("./boot");

const dias = () => Array.from({ length: 7 }, (_, i) => ({ dayLabel: "Lunes", meals: [] }));

const mkHandle = (foods, needyFoods) => bootApp({
  seed: {
    foods,
    weekmenu: { approved: true, generatedOn: "2026-10-19", includeUnavailable: false, plan: dias(), needyFoods },
  },
});

const despensaBase = [
  { id: "ib1", name: "Jamón ibérico", qty: 0, min: 1, score: 5, checked: false },
  { id: "lc1", name: "Leche", qty: 3, min: 1, score: 2, checked: true },
];

describe("🛒 Despensa? — candidatos de variantes en la fila de la compra (integración)", () => {
  it("la fila de «Jamón serrano» lleva el botón 🛒 despensa y «✅ comprado» queda después", () => {
    const app = mkHandle(despensaBase, [{ name: "Jamón serrano" }]);
    const filas = app.document.querySelectorAll("#shopping-list li.alert-row");
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain("Jamón serrano");
    const btnDespensa = filas[0].querySelector("[data-despensa]");
    expect(btnDespensa).toBeTruthy();
    expect(filas[0].querySelector("[data-buy]")).toBeTruthy();
    // orden pedido del usuario: "Despensa?" ANTES de "comprado"
    expect(filas[0].querySelectorAll("[data-despensa], [data-buy]")[0].dataset.despensa).toBe("Jamón serrano");
  });

  it("el clico abre el diálogo de candidatos: sólo variantes con token común (jamón sí, leche no)", () => {
    const app = mkHandle(despensaBase, [{ name: "Jamón serrano" }]);
    app.document.querySelector("#shopping-list [data-despensa]").click();
    const modal = app.document.getElementById("modal-content");
    expect(modal.querySelector("h2").textContent).toContain("¿Despensa?");
    expect(modal.textContent).toContain("Posible alimento identificado en tu despensa");
    const opciones = [...modal.querySelectorAll("[data-despensa-elegir]")].map(b => b.dataset.despensaElegir);
    expect(opciones).toEqual(["Jamón ibérico"]);
  });

  it("elegir la variante abre el modal de compra apuntando AL ALIMENTO ELEGIDO; al confirmar, la compra va in-situ", () => {
    const app = mkHandle(despensaBase, [{ name: "Jamón serrano" }]);
    app.document.querySelector("#shopping-list [data-despensa]").click();
    app.document.querySelector("#modal-content [data-despensa-elegir]").click();
    const modal = app.document.getElementById("modal-content");
    expect(modal.querySelector("h2").textContent).toContain("¿Comprado?");
    expect(modal.textContent).toContain("Jamón ibérico");   // el texto del destino explicará despensa
    // afinación 2026-10-19: el modal viene pre-cargado con el MÍNIMO y la IMPORTANCIA del
    // alimento de despensa (su criterio de alerta ya existe — no re-preguntar de cero)
    expect(app.document.getElementById("compra-min").value).toBe("1");
    expect(app.document.getElementById("compra-score").value).toBe("5");
    app.document.getElementById("compra-qty").value = "2";
    app.document.getElementById("compra-score").value = "7";
    app.document.getElementById("compra-min").value = "";
    app.document.querySelector("[data-buy-confirm]").click();

    const foods = JSON.parse(app.localStorage.getItem("mrcheff.foods"));
    expect(foods).toHaveLength(2);                          // sin alta nueva
    const jamon = foods.find(f => f.name === "Jamón ibérico");
    expect(jamon.id).toBe("ib1");                           // mismo alimento, no un gemelo nuevo
    expect(jamon.qty).toBe(2);
    expect(jamon.score).toBe(7);
    expect(jamon.min).toBe(1);                              // conservó su mínimo de despensa
    const weekmenu = JSON.parse(app.localStorage.getItem("mrcheff.weekmenu"));
    expect(weekmenu.needyFoods).toHaveLength(0);            // el ítem sale de la compra
    expect(app.document.getElementById("shopping-list").classList.contains("hidden")).toBe(true);
  });

  it("sin variantes plausibles (nada comparte token): la fila NO lleva el botón", () => {
    const app = mkHandle(despensaBase, [{ name: "Zanahoria" }]);
    const fila = app.document.querySelector("#shopping-list li.alert-row");
    expect(fila).toBeTruthy();
    expect(fila.querySelector("[data-despensa]")).toBeNull();
    expect(fila.querySelector("[data-buy]")).toBeTruthy();
  });

  it("«Pan de pueblo» ↔ despensa «Pan»: el caso del usuario sale de candidata y mapea igual", () => {
    const app = mkHandle(
      [{ id: "p1", name: "Pan", qty: 0, min: 1, score: 3, checked: false }],
      [{ name: "Pan de pueblo" }]
    );
    const fila = app.document.querySelector("#shopping-list li.alert-row");
    expect(fila).toBeTruthy();
    fila.querySelector("[data-despensa]").click();
    const opciones = [...app.document.querySelectorAll("#modal-content [data-despensa-elegir]")];
    expect(opciones.map(b => b.dataset.despensaElegir)).toEqual(["Pan"]);
    opciones[0].click();
    app.document.getElementById("compra-qty").value = "3";
    app.document.getElementById("compra-score").value = "6";
    app.document.getElementById("compra-min").value = "2";
    app.document.querySelector("[data-buy-confirm]").click();
    const foods = JSON.parse(app.localStorage.getItem("mrcheff.foods"));
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe("Pan");
    expect(foods[0].qty).toBe(3);
    expect(foods[0].min).toBe(2);
    expect(JSON.parse(app.localStorage.getItem("mrcheff.weekmenu")).needyFoods).toHaveLength(0);
  });
});

  it("el pre-cargado trae el criterio REAL de despensa (mín 4 / importancia 8) y se conserva al confirmar", () => {
    const app = mkHandle(
      [{ id: "ch1", name: "Chorizo riojano", qty: 0, min: 4, score: 8, checked: false }],
      [{ name: "Chorizo de la sierra" }]
    );
    const fila = app.document.querySelector("#shopping-list li.alert-row");
    expect(fila).toBeTruthy();                              // comparten el token "chorizo"
    fila.querySelector("[data-despensa]").click();
    app.document.querySelector("#modal-content [data-despensa-elegir]").click();
    // ambos campos llegan PRE-CARGADOS con los datos del Chorizo riojano de la despensa
    expect(app.document.getElementById("compra-min").value).toBe("4");
    expect(app.document.getElementById("compra-score").value).toBe("8");
    app.document.getElementById("compra-qty").value = "1";  // lo único que cambia: cuánto se compró
    app.document.querySelector("[data-buy-confirm]").click();
    const foods = JSON.parse(app.localStorage.getItem("mrcheff.foods"));
    const chorizo = foods.find(f => f.name === "Chorizo riojano");
    expect(chorizo.qty).toBe(1);
    expect(chorizo.min).toBe(4);
    expect(chorizo.score).toBe(8);
    expect(JSON.parse(app.localStorage.getItem("mrcheff.weekmenu")).needyFoods).toHaveLength(0);
  });

// tests/lista-compra-prioridad.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS §6) del
// SEMÁFORO DE LA COMPRA POR PRIORIDAD (bugfix 2026-10-21, petición del usuario: "los que no tengan
// la prioridad definida tienen que tener el color neutro; los que ya están en el Inventario, el color
// de SU prioridad"). Antes el color lo mandaba la fecha de preparación del plan y los ítems sin
// registro salían mezclados en rojo/verde. La regla vive en el módulo puro (shoppingListFor →
// priority.urgencyLevel); aquí se ejercita el DOM REAL de la Card 3 vía bootApp:
//   * alimento REGISTRADO en casa (con qty ≤ min, por eso sigue en la lista) → li.urg- por SU score
//     y los datos reales (qty/min/score) en la fila;
//   * ítem SIN registro (defaults 0/0/5) → li.urg-NEUTRAL y va al final;
//   * el metadato "se usa el …" del plan se sigue pintando (onDay/daysUntil intactos).

const { bootApp } = require("./boot");

// Inventario: Yogur natural score 7 (naranja, qty 2 de un min 3 → SIN cubrir, SIGUE), Pan score 3
// (verde, qty 1 de un min 2 → SIGUE). "Semillas de calabaza" NO está en casa → neutra (última).
// needyFoods del plan aprobado con días distintos para comprobar que onDay/daysUntil siguen en la fila.
const SEMILLA = {
  foods: [
    { id: "a1", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 1 },
    { id: "a2", name: "Pan", score: 3, qty: 1, min: 2, checked: false, createdAt: 2 }
  ],
  recipes: [],
  innov: [],
  cooked: [],
  weekmenu: {
    approved: true,
    generatedOn: "2026-10-21",
    includeUnavailable: false,
    plan: [
      {
        dayLabel: "Martes",
        meals: [
          { meal: "desayuno", recipe: null, missing: [] },
          { meal: "comida", recipe: { title: "Puré", ingredients: ["Semillas de calabaza"] }, missing: ["Semillas de calabaza", "Yogur"] },
          { meal: "cena", recipe: null, missing: [] }
        ]
      },
      {
        dayLabel: "Sábado",
        meals: [
          { meal: "desayuno", recipe: null, missing: [] },
          { meal: "comida", recipe: { title: "Bocadillos", ingredients: ["Pan"] }, missing: ["Pan"] },
          { meal: "cena", recipe: null, missing: [] }
        ]
      }
    ],
    needyFoods: [{ name: "Pan" }, { name: "Yogur" }, { name: "Semillas de calabaza" }],
    colapsado: false
  }
};

function arrancar() {
  return bootApp({
    today: "2026-10-21",
    seed: SEMILLA
  });
}

const filas = document =>
  [...document.querySelectorAll("#shopping-list li.alert-row")].map(li => ({
    nombre: li.querySelector(".alert-name strong").textContent,
    clases: [...li.classList].filter(c => c.startsWith("urg-")),
    texto: li.textContent
  }));

describe("Card 3 — SEMÁFORO DE LA COMPRA POR PRIORIDAD (bugfix 2026-10-21, integración)", () => {
  it("registrado con qty ≤ min → color por SU prioridad + datos reales; sin registro → neutro al final; onDay/daysUntil siguen en la fila", () => {
    const { document } = arrancar();
    const lista = filas(document);

    expect(lista.map(f => f.nombre)).toEqual(["Yogur", "Pan", "Semillas de calabaza"]);

    // Yogur natural (score 7): NARANJA, con el qty/min/score REALES del alimento de casa y el
    // ancla del plan (se usa el…), que sigue informativa.
    expect(lista[0].clases).toEqual(["urg-orange"]);
    expect(lista[0].texto).toContain("qty 2 · mínimo 3 · importante 7/10");
    expect(lista[0].texto).toContain("se usa el");

    // Pan (score 3): VERDE con sus datos reales.
    expect(lista[1].clases).toEqual(["urg-green"]);
    expect(lista[1].texto).toContain("qty 1 · mínimo 2 · importante 3/10");

    // Semillas de calabaza: SIN registro → fila NEUTRA con los ceros de defecto, al final.
    expect(lista[2].clases).toEqual(["urg-neutral"]);
    expect(lista[2].texto).toContain("qty 0 · mínimo 0 · importante 5/10");
  });

  it("compra que CUBRE el mínimo (qty > min del alimento de casa) saca la fila; la que no, la deja con su color", () => {
    const { document, window } = arrancar();
    // ✅ comprado del YOGUR: cantidad 3 → 2+3 = 5 > min 3 → SALE de la lista
    const btnYogur = document.querySelector('#shopping-list [data-buy="Yogur"]');
    btnYogur.click();
    document.getElementById("compra-qty").value = "3";
    document.querySelector("[data-buy-confirm]").click();
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);   // sanity: no hay pendientes del ticket

    const nombres = filas(document).map(f => f.nombre);
    expect(nombres).toEqual(["Pan", "Semillas de calabaza"]);                  // neutra sigue al final
  });
});

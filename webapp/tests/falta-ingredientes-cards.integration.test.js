// tests/falta-ingredientes-cards.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// FEATURE 2026-10-24 "la falta en las cards" (petición del usuario: el plan semanal ya contaba lo
// que faltaba fuera Y dentro de la ficha — las demás tarjetas de receta no): card de MIS RECETAS,
// ideas de INNOVACIÓN, lotes de SUGERENCIAS (Card 1) y la FICHA desde CUALQUIER vista enseñan ahora
// la MISMA información de despensa viva — "⚠️ Falta: A, B" en rojo o "✅ Todos los ingredientes en
// casa" en verde. La regel vive en el módulo puro recipe-missing (nombresFaltantes, misma decisión
// que las marcas del modal — un solo lugar calcula bien); aquí se ejercita la app REAL vía bootApp.
//
// REGIÓN de repintado: cualquier suceso de despensa (alta manual, ➕/➖/🗑, OCR, import) pasa por
// ctx.renderShoppingListTrasDespensa — el gancho que ahora también repinta las tres listas de cards.

const { bootApp } = require("./boot");

const despensaConFaltas = [
  { id: "f1", name: "Pan", qty: 3, min: 1, score: 3 },                    // cubre el pan de la receta 1
  { id: "f2", name: "Huevos", qty: 4, min: 1, score: 5 },                 // cubre la receta 2 entera
  { id: "f3", name: "Sal", qty: 2, min: 1, score: 4 },
  { id: "f4", name: "Espinacas", qty: 0, min: 1, score: 8 },              // en el inventario pero SIN stock → falta
  { id: "f5", name: "Crema de manos", qty: 5, min: 0, score: 5, categoria: "hogar" }  // hogar NO cubre cocina (la despensa de cocina la despacha)
];

const recetas = [
  {
    id: "r1", title: "Huevos escalfados sobre espinacas", meal: "comida",
    ingredients: ["Pan", "Espinacas", "Vino blanco", "Sal"], method: ["Una cosa", "Otra"],
    createdAt: 1
  },
  {
    id: "r2", title: "Huevos duros con sal", meal: "comida",
    ingredients: ["Huevos", "Sal"], method: ["Cuece", "Pela"], createdAt: 2
  }
];

const recetaConHogar = [
  {
    id: "r3", title: "Dema", meal: "cena",
    ingredients: ["Crema"], method: ["Bate"], createdAt: 3
  }
];

describe("Cards con la despensa viva: línea Falta / todo-en-casa en Mis Recetas, Innovación, Card 1 y ficha (integración)", () => {
  const hoyISO = () => new Date().toISOString().slice(0, 10);

  it("Mis Recetas: la receta con carencias enseña '⚠️ Falta' con SU lista y la completa la verde '✅'", () => {
    const { document } = bootApp({ seed: { foods: despensaConFaltas, recipes: recetas } });
    const cards = document.querySelectorAll("#recipe-list .recipe-card");
    expect(cards.length).toBe(2);
    const lineas = [...cards].map(c => [...c.querySelectorAll(".innov-uses")].map(e => e.textContent).join(" | "));
    const faltante = lineas.find(l => l.includes("Falta:"));
    expect(faltante).toContain("Falta: Espinacas, Vino blanco");
    const algunaVerde = lineas.some(l => l.includes("Todos los ingredientes en casa"));
    expect(algunaVerde).toBe(true);
  });

  it("ideas de Innovación sembradas: su card de ideas también enseña 'Falta: Espinacas'", () => {
    const idea = {
      id: "i1", title: "Tortilla de Espinacas", meal: "comida", source: "nueva",
      ingredients: ["Huevos", "Espinacas"], method: ["Bate", "Cuaja"],
      createdAt: Date.now(), uses: ["Huevos"]
    };
    const { document } = bootApp({
      seed: { foods: despensaConFaltas, recipes: recetas, innov: [idea], innovDate: hoyISO() }
    });
    const card = document.querySelector("#innovation-list .recipe-card");
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Falta: Espinacas");
  });

  it("el producto de HOGAR no cubre cocinar: la receta con 'Crema' sigue en Falta aunque la despensa tenga 'Crema de manos' qty 5", () => {
    const { document } = bootApp({ seed: { foods: despensaConFaltas, recipes: recetaConHogar } });
    const card = document.querySelector("#recipe-list .recipe-card");
    expect(card.textContent).toContain("Falta: Crema");
    expect(card.textContent).not.toContain("Todos los ingredientes en casa");
  });

  it("la FICHA desde Mis Recetas marca los '⚠️ No lo tienes' por ingrediente (sin bandera — marca desde todas las vistas)", () => {
    const { document } = bootApp({ seed: { foods: despensaConFaltas, recipes: recetas } });
    const card = [...document.querySelectorAll("#recipe-list .recipe-card")]
      .find(c => c.querySelector("h3") && c.querySelector("h3").textContent.includes("escalfados"));
    card.click();                                   // abre el modal de detalle
    const marcados = [...document.querySelectorAll("#modal-content li.meal-missing")].map(li => li.textContent);
    expect(marcados.some(t => t.includes("Espinacas"))).toBe(true);
    expect(marcados.some(t => t.includes("Vino blanco"))).toBe(true);
    document.querySelector("#modal-content [data-close]").click();
  });

  it("REPINTADO tras suceso de despensa: ➕ del inventario llena 'Espinacas' → sale de la Falta de la card AL INSTANTE (queda 'Vino blanco')", () => {
    const { document } = bootApp({ seed: { foods: despensaConFaltas, recipes: recetas } });
    const filaEspinacas = [...document.querySelectorAll("#food-list .food-row, #food-list li")]
      .find(f => f.textContent && f.textContent.includes("Espinacas"));
    filaEspinacas.querySelector("[data-inc]").click();

    const card = [...document.querySelectorAll("#recipe-list .recipe-card")]
      .find(c => c.querySelector("h3") && c.querySelector("h3").textContent.includes("escalfados"));
    expect(card.textContent).toContain("Falta: Vino blanco");        // el repintado EN VIVO: Espinacas (1 en casa) sale
    expect(card.textContent).not.toContain("Falta: Espinacas");
    expect(card.textContent).not.toContain("Todos los ingredientes en casa"); // aún falta el vino
  });

  it("Sugerencias (Card 1): cada tarjeta del lote enseña UNA de las dos líneas — nunca queda sin la información", () => {
    const foodsCocinables = [
      { id: "c1", name: "Pan", qty: 5, min: 1, score: 5 },
      { id: "c2", name: "Tomate", qty: 5, min: 1, score: 5 },
      { id: "c3", name: "Ajo", qty: 5, min: 1, score: 5 },
      { id: "c4", name: "Aceite de oliva", qty: 5, min: 1, score: 5 },
      { id: "c5", name: "Sal", qty: 5, min: 1, score: 5 }
    ];
    const { document } = bootApp({ seed: { foods: foodsCocinables, recipes: [] } });
    document.querySelector('[data-view="suggest"]').click();
    document.getElementById("btn-suggest-generate").click();
    const cards = document.querySelectorAll("#suggest-list .recipe-card");
    expect(cards.length).toBeGreaterThan(0);
    [...cards].forEach(card => {
      const lineas = [...card.querySelectorAll(".innov-uses")].map(e => e.textContent);
      const tiene = lineas.some(l => l.includes("Falta:") || l.includes("Todos los ingredientes en casa"));
      expect(tiene).toBe(true);
    });

    // "Sugerencia limpiada" + suceso de despensa: el lote limpiado NO debe reaparecer con el repintado
    document.getElementById("btn-suggest-clear").click();
    const filaPan = [...document.querySelectorAll("#food-list li")].find(f => f.textContent.includes("Pan"));
    filaPan.querySelector("[data-inc]").click();
    expect(document.querySelectorAll("#suggest-list .recipe-card").length).toBe(0);
  });
});

// tests/suggest-rotation.integration.test.js — CAPA INTEGRACIÓN (Capa 2, §6 del estándar de pruebas).
// Ejerce el flujo del botón "↻ Sugerir ahora" (Card 1 de "Sugerencias y menú", feature 2026-10-18):
//   1) Cada click muestra un LOTE DE 4 máximo con 1 desayuno + 1 comida + 1 cena (la 4ª tarjeta
//      rota por tipo de comida) — los 3 tipos están garantizados mientras el aforo tenga
//      cocinables de cada tipo; si a algún tipo le faltan candidatos, el hueco lo tapa lo mejor
//      del ranking global aún no en el lote (nunca más de 4 tarjetas).
//   2) El lote CAMBIA en cada click aunque el aforo cocinable sea pequeño: la vista reparte el
//      ranking de planner.suggestToday por tipo de comida y avanza un cursor por click.
//   3) "Limpiar" reinicia la rotación desde cero (mismo lote que el primer click).
// Arranca la app REAL vía bootApp() e interacciona sólo por DOM, como un usuario.

const { bootApp } = require("./boot");
const catalogo = require("../data/recetas-espanolas-data.js");

// Aforo sembrado: union de los ingredientes de 2 desayunos + 2 comidas + 2 cenas REALES del
// catálogo (garantiza candidatos cocinables de los 3 tipos) — cada alimento con qty>0.
const elegidas = [];
["desayuno", "comida", "cena"].forEach(meal => {
  elegidas.push(...catalogo.filter(r => r.meal === meal).slice(0, 2));
});
const nombres = [...new Set(elegidas.flatMap(r => r.ingredients || []))];
const PANTRY = nombres.map((name, i) => ({ id: "f-" + i, name, qty: 5, min: 1, score: 5, checked: false, createdAt: i }));

function abrirSugerenciasYClick(doc) {
  doc.querySelector('.tab[data-view="suggest"]').click();
  const btn = doc.getElementById("btn-suggest-generate");
  expect(btn).not.toBeNull();
  btn.click();
  return leerLote(doc);
}

function leerLote(doc) {
  const cards = [...doc.querySelectorAll("#suggest-list .recipe-card")];
  return cards.map(card => {
    const tag = [...card.querySelectorAll(".tag")].find(t => (t.className || "").includes("meal-"));
    return {
      title: card.querySelector("h3").textContent,
      meal: tag ? [...tag.classList].find(c => c.startsWith("meal-")).slice(5) : ""
    };
  });
}

describe("Sugerencias y menú — lote de 4 con 1 desayuno + 1 comida + 1 cena y rotación por click", () => {
  it("cada click saca máximo 4 tarjetas y cubre los 3 tipos de comida cuando hay cocinables de los tres", () => {
    const { document } = bootApp({ seed: { foods: PANTRY, recipes: [], innov: [], cooked: [] } });
    const t1 = abrirSugerenciasYClick(document);
    expect(t1.length).toBeLessThanOrEqual(4);
    expect(t1.length).toBeGreaterThanOrEqual(3);
    const tipos = new Set(t1.map(c => c.meal));
    expect(tipos.has("desayuno")).toBe(true);
    expect(tipos.has("comida")).toBe(true);
    expect(tipos.has("cena")).toBe(true);
  });

  it("el lote CAMBIA en el click siguiente (el cursor avanza aunque el pool cocinable sea pequeño)", () => {
    const { document } = bootApp({ seed: { foods: PANTRY, recipes: [], innov: [], cooked: [] } });
    const t1 = abrirSugerenciasYClick(document);
    document.getElementById("btn-suggest-generate").click();
    const t2 = leerLote(document);
    expect(t2.length).toBeLessThanOrEqual(4);
    const nuevosEnT2 = t2.filter(c => !t1.some(x => x.title === c.title));
    expect(nuevosEnT2.length).toBeGreaterThan(0);   // NO vuelve a sacar siempre lo mismo
  });

  it('"Limpiar" reinicia la rotación: el lote vuelve a ser el del primer click', () => {
    const { document } = bootApp({ seed: { foods: PANTRY, recipes: [], innov: [], cooked: [] } });
    const t1 = abrirSugerenciasYClick(document);
    document.getElementById("btn-suggest-generate").click();
    document.getElementById("btn-suggest-clear").click();
    const reinicio = abrirSugerenciasYClick(document);
    expect(reinicio.map(c => c.title)).toEqual(t1.map(c => c.title));
  });
});

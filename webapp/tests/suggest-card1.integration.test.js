// tests/suggest-card1.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// Arranca la app REAL vía bootApp() e ejerce el flujo de Card-1 "Sugerencia de hoy" de la pestaña
// "Sugerencias y menú":
//   1) tab suggest activa #view-suggest
//   2) "↻ Sugerir ahora" renderiza recipe-cards con etiqueta SOURCE_LABEL.sugerenciaHoy ("Sugerencia de hoy")
//   3) "🍳 Cocinar hoy" inserta { id, title, keyFingerprint, on } en mrcheff.cooked y re-render (cooldown 7 días)
// No toca Mis Recetas / recipes[].

const { bootApp } = require("./boot");

const foodsConStock = [
  { name: "Pan", qty: 5, min: 1, score: 5 },
  { name: "Tomate", qty: 5, min: 1, score: 5 },
  { name: "Ajo", qty: 5, min: 1, score: 5 },
  { name: "Aceite de oliva", qty: 5, min: 1, score: 5 },
  { name: "Sal", qty: 5, min: 1, score: 5 },
];

const hoyISO = () => new Date().toISOString().slice(0, 10);

function sugerenciasVacias({ foods, recipes = [], innov = [], cooked = [] }) {
  return bootApp({ seed: { foods, recipes, innov, cooked } });
}

describe("Card-1 'Sugerencia de hoy' — pestaña Sugerencias y menú (integración parcial)", () => {
  it("activa la vista #view-suggest al hacer click en la pestaña suggest", () => {
    const { document } = sugerenciasVacias({ foods: foodsConStock });
    const tab = document.querySelector('[data-view="suggest"]');
    expect(tab).not.toBeNull();
    tab.click();
    expect(document.getElementById("view-suggest").classList.contains("active")).toBe(true);
  });

  it("renderiza recipe-cards con etiqueta 'Sugerencia de hoy' al pulsar 'Sugerir ahora'", () => {
    const { document } = sugerenciasVacias({ foods: foodsConStock });
    document.querySelector('[data-view="suggest"]').click();

    document.getElementById("btn-suggest-generate").click();

    const cards = document.querySelectorAll("#suggest-list .recipe-card");
    expect(cards.length).toBeGreaterThan(0);

    const tag = cards[0].querySelector(".tag.tag-receta_sugerida");
    expect(tag).not.toBeNull();
    expect(tag.textContent).toBe("Sugerencia de hoy");
  });

  it("'🍳 Cocinar hoy' inserta la entrada en mrcheff.cooked, no toca recipes[] y re-render con cooldown", () => {
    const { document, localStorage } = sugerenciasVacias({ foods: foodsConStock });
    document.querySelector('[data-view="suggest"]').click();
    document.getElementById("btn-suggest-generate").click();

    const cards = document.querySelectorAll("#suggest-list .recipe-card");
    expect(cards.length).toBeGreaterThan(0);

    const title = cards[0].querySelector("h3").textContent;
    cards[0].querySelector('[data-cook]').click();

    const cooked = JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]");
    expect(cooked.length).toBe(1);
    expect(cooked[0].title).toBe(title);
    expect(typeof cooked[0].id).toBe("string");
    expect(cooked[0].id.length).toBeGreaterThan(0);
    expect(cooked[0].on).toBe(hoyISO());
    expect(typeof cooked[0].keyFingerprint).toBe("string");
    expect(cooked[0].keyFingerprint.length).toBeGreaterThan(0);

    // No toca Mis Recetas / recipes[]
    expect(JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]")).toEqual([]);

    // Re-render: el plato cocinado entra en cooldown de 7 días y deja de sugerirse
    const cardsAfter = document.querySelectorAll("#suggest-list .recipe-card");
    const titulosAfter = Array.from(cardsAfter).map(c => c.querySelector("h3").textContent);
    expect(titulosAfter).not.toContain(title);
  });

  it("'Limpiar' borra el listado y vuelve a mostrar el aviso vacío", () => {
    const { document } = sugerenciasVacias({ foods: foodsConStock });
    document.querySelector('[data-view="suggest"]').click();
    document.getElementById("btn-suggest-generate").click();
    expect(document.querySelectorAll("#suggest-list .recipe-card").length).toBeGreaterThan(0);

    document.getElementById("btn-suggest-clear").click();
    expect(document.querySelectorAll("#suggest-list .recipe-card").length).toBe(0);
    expect(document.getElementById("suggest-empty").classList.contains("hidden")).toBe(false);
  });
});

// tests/buscador-catalogo.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// Arranca la app REAL vía bootApp() y ejerce la card "🔎 Buscador del catálogo" del tab RECETAS
// (feature 2026-10-18, entre crear receta y Mis Recetas):
//   1) se escribe en #recipe-catalog-search → resultados del catálogo (título o ingrediente)
//   2) click en una tarjeta del buscador → abre el MODAL de detalle (badge de origen incluido)
//   3) query sin match → estado vacío visible; NO toca Mis Recetas ni localStorage de recetas.

const { bootApp } = require("./boot");
const catalogo = require("../data/recetas-espanolas-data.js");

function appVacia() {
  return bootApp({ seed: { foods: [], recipes: [], innov: [], cooked: [] } });
}

// El harness no expone `Event` como global de Node: se toma del window del documento jsdom.
function escribir(input, texto) {
  input.value = texto;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

describe("Buscador del catálogo — pestaña Recetas (integración)", () => {
  it("escribe 'tortilla de patatas' → resultados del catálogo con badge de origen y sin tocar Mis Recetas", () => {
    const { document } = appVacia();
    const input = document.getElementById("recipe-catalog-search");
    expect(input).not.toBeNull();
    escribir(input, "tortilla de patatas");

    const cards = document.querySelectorAll("#recipe-catalog-results .recipe-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].querySelector("h3").textContent).toBe("Tortilla de patatas española");
    // badge de ORIGEN en cada tarjeta (feature de etiqueta por catálogo/ids italianas)
    expect(cards[0].querySelector(".tag.tag-origen-espanola")).not.toBeNull();
    // Mis Recetas sigue vacío (el buscador NO guarda)
    expect(JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]")).toEqual([]);
  });

  it("busca por INGREDIENTE fuera del título ('mascarpone' → Tiramisú casero con badge italiana)", () => {
    const { document } = appVacia();
    const input = document.getElementById("recipe-catalog-search");
    escribir(input, "mascarpone");

    const cards = [...document.querySelectorAll("#recipe-catalog-results .recipe-card")];
    const tiramisu = cards.find(c => c.querySelector("h3").textContent === "Tiramisú casero");
    expect(tiramisu).toBeDefined();
    expect(tiramisu.querySelector(".tag.tag-origen-italiana")).not.toBeNull();
  });

  it("click en un resultado abre el MODAL de detalle de esa receta", () => {
    const { document } = appVacia();
    const input = document.getElementById("recipe-catalog-search");
    escribir(input, "tiramisu");
    document.querySelectorAll("#recipe-catalog-results .recipe-card")[0].click();
    const modal = document.getElementById("modal");
    expect(modal.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("modal-content").querySelector("h2").textContent).toContain("Tiramisú");
  });

  it("query sin resultados → estado vacío visible (y limpiar la consulta lo oculta)", () => {
    const { document } = appVacia();
    const input = document.getElementById("recipe-catalog-search");
    const vacio = document.getElementById("recipe-catalog-empty");
    escribir(input, "zzzquinoa");
    expect(document.querySelectorAll("#recipe-catalog-results .recipe-card").length).toBe(0);
    expect(vacio.classList.contains("hidden")).toBe(false);
    escribir(input, "");
    expect(vacio.classList.contains("hidden")).toBe(true);
  });

  it("hay al menos 1 receta en el catálogo real esperada por este test (guard de wiring del JSON)", () => {
    expect(catalogo.length).toBeGreaterThan(100);
  });
});

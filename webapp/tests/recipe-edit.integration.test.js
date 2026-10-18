// tests/recipe-edit.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// Ejerce el flujo "✏️ Editar" del modal de receta (feature 2026-10-18):
//   1) Receta ya guardada en Mis Recetas → edición IN-SITU: mismo id, título/ingredientes/pasos
//      actualizados y persistidos en mrcheff.recipes; la lista re-renderiza el título nuevo.
//   2) Plato del MENÚ generado (catálogo curado, de sólo lectura) → "Editar y guardar" crea una
//      COPIA editable en Mis Recetas (id nuevo) y el hueco del plan aprobado refresca su plato
//      (el parche del plan se hace por el id ORIGINAL; no se duplica ninguna fila de Mis Recetas).
//
// Arranca la app REAL vía bootApp() e interacciona sólo por DOM (clicks/valores), como un usuario.

const { bootApp } = require("./boot");

const recetaSeed = {
  id: "r-1",
  title: "Tortilla de patatas",
  meal: "comida",
  ingredients: ["Patata", "Huevo"],
  method: ["Pela la patata", "Cuaja la tortilla"],
  createdAt: 1700000000000,
};

describe("Modal de receta — botón ✏️ Editar (edición de recetas)", () => {
  it("una receta de Mis Recetas se edita in-situ: mismo id, cambios persistidos y lista re-renderizada", () => {
    const { document, localStorage, jsdomErrors } = bootApp({
      seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] },
    });

    // Abre el detalle de la receta desde su tarjeta
    const card = document.querySelector("#recipe-list .recipe-card");
    expect(card).not.toBeNull();
    card.click();
    const modal = document.getElementById("modal");
    expect(modal.classList.contains("hidden")).toBe(false);

    // La receta vive en Mis Recetas → botón "✏️ Editar" (sin "y guardar")
    const btnEdit = document.querySelector("#modal-content [data-edit]");
    expect(btnEdit).not.toBeNull();
    expect(btnEdit.textContent).toBe("✏️ Editar");

    btnEdit.click();
    // El editor reutiliza el mismo modal y llega relleno
    expect(document.getElementById("edit-title").value).toBe("Tortilla de patatas");
    expect(document.getElementById("edit-ingredients").value).toContain("Huevo");

    // Edita título, añade un ingrediente y un paso
    document.getElementById("edit-title").value = "Tortilla de patatas y cebolla";
    document.getElementById("edit-meal").value = "cena";
    document.getElementById("edit-ingredients").value = "Patata\nHuevo\nCebolla";
    document.getElementById("edit-method").value = "Pela la patata\nFríe la cebolla\nCuaja la tortilla";

    document.querySelector("#modal-content [data-save-edit]").click();

    // Persistencia: MISMA receta, MISMO id, datos nuevos
    const recipes = JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]");
    expect(recipes.length).toBe(1);
    expect(recipes[0].id).toBe("r-1");
    expect(recipes[0].title).toBe("Tortilla de patatas y cebolla");
    expect(recipes[0].meal).toBe("cena");
    expect(recipes[0].ingredients).toEqual(["Patata", "Huevo", "Cebolla"]);
    expect(recipes[0].method).toEqual(["Pela la patata", "Fríe la cebolla", "Cuaja la tortilla"]);

    // El modal se cierra y la lista muestra el título editado (re-render)
    expect(modal.classList.contains("hidden")).toBe(true);
    const cards = [...document.querySelectorAll("#recipe-list .recipe-card")];
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector("h3").textContent).toBe("Tortilla de patatas y cebolla");

    expect(jsdomErrors.length).toBe(0);
  });

  it("un plato del menú generado se edita como COPIA en Mis Recetas y el hueco del plan refresca su plato", () => {
    // Poco stock + includeUnavailable (activado por defecto) → 7 días × 3 comidas con platos del catálogo
    const { document, localStorage, jsdomErrors } = bootApp({
      seed: { foods: [{ name: "Agua", qty: 5, min: 1, score: 5 }], recipes: [], innov: [], cooked: [] },
    });

    document.querySelector('[data-view="suggest"]').click();
    document.getElementById("btn-menu-generate").click();
    expect(document.querySelectorAll("#menu-plan-list .menu-day").length).toBe(7);
    document.getElementById("btn-menu-approve").click();

    // Elige un hueco CON plato (todas las comidas del plan tienen receta con includeUnavailable=true)
    const filasConPlato = [...document.querySelectorAll("#menu-plan-list .menu-meal-row[data-meal-idx]")]
      .filter(row => row.querySelector(".menu-meal-title"));
    expect(filasConPlato.length).toBeGreaterThan(0);
    const fila = filasConPlato[0];
    const titleOriginal = fila.querySelector(".menu-meal-title").textContent;

    fila.click();
    const modal = document.getElementById("modal");
    expect(modal.classList.contains("hidden")).toBe(false);

    // No está en Mis Recetas → "Editar y guardar" (crea copia, no muta el catálogo)
    const btnEdit = document.querySelector("#modal-content [data-edit]");
    expect(btnEdit.textContent).toBe("✏️ Editar y guardar");
    btnEdit.click();

    const titleNuevo = "Mi versión casera";
    expect(document.getElementById("edit-title").value).toBe(titleOriginal);
    document.getElementById("edit-title").value = titleNuevo;
    document.getElementById("edit-ingredients").value = "Agua\nSal";
    document.getElementById("edit-method").value = "Mezcla\nCuaja";

    document.querySelector("#modal-content [data-save-edit]").click();

    // Mis Recetas gana UNA copia nueva (id nuevo), y el plan aprobado refresca el plato de ese hueco
    const recipes = JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]");
    expect(recipes.length).toBe(1);
    expect(recipes[0].title).toBe(titleNuevo);
    expect(recipes[0].ingredients).toEqual(["Agua", "Sal"]);
    expect(recipes[0].id).not.toBe(titleOriginal);   // id nuevo, no el del catálogo

    const weekmenu = JSON.parse(localStorage.getItem("mrcheff.weekmenu") || "null");
    expect(weekmenu).not.toBeNull();
    const platosPlan = weekmenu.plan.flatMap(dia =>
      (Array.isArray(dia.meals) ? dia.meals : []).map(m => m.recipe).filter(Boolean)
    );
    const parcheado = platosPlan.filter(r => r.title === titleNuevo);
    expect(parcheado.length).toBe(1);                // el plato de la fila editada muestra el título nuevo

    // El modal queda cerrado tras guardar
    expect(modal.classList.contains("hidden")).toBe(true);
    expect(jsdomErrors.length).toBe(0);
  });

  it("guardar sin ingredientes o sin pasos no avanza y no toca la persistencia", () => {
    const { document, localStorage, recipes: recetasAntes } = bootApp({
      seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] },
    });

    document.querySelector("#recipe-list .recipe-card").click();
    document.querySelector("#modal-content [data-edit]").click();

    document.getElementById("edit-ingredients").value = "   \n   ";   // vacío tras trim
    document.querySelector("#modal-content [data-save-edit]").click();

    // Toast de error y modal sigue abierto (no cerró): el flujo queda en el editor
    expect(document.querySelector("#toast").textContent).toBe("Completa nombre, ingredientes y pasos");
    expect(document.getElementById("modal").classList.contains("hidden")).toBe(false);
    expect(recetasAntes.length).toBe(1);             // seed intacto: no se guardó nada
    expect(recetasAntes[0].title).toBe("Tortilla de patatas");
  });
});

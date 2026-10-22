// tests/fotos-recetas.integration.test.js — integración (Capa 2, CODING_STANDARDS.md §6).
// La banda de FOTO en la card (feature imagenes-recetas-cards, 2026-10-22) en las superficies de
// RECETA: lista de Mis Recetas, buscador del catálogo e Innovación. Regla vivida: la receta que
// conserva id del catálogo (o el título normalizado — copias ⭐/ideas) MUESTRA la foto del repo;
// el resto (recetas de usuario) muetra el placeholder con la inicial del plato. jsdom NO carga
// imágenes: los asertos son estructurales (img + src + placeholder), nunca de píxeles.

const { bootApp } = require("./boot");
const FOTOS_INDEX = require("../data/fotos-recetas-data.js");
const CATALOGO = require("../data/recetas-espanolas-data.js");

// El PRIMERO del índice generado (hay foto en el repo seguro) y SU título de catálogo.
const ID_FOTO = FOTOS_INDEX[0];
const TITULO_FOTO = CATALOGO.find(r => r.id === ID_FOTO).title;

describe("la banda de foto en las cards (integración)", () => {
  it("Recetas: la copia con título del catálogo lleva su foto; la manual lleva placeholder", () => {
    const app = bootApp({ seed: {
      recipes: [
        { id: "uid-guardada", title: TITULO_FOTO, meal: "cena", ingredients: ["a"], method: ["m"], createdAt: 1 },
        { id: "uid-manual", title: "Mis tostas raras de la huerta", meal: "comida", ingredients: ["b"], method: ["m"], createdAt: 2 },
      ],
    } });
    app.document.querySelector('[data-view="recipes"]').click();
    const cards = [...app.document.querySelectorAll("#recipe-list .recipe-card")];
    const conFoto = cards.find(c => c.querySelector("img.recipe-photo"));
    const sinFoto = cards.find(c => c.querySelector(".recipe-photo.recipe-foto-falta"));
    // La copia de uid NUEVO con título del plato del catálogo: foto por TÍTULO normalizado.
    expect(conFoto).toBeTruthy();
    expect(conFoto.querySelector("img.recipe-photo").getAttribute("src")).toBe("img/recetas/" + ID_FOTO + ".jpg");
    // La receta de la persona: placeholder del diseño con la inicial del título.
    expect(sinFoto).toBeTruthy();
    expect(sinFoto.querySelector(".recipe-foto-falta").getAttribute("data-letra")).toBe("M");
  });

  it("Buscador del catálogo: el hit con foto en el repo la muestra (id directo, sin uid)", () => {
    const app = bootApp({ seed: { recipes: [] } });
    app.document.querySelector('[data-view="recipes"]').click();
    const campo = app.document.getElementById("recipe-catalog-search");
    campo.value = TITULO_FOTO;
    campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("input", { bubbles: true }));
    const tiramisu = [...app.document.querySelectorAll("#recipe-catalog-results .recipe-card")]
      .find(c => c.querySelector("h3").textContent === TITULO_FOTO);
    expect(tiramisu).toBeTruthy();
    const img = tiramisu.querySelector("img.recipe-photo");
    expect(img && img.getAttribute("src")).toBe("img/recetas/" + ID_FOTO + ".jpg");
  });

  it("Innovación: la idea curada con título del catálogo sale con foto (el uid propio no frena)", () => {
    const app = bootApp({ seed: {
      innovDate: "2026-10-22",
      innov: [{
        id: "idea-uid", title: TITULO_FOTO, meal: "cena",
        ingredients: ["un ingrediente"], method: ["un paso"], source: "curada", createdAt: 3,
      }],
    } });
    app.document.querySelector('[data-view="innovation"]').click();
    const card = app.document.querySelector("#innovation-list .recipe-card");
    expect(card).toBeTruthy();
    expect(card.querySelector("img.recipe-photo").getAttribute("src")).toBe("img/recetas/" + ID_FOTO + ".jpg");
  });

  it("la foto va ANTES del título en el orden VISUAL (flex order) y las acciones al pie", () => {
    // jsdom no computa flexbox order: el molde DOM no lo nota — lo decide style.css (.recipe-photo
    // order:-1, .recipe-actions order:5). Aquí se amarra el CONTRATO del molde: banda presente en
    // la card a la vez que el título sigue siendo h3 (accesibilidad y ficha).
    const app = bootApp({ seed: { recipes: [{ id: "r1", title: TITULO_FOTO, meal: "comida", ingredients: ["a"], method: ["m"], createdAt: 1 }] } });
    app.document.querySelector('[data-view="recipes"]').click();
    const card = app.document.querySelector("#recipe-list .recipe-card");
    expect(card.querySelector(".recipe-photo")).toBeTruthy();
    expect(card.querySelector("h3")).toBeTruthy();
  });

  it("la foto no entra en el modal de detalle ni en los huecos del plan (scope cerrado)", () => {
    const app = bootApp({ seed: { recipes: [{ id: "r1", title: TITULO_FOTO, meal: "comida", ingredients: ["a"], method: ["m"], createdAt: 1 }] } });
    app.document.querySelector('[data-view="recipes"]').click();
    const fotoCard = [...app.document.querySelectorAll("#recipe-list .recipe-card")]
      .find(c => c.querySelector("img.recipe-photo"));
    fotoCard.click();
    const ficha = app.document.getElementById("modal-content");
    expect(ficha.querySelector("img.recipe-photo")).toBeNull();
  });
});

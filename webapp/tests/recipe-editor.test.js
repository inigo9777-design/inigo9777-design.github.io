// tests/recipe-editor.test.js — CAPA UNIDAD (Capa 1, CODING_STANDARDS.md §6) del módulo puro
// modules/recipe-editor.js ("✏️ Editar" del modal de detalle, feature 2026-10-18).
// Sin DOM ni localStorage: el módulo es 100% Node-testable (patrón A de §3).

const recipeEditor = require("../modules/recipe-editor");
const { buildDraft, validateDraft, estaGuardada, applyEdit, patchPlan } = recipeEditor;

const RECETA_SEED = {
  id: "r-1",
  title: "Tortilla de patatas",
  meal: "comida",
  ingredients: ["Patata", "Huevo"],
  method: ["Pela", "Cuaja"],
  source: "curada",
  uses: ["Patata"],
  createdAt: 1700000000000,
};

describe("recipeEditor.buildDraft — normaliza el formulario", () => {
  it("recorta bordes, parte por líneas y descarta líneas vacías", () => {
    const draft = buildDraft("  Tortilla  ", "comida", " Patata\n \n\n  Huevo \n", "\n\nPela\n   \nCuaja\n");
    expect(draft.title).toBe("Tortilla");
    expect(draft.meal).toBe("comida");
    expect(draft.ingredients).toEqual(["Patata", "Huevo"]);
    expect(draft.method).toEqual(["Pela", "Cuaja"]);
  });

  it("con textos vacíos produce borrador con listas vacías y título vacío (nunca undefined)", () => {
    const draft = buildDraft("", "", undefined, null);
    expect(draft.title).toBe("");
    expect(draft.ingredients).toEqual([]);
    expect(draft.method).toEqual([]);
  });
});

describe("recipeEditor.validateDraft — gate de guardado", () => {
  it("aprueba un borrador completo (ok=true, falta=null)", () => {
    expect(validateDraft(buildDraft("T", "cena", "A", "B"))).toEqual({ ok: true, falta: null });
  });

  it("rechaza por orden: title → ingredients → method (un fallo por vez)", () => {
    expect(validateDraft(buildDraft("", "cena", "A", "B")).falta).toBe("title");
    expect(validateDraft(buildDraft("T", "cena", "  \n ", "B")).falta).toBe("ingredients");
    expect(validateDraft({ title: "T", meal: "comida", ingredients: ["A"], method: [] }).falta).toBe("method");
  });

  it("defensivo: draft nulo se rechaza sin lanzar", () => {
    expect(validateDraft(null).ok).toBe(false);
  });
});

describe("recipeEditor.estaGuardada — match por id", () => {
  it("true sólo si la receta existe en Mis Recetas por id; false sin id/array", () => {
    expect(estaGuardada([RECETA_SEED], RECETA_SEED)).toBe(true);
    expect(estaGuardada([{ id: "otro" }], RECETA_SEED)).toBe(false);
    expect(estaGuardada([], RECETA_SEED)).toBe(false);
    expect(estaGuardada(null, RECETA_SEED)).toBe(false);
    expect(estaGuardada([RECETA_SEED], { title: "sin id" })).toBe(false);
  });
});

describe("recipeEditor.applyEdit — edición in-situ de Mis Recetas", () => {
  it("actualiza el MISMO id, preserva el resto de campos y NO muta el array recibido", () => {
    const recipes = [RECETA_SEED];
    const draft = buildDraft("Tortilla de patatas y cebolla", "cena", "Patata\nHuevo\nCebolla", "Pela\nFríe la cebolla\nCuaja");
    const res = applyEdit(recipes, RECETA_SEED, draft, { uid: () => "nuevo" });

    expect(res.modo).toBe("in-situ");
    expect(res.guardada.id).toBe("r-1");
    expect(res.guardada.title).toBe("Tortilla de patatas y cebolla");
    expect(res.guardada.meal).toBe("cena");
    expect(res.guardada.ingredients).toEqual(["Patata", "Huevo", "Cebolla"]);
    expect(res.guardada.method).toEqual(["Pela", "Fríe la cebolla", "Cuaja"]);
    expect(res.guardada.source).toBe("curada");       // preservado
    expect(res.guardada.uses).toEqual(["Patata"]);    // preservado
    expect(res.guardada.createdAt).toBe(1700000000000); // preservado
    // el array ORIGINAL no se muta (imputable); se devuelve uno nuevo
    expect(recipes[0].title).toBe("Tortilla de patatas");
    expect(recipes).toHaveLength(1);
    expect(res.recipes).toHaveLength(1);
    expect(res.recipes[0].title).toBe("Tortilla de patatas y cebolla");
  });
});

describe("recipeEditor.applyEdit — copia desde catálogo/plane (no guardada)", () => {
  const platoCatalogo = {
    id: "es-tortilla",
    title: "Tortilla de la abuela",
    meal: "comida",
    ingredients: ["Patata", "Huevo"],
    method: ["Pela", "Cuaja"],
    source: "receta_sugerida",
    from: "Receta española",
  };

  it("crea una copia con id NUEVO y campos heredados; el array original queda intacto", () => {
    let idFalso = 0;
    const recipes = [];
    const draft = buildDraft("Mi versión", "comida", " Patata\nCebolla ", "Pela");
    const res = applyEdit(recipes, platoCatalogo, draft, { uid: () => `uid-${++idFalso}`, now: () => 555 });

    expect(res.modo).toBe("copia");
    expect(res.guardada.id).toBe("uid-1");             // viene del uid inyectado, NO del catálogo
    expect(res.guardada.title).toBe("Mi versión");
    expect(res.guardada.meal).toBe("comida");
    expect(res.guardada.ingredients).toEqual(["Patata", "Cebolla"]);
    expect(res.guardada.method).toEqual(["Pela"]);
    expect(res.guardada.createdAt).toBe(555);          // now inyectado (determinismo §6)
    expect(res.guardada.source).toBe("receta_sugerida");
    expect(res.guardada.from).toBe("Receta española");
    expect(res.recipes).toHaveLength(1);
    expect(platoCatalogo.title).toBe("Tortilla de la abuela"); // el original no se toca
  });
});

describe("recipeEditor.patchPlan — refresco de las copias del plan semanal", () => {
  const planBase = [
    { dayLabel: "Lunes", meals: [
      { meal: "desayuno", recipe: { id: "es-1", title: "Viejo A" } },
      { meal: "comida", recipe: { id: "r-1", title: "Viejo B" } },
      { meal: "cena", recipe: null, missing: ["X"] },
    ] },
    { dayLabel: "Martes", meals: [] },
  ];

  it("parchea por recetaEditada.id las copias incrustadas y devuelve true", () => {
    const plan = JSON.parse(JSON.stringify(planBase));   // copy: patchPlan muta el snapshot en memoria
    const guardada = { id: "r-1", title: "Nuevo B", meal: "cena", ingredients: ["P"], method: ["M"] };
    expect(patchPlan(plan, guardada)).toBe(true);
    expect(plan[0].meals[1].recipe.title).toBe("Nuevo B");
    expect(plan[0].meals[1].recipe.meal).toBe("cena");
    expect(plan[0].meals[1].recipe.ingredients).toEqual(["P"]);
    expect(plan[0].meals[1].recipe.method).toEqual(["M"]);
    expect(plan[0].meals[0].recipe.title).toBe("Viejo A"); // otros platos intactos
  });

  it("para una COPIA nueva parchea por el id ORIGINAL del plato del menú", () => {
    const plan = JSON.parse(JSON.stringify(planBase));
    const copia = { id: "uid-9", title: "Nueva copia", meal: "comida", ingredients: [], method: [] };
    expect(patchPlan(plan, copia, "es-1")).toBe(true);
    expect(plan[0].meals[0].recipe.title).toBe("Nueva copia");
  });

  it("sin plan, o si el id no está en la semana → false y nada cambia", () => {
    expect(patchPlan(null, { id: "r-1" })).toBe(false);
    const plan = JSON.parse(JSON.stringify(planBase));
    expect(patchPlan(plan, { id: "desconocido", title: "X", meal: "comida", ingredients: [], method: [] })).toBe(false);
    expect(plan[0].meals[1].recipe.title).toBe("Viejo B");
  });
});

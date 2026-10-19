// tests/merge-identidad.test.js — Capa 1 (unitaria, §6 CODING_STANDARDS.md).
// Cobre la FASE 1 del plan-sync-buzon.md: identidad estable de recetas (uid entrante PRESERVADO +
// dedup por fingerprint de ingredientes para legacy) y payload de backup v2 (cooked + weekmenu + editedAt).
// El módulo backup.js es puro → require() directo, sin jsdom (mismo patrón que backup.test.js).

const backup = require("../modules/backup");
const recipeEditor = require("../modules/recipe-editor");

// ids secuenciales deterministas para los "uid fresco" (§6 Determinismo: sin reloj ni azar).
function uidsSecuencia(values) { let i = 0; return () => values[i++]; }

describe("merge — identidad estable de RECETAS (uid preservado + dedup por fingerprint)", () => {
  const recetaBase = { id: "receta-uno", title: "Tortilla", meal: "comida", ingredients: ["Huevos", "Patata"], method: ["Batir", "Sofreír"] };

  it("PRESERVA el uid entrante: la receta llega con SU id, no con una uid recalada", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [] },
      { recipes: [recetaBase] }, { uid: uidsSecuencia(["nunca-usada"]) });
    expect(out.recipes[0].id).toBe("receta-uno");
    expect(out.addedRecipes).toBe(1);
  });

  it("recetas SIN id reciben uid fresco (el comportamiento huérfano no desaparece)", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [] },
      { recipes: [{ title: "Sin id", ingredients: ["Sal"] }] }, { uid: uidsSecuencia(["fresco-1"]) });
    expect(out.recipes[0].id).toBe("fresco-1");
  });

  it("re-importar la MISMA receta (mismo id) NO la duplica — idempotente por identidad", () => {
    const tras = backup.mergeIncoming({ foods: [], recipes: [], innovations: [] }, { recipes: [recetaBase] }, {});
    expect(tras.addedRecipes).toBe(1);
    const re = backup.mergeIncoming({ foods: [], recipes: tras.recipes, innovations: [] }, { recipes: [recetaBase] }, {});
    expect(re.addedRecipes).toBe(0);
    expect(re.recipes.length).toBe(1);
  });

  it("red de seguridad LEGACY: misma receta con ids DISTINTOS pero ingredients iguales (acentos/orden distintos) NO se duplica", () => {
    const local = [{ id: "local-1", title: "Tortilla", ingredients: ["Tomates triturados", "Ajos"] }];
    const entrante = [{ id: "fresco-del-otro-movil", title: "Tortilla", ingredients: ["ajos", "tomates triturados"] }];
    const out = backup.mergeIncoming({ foods: [], recipes: local, innovations: [] }, { recipes: entrante }, {});
    expect(out.addedRecipes).toBe(0);      // Jaccard=1.0 sobre el conjunto-ingredientes normalizado
    expect(out.recipes.length).toBe(1);
    expect(out.recipes[0].id).toBe("local-1");   // la LOCAL queda: el entrante gemelo se descarta entero
  });

  it("dos recetas de hecho DIFERENTES (ingredientes distintos) sí entran las dos", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [{ id: "a", title: "A", ingredients: ["Arroz"] }], innovations: [] },
      { recipes: [{ id: "b", title: "B", ingredients: ["Pimentón"] }] }, {});
    expect(out.addedRecipes).toBe(1);
    expect(out.recipes.length).toBe(2);
  });

  it("recetas sin ingredientes (los datos mínimos del §5 no exigen lista no vacía) NO colisionan por fingerprint vacío", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [{ id: "a", title: "A", ingredients: [] }], innovations: [] },
      { recipes: [{ id: "b", title: "B", ingredients: [] }] }, {});
    expect(out.addedRecipes).toBe(1);        // clave de fingerprint vacía → nunca dedup (guard `if (clave && …)`)
  });

  it("preserva los campos OPTIONAL de la receta guardada: origen / editedAt / source / uses", () => {
    const entrante = { id: "orig-italiana", title: "Carbonara", source: "curada", uses: ["Pasta"],
                       origen: "italiana", editedAt: "2026-10-19T10:00:00.000Z", ingredients: ["Pasta"], method: ["Cocer"] };
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [] }, { recipes: [entrante] }, {});
    expect(out.recipes[0].origen).toBe("italiana");
    expect(out.recipes[0].editedAt).toBe("2026-10-19T10:00:00.000Z");
    expect(out.recipes[0].source).toBe("curada");
    expect(out.recipes[0].uses).toEqual(["Pasta"]);
  });
});

describe("merge — ALIMENTOS: dedup por nombre + preservar el resto de campos", () => {
  it("el alimento NUEVO entra con SUS propiedades (id/qty/min/checked/createdAt) no con defaults ajenos", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [] },
      { foods: [{ id: "food-7", name: "Tomate", score: 9, qty: 4, min: 2, checked: true, createdAt: 1234 }] },
      { uid: uidsSecuencia(["fake"]) });
    const f = out.foods[0];
    expect(f.id).toBe("food-7");           // id entrante preservado (igual que las recetas)
    expect(f.qty).toBe(4);
    expect(f.min).toBe(2);
    expect(f.checked).toBe(true);
    expect(f.createdAt).toBe(1234);
    expect(f.score).toBe(9);
  });

  it("dedup por nombre en minúsculas (como hoy): la existente NUNCA se reescribe, aunque el entrante traiga sus valores", () => {
    const current = { foods: [{ id: "E", name: "Tomate", score: 8, qty: 3, min: 2 }], recipes: [], innovations: [] };
    const out = backup.mergeIncoming(current, { foods: [{ id: "otro-id", name: "TOMATE", score: 4, qty: 9, min: 1 }] }, {});
    expect(out.addedFoods).toBe(0);
    const f = out.foods[0];
    expect(f.id).toBe("E");        // el dedup IGNORA la entrante gemela: la local queda entera
    expect(f.qty).toBe(3);
  });
});

describe("backup v2 — buildBackup + fusion de cooked/weekmenu", () => {
  it("buildBackup añade cooked y weekmenu al payload con version 2", () => {
    const cooked = [{ id: "c1", title: "T", keyFingerprint: "fp", on: "2026-10-19" }];
    const weekmenu = { approved: true, plan: [] };
    const out = backup.buildBackup({ foods: [], recipes: [], innovations: [], innovDay: "2026-10-19", cooked, weekmenu }, { now: "ISO" });
    expect(out.version).toBe(2);
    expect(out.cooked).toBe(cooked);         // por referencia, como el resto del payload
    expect(out.weekmenu).toBe(weekmenu);
  });

  it("buildBackup pone cooked [] y weekmenu null si el estado no los trae (payload v2 sin error)", () => {
    const out = backup.buildBackup({ foods: [], recipes: [], innovations: [], innovDay: "" }, { now: "ISO" });
    expect(out.cooked).toEqual([]);
    expect(out.weekmenu).toBeNull();
  });

  it("merge fusiona cooked: anexa el plato cocinado del otro dispositivo SIN duplicar (mismo fingerprint + mismo día)", () => {
    const local = [{ id: "c1", title: "T", keyFingerprint: "fp-x", on: "2026-10-19" }];
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [], cooked: local },
      { cooked: [{ id: "otro-id", title: "T", keyFingerprint: "fp-x", on: "2026-10-19" },       // duplicado exacto: fuera
                 { id: "c2", title: "Lentejas", keyFingerprint: "fp-y", on: "2026-10-21" }] },  // otro día: ENTRA
      { uid: uidsSecuencia(["k"]) });
    expect(out.addedCooked).toBe(1);
    expect(out.cooked.length).toBe(2);
    expect(out.cooked.some(c => c.keyFingerprint === "fp-y")).toBe(true);
  });

  it("merge fusiona cooked: el MISMO plato cocinado en DÍAS distintos genera dos anclas (el cooldown es por día)", () => {
    const out = backup.mergeIncoming({ foods: [], recipes: [], innovations: [], cooked: [
        { id: "c1", title: "T", keyFingerprint: "fp", on: "2026-10-19" }] },
      { cooked: [{ id: "c9", title: "T", keyFingerprint: "fp", on: "2026-10-25" }] }, {});
    expect(out.addedCooked).toBe(1);
    expect(out.cooked.length).toBe(2);
  });

  it("weekmenu: se adopta el entrante SOLO si el local no tiene ninguno; si hay plan local NADA desaparece", () => {
    const entrante = { approved: true, plan: [], generatedOn: "2026-10-19" };
    const local = { approved: true, plan: [], generatedOn: "2026-10-18" };

    const sinLocal = backup.mergeIncoming({ foods: [], recipes: [], innovations: [], weekmenu: null }, { weekmenu: entrante }, {});
    expect(sinLocal.weekmenu).toBe(entrante);

    const conLocal = backup.mergeIncoming({ foods: [], recipes: [], innovations: [], weekmenu: local }, { weekmenu: entrante }, {});
    expect(conLocal.weekmenu).toBe(local);
  });

  it("payload v1 (sin cooked/weekmenu) sigue funcionando: no lanza, no anexa, merge sin esas claves", () => {
    const current = { foods: [{ id: "f", name: "Tomate", score: 5 }], recipes: [], innovations: [], cooked: [], weekmenu: null };
    const out = backup.mergeIncoming(current, { version: 1, foods: [], recipes: [{ id: "r", title: "R", ingredients: ["Sal"] }] }, {});
    expect(out).not.toBeNull();
    expect(out.recipes.length).toBe(1);
    expect(out.cooked).toEqual([]);
    expect(out.addedCooked).toBe(0);
  });
});

describe("editedAt — las rutas de guardado/edición sellan su marca ISO (sync-buzon §1)", () => {
  const now = () => 1700000000000;
  const isoEsperado = new Date(1700000000000).toISOString();

  it("applyEdit in-situ añade editedAt (derivado del now inyectado, determinista)", () => {
    const recipes = [{ id: "r", title: "Viejo", ingredients: ["Sal"], method: ["Paso"] }];
    const resultado = recipeEditor.applyEdit(recipes, recipes[0],
      { title: "Nuevo", meal: "comida", ingredients: ["Sal", "Agua"], method: ["Paso", "Luego"] },
      { uid: () => "x", now });
    expect(resultado.modo).toBe("in-situ");
    expect(resultado.guardada.editedAt).toBe(isoEsperado);
    expect(resultado.guardada.id).toBe("r");           // in-situ conserva id — la identidad sigue siendo LA misma receta
  });

  it("applyEdit en modo copia también sella editedAt", () => {
    const catalogo = { id: "del-catalogo", title: "Plato", source: "curada", ingredients: ["Pasta"], method: ["Cocer"] };
    const resultado = recipeEditor.applyEdit([], catalogo,
      { title: "Mi carbonara", meal: "cena", ingredients: ["Pasta"], method: ["Cocer"] },
      { uid: uidsSecuencia(["copia-1"]), now });
    expect(resultado.modo).toBe("copia");
    expect(resultado.guardada.editedAt).toBe(isoEsperado);
    expect(resultado.guardada.id).toBe("copia-1");
  });
});

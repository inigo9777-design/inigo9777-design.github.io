// tests/menu-semanal.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para modules/menu-semanal.js.
// Lógica PURe de "Menú semanal + lista de la compra": probada SIN DOM ni jsdom, determinista, en Node/Jest directo.
// Nunca toca localStorage ni la vista. Los inyectables cookEntryFor/uid/now hacen que los tests sean 100 % reproducibles.
// Cambio de contrato (feature 2026-10-18): plan = 7 días × 3 comidas (`meals[]`), `swapSlotRecipe` sustituye a
// `regenerateAfterCook` (cocinar desde el menú = cookEntry + swap de SOLO ese hueco) y `shoppingListFor` añade
// urgencia de compra (semáforo rojo/naranja/verde según la fecha de preparación).

const { shoppingListFor, approveMenu, markItemBought, cookEntry, swapSlotRecipe, clearMenu } = require("../modules/menu-semanal.js");

// cookEntryFor determinista para tests (imita planner.cookEntryFor pero inyectable).
function cookEntryFor(recipe, opts) {
  const mkId = (opts && typeof opts.uid === "function") ? opts.uid : (() => "det-id");
  return {
    id: mkId(),
    title: String((recipe == null || recipe.title === undefined || recipe.title === null) ? "" : recipe.title),
    keyFingerprint: (recipe && recipe.ingredients ? recipe.ingredients.slice().sort().join("¦") : ""),
    on: (opts && opts.today != null) ? String(opts.today) : "2030-01-15"
  };
}

const TODAY = "2030-01-15";

// Slot de comida de receta rápida: { meal, recipe:{title, ingredients}, missing:[...] }.
function mealComida(meal, title, ingredients, missing) {
  return { meal, recipe: ingredients == null ? null : { title, ingredients }, missing: missing || [] };
}

// Preview de 3 días × 3 comidas para los tests ( TODAY="2030-01-15" es MARTES ).
function preview3Dias() {
  return {
    plan: [
      { dayLabel: "Lunes", meals: [ mealComida("desayuno", "Tostada", ["Pan"]), mealComida("comida", "Tortilla", ["Huevos", "Patatas"]), mealComida("cena", "Crema", ["Calabaza"]) ] },
      { dayLabel: "Martes", meals: [ mealComida("desayuno", "Batido", ["Leche"]), mealComida("comida", null), mealComida("cena", "Sardinas", ["Sardinas"]) ] },
      { dayLabel: "Miércoles", meals: [ mealComida("desayuno", null), mealComida("comida", "Merluza", ["Merluza"]), mealComida("cena", null) ] }
    ],
    needyFoods: [{ name: "Aceite" }]
  };
}

describe("modules/menu-semanal.js", () => {

  describe("shoppingListFor — dedup por MATCHER de tokens + urgencia de compra (semáforo dinámico)", () => {
    it("needyFoods vacío → [] sin lanzar", () => {
      expect(shoppingListFor([], [{ name: "Huevos", qty: 5 }])).toEqual([]);
      expect(shoppingListFor(undefined, [])).toEqual([]);
    });

    it("needyFoods con ingredientes no en aforo → filas {qty:0, min:0, score:5, urgency:'green'} sin ctx", () => {
      const foods = [{ name: "Huevos", qty: 5, min: 1, score: 5 }];
      const needy = [{ name: "Merluza" }, { name: "Patatas" }];
      const out = shoppingListFor(needy, foods);
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({ name: "Merluza", qty: 0, min: 0, score: 5, urgency: "green" });
      expect(out[1]).toEqual({ name: "Patatas", qty: 0, min: 0, score: 5, urgency: "green" });
    });

    it("con ctx { plan, generatedOn, today } cada fila lleva onDay/daysUntil/urgency (FIX del semáforo plano)", () => {
      // TODAY es MARTES: "Lunes" ancla el 21 (9 días), "Miércoles" el 16 (1 día → ROJO).
      const plan = [
        { dayLabel: "Lunes", meals: [mealComida("comida", "Tortilla", ["Huevos"], ["Cebollas"])] },
        { dayLabel: "Miércoles", meals: [mealComida("cena", "Crema", ["Calabaza"], ["Queso"])] }
      ];
      const out = shoppingListFor([{ name: "Cebollas" }, { name: "Queso" }], [], {
        plan, generatedOn: TODAY, today: TODAY
      });
      expect(out).toHaveLength(2);
      // Queda anclado al MIÉRCOLES próximo (2030-01-16, mañana) → ROJO y PRIMERO en el orden.
      expect(out[0].name).toBe("Queso");
      expect(out[0].onDay).toBe("2030-01-16");
      expect(out[0].daysUntil).toBe(1);
      expect(out[0].urgency).toBe("red");
      // Cebollas ancla al LUNES siguiente (2030-01-21, a 6 días) → VERDE.
      expect(out[1].name).toBe("Cebollas");
      expect(out[1].onDay).toBe("2030-01-21");
      expect(out[1].daysUntil).toBe(6);
      expect(out[1].urgency).toBe("green");
    });

    it("urgencias según regla del usuario: mañana/hoy=red, 2-3 días=orange, ≥4=green", () => {
      const hoy = "2030-01-15";   // martes
      const plan = [
        { dayLabel: "Martes", meals: [mealComida("comida", "R1", ["A"], ["Tomates"])] },   // ancla HOY (0 d) → red
        { dayLabel: "Jueves", meals: [mealComida("comida", "R2", ["A"], ["Zumo"])] },      // ancla 17 (2 d) → orange
        { dayLabel: "Sábado", meals: [mealComida("comida", "R3", ["A"], ["Arroz"])] }      // ancla 19 (4 d) → green
      ];
      const out = shoppingListFor([{ name: "Tomates" }, { name: "Zumo" }, { name: "Arroz" }], [], { plan, generatedOn: hoy, today: hoy });
      const porNombre = Object.fromEntries(out.map(f => [f.name, f.urgency]));
      expect(porNombre.Tomates).toBe("red");
      expect(porNombre.Zumo).toBe("orange");
      expect(porNombre.Arroz).toBe("green");
      // el orden de salida es semáforo: rojos → naranjas → verdes
      expect(out.map(f => f.name)).toEqual(["Tomates", "Zumo", "Arroz"]);
    });

    it("ítem pedido en VARIOS días se ancla a la fecha MÁS PRÓXIMA (la compra debe cubrir la primera)", () => {
      const plan = [
        { dayLabel: "Martes", meals: [mealComida("comida", "R1", ["A"], ["Limones"])] },     // HOY
        { dayLabel: "Miércoles", meals: [mealComida("comida", "R2", ["A"], ["Limones"])] },  // mañana
        { dayLabel: "Domingo", meals: [mealComida("cena", "R3", ["A"], ["Limones"])] }       // dentro de 5
      ];
      const out = shoppingListFor([{ name: "Limones" }], [], { plan, generatedOn: TODAY, today: TODAY });
      expect(out).toHaveLength(1);
      expect(out[0].daysUntil).toBe(0);      // la MÁS próxima de las tres
      expect(out[0].urgency).toBe("red");
    });

    it("ingrediente ya en aforo CON STOCK (dedup por tokens) → no se duplica; qty=0 SÍ queda en la compra", () => {
      const foods = [{ name: "Huevos", qty: 5 }, { name: "merluza", qty: 2 }, { name: "Pan de barra", qty: 0 }];
      const needy = [{ name: "Huevos" }, { name: "Merluza" }, { name: "MERLUZA" }, { name: "Pan" }];
      const out = shoppingListFor(needy, foods);
      expect(out.map(f => f.name)).toEqual(["Pan"]);   // el pan está (qty 0 = sin stock) → SÍ hay que comprar
    });

    it("dedup intra-lote por tokens: plurales/caso distintos de un mismo ítem → una sola fila", () => {
      const needy = [{ name: "Merluza" }, { name: "merluza" }, { name: "MERLUZA" }, { name: "Plátano" }, { name: "Plátanos" }];
      const out = shoppingListFor(needy, []);
      expect(out.map(f => f.name)).toEqual(["Merluza", "Plátano"]);   // conserva la primera ocurrencia
    });

    it("entradas corruptas en needyFoods se ignoran sin lanzar", () => {
      const needy = [null, "no-objeto", { name: "Merluza" }, { name: "" }];
      const out = shoppingListFor(needy, []);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe("Merluza");
    });
  });

  describe("approveMenu — aprueba preview 7×3; cada plato se ancla a la FECHA de SU día planificado", () => {
    const preview = {
      plan: [
        { dayLabel: "Lunes", meals: [ mealComida("desayuno", "Tostada", ["Pan"]), mealComida("comida", "Tortilla", ["Huevos", "Patatas"]), mealComida("cena", "Crema", ["Calabaza"]) ] },
        { dayLabel: "Martes", meals: [ mealComida("desayuno", "Batido", ["Leche"]), mealComida("comida", null), mealComida("cena", "Sardinas", ["Sardinas"]) ] },
        { dayLabel: "Miércoles", meals: [ mealComida("desayuno", null), mealComida("comida", "Merluza", ["Merluza"]), mealComida("cena", null) ] }
      ],
      needyFoods: [{ name: "Aceite" }]
    };
    // Anclas = próxima ocurrencia de cada weekday desde HOY (día 0):
    //   Lunes → 2030-01-21 (lunes siguiente), Miércoles → 2030-01-16 (mañana), Martes(=hoy) → HOY (2030-01-15).
    it("genera UNA entrada por RECETA del plan (no por slot vacío), sin mutar nada", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const result = approveMenu(preview, cookedIn, TODAY, cookEntryFor, () => "uid-1");

      // recetas: Lunes 3 + Martes 2 (comida null) + Miércoles 1 (desazuno/cena null) + 1 previa
      expect(result.cooked).toHaveLength(7);
      // inmutabilidad: preview y cookedIn no se mutan
      expect(preview.approved).toBeUndefined();
      expect(cookedIn).toHaveLength(1);
    });

    it("las 3 recetas del MISMO día comparten la fecha ancla de ese día (hoy=martes: Lunes→lunes siguiente)", () => {
      const result = approveMenu(preview, [], TODAY, cookEntryFor, () => "uid-1");
      const delLunes = result.cooked.filter(c => ["Tostada", "Tortilla", "Crema"].includes(c.title));
      expect(delLunes).toHaveLength(3);
      for (const c of delLunes) expect(c.on).toBe("2030-01-21");          // ancla = lunes SIGUIENTE (hoy es martes)
      const delMartes = result.cooked.filter(c => ["Batido", "Sardinas"].includes(c.title));
      for (const c of delMartes) expect(c.on).toBe(TODAY);                // hoy es martes → ancla HOY
      const laMerluza = result.cooked.find(c => c.title === "Merluza");
      expect(laMerluza.on).toBe("2030-01-16");                            // mañana (miércoles)
    });

    it("aprobado un sábado → Lunes va a la SEMANA SIGUIENTE y Domingo a mañana (wrap-around)", () => {
      const SABADO = "2030-01-19";
      const previewSab = {
        plan: [
          { dayLabel: "Lunes", meals: [mealComida("comida", "Lentejas", ["Lentejas"]), mealComida("desayuno", null, null), mealComida("cena", null, null)] },
          { dayLabel: "Domingo", meals: [mealComida("cena", "Merluza", ["Merluza"]), mealComida("desayuno", null, null), mealComida("comida", null, null)] }
        ],
        needyFoods: []
      };
      const result = approveMenu(previewSab, [], SABADO, cookEntryFor, () => "uid-1");
      expect(result.cooked[0].on).toBe("2030-01-21"); // lunes siguiente
      expect(result.cooked[1].on).toBe("2030-01-20"); // domingo = mañana del sábado
    });

    it("label con acentos/caso raro se reconoce ('MIéRcOlEs' == miércoles) y label desconocido hace fallback al índice del slot", () => {
      const previewRaro = {
        plan: [
          { dayLabel: "MIéRcOlEs", meals: [mealComida("comida", "R1", ["Tomates"]), mealComida("desayuno", null, null), mealComida("cena", null, null)] }, //.getDay 3 → diff 1 desde martes
          { dayLabel: "???day", meals: [mealComida("comida", "R2", ["Tomates"]), mealComida("desayuno", null, null), mealComida("cena", null, null)] }     // fallback: índice 1 = Martes → HOY
        ],
        needyFoods: []
      };
      const result = approveMenu(previewRaro, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked[0].on).toBe("2030-01-16");
      expect(result.cooked[1].on).toBe(TODAY);
    });

    it("weekmenu.approved=true y generatedOn=hoy (inmutable, sin mutar preview)", () => {
      const result = approveMenu(preview, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.weekmenu.approved).toBe(true);
      expect(result.weekmenu.generatedOn).toBe(TODAY);
      expect(result.weekmenu.plan).toHaveLength(3);
    });

    it("slots con recipe=null no generan entrada de cooked", () => {
      const previewNull = { plan: [{ dayLabel: "Lunes", meals: [mealComida("desayuno", null, null), mealComida("comida", null, null), mealComida("cena", null, null)] }], needyFoods: [] };
      const result = approveMenu(previewNull, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toHaveLength(0);
    });

    it("cookEntryFor inyectado se usa para cada entrada (uid determinista)", () => {
      const result = approveMenu(preview, [], TODAY, cookEntryFor, () => "uid-det");
      const idsCooked = result.cooked.map(c => c.id);
      for (const id of idsCooked) expect(id).toBe("uid-det");
      // anclajes por GRUPO de día (no todas HOY): Lunes→21, Martes(hoy)→15, Miércoles→16
      const unicas = [...new Set(result.cooked.map(c => c.on))].sort();
      expect(unicas).toEqual(["2030-01-15", "2030-01-16", "2030-01-21"]);
    });

    it("preview sin plan → cooked vacío y weekmenu aprobado igual", () => {
      const result = approveMenu({}, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toEqual([]);
      expect(result.weekmenu.approved).toBe(true);
    });
  });

  describe("markItemBought — auto-add alimento + quitar de needyFoods, inmutable", () => {
    const foods = [{ name: "Huevos", qty: 5, min: 1, score: 5 }];
    const weekmenu = { approved: true, plan: [], needyFoods: [{ name: "Merluza" }, { name: "Patatas" }] };

    it("alimento nuevo → se añade con qty=0/min=0/score=5 y se quita de needyFoods", () => {
      const result = markItemBought(foods, weekmenu, "Merluza", () => "uid-buy", 1234567890);

      expect(result.alreadyExists).toBe(false);
      expect(result.foods).toHaveLength(2);
      const nuevo = result.foods[1];
      expect(nuevo.name).toBe("Merluza");
      expect(nuevo.qty).toBe(0);
      expect(nuevo.min).toBe(0);
      expect(nuevo.score).toBe(5);
      expect(nuevo.id).toBe("uid-buy");
      expect(nuevo.createdAt).toBe(1234567890);

      expect(result.weekmenu.needyFoods).toHaveLength(1);
      expect(result.weekmenu.needyFoods[0].name).toBe("Patatas");

      // inmutabilidad: originales no mutan
      expect(foods).toHaveLength(1);
      expect(weekmenu.needyFoods).toHaveLength(2);
    });

    it("alimento ya en aforo (por tokens, no por case exacto) → alreadyExists=true, sin añadir", () => {
      const original = [{ name: "Huevos", qty: 5, min: 1, score: 5 }];
      const result = markItemBought(original, weekmenu, "huevos", () => "uid-buy", 0);
      expect(result.alreadyExists).toBe(true);
      expect(original).toHaveLength(1);
      const r2 = markItemBought(original, weekmenu, "Huevos frescos", () => "u", 0);
      expect(r2.alreadyExists).toBe(true);
      expect(original).toHaveLength(1);
    });

    it("uid/now inyectables para determinismo (§6)", () => {
      const result = markItemBought([], { approved: true, plan: [], needyFoods: [{ name: "Pan" }] }, "Pan", () => "uid-fijo", 999);
      expect(result.foods[0].id).toBe("uid-fijo");
      expect(result.foods[0].createdAt).toBe(999);
    });

    it("weekmenu undefined → no lanza, solo devuelve foods", () => {
      const result = markItemBought([{ name: "A" }], undefined, "B", () => "u", 0);
      expect(result.alreadyExists).toBe(false);
      expect(result.foods).toHaveLength(2);
      expect(result.weekmenu).toBeUndefined();
    });
  });

  describe("cookEntry — anota una receta como cocinada hoy, inmutable", () => {
    const rec = { title: "Tortilla", ingredients: ["Huevos", "Patatas"] };

    it("devuelve { cooked } con la nueva entrada añadida, sin mutar cooked original", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const result = cookEntry(rec, cookedIn, TODAY, cookEntryFor, () => "uid-1");

      expect(result.cooked).toHaveLength(2);
      expect(result.cooked[1].title).toBe("Tortilla");
      expect(result.cooked[1].on).toBe(TODAY);

      expect(cookedIn).toHaveLength(1);
    });

    it("usar cookEntryFor inyectado para uid determinista", () => {
      const result = cookEntry(rec, [], TODAY, cookEntryFor, () => "uid-det");
      expect(result.cooked[0].id).toBe("uid-det");
      expect(result.cooked[0].on).toBe(TODAY);
    });

    it("cooked undefined → crea array con una sola entrada", () => {
      const result = cookEntry(rec, undefined, TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toHaveLength(1);
    });
  });

  describe("clearMenu — reinicia el estado del menú", () => {
    it("devuelve { weekmenu: null } (misma convención de naming que approveMenu/markItemBought)", () => {
      expect(clearMenu()).toEqual({ weekmenu: null });
    });
  });

  describe("swapSlotRecipe — '🔄 Cambiar' de UN día+comida, puro e inmutable (sustituye a regenerateAfterCook)", () => {
    function slotDe(meal, title) {
      return { meal, recipe: title ? { title, ingredients: [title] } : null, missing: [] };
    }
    const weekmenuIn = {
      approved: true, includeUnavailable: true, generatedOn: TODAY,
      plan: [
        { dayLabel: "Lunes", meals: [slotDe("desayuno", "Tostada"), slotDe("comida", "Tortilla"), slotDe("cena", "Crema")] },
        { dayLabel: "Martes", meals: [slotDe("desayuno", "Batido"), slotDe("comida", "Salmorejo"), slotDe("cena", null)] }
      ],
      needyFoods: []
    };

    // planner FALSO inyectado (§2-D): transporta calls + comportamiento exacto de la API nueva.
    function makeFakePlanner(candidato) {
      const calls = { pool: 0, pick: 0 };
      return {
        calls,
        buildCandidatePool(foods, recipes, catalog, opts) {
          calls.pool++;
          return ["pool-con-cooldown"];
        },
        pickRecipeForSlot(pool, foods, opts) {
          calls.pick++;
          expect(pool).toEqual(["pool-con-cooldown"]);
          return candidato;   // { recipe, missing } o null (rank agotado)
        },
        fingerprintOf(recipe) {
          return recipe ? "fp-" + recipe.title : "";
        }
      };
    }

    it("cambia SOLO el slot pedido (Lunes.comida) y deja el resto del plan idéntico", () => {
      const candidato = { recipe: { title: "Merluza al horno", ingredients: ["Merluza"] }, missing: ["Mantequilla"] };
      const fake = makeFakePlanner(candidato);
      const result = swapSlotRecipe({
        weekmenu: weekmenuIn, dayIndex: 0, meal: "comida",
        foods: [], recipes: [], catalog: [], cooked: [], today: TODAY,
        planner: fake, uid: () => "nuevo"
      });

      expect(result.swapped).toBe(true);
      const nuevoSlot = result.weekmenu.plan[0].meals[1];
      expect(nuevoSlot.meal).toBe("comida");
      expect(nuevoSlot.recipe.title).toBe("Merluza al horno");
      expect(nuevoSlot.missing).toEqual(["Mantequilla"]);
      // los OTROS slots quedan intactos (mismas referencias de contenido, plan nuevo clonado)
      expect(result.weekmenu.plan[0].meals[0].recipe.title).toBe("Tostada");
      expect(result.weekmenu.plan[0].meals[2].recipe.title).toBe("Crema");
      expect(result.weekmenu.plan[1].meals[1].recipe.title).toBe("Salmorejo");
      // el original NO se muta
      expect(weekmenuIn.plan[0].meals[1].recipe.title).toBe("Tortilla");
      // orden de uso del planner: pool (con cooldown) → pick de esa comida
      expect(fake.calls).toEqual({ pool: 1, pick: 1 });
    });

    it("excludeKeys = fingerprints de TODO el plan (menos el slot destino) ∪ triedKeys ∪ el actual", () => {
      let excludeVisto = null;
      const fake = {
        buildCandidatePool() { return ["pool"]; },
        pickRecipeForSlot(pool, foods, opts) {
          excludeVisto = opts.excludeKeys.slice();
          return { recipe: { title: "Nuevo", ingredients: ["Nuevo"] }, missing: [] };
        },
        fingerprintOf(recipe) { return recipe ? "fp-" + recipe.title : ""; }
      };
      const conTried = JSON.parse(JSON.stringify(weekmenuIn));
      conTried.plan[0].meals[1].triedKeys = ["fp-IntentadoAntes"];
      swapSlotRecipe({ weekmenu: conTried, dayIndex: 0, meal: "comida", foods: [], recipes: [], catalog: [], cooked: [], today: TODAY, planner: fake, uid: () => "u" });

      expect(excludeVisto).toContain("fp-Tortilla");       // el actual entra explícito: el ranking NO oscila entre clicks
      expect(excludeVisto).toContain("fp-Tostada");        // mismo día
      expect(excludeVisto).toContain("fp-Crema");          // mismo día
      expect(excludeVisto).toContain("fp-Batido");         // otro día
      expect(excludeVisto).toContain("fp-Salmorejo");      // otro día
      expect(excludeVisto).toContain("fp-IntentadoAntes"); // historial del slot (walk determinista)
      expect(excludeVisto).toHaveLength(6);                // Tostada, Crema, Batido, Salmorejo, Tortilla(actual), IntentadoAntes
    });

    it("recomputa needyFoods como unión dedup por tokens de missing de TODOS los slots", () => {
      const candidato = { recipe: { title: "Nuevo", ingredients: ["Gelatina"] }, missing: ["Miel", "miel"] };
      const fake = makeFakePlanner(candidato);
      const conMissing = JSON.parse(JSON.stringify(weekmenuIn));
      conMissing.plan[1].meals[0].missing = ["Leche sin lactosa"];
      conMissing.plan[1].meals[1].recipe = null; // slot sin receta no aporta
      const result = swapSlotRecipe({ weekmenu: conMissing, dayIndex: 0, meal: "comida", foods: [], recipes: [], catalog: [], cooked: [], today: TODAY, planner: fake, uid: () => "u" });

      const nombres = result.weekmenu.needyFoods.map(f => f.name);
      expect(nombres).toContain("Miel");
      expect(nombres.filter(n => n.toLowerCase().includes("miel"))).toHaveLength(1);   // dedup por tokens
      expect(nombres).toContain("Leche sin lactosa");                                  // aportado por un slot NO cambiado
    });

    it("candidato null (rank agotado) → swapped=false y weekmenu INTACTO", () => {
      const fake = makeFakePlanner(null);
      const result = swapSlotRecipe({
        weekmenu: weekmenuIn, dayIndex: 1, meal: "cena",   // slot ya vacío
        foods: [], recipes: [], catalog: [], cooked: [], today: TODAY, planner: fake, uid: () => "u"
      });
      expect(result.swapped).toBe(false);
      expect(result.weekmenu).toBe(weekmenuIn);   // misma referencia: nada cambió
    });

    it("guard §2-A: sin planner → swapped=false sin lanzar", () => {
      const result = swapSlotRecipe({ weekmenu: weekmenuIn, dayIndex: 0, meal: "comida" });
      expect(result.swapped).toBe(false);
      expect(result.weekmenu).toBe(weekmenuIn);
    });

    it("dayIndex/meal fuera de rango → swapped=false sin lanzar (guard §2-A)", () => {
      const fake = makeFakePlanner({ recipe: { title: "X", ingredients: ["x"] }, missing: [] });
      expect(swapSlotRecipe({ weekmenu: weekmenuIn, dayIndex: 9, meal: "comida", planner: fake }).swapped).toBe(false);
      expect(swapSlotRecipe({ weekmenu: weekmenuIn, dayIndex: 0, meal: "brunch", planner: fake }).swapped).toBe(false);
    });
  });
});

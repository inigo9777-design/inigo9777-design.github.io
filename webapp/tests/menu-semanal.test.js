// tests/menu-semanal.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para modules/menu-semanal.js.
// Lógica PURe de "Menú semanal + lista de la compra": probada SIN DOM ni jsdom, determinista, en Node/Jest directo.
// Nunca toca localStorage ni la vista. Los inyectables cookEntryFor/uid/now hacen que los tests sean 100 % reproducibles.

const { shoppingListFor, approveMenu, markItemBought, cookEntry, regenerateAfterCook, clearMenu } = require("../modules/menu-semanal.js");

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

describe("modules/menu-semanal.js", () => {

  describe("shoppingListFor — dedup por nombre-normalizado vs aforo", () => {
    it("needyFoods vacío → [] sin lanzar", () => {
      expect(shoppingListFor([], [{ name: "Huevos", qty: 5 }])).toEqual([]);
      expect(shoppingListFor(undefined, [])).toEqual([]);
    });

    it("needyFoods con ingredientes no en aforo → filas {qty:0, min:0, score:5}", () => {
      const foods = [{ name: "Huevos", qty: 5, min: 1, score: 5 }];
      const needy = [{ name: "Merluza" }, { name: "Patatas" }];
      const out = shoppingListFor(needy, foods);
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({ name: "Merluza", qty: 0, min: 0, score: 5 });
      expect(out[1]).toEqual({ name: "Patatas", qty: 0, min: 0, score: 5 });
    });

    it("ingrediente ya en aforo (dedup contra foods) → no se duplica", () => {
      const foods = [{ name: "Huevos", qty: 5 }, { name: "merluza", qty: 2 }]; // caso/acento distinto al needy
      const needy = [{ name: "Huevos" }, { name: "Merluza" }, { name: "MERLUZA" }];
      const out = shoppingListFor(needy, foods);
      expect(out).toHaveLength(0); // todos ya están en aforo (case-insensitive)
    });

    it("dedup intra-lote: mismo ingrediente dos veces en needy → una sola fila", () => {
      const foods = [];
      const needy = [{ name: "Merluza" }, { name: "merluza" }, { name: "MERLUZA" }];
      const out = shoppingListFor(needy, foods);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe("Merluza"); // conserva el nombre de la primera ocurrencia
    });

    it("entradas corruptas en needyFoods se ignoran sin lanzar", () => {
      const foods = [];
      const needy = [null, "no-objeto", { name: "Merluza" }, { name: "" }];
      const out = shoppingListFor(needy, foods);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe("Merluza");
    });
  });

  describe("approveMenu — aprueba preview; cada plato se ancla a la FECHA de SU día planificado", () => {
    const preview = {
      plan: [
        { dayLabel: "Lunes", recipe: { title: "Tortilla", ingredients: ["Huevos", "Patatas"] } },
        { dayLabel: "Martes", recipe: null },
        { dayLabel: "Miércoles", recipe: { title: "Merluza", ingredients: ["Merluza"] } }
      ],
      needyFoods: [{ name: "Aceite" }]
    };
    // TODAY = "2030-01-15" es MARTES. Anclas = próxima ocurrencia de cada weekday desde HOY (día 0):
    //   Lunes → 2030-01-21 (lunes siguiente), Miércoles → 2030-01-16 (mañana), el propio día → HOY.
    it("devuelve { cooked, weekmenu } sin mutar preview ni cooked y anclando cada plato a SU día", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const result = approveMenu(preview, cookedIn, TODAY, cookEntryFor, () => "uid-1");

      expect(result.cooked).toHaveLength(3); // 1 previa + 2 recetas del plan (Martes es null → salta)
      expect(result.cooked[1].title).toBe("Tortilla");
      expect(result.cooked[1].on).toBe("2030-01-21"); // aprobado martes → "Lunes" ancla al LUNES SIGUIENTE
      expect(result.cooked[2].title).toBe("Merluza");
      expect(result.cooked[2].on).toBe("2030-01-16"); // aprobado martes → "Miércoles" ancla al MIÉRCOLES próximo

      // inmutabilidad: preview y cookedIn no se mutan
      expect(preview.approved).toBeUndefined();
      expect(cookedIn).toHaveLength(1);
    });

    it("el día de HOY en el plan se ancla al PROPIO hoy (día 0, no a la próxima semana)", () => {
      const previewHoy = {
        plan: [
          { dayLabel: "Lunes", recipe: null },
          { dayLabel: "Martes", recipe: { title: "Salmorejo", ingredients: ["Tomates"] } } // lo aprobamos en MARTES
        ],
        needyFoods: []
      };
      const result = approveMenu(previewHoy, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toHaveLength(1);
      expect(result.cooked[0].on).toBe(TODAY); // Sí la aprobaron el día en cuestión → ancla HOY
    });

    it("aprobado un sábado → Lunes va a la SEMANA SIGUIENTE y Domingo a mañana (wrap-around)", () => {
      const SABADO = "2030-01-19";
      const previewSab = {
        plan: [
          { dayLabel: "Lunes", recipe: { title: "Lentejas", ingredients: ["Lentejas"] } },
          { dayLabel: "Domingo", recipe: { title: "Merluza", ingredients: ["Merluza"] } }
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
          { dayLabel: "MIéRcOlEs", recipe: { title: "R1", ingredients: ["Tomates"] } }, //.getDay 3 → diff 1 desde martes
          { dayLabel: "???day", recipe: { title: "R2", ingredients: ["Tomates"] } }     // fallback: índice 1 = Martes → HOY
        ],
        needyFoods: []
      };
      const result = approveMenu(previewRaro, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked[0].on).toBe("2030-01-16");
      expect(result.cooked[1].on).toBe(TODAY);
    });

    it("weekmenu.approved=true y generatedOn=hoy", () => {
      const result = approveMenu(preview, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.weekmenu.approved).toBe(true);
      expect(result.weekmenu.generatedOn).toBe(TODAY);
      expect(result.weekmenu.plan).toHaveLength(3);
    });

    it("slots con recipe=null no generan entrada de cooked", () => {
      const previewNull = { plan: [{ dayLabel: "Lunes", recipe: null }], needyFoods: [] };
      const result = approveMenu(previewNull, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toHaveLength(0);
    });

    it("cookEntryFor inyectado se usa para cada entrada (uid determinista)", () => {
      const result = approveMenu(preview, [], TODAY, cookEntryFor, () => "uid-det");
      const ids = result.cooked.map(c => c.id).sort();
      expect(ids).toEqual(["uid-det", "uid-det"]); // ambas recetas usan el uid inyectado
      // anclajes = fecha de SU día planificado (no todas HOY): Lunes→21, Miércoles→16
      expect(result.cooked.map(c => [c.title, c.on]).sort()).toEqual([
        ["Merluza", "2030-01-16"],
        ["Tortilla", "2030-01-21"]
      ]);
    });

    it("preview sin plan → cooked vacío y weekmenu aprobado igual", () => {
      const result = approveMenu({}, [], TODAY, cookEntryFor, () => "uid-1");
      expect(result.cooked).toEqual([]);
      expect(result.weekmenu.approved).toBe(true);
    });
  });

  describe("markItemBought — auto-add alimento + quitar de needyFoods, inmutable", () => {
    const foods = [{ name: "Huevos", qty: 5, min: 1, score: 5 }];
    const weekmenu = { approved: true, needyFoods: [{ name: "Merluza" }, { name: "Patatas" }] };

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

    it("alimento ya en aforo (case-insensitive) → alreadyExists=true, sin añadir", () => {
      const result = markItemBought(foods, weekmenu, "huevos", () => "uid-buy", 0);
      expect(result.alreadyExists).toBe(true);
      expect(result.foods).toHaveLength(1);
      expect(result.weekmenu.needyFoods).toHaveLength(2); // sin cambios
    });

    it("uid/now inyectables para determinismo (§6)", () => {
      const result = markItemBought([], { approved: true, needyFoods: [{ name: "Pan" }] }, "Pan", () => "uid-fijo", 999);
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

  describe("regenerateAfterCook — flujo '🍳 Cocinar hoy' desde el menú, puro e inmutable", () => {
    const REC = { title: "Tortilla", ingredients: ["Huevos", "Patatas"] };

    // planner FALSO inyectado (§2-D composición): cuento las llamadas y devuelvo shapes sin azar.
    function makeFakePlanner(menuPlan) {
      const calls = { pool: 0, menu: 0, entry: 0 };
      return {
        calls,
        cookEntryFor(recipe, opts) { calls.entry++; return cookEntryFor(recipe, opts); },
        buildCandidatePool(foods2, recipes2, catalog2, opts) {
          calls.pool++;
          if (opts.cooked.length === 1) {
            expect(opts.cooked[0].title).toBe("Tortilla");   // el pool SIEMPRE recibe el cooked YA actualizado
          }
          return ["pool-con-cooked-actualizado"];
        },
        buildWeeklyMenu(pool, foods2, opts) {
          calls.menu++;
          expect(pool).toEqual(["pool-con-cooked-actualizado"]);
          return { plan: menuPlan, needyFoods: [{ name: "Prueba" }] };
        }
      };
    }

    it("anota cocinado hoy + regenera con cooldown + mantiene approved/includeUnavailable del toggle", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const fake = makeFakePlanner([{ dayLabel: "Lunes", recipe: REC, missing: [] }]);
      const result = regenerateAfterCook(REC, {
        cooked: cookedIn, today: TODAY, includeUnavailable: true,
        prevWeekmenu: { approved: true, needyFoods: [] }, planner: fake, uid: () => "uid-det"
      });

      // cooked: entrada nueva con ancla HOY real + NADA se muta
      expect(result.cooked).toHaveLength(2);
      expect(result.cooked[1].title).toBe("Tortilla");
      expect(result.cooked[1].on).toBe(TODAY);
      expect(cookedIn).toHaveLength(1);

      // weekmenu reconstruido desde el plan del planner falso + estado previo
      expect(result.weekmenu.plan).toHaveLength(1);
      expect(result.weekmenu.approved).toBe(true);      // el plan YA estaba aprobado → sigue aprobado
      expect(result.weekmenu.includeUnavailable).toBe(true);
      expect(result.weekmenu.generatedOn).toBe(TODAY);  // ancla HOY real

      // orden de uso del planner: 1 entry, 1 pool, 1 menu
      expect(fake.calls).toEqual({ pool: 1, menu: 1, entry: 1 });
    });

    it("prevWeekmenu SIN aprobar (preview) → el nuevo weekmenu queda approved=false", () => {
      const fake = makeFakePlanner([{ dayLabel: "Lunes", recipe: REC, missing: [] }]);
      const result = regenerateAfterCook(REC, {
        cooked: [], today: TODAY, includeUnavailable: false,
        prevWeekmenu: { approved: false }, planner: fake
      });
      expect(result.weekmenu.approved).toBe(false);
      expect(result.weekmenu.includeUnavailable).toBe(false);
      expect(result.cooked).toHaveLength(1);
    });

    it("prevWeekmenu ausente/undefined → approved=false sin lanzar (guard §2-A)", () => {
      const fake = makeFakePlanner([]);
      const result = regenerateAfterCook(REC, { cooked: [], today: TODAY, planner: fake });
      expect(result.weekmenu.approved).toBe(false);
      expect(result.weekmenu.plan).toEqual([]);
    });

    it("guards defensivos: ctx sin planner → no lanza, cooked clonado SIN entrada y weekmenu con plan vacío", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const result = regenerateAfterCook(REC, { cooked: cookedIn, today: TODAY });   // sin planner
      expect(result.cooked).toEqual(cookedIn);   // no se fabrica entrada (sin cookEntryFor) pero tampoco se muta
      expect(result.weekmenu.approved).toBe(false);
      expect(result.weekmenu.plan).toEqual([]);
      expect(Array.isArray(result.cooked)).toBe(true);
    });
  });
});

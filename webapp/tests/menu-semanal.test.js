// tests/menu-semanal.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para modules/menu-semanal.js.
// Lógica PURe de "Menú semanal + lista de la compra": probada SIN DOM ni jsdom, determinista, en Node/Jest directo.
// Nunca toca localStorage ni la vista. Los inyectables cookEntryFor/uid/now hacen que los tests sean 100 % reproducibles.

const { shoppingListFor, approveMenu, markItemBought } = require("../modules/menu-semanal.js");

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

  describe("approveMenu — aprueba preview, inmutabilidad y ancla HOY", () => {
    const preview = {
      plan: [
        { dayLabel: "Lunes", recipe: { title: "Tortilla", ingredients: ["Huevos", "Patatas"] } },
        { dayLabel: "Martes", recipe: null },
        { dayLabel: "Miércoles", recipe: { title: "Merluza", ingredients: ["Merluza"] } }
      ],
      needyFoods: [{ name: "Aceite" }]
    };

    it("devuelve { cooked, weekmenu } sin mutar preview ni cooked", () => {
      const cookedIn = [{ id: "ant", title: "Antiguo", keyFingerprint: "abc", on: "2030-01-10" }];
      const result = approveMenu(preview, cookedIn, TODAY, cookEntryFor, () => "uid-1");

      expect(result.cooked).toHaveLength(3); // 1 previa + 2 recetas del plan (Martes es null → salta)
      expect(result.cooked[1].title).toBe("Tortilla");
      expect(result.cooked[1].on).toBe(TODAY); // ancla HOY real, no "Lunes"
      expect(result.cooked[2].title).toBe("Merluza");
      expect(result.cooked[2].on).toBe(TODAY);

      // inmutabilidad: preview y cookedIn no se mutan
      expect(preview.approved).toBeUndefined();
      expect(cookedIn).toHaveLength(1);
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
      expect(result.cooked.every(c => c.on === TODAY)).toBe(true);
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

});

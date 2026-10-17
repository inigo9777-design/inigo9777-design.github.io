// tests/recipe-missing.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para modules/recipe-missing.js.
// ---------------------------------------------------------------------------
// Lógica PURa de "¿qué ingredientes de una receta FALTAN en el aforo?" — probada SIN DOM ni jsdom,
// determinista, en Node/Jest directo. Nunca toca localStorage ni la vista.
// ---------------------------------------------------------------------------

const { marcarFaltantes, ingredienteFalta } = require("../modules/recipe-missing.js");

describe("modules/recipe-missing.js", () => {

  describe("marcarFaltantes — mapa paralelo 1:1 a receta.ingredients (sin reordenar ni dedup)", () => {
    it("receta sin array de ingredientes → [] y NO lanza (guard defensivo, idéntico al resto de módulos)", () => {
      expect(marcarFaltantes({}, [{ name: "Huevos", qty: 5 }])).toEqual([]);
      expect(marcarFaltantes(null, [{ name: "Huevos", qty: 5 }])).toEqual([]);
    });

    it("aforo NO-array → no lanza; cada ingrediente válido se marca como FALTA (no hay despensa, todo falta), idéntico a _ingredienteFalta", () => {
      const receta = { ingredients: ["Huevos", "Patatas"] };
      expect(marcarFaltantes(receta, undefined)).toEqual([true, true]);
      expect(marcarFaltantes(receta, null)).toEqual([true, true]);
      expect(marcarFaltantes(receta, "no-array")).toEqual([true, true]);
    });

    it("TODO disponible (qty>0 en todo) → ninguna marca", () => {
      const aforo = [
        { name: "Huevos", qty: 5 },
        { name: "Patatas", qty: 4 },
        { name: "Tomate", qty: 2 },
        { name: "Aceite de oliva", qty: 1 },
      ];
      const receta = { ingredients: ["Huevos", "Patatas", "Tomate", "Aceite de oliva"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([false, false, false, false]);
    });

    it("regla estricta §4 del plan: qty=0 cuenta como FALTA aunque el nombre esté en el aforo", () => {
      const aforo = [
        { name: "Huevos", qty: 5 },
        { name: "Patatas", qty: 0 },   // en lista, pero sin stock real → falta
        { name: "Tomate", qty: 2 },
      ];
      const receta = { ingredients: ["Huevos", "Patatas", "Tomate"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([false, true, false]);
    });

    it("ausente totalmente del aforo → se marca", () => {
      const aforo = [{ name: "Huevos", qty: 5 }];
      const receta = { ingredients: ["Huevos", "Merluza"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([false, true]);
    });

    it("case-insensitive y sin-importar-acentos: \"huevos\" casa con \"HUEVOS\" qty>0 → no falta", () => {
      const aforo = [
        { name: "HUEVOS", qty: 1 },
        { name: "PatataS", qty: 1 },   // caso/acentos a propósito
      ];
      const receta = { ingredients: ["huevos", "patatas"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([false, false]);
    });

    it("match bidireccional tolerante: \"Pata\" casa con \"Patatas\" (coherente con innovaciones.js ~línea 206)", () => {
      const aforo = [{ name: "Patatas", qty: 3 }];
      const receta = { ingredients: ["Pata"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([false]);   // coincide mutuamente por nombre normalizado
    });

    it("paralelismo por ÍNDICE: mismo nombre dos veces → cada índice se evalúa por separado (sin dedup, cada <li> del modal se pinta por su índice)", () => {
      const aforo = [{ name: "Huevos", qty: 0 }];   // sin stock → falta
      const receta = { ingredients: ["Huevos", "Huevos"] };
      expect(marcarFaltantes(receta, aforo)).toEqual([true, true]);   // sin dedup: el modal evalúa cada ingrediente propio
    });
  });

  describe("ingredienteFalta — predicho para un único nombre", () => {
    it("disponible con qty>0 → FALSE", () => {
      expect(ingredienteFalta("Huevos", [{ name: "Huevos", qty: 2 }])).toBe(false);
    });

    it("qty=0 aunque exista el nombre → TRUE (falta, regla estricta §4)", () => {
      expect(ingredienteFalta("Huevos", [{ name: "Huevos", qty: 0 }])).toBe(true);
    });

    it("ausente del aforo → TRUE", () => {
      expect(ingredienteFalta("Merluza", [{ name: "Huevos", qty: 5 }])).toBe(true);
    });

    it("aforo vacío → TRUE", () => {
      expect(ingredienteFalta("Huevos", [])).toBe(true);
    });

    it("nombre vacío o ilegible → FALSE (no se marca como faltante; coincide con el guard de planner.pantryMatchDetails)", () => {
      expect(ingredienteFalta("", [{ name: "Huevos", qty: 5 }])).toBe(false);
      expect(ingredienteFalta("   ", [{ name: "Huevos", qty: 5 }])).toBe(false);
      expect(ingredienteFalta("x", [{ name: "Huevos", qty: 5 }])).toBe(false);   // <2 caracteres normalizados → guard
    });
  });

});

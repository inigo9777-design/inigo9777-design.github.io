// tests/ingredient-matching.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para
// modules/ingredient-matching.js. Matching puro ingrediente↔alimento SIN jsdom: los asserts
// fijan (1) el fix del falso positivo "Sal" ⊂ "Salchichón ibérico" (bug 2026-10-18) y
// (2) los pares-legítimos que el matcher antiguo ya sabía resolver (plurales, acentos).

const { normName, tokensOf, matchIngredientToFood } = require("../modules/ingredient-matching.js");

describe("modules/ingredient-matching.js", () => {

  describe("normName — normalización base (sin acentos, minúsculas, sin símbolos)", () => {
    it("quita acentos y pasa a minúsculas", () => {
      expect(normName("Salchichón Iberico")).toBe("salchichon iberico");
      expect(normName("PÁTATAS")).toBe("patatas");
    });

    it("elimina puntuación/símbolos y colapsa espacios", () => {
      expect(normName("Aceite de oliva — virgen extra!")).toBe("aceite de oliva virgen extra");
      expect(normName(null)).toBe("");
      expect(normName(undefined)).toBe("");
    });
  });

  describe("tokensOf — tokenización comparables (stopwords + plural + longitud)", () => {
    it("quita palabras-función para comparar sólo lo sustancioso", () => {
      expect(tokensOf("Aceite de oliva")).toEqual(["aceite", "oliva"]);
    });

    it("quita el plural morfológico común", () => {
      expect(tokensOf("Tomates maduros")).toEqual(["tomate", "maduro"]);
      expect(tokensOf("Ajos")).toEqual(["ajo"]);
      expect(tokensOf("Huevos")).toEqual(["huevo"]);
    });

    it("descarta tokens cortos sin contenido (≥3 letras)", () => {
      expect(tokensOf("Pan")).toEqual(["pan"]);       // 3 letras entran
      expect(tokensOf("Si y de la")).toEqual([]);     // sólo ruido/stopwords
    });
  });

  describe("matchIngredientToFood — el regla de oro", () => {
    it("FIX bug 2026-10-18: 'Sal' NO casa con 'Salchichón ibérico' (antes era substring-crudo)", () => {
      expect(matchIngredientToFood("Sal", "Salchichón ibérico")).toBe(false);
      expect(matchIngredientToFood("Sal", "Salchichon")).toBe(false);
    });

    it("tampoco casa el token no-núcleo: 'jamón ibérico' ≠ 'salchichón ibérico' (atributo compartido ≠ mismo alimento)", () => {
      expect(matchIngredientToFood("Jamón ibérico", "Salchichón ibérico")).toBe(false);
    });

    it("tampoco casa prefijos-suelto tipo 'agua' ⊂ 'aguacate' ni 'pan' ⊂ 'pangasius'", () => {
      expect(matchIngredientToFood("Agua", "Aguacate")).toBe(false);
      expect(matchIngredientToFood("Pan", "Pangasius")).toBe(false);
    });

    it("MANTIENE los matches legítimos del matcher antiguo", () => {
      expect(matchIngredientToFood("Pan", "Pan de barra")).toBe(true);                       // subconjunto
      expect(matchIngredientToFood("Aceite de oliva virgen extra", "Aceite de oliva")).toBe(true); // subconjunto invertido
      expect(matchIngredientToFood("Tomates maduros", "Tomates")).toBe(true);                // plural
      expect(matchIngredientToFood("Huevos", "Huevos")).toBe(true);
      expect(matchIngredientToFood("Ajo", "Ajos")).toBe(true);                               // singular↔plural
      expect(matchIngredientToFood("Leche", "Leche desnatada")).toBe(true);
      expect(matchIngredientToFood("Cebolla", "Cebollas blancas")).toBe(true);
      expect(matchIngredientToFood("Agua", "Agua mineral")).toBe(true);
      expect(matchIngredientToFood("Plátanos", "Plátanos")).toBe(true);
      // GÉNERO GENÉRICO cubre al ESPECÍFICO (subconjunto: la despensa "Vino" sirve para "Vino blanco")
      expect(matchIngredientToFood("Vino blanco", "Vino")).toBe(true);
      expect(matchIngredientToFood("Tomates triturados", "Tomate")).toBe(true);
      expect(matchIngredientToFood("Queso rallado", "Queso")).toBe(true);
    });

    it("NO casa cosas distintas que el substring-crudo daba por buenas", () => {
      expect(matchIngredientToFood("Salsa de tomate", "Sal")).toBe(false);        // 'sal' ya no está dentro de 'salsa' (token cracking)
      expect(matchIngredientToFood("Mostaza", "Mosto")).toBe(false);
    });

    it("REFINAMIENTO 2 (bug 'Lomo ibérico'): compartir el token NÚCLEO NO basta — el descompone el lado específico", () => {
      // con "Lomo ibérico" en la despensa, NINGUNA de estas recetas debe verse como "ya la tienes"
      expect(matchIngredientToFood("Lomos de bacalao", "Lomo ibérico")).toBe(false);
      expect(matchIngredientToFood("Lomo de atún", "Lomo ibérico")).toBe(false);
      expect(matchIngredientToFood("Lomo de cerdo entero", "Lomo ibérico")).toBe(false);
      expect(matchIngredientToFood("Lomos de merluza", "Lomo ibérico")).toBe(false);
      // mismo fenómeno en otras especies: específico ≠ específico por el primer token
      expect(matchIngredientToFood("Queso rallado", "Queso azul")).toBe(false);
      expect(matchIngredientToFood("Lomo de cerdo", "Lomo salado")).toBe(false);
      expect(matchIngredientToFood("Vino blanco", "Vino tinto")).toBe(false);
    });

    it("degradación suave: vacíos/undefined → false sin lanzar (guard §2-A)", () => {
      expect(matchIngredientToFood("", "Pan")).toBe(false);
      expect(matchIngredientToFood("Pan", "")).toBe(false);
      expect(matchIngredientToFood(undefined, null)).toBe(false);
    });
  });
});

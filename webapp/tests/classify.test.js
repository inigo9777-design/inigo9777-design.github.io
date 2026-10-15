// tests/classify.test.js — capa unitaria (Capa 1, §6). Lógica pura: require directo sin jsdom.
const classify = require("../modules/classify");

describe("classify.norm", () => {
  it("normaliza acentos/diacríticos y reduce a minúsculas (NFD + combining-marks)", () => {
    expect(classify.norm("café")).toBe("cafe");
    // Salmón → salmon: prueba de que la comparación es INSENSIBLE A ACENTOS.
    expect(classify.norm("Salmón")).toBe("salmon");
    expect(classify.norm("TOMATE")).toBe("tomate");
  });

  it("convierte cualquier entrada no-string a String antes de normalizar", () => {
    // `String(s).toLowerCase()`: números y otros tipos también son aceptados sin romper.
    expect(classify.norm(123)).toBe("123");
  });
});

describe("classify — FOOD_TYPES / TYPE_ORDER (contractos del módulo, §5)", () => {
  it("expone las seis categorías alimentarias esperadas", () => {
    expect(Object.keys(classify.FOOD_TYPES).sort()).toEqual(
      ["cereal", "especia", "fruta", "lacteo", "proteina", "verdura"].sort()
    );
  });

  it("ordena la prueba de tipos para que gane el más específico (antes que verdes/especias)", () => {
    expect(classify.TYPE_ORDER).toEqual([
      "proteina",
      "lacteo",
      "cereal",
      "fruta",
      "verdura",
      "especia",
    ]);
  });

  it("las palabras clave de cada categoría están SIN acentos (lo normaliza el comparador)", () => {
    const todas = Object.values(classify.FOOD_TYPES).flat();
    expect(todas.every((k) => /^[a-z0-9\s]+$/.test(k))).toBe(true);
  });
});

describe("classify.classifyFood — clasificación heurística del nombre", () => {
  // Casos limpios, uno por categoría (comprobado empíricamente en Node contra el módulo real).
  it.each([
    ["Pollo a la plancha", "proteina"],
    ["Bacalao", "proteina"],
    ["Leche entera", "lacteo"],
    ["Yogur natural", "lacteo"],
    ["Arroz integral", "cereal"],
    ["Pasta", "cereal"],
    ["Galletas", "cereal"],
    ["Manzana roja", "fruta"],
    ["Tomate cherry", "verdura"],
    ["Berenjena", "verdura"],
    ["Sal marina", "especia"],  // 'sal' entra por MATCH EXACTO (no pasa el umbral de ≥4 chars)
    ["Romero fresco", "especia"],
  ])("'%s' se clasifica como '%s'", (nombre, esperado) => {
    expect(classify.classifyFood(nombre)).toBe(esperado);
  });

  it("es INSENSIBLE a ACENTOS: un nombre con ñ/tilde cae en la misma categoría que su forma sin tilde", () => {
    // Comprobado empíricamente: ambos devuelven "proteina".
    expect(classify.classifyFood("Salmon ahumado")).toBe("proteina");
    expect(classify.classifyFood("Salmón ahumado")).toBe("proteina");
  });

  it("conoce el caso de interacción por ORDEN DE PRIORIDAD: 'Aceite de oliva' → verdura (no especia)", () => {
    // Carácterización del comportamiento actual del módulo, NO lo que quizá sea "más lógico" a nivel
    // conceptual ('aceituna' pertenece también a especia). Se aserter como contrato para que si alguien
    // reordena TYPE_ORDER o ajusta FOOD_TYPES se vea el impacto de inmediato en esta prueba. Ver §5/§6:
    // los tests actúan como "contract test" para los shapes y semántica compartidas.
    expect(classify.classifyFood("Aceite de oliva")).toBe("verdura");
  });

  it.each(["Hielo", "Vino tinto", "Agua mineral", "Xiloto"])(
    "un nombre que no reconoce la heurística cae en 'otros' — '%s'",
    (nombre) => {
      expect(classify.classifyFood(nombre)).toBe("otros");
    }
  );
});

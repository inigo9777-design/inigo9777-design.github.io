// tests/categoria-producto.test.js — ETIQUETA alimento/hogar del Inventario (requisito 95%):
// los productos no alimentarios del ticket (detergente, papel…) entran al Inventario con su tag
// `categoria: "hogar"` y viven por REGLAS fijadas con el usuario: sección propia, sin importancia
// ni mínimo pedidos, alertas semanales cuando se agotan, y FUERA de recetas/sugerencias/lista.
const cp = require("../modules/categoria-producto.js");
const ocr = require("../modules/ocr-despensa.js");

describe("esProductoHogar sobre los NOMBRES reales del ticket", () => {
  test("los de la compra real (Mercadona/ALDI) caen en hogar", () => {
    for (const nombre of [
      "HIGIÉNICO DOBLE ROLL",           // papel higiénico — Mercadona
      "PAÑUELO",                        // Mercadona
      "Detergente Líquido", "Papel Aluminio", "LEJÍA CONCENTRADA", "Champú", "Bolsas de basura",
      "Papel camilla"                   // prefijo de palabra larga ✓
    ]) expect(cp.esProductoHogar(nombre)).toBe(true);
  });
  test("los alimentos NO se tocan (también con acentos y plurales reales)", () => {
    for (const nombre of [
      "PAN H BREOENE",                  // ojo: "pan" ≠ "papel" — NO es hogar
      "SALMON NATURAL", "LECHE FRESCA ENTERA", "Gelatina", "Gel de tomate al natural",
      "Mantequilla Salada", "Tomate Frito", "Aceite de Oliva Virgen Extra"
    ]) expect(cp.esProductoHogar(nombre)).toBe(false);
  });
});

describe("la despensa parte en dos sin tocar a los viejos", () => {
  const despensaDePrueba = () => [
    { id: "a", name: "Tomate" },
    { id: "h", name: "Detergente", categoria: "hogar" },
    { id: "b", name: "Papel Higiénico", categoria: "hogar" },
    { id: "c", name: "Leche" }
  ];
  test("esHogar: sin campo ES ALIMENTO (retro-compatibilidad total)", () => {
    expect(cp.esHogar({ id: "x", name: "Huevos" })).toBe(false);
    expect(cp.esAlimento({ id: "x", name: "Huevos" })).toBe(true);
  });
  test("alimentos() deja pasar sólo los comestibles; hogares() lo contrario", () => {
    const despensa = despensaDePrueba();
    expect(cp.alimentos(despensa).map(f => f.name)).toEqual(["Tomate", "Leche"]);
    expect(cp.hogares(despensa).map(f => f.name)).toEqual(["Detergente", "Papel Higiénico"]);
  });
});

describe("el criterio del ALTA sin preguntas (hogar)", () => {
  test("criterioDeAlta fija score 5 neutra y min 0 (avisar al agotarse) si no venía nada", () => {
    expect(cp.criterioDeAlta(true, {})).toEqual({ score: 5, min: 0 });
    expect(cp.criterioDeAlta(false, { score: 8, min: 2 })).toEqual({ score: 8, min: 2 });   // alimento: lo que la persona puso
  });
});

describe("el escáner mete los hogareños SIN preguntar criterio (ocr-despensa)", () => {
  test("confirmarRevision los da de alta con categoria hogar / score 5 / min 0", () => {
    const r = ocr.confirmarRevision(
      [{ id: "1", name: "Tomate", score: 8, qty: 3, min: 2 }],
      [{ nombre: "PAPEL HIGIÉNICO DOBLE ROLL", qty: 1, hogar: true }],
      [], { uid: () => "u" + Math.random(), ahora: 1000 }
    );
    const hk = r.foods.find(f => f.name.includes("PAPEL"));
    expect(hk.categoria).toBe("hogar");
    expect(hk.score).toBe(5);
    expect(hk.min).toBe(0);
    const tomate = r.foods.find(f => f.name === "Tomate");
    expect(tomate.categoria).toBeUndefined();   // el alimento de always sin tag
  });
  test("el hogar con nombre exacto a uno de casa SUMA y conserva todo (sin alta nueva)", () => {
    const r = ocr.confirmarRevision(
      [{ id: "1", name: "Detergente", score: 5, qty: 1, min: 0, categoria: "hogar" }],
      [{ nombre: "Detergente", qty: 2, hogar: true }],
      [], { uid: () => "u1", ahora: 1000 }
    );
    expect(r.foods).toHaveLength(1);
    expect(r.foods[0].qty).toBe(3);
    expect(r.foods[0].categoria).toBe("hogar");
  });
  test("guardarCandidatos transporta el flag hogar a las tres salidas", () => {
    const r = ocr.guardarCandidatos([], [
      { nombre: "LEJÍA", qty: 1, hogar: true },
      { nombre: "SALMON NATURAL", qty: 1 }
    ], { candidatosDespensa: null });
    expect(r.nuevos.find(n => n.nombre === "LEJÍA").hogar).toBe(true);
    expect(r.nuevos.find(n => n.nombre === "SALMON NATURAL").hogar).toBe(false);
  });
});

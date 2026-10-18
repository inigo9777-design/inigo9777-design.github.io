// tests/ocr-despensa.test.js — Spec del módulo puro del escáner de despensa (OCR, #epic-ocr-despensa-camara).
// Toda la DECISIÓN del flujo vive en modules/ocr-despensa.js (§3/§5): aquí se prueba el contrato
// con el vocabulario REAL de modules/classify.js (FOOD_TYPES) y los escenarios de borde del texto OCR.
const ocrDespensa = require("../modules/ocr-despensa.js");
const classify = require("../modules/classify.js");
const { FOOD_TYPES } = classify;

describe("ocr-despensa — esMovil (la opción de cámara sólo en vista móvil)", () => {
  test("móviles reales → true (Android, iPhone, iPad, iPod, Windows Phone, UA 'Mobile')", () => {
    expect(ocrDespensa.esMovil("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36")).toBe(true);
    expect(ocrDespensa.esMovil("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/Safari/605.1")).toBe(true);
    expect(ocrDespensa.esMovil("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(true);
    expect(ocrDespensa.esMovil("Mozilla/5.0 (Linux; Android 13; SM-A52) AppleWebKit/537.36 Chrome/130.0 Mobile Safari")).toBe(true);
  });

  test("escritorios → false: la cámara NO se muestra, la vía es elegir una foto", () => {
    expect(ocrDespensa.esMovil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")).toBe(false);
    expect(ocrDespensa.esMovil("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")).toBe(false);
    expect(ocrDespensa.esMovil("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Brave/1.78.0 Chrome/126.0.0.0 Safari/537.36")).toBe(false);
  });

  test("vacío/undefined → false (no hay UA, no hay cámara)", () => {
    expect(ocrDespensa.esMovil("")).toBe(false);
    expect(ocrDespensa.esMovil(undefined)).toBe(false);
  });
});

describe("ocr-despensa — extraerCandidatos (texto OCR → alimentos del vocabulario)", () => {
  const nombres = cands => cands.map(c => c.nombre);

  test("detecta varios alimentos de una foto de nevera, con plurales y compuestos", () => {
    const texto = [
      "FRIGORÍFICO SEMANA 44",
      "Leche entera Hacendado 1L",
      "Huevos Docena XL",
      "3 Cebollas · 2 Tomates rojos",
      "Yogures naturales x6"
    ].join("\n");
    const cands = ocrDespensa.extraerCandidatos(texto, FOOD_TYPES);
    expect(nombres(cands)).toEqual(["Leche", "Huevos", "Cebolla", "Tomate", "Yogur"]);
    // el orden es el del documento (línea de primera aparición), no el del diccionario
    expect(cands[0].nombre).toBe("Leche");
    expect(cands[1].tipo).toBe("proteina");
    expect(cands[3].tipo).toBe("verdura");
  });

  test("huérfano del ruido: precios, marcas y envases no crean candidatos falsos", () => {
    const texto = "TOTAL 7,35 €\nCAD. 2026/11/02\nEAN 8480000101010\nLote 44-B\nMercadona";
    expect(ocrDespensa.extraerCandidatos(texto, FOOD_TYPES)).toEqual([]);
  });

  test("'ensalada' NO despierta 'sal' (palabras de <4 letras: sólo igualdad exacta)", () => {
    const texto = "Bolsa de ensalada mixta";
    const cands = ocrDespensa.extraerCandidatos(texto, FOOD_TYPES);
    expect(nombres(cands)).toEqual([]);   // ni "sal" ni "col" (sufijo) — solo matchearía igualdad exacta
  });

  test("acentos y mayúsculas del OCR se perdonan (tildes que salieron mal, líneas de etiqueta)", () => {
    const texto = "LÁCTEOS\nLECHE SEMI\nQUESO MANCHEGO";
    expect(nombres(ocrDespensa.extraerCandidatos(texto, FOOD_TYPES))).toEqual(["Leche", "Queso"]);
  });

  test("un token alimenta UNA palabra: 'lentejas' no duplica 'lenteja' + 'lentejas'", () => {
    const texto = "Lentejas cocidas 400g";
    const cands = ocrDespensa.extraerCandidatos(texto, FOOD_TYPES);
    expect(nombres(cands)).toEqual(["Lentejas"]);   // la palabra del vocabulario más larga que reclama el token
    expect(cands).toHaveLength(1);
  });

  test("repetición: se declara UN candidato y se cuenta en `veces`", () => {
    const texto = "Tomate\nSalsa de tomate\nTomates cherry";
    const cands = ocrDespensa.extraerCandidatos(texto, FOOD_TYPES);
    expect(cands).toHaveLength(1);
    expect(cands[0].nombre).toBe("Tomate");
    expect(cands[0].veces).toBe(3);
  });

  test("prefijo/sufijo de ≥4 letras: 'Macarrones'→macarron (cereal)", () => {
    const texto = "Macarrones 500g y yogures naturales";
    const cands = ocrDespensa.extraerCandidatos(texto, FOOD_TYPES);
    expect(nombres(cands)).toEqual(["Macarron", "Yogur"]);
    expect(cands[0].tipo).toBe("cereal");
  });

  test("los términos de temporada se pueden escanear: 'pimiento rojo' (verdura) aunque venga en mayúsculas y con ruido", () => {
    const texto = "PIMIENTO ROJO 0,89/kg\nPuerro";
    expect(nombres(ocrDespensa.extraerCandidatos(texto, FOOD_TYPES))).toEqual(["Pimiento", "Puerro"]);
  });

  test("texto vacío / sin argumento → nada, sin lanzar", () => {
    expect(ocrDespensa.extraerCandidatos("", FOOD_TYPES)).toEqual([]);
    expect(ocrDespensa.extraerCandidatos(undefined, FOOD_TYPES)).toEqual([]);
    expect(ocrDespensa.extraerCandidatos(null, null)).toEqual([]);
  });
});

describe("ocr-despensa — guardarCandidatos (confirma → despensa, mismo shape que el formulario)", () => {
  const uids = ["u1", "u2", "u3", "u4"];
  const ahora = 1234567890;
  const deps = { uid: () => uids.shift() || "uX", ahora };

  test("alta de candidatos nuevos: nombre REALMENTE editable (se guarda lo confirmado)", () => {
    const { foods, añadidos, actualizados } = ocrDespensa.guardarCandidatos(
      [],
      [
        { nombre: "Leche", tipo: "lacteo", qty: 2, score: 8, min: 1 },
        { nombre: "Huevos XL", tipo: "proteina", qty: 12, score: 5, min: 6 }   // nombre renombrado por el usuario en el modal
      ],
      deps
    );
    expect(añadidos).toBe(2); expect(actualizados).toBe(0);
    expect(foods).toHaveLength(2);
    expect(foods[0]).toEqual({ id: "u1", name: "Leche", score: 8, qty: 2, min: 1, checked: false, createdAt: ahora });
    expect(foods[1].name).toBe("Huevos XL");   // el nombre que el usuario escribió, no el del OCR
    expect(foods[1].min).toBe(6);
  });

  test("nombre ya en la despensa (case-insensitive) → actualización en-situ de qty/score; min sólo si viene", () => {
    const despensa = [
      { id: "a1", name: "leche", score: 3, qty: 0, min: 0, checked: false, createdAt: 1 }
    ];
    const { foods, añadidos, actualizados } = ocrDespensa.guardarCandidatos(
      despensa,
      [{ nombre: "Leche", qty: 2, score: 9, min: 1 }],
      deps
    );
    expect(añadidos).toBe(0); expect(actualizados).toBe(1);
    expect(foods[0]).toEqual({ id: "a1", name: "leche", score: 9, qty: 2, min: 1, checked: false, createdAt: 1 });  // id/createdAt intactos
  });

  test("sin datos válidos (sin nombre/números locos) no entra nada y no rompe", () => {
    const { foods, añadidos, actualizados } = ocrDespensa.guardarCandidatos(
      [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }],
      [
        { nombre: "", qty: 2, score: 5, min: 1 },
        { nombre: "Cosa rara", qty: -1, score: 5, min: 0 },
        { nombre: "Otra cosa", qty: 2, score: 99, min: 0 },
        { nombre: "Especia bien", qty: 1, score: 7, min: 0 }
      ],
      deps
    );
    expect(añadidos).toBe(1); expect(actualizados).toBe(0);
    expect(foods.map(f => f.name)).toEqual(["Pollo", "Especia bien"]);
  });

  test("despensa de entrada NO mutada (pureza §3): el array del llamador queda intacto", () => {
    const original = Object.freeze([{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }]);
    const { foods } = ocrDespensa.guardarCandidatos(original, [{ nombre: "Pollo", qty: 3, score: 6, min: 1 }], deps);
    expect(original[0].qty).toBe(1);           // el ORIGINAL no se toca
    expect(foods[0]).not.toBe(original[0]);    // en el array nuevo hay una copia actualizada
    expect(foods[0].qty).toBe(3);
  });

  test("selección vacía/undefined → despensa igual, cero añadidos", () => {
    const despensa = [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }];
    expect(ocrDespensa.guardarCandidatos(despensa, [], deps)).toEqual({ foods: despensa, añadidos: 0, actualizados: 0 });
    expect(ocrDespensa.guardarCandidatos(despensa, undefined, deps)).toEqual({ foods: despensa, añadidos: 0, actualizados: 0 });
  });
});

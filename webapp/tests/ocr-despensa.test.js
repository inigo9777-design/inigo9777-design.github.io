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
    expect(foods[0].qty).toBe(4);              // el ticket SUMA: tenía 1 en casa + 3 compradas
  });

  test("selección vacía/undefined → despensa igual, cero añadidos, sin dudosos", () => {
    const despensa = [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }];
    expect(ocrDespensa.guardarCandidatos(despensa, [], deps)).toEqual({ foods: despensa, añadidos: 0, actualizados: 0, dudosos: [] });
    expect(ocrDespensa.guardarCandidatos(despensa, undefined, deps)).toEqual({ foods: despensa, añadidos: 0, actualizados: 0, dudosos: [] });
  });
});

describe("ocr-despensa — cantidad del ticket (qty por línea, propósito 2026-10-20)", () => {
  const qtys = texto => ocrDespensa.extraerCandidatos(texto, FOOD_TYPES).map(c => c.qty);

  test("'2 x Leche' / 'Yogures naturales x6' / '3 Cebollas' → 2, 6, 3", () => {
    expect(qtys("2 x Leche entera\nYogures naturales x6\n3 Cebollas")).toEqual([2, 6, 3]);
  });

  test("unidades de cuenta: UD, bolsas, brik ('2 bolsas de cebollas' → 2)", () => {
    expect(qtys("2 bolsas de cebollas\n1 brik Leche\n4 ud Huevos")).toEqual([2, 1, 4]);
  });

  test("pesos y marcas del ENVASE no son cantidad: '400g'/'1L'/'0,89/kg' → null", () => {
    expect(qtys("Lentejas cocidas 400g\nLeche entera 1L\nPIMIENTO ROJO 0,89/kg")).toEqual([null, null, null]);
  });

  test("precios sin unidad de cuenta no cuentan ('TOTAL 7,35 €' ni lanza ni inventa)", () => {
    expect(qtys("TOTAL 7,35 €\nMercadona EAN 123")).toEqual([]);
  });

  test("decimales reales de compra se redondean ('1,5 kg broza'→ no; '2 x Leche' entero)", () => {
    // el peso se ignora a propósito (mira el envase); sólo quedan las cifras de cuenta
    expect(qtys("Leche x1,5")).toEqual([2]);   // x con decimal redondeado: 1,5 ≈ 2 (el modal permite corregir)
  });
});

describe("ocr-despensa — reparto con la despensa: exacto suma, dudoso, alta (propósito ticket)", () => {
  const uids = ["u1", "u2", "u3", "u4", "u5"];
  const ahora = 987654321;
  const deps = { uid: () => uids.shift() || "uX", ahora };
  const despensa = [
    { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 },
    { id: "a2", name: "Leche entera", score: 6, qty: 0, min: 1, checked: false, createdAt: 2 }
  ];
  // el MISMO casador del botón "🛒 Despensa?" (menu-semanal.candidatosDespensa), aquí el doble puro
  const variantes = (nombre, foods) => {
    const t = s => ocrDespensa.norm(s).split(/\W+/).filter(Boolean);
    return foods.filter(f => t(f.name).some(tok => t(nombre).includes(tok)) && ocrDespensa.norm(f.name) !== ocrDespensa.norm(nombre));
  };

  test("nombre EXACTO ya en la despensa → la compra SUMA (no se pisa lo que ya había)", () => {
    const { foods, actualizados, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Leche entera", qty: 2, score: 8, min: 1 }], { ...deps, candidatosDespensa: variantes });
    expect(actualizados).toBe(1); expect(dudosos).toEqual([]);
    expect(foods.find(f => f.name === "Leche entera").qty).toBe(2);   // 0 en casa + 2 compradas
  });

  test("dudoso ('Yogur' vs despensa 'Yogur natural') NO entra: sale para la lista de la compra", () => {
    const { foods, añadidos, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4, score: 5 }], { ...deps, candidatosDespensa: variantes });
    expect(añadidos).toBe(0); expect(dudosos).toEqual([{ nombre: "Yogur", qty: 4, tipo: null }]);
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);   // la despensa SIN tocar
    expect(foods).toHaveLength(2);                                      // ni alta nueva de "Yogur"
  });

  test("sin variantes y sin despensa alike → alta directa (alimento nuevo, no es duda)", () => {
    const { foods, añadidos, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Ajo", qty: 1, score: 7 }], { ...deps, candidatosDespensa: variantes });
    expect(añadidos).toBe(1); expect(dudosos).toEqual([]);
    expect(foods[foods.length - 1]).toEqual({ id: "u1", name: "Ajo", score: 7, qty: 1, min: 1, checked: false, createdAt: ahora });
  });

  test("SIN inyección de candidatosDespensa → degradación del legado: el dudoso entraria de alta (nunca silencio)", () => {
    const { foods, añadidos, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4, score: 5 }], { ...deps });
    expect(dudosos).toEqual([]); expect(añadidos).toBe(1);
    expect(foods.some(f => f.name === "Yogur")).toBe(true);
  });
});

describe("ocr-despensa — pendientes del ticket en la lista de la compra", () => {
  test("añadirTicketPendientes: los nuevos van ARRIBA y el re-escaneado dedup + sube ('Yogur' ≅ 'yogur')", () => {
    const a = ocrDespensa.añadirTicketPendientes([], [{ nombre: "Yogur", qty: 4 }], "2026-10-20");
    expect(a).toEqual([{ nombre: "Yogur", qty: 4, tipo: null, escaneadoEn: "2026-10-20" }]);
    const b = ocrDespensa.añadirTicketPendientes(a, [{ nombre: "Leche", qty: 2, tipo: "lacteo" }], "2026-10-21");
    expect(b.map(p => p.nombre)).toEqual(["Leche", "Yogur"]);          // el nuevo, arriba
    const c = ocrDespensa.añadirTicketPendientes(b, [{ nombre: "yogur", qty: 6 }], "2026-10-22");
    expect(c.map(p => p.nombre)).toEqual(["yogur", "Leche"]);          // mismo alimento (normal): sube con qty nueva
    expect(c[0].qty).toBe(6);
    expect(c).toHaveLength(2);                                          // no se duplica
  });

  test("quitarTicketPendiente: fuera por nombre normalizado; lo demás queda; {quitado} dice si hubo()", () => {
    const lista = [{ nombre: "Yogur", qty: 4, escaneadoEn: "2026-10-20" }, { nombre: "Pan de pueblo", qty: 1, escaneadoEn: "2026-10-20" }];
    const r = ocrDespensa.quitarTicketPendiente(lista, "YOGUR");
    expect(r.quitado).toBe(true);
    expect(r.lista.map(p => p.nombre)).toEqual(["Pan de pueblo"]);
    expect(ocrDespensa.quitarTicketPendiente(lista, "Batido").quitado).toBe(false);
  });
});


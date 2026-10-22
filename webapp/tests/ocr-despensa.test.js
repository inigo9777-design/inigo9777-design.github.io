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

describe("ocr-despensa — esHeic (la foto del iPhone antes del OCR: HEIC/HEIF al OCR)", () => {
  test("HEIC del iPhone por tipo MIME (con y sin mayúsculas) → true", () => {
    expect(ocrDespensa.esHeic({ name: "IMG_4123.heic", type: "image/heic" })).toBe(true);
    expect(ocrDespensa.esHeic({ name: "IMG_4124.HEIC", type: "image/heic" })).toBe(true);
    expect(ocrDespensa.esHeic({ name: "IMG_4125", type: "image/heif" })).toBe(true);
    expect(ocrDespensa.esHeic({ name: "duda.bin", type: "APPLICATION/HEIC" })).toBe(true);
  });

  test("por EXTENSIÓN aunque el tipo venga vacío (algunos file pickers se quedan sin MIME)", () => {
    expect(ocrDespensa.esHeic({ name: "ticket.heic", type: "" })).toBe(true);
    expect(ocrDespensa.esHeic({ name: "ticket.HEIF", type: "" })).toBe(true);
  });

  test("formatos comunes que sí decodifica el navegador → false", () => {
    expect(ocrDespensa.esHeic({ name: "ticket.jpg", type: "image/jpeg" })).toBe(false);
    expect(ocrDespensa.esHeic({ name: "ticket.png", type: "image/png" })).toBe(false);
    expect(ocrDespensa.esHeic({ name: "ticket.webp", type: "image/webp" })).toBe(false);
  });

  test("el HEIC CAMUFLADO de .png NO lo ve la vía nombre/tipo: lo pilla el probe del decodificador (app.js)", () => {
    expect(ocrDespensa.esHeic({ name: "11,00 €.png", type: "image/png" })).toBe(false);   // bytes HEIF con extensión mentirosa
  });

  test("nada / fichero vacío → false", () => {
    expect(ocrDespensa.esHeic(null)).toBe(false);
    expect(ocrDespensa.esHeic({})).toBe(false);
    expect(ocrDespensa.esHeic({ name: "", type: "" })).toBe(false);
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

describe("ocr-despensa — guardarCandidatos (contrato ticket: NADIE entra en la despensa solo)", () => {
  const deps = {};

  test("nombre nuevo (sin variantes inyectadas) NO entra: sale en `nuevos`, su alta se define en el diálogo", () => {
    const { foods, actualizados, nuevos } = ocrDespensa.guardarCandidatos(
      [],
      [
        { nombre: "Leche", tipo: "lacteo", qty: 2 },
        { nombre: "Huevos XL", tipo: "proteina", qty: 12 }   // nombre renombrado por el usuario en el modal
      ],
      deps
    );
    expect(foods).toEqual([]);                                // la despensa NO se inventa altas
    expect(actualizados).toBe(0);
    expect(nuevos).toEqual([
      { nombre: "Leche", qty: 2, tipo: "lacteo", hogar: false },
      { nombre: "Huevos XL", qty: 12, tipo: "proteina", hogar: false }
    ]);
  });

  test("nombre ya en la despensa (case-insensitive) → la compra SUMA; su min/importancia QUEDAN como estaban", () => {
    const despensa = [
      { id: "a1", name: "leche", score: 3, qty: 0, min: 2, checked: false, createdAt: 1 }
    ];
    const { foods, actualizados, nuevos } = ocrDespensa.guardarCandidatos(
      despensa,
      [{ nombre: "Leche", qty: 2 }],
      deps
    );
    expect(nuevos).toEqual([]); expect(actualizados).toBe(1);
    expect(foods[0]).toEqual({ id: "a1", name: "leche", score: 3, qty: 2, min: 2, checked: false, createdAt: 1 });  // id/createdAt/score/min intactos
  });

  test("sin datos válidos (sin nombre/qty loca) el resto sigue y no rompe", () => {
    const { foods, actualizados, nuevos } = ocrDespensa.guardarCandidatos(
      [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }],
      [
        { nombre: "", qty: 2 },
        { nombre: "Cosa rara", qty: -1 },
        { nombre: "Especia bien", qty: 1 }
      ],
      deps
    );
    expect(actualizados).toBe(0);
    expect(nuevos.map(n => n.nombre)).toEqual(["Especia bien"]);
    expect(foods.map(f => f.name)).toEqual(["Pollo"]);        // la despensa queda sin toques
  });

  test("despensa de entrada NO mutada (pureza §3): copia nueva con la compra sumada", () => {
    const original = Object.freeze([{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }]);
    const { foods } = ocrDespensa.guardarCandidatos(original, [{ nombre: "Pollo", qty: 3 }], deps);
    expect(original[0].qty).toBe(1);           // el ORIGINAL no se toca
    expect(foods[0]).not.toBe(original[0]);    // en el array nuevo hay una copia actualizada
    expect(foods[0].qty).toBe(4);              // el ticket SUMA: tenía 1 en casa + 3 compradas
  });

  test("selección vacía/undefined → despensa igual, sin dudosos ni nuevos", () => {
    const despensa = [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }];
    expect(ocrDespensa.guardarCandidatos(despensa, [], deps)).toEqual({ foods: despensa, actualizados: 0, directos: [], dudosos: [], nuevos: [] });
    expect(ocrDespensa.guardarCandidatos(despensa, undefined, deps)).toEqual({ foods: despensa, actualizados: 0, directos: [], dudosos: [], nuevos: [] });
  });

  test("DIRECTOS: los exactos traen su fila (nombre + qty del ticket) para el paso 1 del asistente", () => {
    const despensa = [{ id: "a1", name: "Pollo", score: 4, qty: 1, min: 1, checked: false, createdAt: 1 }];
    const { directos, dudosos, nuevos, actualizados } = ocrDespensa.guardarCandidatos(
      despensa,
      [{ nombre: "Pollo", qty: 3 }, { nombre: "Cuscús", qty: 1 }],
      deps
    );
    expect(actualizados).toBe(1);
    expect(directos).toEqual([{ nombre: "Pollo", qty: 3, tipo: null, hogar: false }]);   // el repetidor del paso 1
    expect(dudosos).toHaveLength(0);
    expect(nuevos.map(n => n.nombre)).toEqual(["Cuscús"]);                 // el repetidor del paso 2
  });
});

describe("ocr-despensa — pasosDeConfirmacion (el recorrido de los diálogos del ticket)", () => {
  test("con exactos Y dudas/nuevos: despensa SIEMPRE primero, la revisión después", () => {
    expect(ocrDespensa.pasosDeConfirmacion({
      directos: [{ nombre: "Pan", qty: 1 }], dudosos: [{ nombre: "Yogur", qty: 2 }], nuevos: []
    })).toEqual(["despensa", "revisar"]);
  });

  test("paso que no tiene filas NO sale (un ticket sin dudas no muestra el diálogo vacío)", () => {
    expect(ocrDespensa.pasosDeConfirmacion({ directos: [{ nombre: "Pan", qty: 1 }], dudosos: [], nuevos: [] }))
      .toEqual(["despensa"]);
    expect(ocrDespensa.pasosDeConfirmacion({ directos: [], dudosos: [], nuevos: [{ nombre: "Leche", qty: 3 }] }))
      .toEqual(["revisar"]);
  });

  test("casi nada que repartir → sin pasos (la vista no abre asistente vacío)", () => {
    expect(ocrDespensa.pasosDeConfirmacion({ directos: [], dudosos: [], nuevos: [] })).toEqual([]);
    expect(ocrDespensa.pasosDeConfirmacion(null)).toEqual([]);
    expect(ocrDespensa.pasosDeConfirmacion()).toEqual([]);
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

describe("ocr-despensa — reparto con la despensa: exacto suma, dudoso, nuevo sin definir (propósito ticket)", () => {
  const despensa = [
    { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 },
    { id: "a2", name: "Leche entera", score: 6, qty: 0, min: 2, checked: false, createdAt: 2 }
  ];
  // el MISMO casador del botón "🛒 Despensa?" (menu-semanal.candidatosDespensa), aquí el doble puro
  const variantes = (nombre, foods) => {
    const t = s => ocrDespensa.norm(s).split(/\W+/).filter(Boolean);
    return foods.filter(f => t(f.name).some(tok => t(nombre).includes(tok)) && ocrDespensa.norm(f.name) !== ocrDespensa.norm(nombre));
  };

  test("nombre EXACTO ya en la despensa → la compra SUMA y su min/importancia quedan INTACTOS", () => {
    const { foods, actualizados, dudosos, nuevos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Leche entera", qty: 2 }], { candidatosDespensa: variantes });
    expect(actualizados).toBe(1); expect(dudosos).toEqual([]); expect(nuevos).toEqual([]);
    const leche = foods.find(f => f.name === "Leche entera");
    expect(leche.qty).toBe(2);                // 0 en casa + 2 compradas
    expect(leche.min).toBe(2); expect(leche.score).toBe(6);   // los criterios de despensa, sin pisar
  });

  test("dudoso ('Yogur' vs despensa 'Yogur natural') NO entra: sale para la revisión del diálogo", () => {
    const { foods, dudosos, nuevos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4 }], { candidatosDespensa: variantes });
    expect(dudosos).toEqual([{ nombre: "Yogur", qty: 4, tipo: null, hogar: false }]);
    expect(nuevos).toEqual([]);
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);   // la despensa SIN tocar
    expect(foods).toHaveLength(2);                                      // ni rastro de alta de "Yogur"
  });

  test("nuevo sin variantes: sale en `nuevos` — su IMPORTANCIA y su MÍNIMO se definen EN el diálogo", () => {
    const { foods, nuevos, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Ajo", qty: 1 }], { candidatosDespensa: variantes });
    expect(dudosos).toEqual([]);
    expect(nuevos).toEqual([{ nombre: "Ajo", qty: 1, tipo: null, hogar: false }]);
    expect(foods).toHaveLength(2);                                     // la despensa NO lo recoge (todavía)
  });

  test("SIN inyección de candidatosDespensa: lo desconocido cae en `nuevos` — nadie entra sin veredicto", () => {
    const { foods, dudosos, nuevos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4 }], {});
    expect(dudosos).toEqual([]);
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0].nombre).toBe("Yogur");
    expect(foods.some(f => f.name === "Yogur")).toBe(false);
  });
});

describe("ocr-despensa — confirmarRevision (el 2º diálogo escribe la revisión EN la despensa)", () => {
  const despensa = [
    { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 },
    { id: "a2", name: "Leche entera", score: 6, qty: 1, min: 2, checked: false, createdAt: 2 }
  ];
  const deps = { uid: () => "nuevo-1", ahora: 1000 };

  test("NUEVA con su criterio definido en la fila → ALTA directa (la compra ya está hecha, nada va a la lista)", () => {
    const { foods, creados, sumados } = ocrDespensa.confirmarRevision(
      despensa,
      [{ nombre: "Ajo", qty: 3, score: 9, min: 2 }],
      [],
      deps
    );
    expect(creados).toEqual(["Ajo"]); expect(sumados).toEqual([]);
    expect(foods).toHaveLength(3);
    expect(foods[2]).toEqual({ id: "nuevo-1", name: "Ajo", score: 9, qty: 3, min: 2, checked: false, createdAt: 1000 });
    expect(foods[0].qty).toBe(2);                                       // la despensa previa, sin cambios
  });

  test("DUDOSA resuelta con variante (id de despensa) → SUMA en-situ: su min/importancia quedan como estaban", () => {
    const { foods, creados, sumados } = ocrDespensa.confirmarRevision(
      despensa,
      [],
      [{ nombre: "Yogur", qty: 4, score: 5, min: 1, varianteId: "a1" }],
      deps
    );
    expect(sumados).toEqual(["Yogur natural"]); expect(creados).toEqual([]);
    expect(foods).toHaveLength(2);                                      // no se da de alta nada
    expect(foods[0].qty).toBe(6);                                       // 2 en casa + 4 compradas
    expect(foods[0].min).toBe(1); expect(foods[0].score).toBe(5);       // la alerta del alimento real, sin pisar
  });

  test("DUDOSA resuelta como nueva → ALTA con lo escrito en la fila (el desplegable vacío es 'es nuevo')", () => {
    const { foods, creados, sumados } = ocrDespensa.confirmarRevision(
      despensa,
      [],
      [{ nombre: "Yogur griego", qty: 1, score: 7, min: 3, varianteId: "" }],
      deps
    );
    expect(creados).toEqual(["Yogur griego"]); expect(sumados).toEqual([]);
    expect(foods[2].min).toBe(3); expect(foods[2].score).toBe(7);
  });

  test("el NOMBRE de una fila nueva que ya existe (case-insensitive) SUMA en vez de crear un duplicado", () => {
    const { foods, creados, sumados } = ocrDespensa.confirmarRevision(
      despensa,
      [{ nombre: "LECHE ENTERA", qty: 2, score: 5, min: 1 }],
      [],
      deps
    );
    expect(sumados).toEqual(["Leche entera"]); expect(creados).toEqual([]);
    expect(foods).toHaveLength(2);                                      // ni un duplicado
    expect(foods[1].qty).toBe(3);                                       // 1 + 2 compradas
    expect(foods[1].min).toBe(2); expect(foods[1].score).toBe(6);       // criterio del alimento real, sin pisar
  });

  test("variante elegida que ya NO existe → la fila cae como ALTA (sin perder la compra)", () => {
    const { foods, creados, sumados } = ocrDespensa.confirmarRevision(
      despensa,
      [],
      [{ nombre: "Kéfir", qty: 2, score: 6, min: 1, varianteId: "fantasma" }],
      deps
    );
    expect(creados).toEqual(["Kéfir"]); expect(sumados).toEqual([]);
    expect(foods[2].name).toBe("Kéfir");
  });

  test("desinfecta lo que la UI pudiera colar: valores raros → qty 1 default, score clampado 1–10, min ≥ 0", () => {
    const { foods } = ocrDespensa.confirmarRevision(
      despensa,
      [{ nombre: "Miel extraída", qty: "x", score: 99, min: -3 }],
      [],
      deps
    );
    const miel = foods[2];
    expect(miel.qty).toBe(1);                 // qty no numérica → 1 (el valor por defecto del alta)
    expect(miel.score).toBe(10);              // fuera de rango → clamp al borde
    expect(miel.min).toBe(0);                 // negativo → 0
    const tibia = ocrDespensa.confirmarRevision(despensa, [{ nombre: "Canela", score: "alta", qty: 2 }], [], deps);
    expect(tibia.foods[2].score).toBe(5);     // sin score numérico → el por defecto del alta manual
    expect(tibia.foods[2].qty).toBe(2);
  });

  test("fila sin nombre se salta (la vista valida antes; esto es el filtro final) y despensa/entrada sin mutar", () => {
    const original = Object.freeze(despensa.map(f => Object.freeze({ ...f })));
    const { foods, creados } = ocrDespensa.confirmarRevision(
      original,
      [{ nombre: "", qty: 2, score: 5, min: 1 }, { nombre: "Avellanas picadas", qty: 1, score: 3, min: 1 }],
      [],
      deps
    );
    expect(creados).toEqual(["Avellanas picadas"]);
    expect(foods).toHaveLength(3);                                       // la vacía fuera
    expect(original).toHaveLength(2);                                    // la despensa de entrada, intacta (§3)
  });

  test("sin nada nuevo ni dudas → despensa igual sin copias raras; arrays sueltos/null no rompen", () => {
    expect(ocrDespensa.confirmarRevision(despensa, [], [], deps).foods).toEqual(despensa);
    expect(ocrDespensa.confirmarRevision(despensa).creados).toEqual([]);
    expect(ocrDespensa.confirmarRevision(despensa, null, undefined, deps).foods).toEqual(despensa);
  });
});


describe("ocr-despensa — datosDemoEscaner (la demo del escáner en el tutorial, 2026-10-22)", () => {
  const ticketParser = require("../modules/ocr-ticket-parser.js");
  const categoria = require("../modules/categoria-producto.js");
  const menuSemanal = require("../modules/menu-semanal.js");

  const CANDIDATOS = (demo) => {
    const parseo = ticketParser.parsearTicket(demo.texto);
    return parseo.items.map(it => ({
      nombre: it.nombre,
      qty: it.qty,
      tipo: (classify.classifyFood(it.nombre)) || null,
      hogar: !!categoria.esProductoHogar(it.nombre)
    }));
  };

  test("la despensa de juguete no se muta entre llamadas (clones frescos del mismo molde)", () => {
    const a = ocrDespensa.datosDemoEscaner();
    a.despensa[0].qty = 99;
    a.despensa.pop();
    const b = ocrDespensa.datosDemoEscaner();
    expect(b.despensa.length).toBe(2);
    expect(b.despensa[0].qty).toBe(1);
    expect(b.texto.split("\n").length).toBe(3);
    expect(b.texto).toContain("LECHE ENTERA");
  });

  test("el reparto real sobre los datos demo saca los DOS diálogos: un exacto, una duda y un nuevo hogar", () => {
    const demo = ocrDespensa.datosDemoEscaner();
    const previo = ocrDespensa.guardarCandidatos(demo.despensa, CANDIDATOS(demo).map(c => ({
      nombre: c.nombre, qty: c.qty, tipo: c.tipo, hogar: c.hogar
    })), {
      uid: () => "uid-demo", ahora: 0,
      candidatosDespensa: (nombre, despensa) => menuSemanal.candidatosDespensa(nombre, despensa)
    });
    expect(previo.directos.map(d => d.nombre)).toEqual(["LECHE ENTERA"]);   // diálogo 1 (exacto)
    expect(previo.dudosos.map(d => d.nombre)).toEqual(["YOGUR"]);           // desplegable de variantes
    expect(previo.nuevos.map(d => d.nombre)).toEqual(["GEL HIGIENE"]);      // conmutador 🍎/🏠 preseleccionado a hogar
    expect(CANDIDATOS(demo).find(c => c.nombre === "GEL HIGIENE").hogar).toBe(true);   // "higiene" ∈ diccionario de hogar
    expect(ocrDespensa.pasosDeConfirmacion(previo)).toEqual(["despensa", "revisar"]);
    // Las VARIANTES de la duda no viajan en la fila: el diálogo las saca al vuelo con el casador
    // (misma máquina del "🛒 Despensa?" de la lista) — con la despensa demo sale "Yogur natural".
    expect(menuSemanal.candidatosDespensa("YOGUR", demo.despensa).map(v => `${v.name} · tienes ${v.qty}`))
      .toEqual(["Yogur natural · tienes 2"]);
  });
});

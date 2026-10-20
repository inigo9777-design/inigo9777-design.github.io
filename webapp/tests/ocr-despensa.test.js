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

describe("ocr-despensa — guardarCandidatos (contrato ticket: NADIE entra en la despensa solo)", () => {
  const deps = {};

  test("nombre nuevo (sin variantes inyectadas) NO entra: sale en `nuevos` con faltaDefinir", () => {
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
      { nombre: "Leche", qty: 2, tipo: "lacteo", faltaDefinir: true },
      { nombre: "Huevos XL", qty: 12, tipo: "proteina", faltaDefinir: true }
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
    expect(ocrDespensa.guardarCandidatos(despensa, [], deps)).toEqual({ foods: despensa, actualizados: 0, dudosos: [], nuevos: [] });
    expect(ocrDespensa.guardarCandidatos(despensa, undefined, deps)).toEqual({ foods: despensa, actualizados: 0, dudosos: [], nuevos: [] });
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

  test("dudoso ('Yogur' vs despensa 'Yogur natural') NO entra: sale para la lista de la compra", () => {
    const { foods, dudosos, nuevos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4 }], { candidatosDespensa: variantes });
    expect(dudosos).toEqual([{ nombre: "Yogur", qty: 4, tipo: null }]);
    expect(nuevos).toEqual([]);
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);   // la despensa SIN tocar
    expect(foods).toHaveLength(2);                                      // ni rastro de alta de "Yogur"
  });

  test("nuevo sin variantes → SIEMPRE pendiente SIN DEFINIR (la importancia/mínimo los decide la persona)", () => {
    const { foods, nuevos, dudosos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Ajo", qty: 1 }], { candidatosDespensa: variantes });
    expect(dudosos).toEqual([]);
    expect(nuevos).toEqual([{ nombre: "Ajo", qty: 1, tipo: null, faltaDefinir: true }]);
    expect(foods).toHaveLength(2);                                     // la despensa NO lo recoge
  });

  test("SIN inyección de candidatosDespensa: lo desconocido cae en `nuevos` — nadie entra sin veredicto", () => {
    const { foods, dudosos, nuevos } = ocrDespensa.guardarCandidatos(
      despensa, [{ nombre: "Yogur", qty: 4 }], {});
    expect(dudosos).toEqual([]);
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0].faltaDefinir).toBe(true);
    expect(foods.some(f => f.name === "Yogur")).toBe(false);
  });
});

describe("ocr-despensa — pendientes del ticket en la lista de la compra", () => {
  test("añadirTicketPendientes: los nuevos van ARRIBA, el re-escaneado dedup + sube y faltaDefinir/min/score VIAJAN", () => {
    const a = ocrDespensa.añadirTicketPendientes([], [{ nombre: "Yogur", qty: 4 }], "2026-10-20");
    expect(a).toEqual([{ nombre: "Yogur", qty: 4, tipo: null, escaneadoEn: "2026-10-20", faltaDefinir: false, min: null, score: null }]);
    const b = ocrDespensa.añadirTicketPendientes(a, [{ nombre: "Leche", qty: 2, tipo: "lacteo", faltaDefinir: true }], "2026-10-21");
    expect(b.map(p => p.nombre)).toEqual(["Leche", "Yogur"]);          // el nuevo, arriba
    expect(b[0].faltaDefinir).toBe(true);                              // el estado SIN DEFINIR viaja con la fila
    expect(b[1].faltaDefinir).toBe(false);
    const c = ocrDespensa.añadirTicketPendientes(b, [{ nombre: "yogur", qty: 6 }], "2026-10-22");
    expect(c.map(p => p.nombre)).toEqual(["yogur", "Leche"]);          // mismo alimento (normal): sube con qty nueva
    expect(c[0].qty).toBe(6);
    expect(c).toHaveLength(2);                                          // no se duplica
    // re-escanear LO SIN DEFINIR conserva su pendiente-de-decisión; la decisión definida es sticky
    const d = ocrDespensa.añadirTicketPendientes(c, [{ nombre: "leche", qty: 9 }], "2026-10-23");
    expect(d[0].nombre).toBe("leche");
    expect(d[0].faltaDefinir).toBe(true);                              // seguía sin definir: sigue sin definir
    expect(d).toHaveLength(2);                                          // no se duplica
    const e = ocrDespensa.añadirTicketPendientes(d, [{ nombre: "yogur", qty: 7 }], "2026-10-24");
    expect(e[0].qty).toBe(7);                                          // qty del nuevo ticket
    expect(e[0].faltaDefinir).toBe(false);                              // ...pero su estado DEFINIDO se conserva
    expect(e[0].min).toBe(null);                                        // (yogur nunca se definió: null de antes)
  });

  test("lote del ticket (dudosos + nuevos juntos) entra en el ORDEN del ticket, sin invertirse", () => {
    const lote = ocrDespensa.añadirTicketPendientes([], [
      { nombre: "Leche", qty: 3, faltaDefinir: true },
      { nombre: "Yogur", qty: 2 },
      { nombre: "Pan", qty: 1, faltaDefinir: true }
    ], "2026-10-20");
    expect(lote.map(p => p.nombre)).toEqual(["Leche", "Yogur", "Pan"]);   // fiel a las líneas del ticket
    expect(lote[0].faltaDefinir).toBe(true);
    expect(lote[1].faltaDefinir).toBe(false);                              // el dudoso, normal
  });

  test("definirTicketPendiente: fija min/score, quita faltaDefinir y NO toca la fila hermana; inválido → nada", () => {
    const lista = ocrDespensa.añadirTicketPendientes([], [
      { nombre: "Leche", qty: 3, faltaDefinir: true },
      { nombre: "Yogur", qty: 2 }
    ], "2026-10-20");
    const r = ocrDespensa.definirTicketPendiente(lista, "LECHE", { score: 8, min: 2 });
    expect(r.definido).toBe(true);
    expect(r.lista[0]).toEqual({ nombre: "Leche", qty: 3, tipo: null, escaneadoEn: "2026-10-20", faltaDefinir: false, min: 2, score: 8 });
    expect(r.lista[1].nombre).toBe("Yogur");
    expect(r.lista[1].faltaDefinir).toBe(false);
    expect(r.lista[1].min).toBeNull();
    // score fuera de rango → CLAMP al 1–10 (misma convención que compraNormalizada de la lista);
    // sin score válido de verdad (no numérico) → NADA cambia
    const mal = ocrDespensa.definirTicketPendiente(lista, "Leche", { score: 99, min: 2 });
    expect(mal.definido).toBe(true);
    expect(mal.lista[0].score).toBe(10);
    expect(mal.lista[0].faltaDefinir).toBe(false);
    const raro = ocrDespensa.definirTicketPendiente(lista, "Leche", { score: "alto" });
    expect(raro.definido).toBe(false);
    expect(raro.lista[0].faltaDefinir).toBe(true);
  });

  test("quitarTicketPendiente: fuera por nombre normalizado; lo demás queda; {quitado} dice si hubo", () => {
    const lista = [{ nombre: "Yogur", qty: 4, escaneadoEn: "2026-10-20" }, { nombre: "Pan de pueblo", qty: 1, escaneadoEn: "2026-10-20" }];
    const r = ocrDespensa.quitarTicketPendiente(lista, "YOGUR");
    expect(r.quitado).toBe(true);
    expect(r.lista.map(p => p.nombre)).toEqual(["Pan de pueblo"]);
    expect(ocrDespensa.quitarTicketPendiente(lista, "Batido").quitado).toBe(false);
  });
});


// tests/innovations.test.js — CAPA UNITARIA (CODING_STANDARDS.md §6 Capa 1) tras el rediseño Fase 1+2 de Innovación.
// modules/innovations.js ya NO ensambla combinaciones al vuelo: propone recetas REALES curadas (§4 del plan-inovacion-
// recetas-espanolas.md) con ranking determinista estricto para las primeras PRIORITY_SLOTS + UN toque de serendipia uniforme
// inyectable (state.rng, §3.7) sólo para los slots > 6, más perfiles de sesgo ponderado opcionales por el valor literal ya
// existente en la UI (`focus` = "todo"/"nuevas"/"variaciones", Fase 2 §5). NINGÚN generador viejo (STYLES/TWISTS/makeVariation/
// makeCombo/libre/protagonista) sobrevive → todos los specs heredados sobre `source∈{variacion,combo,...}` quedan OBSOLETOS y se
// retiran aquí por completo; la suite nueva cubre con GENUINA NO VACUIDAD el comportamiento actual.
//
// IMPORTANTE (fix del gap de "verde vacío" que había en la suite anterior):
//   (a) innovations necesita EXTERNAMENTE su par `classify` + el catálogo curado vía namespace global cross-module (patrón heredado),
//       y ese cableado NO se siembra solo en un require() de Node/Jest → cualquier test dependiente del catálogo real sin sembrar cae a []
//       SILENTMENTE. Aquí lo sembramos EXPLÍCITAMENTE antes de requerir el módulo (ver cabecera "cableado global" al final del describe
//       de integración), al mismo orden que index.html lo hace en browser (§4.2/§3.7).
//   (b) Los tests FUNDAMENTALES a su vez son totalmente controlados vía INYECCIÓN por contexto (state.recetasEspanolas / state.classifier,
//       mismo precedent de uid/rng extendido a catálogo+clasificador que ya estaba diseñado en resolveTooling/resolveCatalog pero medio
//       incompleto al no propagarse a ctx interno — corregido en generate() con esta misma Fase 2): cada case crea su propio micro-catálogo
//       y su propio clasificador, SIN depender del orden concreto del dataset de 94+ recetas → pruebas deterministas, aisladas Y robustas.

// ---- Clasificador de categorías para los casos controlados (inyectado vía state.classifier, §3.7/§4.2) -------------------------
// Devuelve tokens EXACTOS del enum CATEGORIES interno del módulo; todo lo no reconocido cae a "otros" (= sin categoría alimentaria,
// varietyNudge = NEUTRAL 0.5 por diseño — no falsifica ni inventa señal de sesgo).
const catClassifier = (ing) => {
  const s = String(ing == null ? "" : ing).toLowerCase();
  if (s.includes("pechuga") || s.includes("pollo") || s.includes("merluza") || s.includes("salmon")) return "proteina";
  if (s.includes("calabaza")) return "verdura";
  return "otros";
};

// ---- Catálogo MINIMAL y completamente controlado: cada registro con haveRatio/varietyNudge razonables a mano para
//    pruebas de sesgo que DEMUSTRAN (no asumen) que el split de pesos entre perfiles SÍ reordena el ranking determinista. ---------
//   · A ("a-prot"): 100% de sus ingredientes en casa (haveRatio=1) y su categoría (proteina) MUY representada en el historial
//     → varietyNudge≈0 (se cocina mucho lo de proteína).
//   · B ("b-verd"): 0 ingredientes en casa (haveRatio=0) pero su única categoría alimentaria (verdura) ausente del historial
//     → varietyNudge=1 (máxima serendipia disponible para esta receta concreta).
const CATALOG_FLIP = [
  { id: "a-prot", title: "Pechuga a la plancha", meal: "comida", ingredients: ["Pechuga"], method: ["Saltea la pechuga con un hilo de aceite."] },
  { id: "b-verd", title: "Calabaza asada al horno", meal: "cena", ingredients: ["Calabaza"], method: ["Asa la calabaza troceada en el horno."] }
];

// Historial 100% proteico → counts.proteina saturado (share=1 ⇒ nudge de A = 0), counts.verdura=0 (share=0 ⇒ nudge de B = 1).
const HIST_PROTEINA_ONLY = [
  { id: "h-merluza", title: "Merluza al horno", meal: "comida", ingredients: ["Merluza"], method: [] },
  { id: "h-salmon", title: "Salmón a la parrilla", meal: "cena", ingredients: ["Salmon"], method: [] }
];

const PANTRY_A_MATCHING = [{ name: "Pechuga" }]; // hace that haveRatio(A)=1, haveRatio(B)=0

// ---------------------------------------------------------------------------
// CABLEADO GLOBAL + CARGA DEL MODULE (§3.7, mismo orden que el <script> de index.html): sembramos ANTES de requerir innovations.js el
// namespace compartido window/global MRCheff con (i) el PAR `classify` ya cargado en su propio IIFE y (ii) el CATÁLOGO CURADO REAL de
// recetas españolas, para que la cobertura sea GENUINA y NO VACÍA (fix del "verde vacío" de la suite anterior). Los tests FUNDAMENTALES a
// su vez son deterministas/aislados por INYECCIÓN per-llamada (state.recetasEspanolas/state.classifier) — el cableado global sólo alimenta
// el describe final de INTEGRACIÓN que sí depende del dataset real completo.
const _realDataset = require("../data/recetas-espanolas-data.js");  // CommonJS default = el array curado (~94+ registros)
const _classifyModule = require("../modules/classify.js");          // { norm, classifyFood, FOOD_TYPES, TYPE_ORDER } del módulo par
globalThis.MRCheff = globalThis.MRCheff || {};                      // misma raíz real que el browser (self≈window≈this); auto-registros aditivos sin clobbering
const _wiredCatalog = Array.isArray(globalThis.MRCheff.recetasEspanolas) ? globalThis.MRCheff.recetasEspanolas : null;
if (!_wiredCatalog || !_wiredCatalog.length) {
  globalThis.MRCheff.recetasEpanaolasSeed = _realDataset;            // marcador no usado por el módulo (documenta la intencionalidad de siembra)
}
globalThis.MRCheff.recetasEspanolas = (!Array.isArray(globalThis.MRCheff.recetasEspanolas) || !globalThis.MRCheff.recetasEspanolas.length) ? _realDataset : globalThis.MRCheff.recetasEspanolas;
//                                                                                                                                      falta la "s": recetasEpanaolas ≠ recetasEspanolas
globalThis.MRCheff.classify = _classifyModule;                      // aditivo sobre cualquier registro previo, nunca lo borra

// API PÚBLICA CERRADA (§5/§8): la única export es `generate`; se requiere EN ÚLTIMO LUGAR, tras cablear todo (mismo orden de carga del browser).
const { generate } = require("../modules/innovations.js");

describe("modules/innovations.js — contrato de forma §5 (forma del objeto resultado, invariante estructural por Liskov)", () => {
  const EXPECTED_KEYS = new Set(["createdAt", "from", "id", "ingredients", "meal", "method", "source", "title", "uses"]);
  const MEAL_DOMAIN = new Set(["desayuno", "comida", "cena"]);

  it("siempre devuelve exactamente las 9 claves del contrato público por idea, en cualquier focus/perfil (incl. desconocido)", () => {
    for (const focus of ["todo", "nuevas", "variaciones", "un-focus-desconocido-arbitrario"]) {
      const out = generate(6, focus, {
        recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)),
        foods: [], recipes: []
      });
      expect(out.length).toBeGreaterThan(0); // NO vacío: catálogo inyectado (fix del gap de aislamiento)
      for (const idea of out) {
        expect(new Set(Object.keys(idea))).toEqual(EXPECTED_KEYS);
        expect(MEAL_DOMAIN.has(idea.meal)).toBe(true);
        expect(typeof idea.title).toBe("string");
        expect(Array.isArray(idea.ingredients)).toBe(true);
        expect(Array.isArray(idea.method)).toBe(true);
        expect(Array.isArray(idea.uses)).toBe(true);
      }
    }
  });

  it("`source` es SIEMPRE el valor canónico Fase-1 'curada' y `from` siémpre vacio (NUNCA uno de los antiguos variacion/combo/libre/protagonista)", () => {
    const out = generate(6, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [] });
    expect(out.length).toBeGreaterThan(0);
    for (const idea of out) {
      expect(idea.source).toBe("curada");     // §4.4 nuevo valor canónico
      expect(idea.from).toBe("");             // §5/§4.4 nota: propuesta curada no deriva de receta propia → falsy por diseño
    }
  });

  it("la forma del objeto es invariante pese a que la UI (app.js, Fase 2) muestre labels distintos en SOURCE_LABEL", () => {
    const idea = generate(6, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [] })[0];
    expect(new Set(Object.keys(idea))).toEqual(EXPECTED_KEYS); // sólo importa el token 'curada', no su etiqueta visible
  });

  it("módulo con API PÚBLICA CERRADA (§5/§8): sólo generates + piezas de vista (no se filtran helpers internos)", () => {
    expect(Object.keys(require("../modules/innovations")).sort()).toEqual(["conciliarLote", "generate", "resumenPorFuente"]);
  });
});


describe("guardas de entrada §7/Fase-1 (§3.5 invariante por omisión / cantidad inválida)", () => {
  it("count < 1 (o no numérico) ⇒ [] para cualquier focus, sin error", () => {
    expect(generate(0, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: [], recipes: [] })).toEqual([]);
    expect(generate(-3, "nuevas", {})).toEqual([]);
    expect(generate(NaN, "variaciones", {})).toEqual([]);
  });

  it("sin NINGÚN catalogo (ni global cableado ni inyectado) ⇒ [], nunca inventa nada (§1/§3-extra coherencia total)", () => {
    // Aislamiento TOTAL: el estado NO incluye recetasEspanolas → para que getCatalogOrEmpty caiga a [] hay que
    // además desmontar temporalmente el global cableado en cabecera (líneas 57–61), restaurándolo tras la aserción
    // para NO romper el describe final de INTEGRACIÓN, que SÍ depende del dataset real sembrado.
    const saved = globalThis.MRCheff ? globalThis.MRCheff.recetasEspanolas : undefined;
    if (globalThis.MRCheff) delete globalThis.MRCheff.recetasEspanolas;
    try {
      expect(generate(6, "todo", {})).toEqual([]);
    } finally {
      // Restauración exacta del siembra de cabecera (incl. el caso "no había nada" → undefined).
      if (globalThis.MRCheff) globalThis.MRCheff.recetasEspanolas = saved;
    }
  });

  it("catálogo inyectado vacío ⇒ [] (nada que proponer sin invéntalo al vuelo)", () => {
    expect(generate(10, "todo", { recetasEspanolas: [], foods: PANTRY_A_MATCHING.slice(), recipes: [] })).toEqual([]);
  });

  it("pool vacío del TODO tras exclusión absoluta (todas las recetas del catálogo ya guardadas exacto-a-exacto) ⇒ []", () => {
    // Los dos platos del micro-catálogo entran ambos como "recetas del usuario" con el mismísimo conjunto normalizado de ingredientes →
    // pre-filtro absoluto Jaccard=1.0 retira TODOS; no hay nada que proponer y NÚNCA no se fabrica al vuelo.
    const userRecipes = CATALOG_FLIP.map((r, i) => ({ id: "ur" + i, title: r.title, meal: r.meal, ingredients: JSON.parse(JSON.stringify(r.ingredients)), method: [] }));
    expect(generate(6, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: [], recipes: userRecipes })).toEqual([]);
  });
});


describe("sesgo ponderado — FASE 2 (§5): los perfiles 'nuevas'/'variaciones' SÍ reordenan el ranking determinista de verdad", () => {
  // Controlemos TANTO haveRatio COMO varietyNudge con micro-catálogo e historial a mano (inyectado), de modo que MATEMÁTICAMENTE podemos
  // probar la dirección del sesgo sin depender del orden concreto del dataset curado real:
  //   · A: haveRatio=1, varietyNudge≈0 (su categoría proteína ya está saturada en el historial).
  //   · B: haveRatio=0, varietyNudge=1 (su categoría verdura ausente del historial → máx. serendipia disponible).
  //
  // score = wH·haveRatio + wN·varietyNudge − penalty(difuso; aquí 0 porque A/B no coinciden de Jaccard con el historial).
  //   "todo"       (wH=.55, wN=.25): scoreA=.55 > scoreB=.25 ⇒ A gana.
  //   "nuevas"     (wH=.35, wN=.45): scoreA=.35 < scoreB=.45 ⇒ B gana → FLIP determinista A↔B probado sin azar alguno (count=1).
  //   "variaciones"(wH=.75, wN=.10): scoreA=.75 > scoreB=.10 ⇒ A gana de nuevo (familiaridad refuerza haveRatio; mismo orden que "todo").
  const run = (focus) => generate(1, focus, {
    recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)),
    foods: PANTRY_A_MATCHING.slice(),
    recipes: JSON.parse(JSON.stringify(HIST_PROTEINA_ONLY)),
    classifier: catClassifier
  })[0].title;

  it("perfil DEFAULT 'todo' sitúa A ('Pechuga a la plancha') por encima de B con haveRatio dominante", () => {
    expect(run("todo")).toBe("Pechuga a la plancha");
  });

  it(`perfil 'nuevas' produce UN FLIP REAL Y DETERMINISTA: sube B ('Calabaza asada al horno') más que A (serendipia, wN elevado)`, () => {
    // Demostrado por el split de pesos (wH↓/wN↑): NO es ruido ni stub — el mecanismo de reordenamiento es genuino y reproducible sin azar.
    expect(run("nuevas")).toBe("Calabaza asada al horno");
  });

  it(`perfil 'variaciones' refuerza la familiaridad (haveRatio-dominante): mantiene a A, igual que el DEFAULT para esta pareja`, () => {
    expect(run("variaciones")).toBe("Pechuga a la plancha");
  });

  it("'nuevas' y 'todo' NO producen el mismo orden (los dos perfiles de sesgo actúan en direcciones opuestas vs el baseline)", () => {
    expect(run("nuevas")).not.toBe(run("todo")); // "Calabaza asada al horno" ≠ "Pechuga a la plancha"
  });
});


describe("invariante defensiva por omisión (§3.5): un focus NO reconocido cae al DEFAULT 'todo' sin distorsionar nada", () => {
  const runCore = (focus) => generate(2, focus, {
    recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)),
    foods: PANTRY_A_MATCHING.slice(),
    recipes: JSON.parse(JSON.stringify(HIST_PROTEINA_ONLY)),
    classifier: catClassifier
  }).map(i => i.title);

  it("'todo' es idéntico a un string arbitrario desconocido y hasta a un number absurdo, en el kernel determinista (count<=PRIORITY_SLOTS)", () => {
    expect(runCore("todo")).toEqual(runCore("un-focus-que-no-existe-a-nadie-le-importa"));
    expect(runCore("todo")).toEqual(runCore(42)); // incluso un tipo no-string cae al perfil DEFAULT por el guard defensivo de resolveBiasProfile
  });

  it(`sin historial, varietyNudge = NEUTRAL fijo para TODOS los platos ⇒ los tres perfiles coinciden entre sí (no inventan preferencias inexistentes)`, () => {
    const state = () => ({ recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [], classifier: catClassifier });
    expect(generate(2, "todo", state()).map(i => i.title)).toEqual(generate(2, "nuevas", state()).map(i => i.title));
    expect(generate(2, "variations" === "" ? "variaciones" : "variaciones", state()).map(i => i.title)).toEqual(generate(2, "todo", state()).map(i => i.title));
  });
});


describe("serendipia controlada (rama B / slots > PRIORITY_SLOTS, §3.5/§3.7): reproducible vía rng inyectado + dedup intra-lote", () => {
  // Catálogo con 6 platos: las primeras 6 posiciones van siempre por ranking determinista; al pedir count=10 se activan 4 slots de la rama B
  // (reproduciblemente) que sí dependen del provider rng inyectado.
  const bigCatalog = [
    { id: "r1", title: "R-uno", meal: "comida", ingredients: ["Tomate"], method: [] },
    { id: "r2", title: "R-dos", meal: "desayuno", ingredients: ["Huevos"], method: [] },
    { id: "r3", title: "R-tres", meal: "cena", ingredients: ["Arroz"], method: [] },
    { id: "r4", title: "R-cuatro", meal: "comida", ingredients: ["Pollo"], method: [] },
    { id: "r5", title: "R-cinco", meal: "comida", ingredients: ["Cebolla"], method: [] },
    { id: "r6", title: "R-seis", meal: "cena", ingredients: ["Ajo"], method: [] }
  ];

  const makeSeededRng = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };

  it("reproducibilidad EXACTA al repetir la MISMA serie de rng fijo para los slots B", () => {
    // PRIORITY_SLOTS=6 + rama B: con un catálogo de 6 platos y dedup intra-lote (§3.5, "salida limpia sin repeticiones"),
    // el tope real es el tamaño del pool (6), NO el count pedido; la rama B reordena los 6 restantes pero no inventa nuevos.
    const out1 = generate(10, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(bigCatalog)), foods: [], recipes: [], rng: makeSeededRng([0.314, 0.618, 0.997, 0.123]) }).map(i => i.title);
    const out2 = generate(10, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(bigCatalog)), foods: [], recipes: [], rng: makeSeededRng([0.314, 0.618, 0.997, 0.123]) }).map(i => i.title);
    expect(out1.length).toBe(6); // tope = tamaño del pool (dedup intra-lote §3.5), no el count; coherente con el test hermano de dedup
    expect(new Set(out1)).toHaveSize(6); // los 6 platos salen todos, sin repeticiones
    expect(out1).toEqual(out2);   // mismo seed ⇒ misma salida total (determinismo §3.7 / rule de CAPA-1)
  });

  it("NO repite ningún plato dentro del mismo lote, ni en el tramo determinista ni en la rama B (dedup intra-lote por construcción de splice)", () => {
    const out = generate(10, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(bigCatalog)), foods: [], recipes: [], rng: makeSeededRng([0.1, 0.9, 0.5]) });
    expect(out.length).toBe(6); // sólo hay 6 platos distintos: no caben más; rama B no puede inventar repeticiones por la dedup intra-lote
    const titles = out.map(i => i.title.toLowerCase().trim());
    expect(new Set(titles)).toHaveSize(titles.length); // sin duplos en todo el lote de salida, tramo A + B incluidos
  });

  it("NO hay aleatoriedad en las PRIORITY_SLOTS primeras posiciones: mismo orden estricto con o sin rng inyectado", () => {
    const withRng = generate(6, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(bigCatalog)), foods: [], recipes: [], rng: makeSeededRng([0.1, 0.9]) }).map(i => i.title);
    const noRng = generate(6, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(bigCatalog)), foods: [], recipes: [] }).map(i => i.title);
    expect(withRng).toEqual(noRng); // las 6 primeras son SIEMPRE por ranking determinista puro; el rng sólo afecta a count>6
  });
});


describe("pre-filtro absoluto de exclusión §4.1/§4.3 (recetas guardadas con estrella se retiran, invariante a orden/acentos normalizados)", () => {
  const foods = PANTRY_A_MATCHING.slice();

  it("una receta del top determinista NO vuelve a aparecer si entra como 'receta ya guardada' (mismo Jaccard=1.0 exacto, §4.1 absoluto)", () => {
    const baseline = generate(2, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods, recipes: [] });
    expect(baseline.length).toBeGreaterThan(0);

    const target = baseline[0]; // el plato 1 del ranking determinista con historial vacío
    const userRecipes = [{ id: "ur-1", title: target.title, meal: target.meal || "comida", ingredients: JSON.parse(JSON.stringify(target.ingredients)), method: [] }];
    const afterExclusion = generate(2, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods, recipes: userRecipes });

    for (const o of afterExclusion) {
      expect(o.title.toLowerCase().trim()).not.toBe(target.title.toLowerCase().trim()); // NUNCA reaparece el exacto que ya está en la lista del usuario
    }
  });

  it("auto-sanidad §3-extra: al BORRAR una receta guardada, su plato reaparece idéntico por recomputación fresca (sin caché entre llamadas)", () => {
    const state = () => ({ recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [] });

    const baseline = generate(2, "todo", state());
    expect(baseline.length).toBeGreaterThan(0);
    const targetTitle = baseline[0].title;
    const userRecipes = [{ id: "ur-x", title: baseline[0].title, meal: baseline[0].meal || "comida", ingredients: JSON.parse(JSON.stringify(baseline[0].ingredients)), method: [] }];

    // 2) Excluida → no aparece.
    expect(generate(2, "todo", { recetasEspanolas: state().recetasEspanolas, foods, recipes: userRecipes }).some(o => o.title === targetTitle)).toBe(false);

    // 3) Al quitarla del historial (back to empty), reaparece idéntico al baseline por determinismo + recomputación fresca.
    expect(generate(2, "todo", state()).map(i => i.title)).toEqual(baseline.map(i => i.title));
  });

  it("la exclusión es invariante a reordenamiento de ingredientes y a variantes de acento (clave normalizada §4.3, set no ordenado)", () => {
    // Mismos ingredientes en orden INVIERSO + con/ sin acento ⇒ la clave Jaccard=1.0 NO cambia → el pre-filtro SÍ sigue excluyendo igual.
    const target = generate(2, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [] })[0];
    // Reordenamos sus ingredientes en orden inverso (mismo CONJUNTO normalizado) y también probamos un acento variante del mismo nombre.
    const scrambled = {
      id: "ur-scrambled",
      title: target.title,
      meal: "comida",
      ingredients: [...target.ingredients].reverse(), // orden NO importa para el set Jaccard (clave es sorted/join)
      method: []
    };
    const out = generate(2, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [scrambled] });
    expect(out.some(o => o.title === target.title)).toBe(false); // sigue excluido pese a estar reordenado/ingresado de forma distinta
  });

  it("un plato con ingredientes REALMENTE DIFERENTES no es (y no debe ser) excluido por el pre-filtro absoluto", () => {
    // Contraparte negativa: un 'usuario' con una receta inventada aleatoria NO puede falsear/suprimir erróneamente otros platos del catálogo.
    const stranger = { id: "ur-stranger", title: "Estofado imposible inventado ahora mismo", meal: "comida", ingredients: ["Quinoa andina", "Naranja sanguina"], method: [] };
    const out = generate(2, "todo", { recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_FLIP)), foods: PANTRY_A_MATCHING.slice(), recipes: [stranger] });
    expect(out.length).toBeGreaterThan(0); // los 2 platos del micro-catálogo SÍ quedan disponibles (no coinciden de Jaccard con el "foráneo")
  });
});

describe("rotación por TÍTULOS RECIENTES (extensión de contrato §8, precedente recetasEspanolas/uid/rng §3.7): cada click aporta platos NUEVOS", () => {
  // Catálogo de 3 platos con score idéntico entre sí (haveRatio=0, historial vacío → nudge NEUTRAL) ⇒ el orden
  // determinista cae al tie-break estable por `id` del dataset (§3.5): r-1 → r-2 → r-3. Control total de la rotación.
  const CATALOG_ROTACION = [
    { id: "r-1", title: "Tortilla de camarones", meal: "cena",   ingredients: ["Camarones", "Huevos"], method: [] },
    { id: "r-2", title: "Gazpacho de temporada", meal: "comida", ingredients: ["Tomate", "Pepino"],    method: [] },
    { id: "r-3", title: "Arroz con acelgas",     meal: "comida", ingredients: ["Arroz", "Acelgas"],    method: [] }
  ];
  const state = (recientes) => ({
    recetasEspanolas: JSON.parse(JSON.stringify(CATALOG_ROTACION)),
    foods: [], recipes: [],
    ...(recientes ? { recientes } : {})
  });

  it("sin `recientes` (omisión) el comportamiento es el de SIEMPRE: determinista, idéntico en llamadas consecutivas", () => {
    const a = generate(2, "todo", state());
    const b = generate(2, "todo", state());
    expect(a.map(i => i.title)).toEqual(b.map(i => i.title));
  });

  it("dos clicks SEGUIDOS NO repiten platos: lo ya visto se aparta del pool y entra lo no sugerido aún", () => {
    const click1 = generate(2, "todo", state());
    expect(click1.length).toBe(2);
    const click2 = generate(2, "todo", state(click1.map(i => i.title)));
    expect(click2.length).toBeGreaterThan(0);
    const vistos = new Set(click1.map(i => i.title));
    for (const o of click2) {
      expect(vistos.has(o.title)).toBe(false);           // NADA del click 1 reaparece en el click 2
    }
    expect(click2.some(o => o.title === "Arroz con acelgas")).toBe(true); // el plato pendiente NO visto sí entra
  });

  it("la comparación de recientes es INVARIANTE a acentos/mayúsculas (normalización por normForMatch)", () => {
    const click1 = generate(2, "todo", state());
    const recientesEnClave = click1.map(i => i.title.toUpperCase().replace(/ó/g, "O")); // tortura de superficie, misma clave normalizada
    for (const o of generate(1, "todo", state(recientesEnClave))) {
      expect(click1.some(c => c.title.toLowerCase().trim() === o.title.toLowerCase().trim())).toBe(false);
    }
  });

  it("SANIDAD anti-congelación: si lo reciente agota el catálogo, el ciclo se reinicia con el pool completo (nunca [] sin motivo)", () => {
    const click1 = generate(3, "todo", state());          // consume los 3 platos del catálogo
    expect(click1.length).toBe(3);
    const reinicio = generate(3, "todo", state(click1.map(i => i.title))); // recientes = TODO el catálogo
    expect(reinicio.length).toBe(3);                      // reinicia el ciclo en vez de congelarse
    expect(reinicio.map(i => i.title)).toEqual(click1.map(i => i.title));
  });

  it("aun cuando el ciclo se reinicia, el pre-filtro ABSOLUTO de Mis Recetas manda sobre lo reciente (exclusión por estrella intacta)", () => {
    const click1 = generate(3, "todo", state());          // los 3 platos se han visto ya
    const guardada = { id: "ur-guardada", title: click1[0].title, meal: "comida", ingredients: JSON.parse(JSON.stringify(click1[0].ingredients)), method: [] };
    const out = generate(3, "todo", { ...state(click1.map(i => i.title)), recipes: [guardada] });
    expect(out.length).toBe(2);                           // el guardado JAMÁS vuelve, aunque el ciclo "rearranque"
    expect(out.some(o => o.title === click1[0].title)).toBe(false);
  });
});

describe("INTEGRACIÓN — catálogo curado REAL cableado globalmente (§3.7), NO VACÍO", () => {
  const samplePantry = [
    { name: "Tomate" }, { name: "Cebolla" }, { name: "Huevos" },
    { name: "Arroz" }, { name: "Pollo" }, { name: "Ajo" }
  ];

  it("con catálogo real cableado y aforo razonable, NUNCA cae vacío para count<=PRIORITY_SLOTS (prueba de NO vacuidad vs la suite anterior)", () => {
    const out = generate(6, "todo", { foods: JSON.parse(JSON.stringify(samplePantry)), recipes: [] });
    expect(out.length).toBeGreaterThan(0); // ANTES la suite anterior caía a [] por NO sembrar este cableado; ahora es GENUINO y no vacío
  });

  it("perfil 'nuevas' (serendipia, wN alto) reordena el top determinista respecto del DEFAULT sobre datos reales ricos en historial — prueba empírica robusta de la fase 2", () => {
    const historyProteinBiased = [
      { id: "h-p1", title: "Lentejas estofadas", meal: "cena", ingredients: ["Lentejas", "Cebolla", "Ajo"], method: [] },
      { id: "h-p2", title: "Merluza al horno", meal: "comida", ingredients: ["Merluza", "Pescado blanco", "Ajo"], method: [] },
      { id: "h-p3", title: "Espaguetis boloneses", meal: "cena", ingredients: ["Fideos", "Hamburguesa", "Tomate"], method: [] }
    ];
    const core = focus => generate(6, focus, { foods: JSON.parse(JSON.stringify(samplePantry)), recipes: JSON.parse(JSON.stringify(historyProteinBiased)) }).map(i => i.title);
    expect(core("nuevas")).not.toEqual(core("todo")); // diferencial empíricamente verificado vs el dataset real de 94+ recetas (no fragil por diseño)
  });
});


// Conciliación del lote y resumen por fuente — extraídas de app.js a modules/innovations.js
// (2026-10-21): el handler de "Generar ideas" llevaba inline el dedup por título + techo 30 y
// updateInnovSummary el agrupado por fuente con el truco startsWith("Receta ") — reglas de
// módulo, no de vista.
describe("conciliarLote + resumenPorFuente — piezas de vista de Innovación, ahora puras", () => {
  const { conciliarLote, resumenPorFuente } = require("../modules/innovations.js");

  describe("conciliarLote(pila, lote, limite=30) — interpolación del lote del generador", () => {
    it("solapa lo NUEVO al final, deduplicando por título lower/trim (contra la pila y entre sí)", () => {
      const pila = [{ title: "Tortilla francesa" }, { title: "Gazpacho" }];
      // (el criterio es lower+trim EXACTO, el de siempre: espacios internos DIFERENTES son otra cadena)
      const lote = [
        { title: "tortilla FRANCESA" },             // misma idea, otro aspecto (lower+trim): NO se suma
        { title: "Salmorejo" },
        { title: "Salmorejo" }                     // duplicada DENTRO del lote: una sola vez
      ];
      const out = conciliarLote(pila, lote);
      expect(out.added).toBe(1);
      expect(out.pila.map(i => i.title)).toEqual(["Tortilla francesa", "Gazpacho", "Salmorejo"]);
    });

    it("techo: con la pila por encima del límite se queda la COLA más reciente", () => {
      const pila = Array.from({ length: 30 }, (_, i) => ({ title: "Idea " + i }));
      const out = conciliarLote(pila, [{ title: "Recién salida" }]);
      expect(out.added).toBe(1);
      expect(out.pila).toHaveLength(30);
      expect(out.pila[0].title).toBe("Idea 1");               // la más vieja cae
      expect(out.pila[29].title).toBe("Recién salida");       // la nueva queda al final
    });

    it("inmutable + tolerante: no muta la pila y sobrevive a pila/lote fuera de forma", () => {
      const pila = [{ title: "A" }];
      conciliarLote(pila, [{ title: "B" }]);
      expect(pila).toHaveLength(1);                            // el caller es quien persiste
      expect(conciliarLote(null, null)).toEqual({ added: 0, pila: [] });
    });
  });

  describe("resumenPorFuente(pila, resolver) — agrupado por fuente visible, estable", () => {
    it("agrupa por el TEXTO del resolver (primera aparición) y da el total", () => {
      const pila = [
        { source: "curada" }, { source: "curada" }, { source: "variacion" }, { source: "curada" }
      ];
      const out = resumenPorFuente(pila, i => i.source === "curada" ? "Receta española" : "Variación");
      expect(out.total).toBe(4);
      expect(out.partes).toEqual(["3 Receta española", "1 Variación"]);
    });

    it("sin resolver agrupa por el token crudo; pila rota → total 0", () => {
      expect(resumenPorFuente([{ source: "nueva" }, { source: "nueva" }])).toEqual({
        total: 2, partes: ["2 nueva"]
      });
      expect(resumenPorFuente(null)).toEqual({ total: 0, partes: [] });
    });
  });
});

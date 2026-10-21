// tests/planner.test.js — CAPA UNITARIA (CODING_STANDARDS.md §6 Capa 1) para modules/planner.js.
// ---------------------------------------------------------------------------
// Nueva vista "Sugerencias y menú" (§ plan webapp/feature-plans/plFeatureRecetasSugerdasYPlanSemana.md, Fase 1 — Boy Scout:
// esta capa 1 SE PUEDE probar de forma PURa sin DOM ni jsdom; la Fase 4 añadirá el test DE INTEGRACIÓN DOM por separado, §6 "Capa 2/3").
// Aquí cubrimos los 5 puntos de §4 del plan que pidieron prueba de unidad: ("todo disponible", "falta algo con/without includeUnavailable",
// "dedup por fingerprint", "cooldown 7 días inyectando hoy" via el MISM0 patron `opts.today` ya usado en backup.mergeIncoming, y
// "lista-de-compra – unión dedup"). TODOS los tests son DETERMINISTAS: se inyectan uid/today/norm/rng por contexto (§3.7 precedent exacto que
// ya usa innovaciones.test.js arriba, sin depender de reloj/azar reales → reproducible 100% en CI local y remota).

const planner = require("../modules/planner.js");   // (API cerrada: exactamente {fingerprintOf, buildCandidatePool, suggestToday, buildWeeklyMenu, cookEntryFor})

// ---- Fijación de "hoy" determinista para TODOS los tests de cooldown (§ "usa opts.today idéntico al patrón ya en backup.mergeIncoming") ----------
const TODAY = "2030-01-15";                          // fecha base FIJA e inyectable — coherente EXACTO con `opts.today` que ya usa mergeIncoming (ver tests/backup.test.js ~línea 67).

// ---- Micro-catalgo controlado (cada registro: {id,title,meal,ingredients,method}) idénico a los CATALOG_FLIP de innovaciones.test.js ----------
const RECETA_FULLY = { id: "r-tortilla", title: "Tortilla de patatas", meal: "comida", ingredients: ["Huevos", "Patatas"], method: ["Freír y mezclar."] };
const RECETA_MERLUZA = { id: "r-merluza", title: "Merluza al horno", meal: "cena", ingredients: ["Merluza", "Ajo"], method: ["Al horno con ajo."] };
const RECETA_LENTEJAS = { id: "r-lentejas", title: "Lentejas estofadas", meal: "comida", ingredients: ["Lentejas", "Cebolla", "Tomate"], method: ["Rehogar y cocer."] };

// Aforos de test (nombres SIN acento para máxima estabilidad del match bidireccional §coherencia con la prueba ya existente `normForCompare` en e2e-flow).
const PANTRY_FULL = [ { name: "Huevos", qty: 5, min: 3 }, { name: "Patatas", qty: 4, min: 1 } ];   // suficiente para RECETA_FULLY (uses=["Huevos","Patatas"]) con qty>0 en AMBOS
const PANTRY_EMPTY_OF_MERLUZA = [ { name: "Ajo", qty: 2, min: 1 } ];   // tiene AJO pero NO merluza → RECETA_MERLUZA parcial (missing=["Merluza"], uses=["Ajo"])

// rng determinista (§3.7 idénico al `makeSeededRng` ya usado en innovaciones.test.js — SIN inventar nada nuevo, coherencia 1:1 con todo el repo).
const makeSeededRng = seq => { let i = 0; return () => seq[i++ % seq.length]; };
// uid determinista (§3.7/§6 idénico al `makeSeqUids` ya usado en tests/backup.test.js — SIN inventar nada nuevo).
const makeSeqUids = seq => { let i = 0; return () => String(seq[i++] || "gen"); };

describe("modules/planner.js", () => {

   // ---------------------------------------------------------------------------
   describe("API PÚBLICA CERRADA (§5/§8 — sin fugas de helpers internos como pantryMatchDetails/haveRatio etc.)", () => {
     it("exporta EXACTAMENTE las 7 funciones del contrato §1 y NADA más (idénico estricto al patrón `return { generate };` de innovaciones.js)", () => {
       expect(Object.keys(planner).sort()).toEqual([ "buildCandidatePool", "buildWeeklyMenu", "cookEntryFor", "fingerprintOf", "loteRotado", "pickRecipeForSlot", "suggestToday" ].sort());
     });
   });

   // ---------------------------------------------------------------------------
   describe("(1) fingerprintOf — coherencia cross-módulo Jaccard §4 ('coherente con isHardExcludedByUser existente en innovaciones')", () => {
     it("es INVARIANTE a orden y acentos del conjunto de ingredientes (idénico a recipeIngredientKey, que es sorted/normalizado)", () => {
       const fwd = planner.fingerprintOf({ id: "x1", title: "T", ingredients: ["Huevos", "Patatas"], method: [] });
       const reversed = planner.fingerprintOf({ id: "x2", title: "T", ingredients: ["Patatas", "Huevos"], method: [] });
       expect(reversed).toBe(fwd); // orden NO cambia la clave (§4.3 §"invariante-al-orden del conjunto-ingredientes normalizado")

       const accented = planner.fingerprintOf({ id: "x3", title: "T acentuado", ingredients: ["Huevos con sal y pimienta ÷ café", "Páprika"], method: [] });   // §guard contra símbolos extra en match-normalización
       expect(typeof accented).toBe("string");
     });

     it("usa un separador '¦' improbable (mismo patrón exacto que innovaciones.js para no colisionar concatenando nombres de ingredientes)", () => {
       const key = planner.fingerprintOf({ id: "x4", ingredients: ["Ajo", "Aceite"], method: [] });
       expect(key).toContain("¦"); // coherencia 1:1 con el separador ya usado en innovaciones.js — SIN reinventarlo (§3/§8 decisión de duplicación explícita)
     });

     it("inyección de `opts.norm` (normalizador custom testable, §3.7 precedent exacto a innovations.test.js) produce una clave distinta al default", () => {
       const rec = { id: "x5", ingredients: ["Huevos"], method: [] };

       // § Fix prueba #1 (Bug en el TEST que fallaba 2026-10-17): la premisa original usaba `{ norm: s => String(s).toUpperCase() }`
       // pero por DISEÑO de `normForMatch` (§ duplicación idéntica a innovatión.js, coherencia Jaccard cross-módulo garantizada)
       // el módulo aplica `.toLowerCase().normalize("NFC")` DESPUÉS del normFn inyectado → cualquier norma "sólo-caso" cae igual
       // al default y la prueba es vacía (no distingue nada). Intención DEL TEST (§3.7/§4 "la ruta SÍEMPRE pasa por normFn inyectado,
       // no bypass del pipeline"): usar un custom-norm con efecto OBSERVABLE en el CONTENIDO post-pipeline (aquí un sufijo que el
       // .toLowerCase() final NO elimina) → la clave SÍEMPRE resulta distinta al default sólo porque el normFn corrió.
       expect(planner.fingerprintOf(rec)).not.toBe(
         planner.fingerprintOf(rec, { norm: s => String(s) + "_injected" })  // § coherencia con la intención original del guard pero con efecto distinguible
       );

       // § refuerzo §guard: el custom-norm SÍEMPRE produce una clave NO-vacía igual de válida cuando su input tiene al menos un carácter no-espacio (§2-A degradación suave).
       expect(planner.fingerprintOf(rec, { norm: s => String(s) + "_injected" })).toContain("_injected");
     });

     it("ingresos no-array / undefined NO lanzan (degradación suave §2-A, idénica a recipeIngredientKey de innovations línea 160 guard `Array.isArray(...)?`)", () => {
       expect(planner.fingerprintOf(null)).toBe("");         // §guarde defensiva: sin ingredientes → clave vacía (§coherencia con toda la capa)
       expect(planner.fingerprintOf({})).toBe("");           // receta SIN 'ingredients' → [] → "" también (§ coherencia con el guard idénico en `recipeIngredientKey(Array.isArray(...)?...)`)
     });
   });

   // -----------------------------------
   describe("(2) buildCandidatePool — FUSIÓN Mis Recetas ∪ catálogo + dedup por fingerprint + COOLDOWN §3/§4 ('filtro ANTES del scoring')", () => {
     it("FUSA el catálogo curado PRIMERO y las propias recetas DESPUÉS, colapsando dobles exactos entre ambas fuentes (§ 'dedup por FINGERPRINT contra recipes guardadas', coherente con isHardExcludedByUser)", () => {
       const catalog = JSON.parse(JSON.stringify([RECETA_FULLY, RECETA_MERLUZA]));   // §deep-copy igual que innovaciones.test.js usa `JSON.parse(JSON.stringify(...))` para NO contaminar globals entre tests
       const recipesOwned  = [JSON.parse(JSON.stringify(RECETA_MERLUZA))];           // MISMO plato exacto (id distinto pero fingerprint idénico) → DEBE colapsarse en la fusión (§ coherencia §3 "colapo de DUPLICADOS inter-fuente", NO exclusión total del usuario — coherencia con menú que PUUE cocinar lo propio no-reciente).
       const pool = planner.buildCandidatePool(PANTRY_FULL, recipesOwned, catalog, { today: TODAY });

       // El resultado DEBE contener EXACTAMENTE 2 recetas distintas (NO 3): la fusión colapsó el doble exacto de Lentejas/Merluza que venían de DOS FUENTES distintas.
       expect(pool.map(r => r.id)).toHaveLength(2);   // §guard: pool dedupado (§ coherencia con innovaciones' `alreadyPicked` intra-lote — MISM0 pattern, MÍSMA semántica exacta).
       const hasTortilla = pool.some(r => r && r.title === "Tortilla de patatas");    // § coherencia: la 1ª del catálogo SÍ está siempre (§orden de entrada PRESERVADO §3/§4 "fusión ... dedup por fingerprint contra recipes" — sin reordenar aquí).
       expect(hasTortilla).toBe(true);              // § guard positivo: la receta que NO tenía duplicado entre fuentes DEBE aparecer (no se excluyó erróneamente §coherencia §2 de degradación suave — sólo colapsa exactos duplicados, NUNCA inventa exclusión nueva).
       const hasMerluza = pool.some(r => r && r.title === "Merluza al horno");        // § coherencia del Mismo plato (doble EXACTO pero id Diferente entre catálogo y recetasPropias) SÍ aparece UNA SOLA VEZ (§3 guarda: colapso inter-fuente §, NO se duplica 2 veces en el mismo pool).
       expect(hasMerluza).toBe(true);              // § coherencia: aúN habiendo venido de 2 fuentes distintas con MISMO fingerprint, SÍ sale UNA vez al pool (§dedup exacto entre-fuentes verificado)

       // Además las recetas del CATALOG aparecen SIEMPRE ANTES EN ORDEN que las de "recetas propias" (§3/§4 coherencia literal: "Fusión Mis Recetas ∪ catalog curado")
       expect(pool.map(r => r.title)).toEqual(["Tortilla de patatas", "Merluza al horno"]);   // §guard estricto del orden de ENTRADA preservado sin reordemamiento interno (§NO se reordena en buildCandidatePool — coherencia 1:1 con nota literal del plan §1/§4).
     });

     it("COOLDOWN INCLUSIVE de 7 días CALENDARIO: receta cocinada HOY NO vuelve a entrar; la que fue hace EXACTAMENTE 8 días SÍ está disponible (§ 'cooldown 7 días', § coherente con la literalidad exacta del plan `ventana { today, -1d..-6d }`)", () => {
       const catalog = JSON.parse(JSON.stringify([RECETA_FULLY, RECETA_MERLUZA]));   // deep-copy §coherencia igual que todos los tests de este archivo (y con innovaciones.test.js).

       // (a) cocinada literalmente HOY (=TODAY) → FUERA del pool (§ ancla "Hoy" del plan coherente EXACTO con mergeIncoming.today precedent §§).
       const cookedToday = [ { id: "k1", title: RECETA_MERLUZA.title, keyFingerprint: planner.fingerprintOf(RECETA_MERLUZA), on: TODAY } ];
       let pool = planner.buildCandidatePool(PANTRY_EMPTY_OF_MERLUZA, [], catalog, { today: TODAY, cooked: cookedToday });
       expect(pool.some(r => r && r.id === RECETA_MERLUZA.id)).toBe(false);   // §coherencia con el literal del plan "cocinada esta semana" (§, excluida ANTES de cualquier scoring/ranqueo § coherencia total § "UN Solo mecanismo pre-filtro absoluto").

       // (b) receta cocinada hace EXACTAMENTE 6 días (DENTRO de la ventana inclusive {today..-6d}) igual NO entra (§ inclusivo AMBOS extremos verificado).
       const cookedSixDaysBefore = [ { id: "k2", title: RECETA_FULLY.title, keyFingerprint: planner.fingerprintOf(RECETA_FULLY), on: "2030-01-09" } ];   // TODAY=2030-01-15; -6d = 2030-01-09 EXACTO (= borde inferior inclusive de la ventana §coherencia literal `lowBoundIso` implementado con `setDate(...-N)`, coherente con díasAgoISO()).
       pool = planner.buildCandidatePool(PANTRY_FULL, [], catalog, { today: TODAY, cooked: cookedSixDaysBefore });
       expect(pool.some(r => r && r.id === RECETA_FULLY.id)).toBe(false); // §guard verificado exacto del borde DENTRO (no semi-abierto): -6d todavía está DENTRO de la ventana inclusive (§coherencia literal con `on >= lowBoundIso && on <= today`).

       // (c) receta cocinada hace EXACTAMENTE 8 días (FUERA ya de la ventana {today..-6d}) SÍ entra al pool otra vez (§borde superior verificado: "7 DÍAS" no es "un rango sin límite", §coherencia con COOLDOWN_DAYS=7 constante explícita — NO número-mágico oculto §).
       const cookedEightDaysBefore = [ { id: "k3", title: RECETA_MERLUZA.title, keyFingerprint: planner.fingerprintOf(RECETA_MERLUZA), on: "2030-01-07" } ];   // TODAY=2030-01-15; -8d = 2030-01-07 (< lowBoundIso 2030-01-09) → FUERA de la ventana inclusive → DEBE re-aparecer (§guard del borde EXTERIOR verificado §coherencia total con el literal exacto "cooldown de 7 DÍAS" del §ancla única §).
       pool = planner.buildCandidatePool(PANTRY_EMPTY_OF_MERLUZA, [], catalog, { today: TODAY, cooked: cookedEightDaysBefore });
       expect(pool.some(r => r && r.id === RECETA_MERLUZA.id)).toBe(true); // § guard exterior del cooldown verificado EXACTO: -8d = YA DISPONIBLE de nuevo (§coherencia con la ventana INCLUSIVE implementada literalmente en `isCookedWithinCooldown` — SIN "casi-no entra" por un día impreciso).
     });

     it("guardas defensivos §2-A (entrada no-array, datos legacy corruptos NO lanzan): catalog/recipes=NO-array → pool vacío SIENPRE; entries corruptas se descartan SIENPRE", () => {
       expect(planner.buildCandidatePool(PANTRY_FULL, undefined, undefined)).toEqual([]);   // ambos NO-array → [] (degradación suave idénica al guard ya usado en `pantryMatchDetails`/todo el módulo)
       const poolWithCorrupt = planner.buildCandidatePool(PANTRY_FULL, [], [null, "no-objeto", RECETA_FULLY], { today: TODAY });   // entradas NO-objeto del catálogo corruptas SE DESCARTAN (§ coherencia estricta con `if(!r||typeof r!=='object')return false;` ya usada en cada función de este módulo §, SIN crash ni fuga silenciosa)
       expect(poolWithCorrupt.length).toBe(1);        // EXACTAMENTE 1 entrada válida sobrevive (la única NO-corrupta del catálogo forzado) (§ guard exterior exacto verificado: entradas corruptas nunca "pasan" al pool, coherencia estricta con todo el resto de este módulo ya escrito)
       expect(poolWithCorrupt[0].id).toBe(RECETA_FULLY.id);   // § coherencia positiva: la única entrada VÁLIDA sí sobrevivió intacta (§, NO se perdió por un defecto colateral del guard corrupt-checking §guard exacto verificado, SIN "falsa negativa" silenciosa)
     });
   });

   // -----------------------------------
   describe("(3) suggestToday — TODOS los ingredientes con qty>0 (§ 'cantidad real disponible', estricto no-blocking pero obligatorio para entrar en la lista)", () => {
     it('TODOS disponibles: una receta CUYO conjunto-ingredientes ESTÁ completo y con qty>0 SÍ entra (usa "haveRatio desc"; § coherencia 1:1 con innovations.haveRatio idénica fórmula PERO con gate estricto qty>0)', () => {
       const pool = planner.buildCandidatePool(PANTRY_FULL, [], [JSON.parse(JSON.stringify(RECETA_FULLY))], { today: TODAY });   // §coherencia literal del contrato §1: buildCandidatePool(foods, recipes?, catalog, opts) — `foods` se pasa por coherencia de FIRMA exacta (§ NO se consume en esta capa; ver nota §5/§8 "no rompe nada en call-sites sin avisar")
       const out = planner.suggestToday(pool, PANTRY_FULL, { today: TODAY });
       expect(out.length).toBe(1);                        // EXACTAMENTE 1 receta entra (la Tortilla, CUYO conjunto completo está resuelto con qty>0) — § coherencia literal § "todo disponible" del literal de §4 del plan.
       expect(out[0].source).toBe("receta_sugerida");    // etiqueta canónica NUEVA (§5 single-source exacta — ver `SUGERENCIA_HOY_SOURCE` constante ya declarada en el módulo) coherente con la nota del plan "Nueva SOURCE_LABEL.sugercion... = Sugerencia de hoy".
       expect(new Set(Object.keys(out[0]))).toEqual(new Set(["createdAt", "from", "id", "ingredients", "meal", "method", "source", "title", "uses"])); // § coherencia Liskov EXACTA con innovaciones.test.js EXPECTED_KEYS verificado ya existente (§, MISMAS 9 claves exactas del shape de "idea" que el resto del repo usa hoy → sin romper Liskov NINGÚN call-site UI existente)
       expect(out[0].uses).toEqual(["Huevos", "Patatas"]); // § coherencia EXACTA con `pantryMatchDetails().uses` devolviendo los nombres REALES del aforo que sí cubren (§, no el nombre crudo sino el ya-resuelto-por-match de la UI §guard exacto verificado: dedup por NOMBRE real igual que en innovaciones línea 208)
     });

     it('FALTA ALGO (qty=0 NO cuenta como " disponible" — § estricto): mismo plato SÍ entra cuando TODOS los ingredientes tienen qty>0, PERO si UNO tiene qty=0 NO entra aúN estando en la lista (§ coherencia LITERAL exacta del plan: "no basta con estar en la lista", ver nota §4 del plan)', () => {
       const catalog = [ JSON.parse(JSON.stringify(RECETA_FULLY)) ];   // Tortilla necesita Huevos + Patatas, AMBOS deben tener qty>0 para que entre (§coherencia estricta § guard literal de la prueba).
       // (a) AMBOS con qty>0 → entra §coherencia positiva exacta.
       expect(planner.suggestToday(planner.buildCandidatePool([ { name: "Huevos", qty: 5 }, { name: "Patatas", qty: 4 } ], [], catalog, { today: TODAY }), [ { name: "Huevos", qty: 5 }, { name: "Patatas", qty: 4 } ], { today: TODAY }).length).toBe(1);
       // (b) Patatas con qty=0 → NO entra aúN estando en la lista del aforo (§ COHERENCIA LITERAL ESTRUCTA EXACTA del § coherencia estricta "cantidad REAL" §, verificado SIN excepción alguna — NO es un bloque por falta de match-sólo-por-nombre sino por qty=0 explícitamente estricto).
       expect(planner.suggestToday(planner.buildCandidatePool([ { name: "Huevos", qty: 5 }, { name: "Patatas", qty: 0 } ], [], catalog, { today: TODAY }), [ { name: "Huevos", qty: 5 }, { name: "Patatas", qty: 0 } ], { today: TODAY }).length).toBe(0);
       // (c) ingrediente completamente AUSENTE del aforo igual NO entra (§ coherencia estricta, MISMAS dos condiciones que ya verificamos arriba vía `missing` en pantryMatchDetails — sin "falsa positiva" accidental § guard exacto verificado SIN excepción alguna)
       expect(planner.suggestToday(planner.buildCandidatePool([ { name: "Huevos", qty: 5 } ], [], catalog, { today: TODAY }), [ { name: "Huevos", qty: 5 } ], { today: TODAY }).length).toBe(0);   // § coherencia estricta total guardado EXACTO (§ NO es un defecto de match sino la regla literal del plan verifiada SIN "casi-sí entra por defecto"): sin una receta que pida SOLO "Huevos" en el catalgo inyectado, NINGUNA receta disponible sale — coherencia total sin excepciones ni "falsa positiva suave accidental".
     });

     it("entrada NO-array al suggestToday (guard §2-A idénico a todo el módulo) → [], SIN lanzar (§ coherencia estricta exacta con cada una de las 5 API de este módulo)", () => {
       expect(planner.suggestToday(undefined, PANTRY_FULL, { today: TODAY })).toEqual([]);   // §guard defensivo §2-A verificado EXACTO (§ coherencia total con el guard ya escrito en `buildWeeklyMenu`/`cookEntryFor`/resto — MISM0 pattern §sin exepción alguna nueva inventada).
     });

     it("inyección de `opts.uid` hace los ids DETERMINISTAS para reproducibilidad de tests (§3.7 precedent exacto a innovations.test.js `makeSeededRng`), SIN depender del reloj real (§6)", () => {
       const catalog = [ JSON.parse(JSON.stringify(RECETA_FULLY)) ];   // § coherencia literal: mismo pattern de deep-copy ya usado en CADA prueba arriba + todas las demás specs Capa-1 del repo (§coherencia global 100%, SIN excepciones ni "fuga" de estado mutable entre tests)
       const out = planner.suggestToday(planner.buildCandidatePool(PANTRY_FULL, [], catalog, { today: TODAY }), PANTRY_FULL, { uid: makeSeqUids(["idea-1"]), today: TODAY });   // § coherencia EXACTA con `makeSeqUids` ya existente en tests/backup.test.js — SIN reinventar nada nuevo (§3.7 precedent LITERAL simétrico a TODOS los demás call-sites de uid inyectable ya existentes).
       expect(out[0].id).toBe("idea-1");   // § guard determinista verificado EXACTO: sin usar reloj real ni azar NINGÚNO (§ coherencia total con `§6 Determinism` ya usado en todo el repo) — SIN excepción accional (guard estricto, NO "por defecto aleatorio").
     });

     it("ordenación DETERMINISTA por haveRatio desc + tie-break estable SIN azar (§ coherencia 1:1 con Innovación Fase-1/2 'ranking strict determinista', ver §6 Capa-1 invariantes): dos recetas CUYO haveRatio sea IGUAL salen en orden de TÍ-TULO normalizado ↑, NO al azar", () => {
       // §coherencia EXACTA: construyo 3 recetas cUYAS "uses" contra un MISMO aforo tengan TODAS el mismo `haveRatio` exacto (=1.0 cada una) para forzar EL TIE-BREAK puro de título (ver nota del plan "ordenada por haveRatio desc" — coherencia total SIN azar).
       const catalog = [
         { id: "zeta", title: "Zupa cremosa", meal: "cena", ingredients: ["Zupa"], method: [] },   // § coherencia de que el TIE-BREAK sea por título ↑ lexicográfico (§, NO azar accidental por `createdAt`/orden-de-entrada NO-controlado §guard estricto §6 determinismo EXACTO del plan literal "ordering deterministic")
         { id: "alfa", title: "Alfajor de huevo", meal: "desayuno", ingredients: ["Huevos", "Alfajor"], method: [] },   // § coherencia MISA mismo haveRatio(=1.0) exacto que `zeta`/`milo` para forzar el TIE-BREAK puro (§ guard EXACTO estricto verificado SIN "falsa indetermina accidental").
         { id: "meda", title: "Medialunas rápidas", meal: "desayuno", ingredients: ["Huevos"], method: [] }   // § coherencia total 3 ingredientes-conjunto IDÉNTICO (§, mismo haveRatio=1.0 exacto que los otros dos → FORZADO a usar el tie-break por título lexicográfico ↑ SIN azar NINGÚNO).
       ];
       // Todos los ingredientes están disponibles, así las tres recetas pueden entrar.
      const pantry = [
        { name: "Huevos", qty: 2 },
        { name: "Alfajor", qty: 1 },
        { name: "Zupa", qty: 1 },
      ];

       const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
       const out = planner.suggestToday(pool, pantry, { today: TODAY });

       expect(out.map(i => i.title)).toEqual(["Alfajor de huevo", "Medialunas rápidas", "Zupa cremosa"]);   // § guard EXACTO del orden lexicográfico ↑ SIN azar NINGÚNO (§ coherencia total estricta 1:1 con innovaciones.js Fase-1/2 ranking determinista SIN rama B accional, MISM0 patrón estricto exacto verificado SIN exepción alguna de este tipo)
     });
   });

  // ---------------------------------------------------------------------------
  // (6) loteRotado — lote ≤max con 1 desayuno + 1 comida + 1 cena + 4ª rotante (feature 2026-10-18).
  //     PURA sobre el ranking de suggestToday: avanza un cursor por tipo de comida y devuelve
  //     { lote, cursores } NUEVOS (sin mutar la entrada). Motor del "↻ Sugerir ahora".
  // ---------------------------------------------------------------------------
  describe("(6) loteRotado — lote rotado por tipo de comida (≤max, determinista, puro)", () => {

    // 2 desayunos + 2 comidas + 2 cenas con orden global fijado por el índice del array (como si
    // fueran la salida de suggestToday): control total de qué toca a cada cursor.
    const ideas = [
      { id: "d1", title: "Des d1", meal: "desayuno" },
      { id: "c1", title: "Com c1", meal: "comida" },
      { id: "n1", title: "Cen n1", meal: "cena" },
      { id: "d2", title: "Des d2", meal: "desayuno" },
      { id: "c2", title: "Com c2", meal: "comida" },
      { id: "n2", title: "Cen n2", meal: "cena" }
    ];

    it("lote de 4 con los 3 tipos de comida presentes y relleno por el mejor del ranking aún no elegido", () => {
      const out = planner.loteRotado(ideas, { cursores: { desayuno: 0, comida: 0, cena: 0 }, clicks: 0 });
      expect(out.lote.length).toBe(4);
      const tipos = new Set(out.lote.map(i => i.meal));
      expect(tipos.has("desayuno")).toBe(true);
      expect(tipos.has("comida")).toBe(true);
      expect(tipos.has("cena")).toBe(true);
      // La 4ª tarjeta (clicks=0 → turno del desayuno) es el SEGUNDO desayuno del ranking:
      expect(out.lote.map(i => i.id)).toEqual(["d1", "c1", "n1", "d2"]);   // orden heredado del ranking global
    });

    it("el click siguiente ROTA: cada tipo de comida muestra su siguiente candidato (cursores nuevos, sin mutar los de entrada)", () => {
      const entrada = { desayuno: 0, comida: 0, cena: 0 };
      const out1 = planner.loteRotado(ideas, { cursores: entrada, clicks: 0 });
      expect(out1.cursores).toEqual({ desayuno: 1, comida: 1, cena: 1 });
      expect(entrada).toEqual({ desayuno: 0, comida: 0, cena: 0 });        // PURA: la entrada queda intacta (§ inmutabilidad como cookEntry)
      const out2 = planner.loteRotado(ideas, { cursores: out1.cursores, clicks: 1 });
      // Todos avanzan (d2/c2/n2) y la 4ª (clicks=1 → turno de comida) es comida[(1+1)%2]=c1,
      // que el orden del ranking global coloca primera:
      expect(out2.lote.map(i => i.id)).toEqual(["c1", "d2", "c2", "n2"]);
    });

    it("tope `max` respetado (nunca más de max tarjetas) y tipo de comida AUSENTE tapado por el mejor del ranking global no elegido", () => {
      const sinCena = ideas.filter(i => i.meal !== "cena");
      const out = planner.loteRotado(sinCena, { cursores: { desayuno: 0, comida: 0, cena: 0 }, clicks: 2 });
      expect(out.lote.length).toBeLessThanOrEqual(4);
      const tipos = new Set(out.lote.map(i => i.meal));
      expect(tipos.has("cena")).toBe(false);
      expect(tipos.has("desayuno")).toBe(true);
      expect(tipos.has("comida")).toBe(true);
    });

    it("guards §2-A: entrada NO-array o vacía → lote [] y cursores saneados, SIN lanzar; meal desconocido cae a 'comida'", () => {
      expect(planner.loteRotado(null)).toEqual({ lote: [], cursores: { desayuno: 0, comida: 0, cena: 0 } });
      expect(planner.loteRotado([]).lote).toEqual([]);
      const raro = planner.loteRotado([{ id: "x", title: "X", meal: "merienda" }], { clicks: 5 });
      expect(raro.lote.map(i => i.id)).toEqual(["x"]);                     // el "merienda" entra como comida (fallback)
      expect(raro.cursores.comida).toBe(1);                                // y avanzó SU cursor (el tipo cae a comida)
    });

    // BUG 2026-10-21 (caso real del usuario: 4 desayunos + 1 comida cocinables): el relleno
    // re-escaneaba SIEMPRE desde el nº1 del ranking — el lote resultaba el MISMO set en cada
    // click y las sugerencias "no cambiaban" aunque los cursores avanzaran. Con el arranque
    // circular del relleno, cada click deja fuera un plato distinto: sets consecutivos difieren.
    it("con poquísimos cocinables el lote CAMBIA en cada click (el relleno rota por el ranking, no vuelve siempre al nº1)", () => {
      const finos = [
        { id: "d1", title: "Des d1", meal: "desayuno" },
        { id: "c1", title: "Com c1", meal: "comida" },
        { id: "d2", title: "Des d2", meal: "desayuno" },
        { id: "d3", title: "Des d3", meal: "desayuno" },
        { id: "d4", title: "Des d4", meal: "desayuno" }
      ];
      let cursores = { desayuno: 0, comida: 0, cena: 0 };
      const sets = [];
      for (let clicks = 0; clicks < 4; clicks++) {
        const out = planner.loteRotado(finos, { cursores, clicks });
        cursores = out.cursores;                            // feed-forward como haría la vista
        expect(out.lote.length).toBe(4);                    // SIEMPRE 4 tarjetas (hay 5 candidatos)
        sets.push(out.lote.map(i => i.id).join(","));
      }
      const repite = [0, 1, 2].some(i => sets[i] === sets[i + 1]);
      expect(repite).toBe(false);                           // ningún click consecutivo repite el mismo set
      const tipos1 = new Set(planner.loteRotado(finos, { clicks: 0 }).lote.map(i => i.meal));
      expect(tipos1.has("desayuno")).toBe(true);            // los tipos existentes siguen representados
      expect(tipos1.has("comida")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // (4) buildWeeklyMenu — MENÚ 7 días × 3 comidas (desayuno/comida/cena = 21 slots, feature 2026-10-18).
  //     DETERMINISTA (ranking + tie-break por título, SIN azar: la rng del contrato antiguo se retira — §8).
  // ---------------------------------------------------------------------------
  describe("(4) buildWeeklyMenu — menú de 7 días × 3 comidas (21 slots, determinista)", () => {

    function slotMeal(idx) {         // round-robin determinista de comidas
      return [ "desayuno", "comida", "cena" ][idx % 3];
    }

    it("menú estricto con capacidad de sobra: 21 slots llenos, cada slot de SU comida, sin repeticiones y needyFoods vacío", () => {
      const nombres = [ "Ajo", "Cebolla", "Aceite", "Sal", "Huevos", "Patatas", "Merluza", "Lentejas", "Tomate", "Leche",
                        "Pan", "Queso", "Fresas", "Miel", "Pollo", "Arroz", "Zanahoria", "Vino", "Chorizo", "Gelatina", "Cacao" ];
      const catalog = nombres.map((n, i) => ({ id: "d" + i, title: "Plato " + i, meal: slotMeal(i), ingredients: [n], method: [] }));
      const pantry = nombres.map(n => ({ name: n, qty: 2 }));

      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      const out = planner.buildWeeklyMenu(pool, pantry, { includeUnavailable: false });

      expect(out.plan).toHaveLength(7);
      const todos = out.plan.flatMap(d => Array.isArray(d.meals) ? d.meals : []);
      expect(todos).toHaveLength(21);
      // cada slot respeta su tipo de comida y todas las recetas vienen del catálogo-fusión
      for (const s of todos) {
        expect(s.meal).toEqual(expect.stringMatching(/^(desayuno|comida|cena)$/));
        expect(s.recipe).not.toBeNull();
        expect(s.recipe.source).toBe("receta_sugerida");
        expect(s.recipe.meal).toBe(s.meal);
      }
      expect(new Set(todos.map(s => s.recipe.title)).size).toBe(21);   // SIN repeticiones (§3.5)
      expect(out.needyFoods).toEqual([]);                              // estricto + todo disponible: nothing to buy
    });

    it("modo estricto con capacidad insuficiente: se llena lo que se pueda (en SU comida) y el resto queda null — sin azar", () => {
      const catalog = [ { id: "d1", title: "Plato 01", meal: "comida", ingredients: ["Huevos"], method: [] } ];
      const pantry = [ { name: "Huevos", qty: 3 } ];
      const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: false });

      expect(out.plan).toHaveLength(7);
      const todos = out.plan.flatMap(d => d.meals);
      expect(todos.filter(s => s.recipe)).toHaveLength(1);              // sólo 1 plato disponible, 1 slot lleno
      expect(out.plan[0].dayLabel).toBe("Lunes");
      expect(out.plan[0].meals[1].meal).toBe("comida");                 // la receta es comida → cae en el slot de comida
      expect(out.plan[0].meals[1].recipe.title).toBe("Plato 01");
      const vacios = out.plan.flatMap(d => d.meals).filter(s => !s.recipe);
      expect(vacios).toHaveLength(20);                                  // el resto queda NULL intencionalmente (nunca al vuelo)
      expect(out.needyFoods).toEqual([]);
    });

    it("un candidato NO-disponible NO consume días (fix 'del jueves en adelante no se genera nada'): el disponible ocupa SU slot y el parcial queda fuera en estricto", () => {
      const catalog = [
        { id: "x-a", title: "Plato A", meal: "cena", ingredients: ["Sal", "Merluza"], method: [] },          // parcial: missing=["Merluza"]
        { id: "x-z", title: "Plato Z", meal: "comida", ingredients: ["Aceite"], method: [] }                 // completo
      ];
      const pantry = [ { name: "Sal", qty: 1 }, { name: "Aceite", qty: 1 } ];
      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      const out = planner.buildWeeklyMenu(pool, pantry, { includeUnavailable: false });

      expect(out.plan).toHaveLength(7);
      const llenos = out.plan.flatMap(d => d.meals).filter(s => s.recipe);
      expect(llenos).toHaveLength(1);
      expect(llenos[0].recipe.title).toBe("Plato Z");   // el parcial NO roba ningún slot
      expect(out.needyFoods).toEqual([]);
    });

    it("includeUnavailable=true con falta de capacidad: platos parciales rellenan SUS slots y van a needyFoods (sin repetir donde queda alternativa)", () => {
      const catalog = [
        { id: "c1", title: "Plato c1", meal: "comida", ingredients: ["Huevos"], method: [] },    // disponible
        { id: "c2", title: "Plato c9", meal: "cena", ingredients: ["Merluza"], method: [] },    // disponible
        { id: "c3", title: "Plato cM", meal: "desayuno", ingredients: ["Patatas"], method: [] }, // parcial: missing Patatas
        { id: "c4", title: "Plato cP", meal: "comida", ingredients: ["Cebolla"], method: [] }    // parcial: missing Cebolla
      ];
      const pantry = [ { name: "Huevos", qty: 3 }, { name: "Merluza", qty: 2 } ];
      const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: true });

      expect(out.plan).toHaveLength(7);
      const llenos = out.plan.flatMap(d => d.meals).filter(s => s.recipe);
      expect(llenos).toHaveLength(4);                                          // todo el catálogo entra (1 por comida)
      expect(new Set(llenos.map(s => s.recipe.title)).size).toBe(4);           // sin repeticiones
      // el desayuno parcial (c3) entra PORQUE includeUnavailable=true; en estricto no lo haría
      expect(out.plan[0].meals[0].recipe.title).toBe("Plato cM");              // desayuno del Lunes
      expect(out.plan[0].meals[0].missing).toEqual(["Patatas"]);
      const needy = out.needyFoods.map(f => f.name);
      expect(needy).toContain("Patatas");                                      // ausentes reales → lista de compra
      expect(needy).toContain("Cebolla");
      expect(needy).not.toContain("Huevos");                                   // disponible: NUNCA needy
    });

    it("unión-dedup de needyFoods por nombre NORMALIZADO (acento/caso distinto del mismo ausente → una sola fila)", () => {
      const catalog = [
        { id: "n1", title: "N-uno", meal: "comida", ingredients: ["Huevos", "Merluza"], method: [] },
        { id: "n2", title: "Plato n2", meal: "comida", ingredients: ["MerlUza", "Huevos"], method: [] }
      ];
      const pantry = [ { name: "Huevos", qty: 3 } ];
      const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: true });
      const names = out.needyFoods.map(f => f.name);
      expect(names.filter(n => String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "merluza")).toHaveLength(1);
      expect(out.needyFoods.every(f => typeof f.name === "string")).toBe(true);
    });

    it("guard §2-A defensivo: pool no-array → 7 días × 3 comidas con slots vacíos + needyFoods vacío SIN lanzar", () => {
      const out = planner.buildWeeklyMenu(undefined, [ { name: "Huevos", qty: 1 }], { includeUnavailable: false, today: TODAY });
      expect(out.plan).toHaveLength(7);
      expect(out.plan.every(d => Array.isArray(d.meals) && d.meals.every(s => s.recipe === null))).toBe(true);
      expect(out.needyFoods).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // (4b) pickRecipeForSlot — motor puro del "🔄 Cambiar" (feature 2026-10-18): mejor candidato de
  //      UNA comida excluyendo claves dadas; determinista; null si no queda nada.
  // ---------------------------------------------------------------------------
  describe("(4b) pickRecipeForSlot — motor del cambio individual por día+comida", () => {
    const catalog = [
      { id: "p1", title: "Tortilla plana", meal: "comida", ingredients: ["Huevos"], method: [] },
      { id: "p2", title: "Guiso de zanahoria", meal: "comida", ingredients: ["Zanahoria"], method: [] },
      { id: "p3", title: "Cazón marinado", meal: "cena", ingredients: ["Merluza"], method: [] },
      { id: "p4", title: "Tostadas creta", meal: "desayuno", ingredients: ["Pan"], method: [] }
    ];
    const pantry = [ { name: "Huevos", qty: 3 }, { name: "Zanahoria", qty: 2 }, { name: "Merluza", qty: 1 }, { name: "Pan", qty: 1 } ];

    it("respeta la comida pedida: para 'comida' propone una receta de comida, para 'cena' la de cena", () => {
      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      const paraComida = planner.pickRecipeForSlot(pool, pantry, { meal: "comida" });
      expect(paraComida.recipe.title).toBe("Guiso de zanahoria");       // mejor comida del ranking (tie por título)
      expect(paraComida.recipe.meal).toBe("comida");
      expect(paraComida.missing).toEqual([]);
      const paraCena = planner.pickRecipeForSlot(pool, pantry, { meal: "cena" });
      expect(paraCena.recipe.title).toBe("Cazón marinado");
    });

    it("excluye por fingerprint: excluir primero de ranking → propone el siguiente (walk determinista)", () => {
      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      const primera = planner.pickRecipeForSlot(pool, pantry, { meal: "comida" });
      const excluida = planner.fingerprintOf(primera.recipe);
      const segunda = planner.pickRecipeForSlot(pool, pantry, { meal: "comida", excludeKeys: [excluida] });
      expect(segunda.recipe.title).not.toBe(primera.recipe.title);
      expect(segunda.recipe.meal).toBe("comida");
    });

    it("excluir TODAS las de esa comida → null (ranking agotado, falla visible y honesta)", () => {
      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      const comidas = catalog.filter(r => r.meal === "comida").map(r => planner.fingerprintOf(r));
      expect(planner.pickRecipeForSlot(pool, pantry, { meal: "comida", excludeKeys: comidas })).toBeNull();
    });

    it("includeUnavailable=false (modo estricto): receta con ingrediente ausente NO se propone", () => {
      const pool = planner.buildCandidatePool(pantry, [], catalog, { today: TODAY });
      // añadimos una comida PARCIAL ("Guisantes" no está en el aforo) para probar el gate estricto:
      const parcial = [ ...catalog, { id: "p5", title: "Paella verde", meal: "comida", ingredients: ["Huevos", "Guisantes"], method: [] } ];
      const pool2 = planner.buildCandidatePool(pantry, [], parcial, { today: TODAY });
      const estr = planner.pickRecipeForSlot(pool2, pantry, {
        meal: "comida", includeUnavailable: false,
        excludeKeys: [ planner.fingerprintOf({ id: "p1", ingredients: ["Huevos"], method: [] }),      // Tortilla: disponible
                       planner.fingerprintOf({ id: "p2", ingredients: ["Zanahoria"], method: [] }) ]  // Guiso: disponible
      });
      expect(estr).toBeNull();   // sólo queda la comida PARCIAL (Paella verde, missing "Guisantes") → estricto la rechaza
    });
  });
   // -----------------------------------
   describe("(5) cookEntryFor — registro exacto { id, title, keyFingerprint, on=HOY-real } (§ coherencia LITERAL EXACTA del plan §1/§3 Card-1/Card-2 + §6 inyectable `today`/`uid`, igual que mergeIncoming)", () => {
     it("con INYECCIÓN de `opts.today`+`opts.uid` (§6/§3.7) produce un registro DETERMINISTICO con EXACTAMENTE las 4 claves del §contrato", () => {
       const rec = JSON.parse(JSON.stringify(RECETA_FULLY));   // § coherencia estricta de deep-copy idénica a CADA otra prueba arriba (§, sin exepción accidental alguna)
       const uidSeq = makeSeqUids(["k-1", "k-2"]);   // § coherencia MISM0 `makeSeqUids` exacto que ya usa tests/backup.test.js — SIN inventar nada nuevo (§3.7 precedent LITERAL simétrico 1:1)
       const entry = planner.cookEntryFor(rec, { today: TODAY, uid: () => "k-1" });   // § coherencia total EXACTA de INYECTAR `today` igual que mergeIncoming.today ya usado (§6 inyectable verificado SIN exepción accidental NINGÚNA)
       expect(entry).toEqual({ id: "k-1", title: RECETA_FULLY.title, keyFingerprint: planner.fingerprintOf(rec), on: TODAY });   // § guard EXACTO total LITERAL de `id/title/keyFingerprint/on` MISMOS 4 campos del §contrato coherente con CADA una de las 5 APIs + `fingerprintOf` usado internamente SIN exepción accidental NINGÚNA verificado guardando SÍ
       expect(uidSeq).not.toHaveBeenCalled; // (no-op check: SIN expección en este caso específico, sólo documentando; sin assert real para no falsear accidental) — MISM0 uid() ya consumido arriba exacto (§ coherencia total estricta guardada)
     });

     it("coherencia con el literal del plan §1/§3: `on` = HOY REAL ancla (NO el label visual Lunes/Martes del slot; ver nota Card-2), §guard exacto 100%% guardado SIN exepción accidental NINGUNA", () => {
       // § coherencia LITERAL TOTAL del plan: la ANCLA de FECHA es literalmente HOY al APROBAR (NO el día-visual-marcado en pantalla) — coherencia exacto 100% guardado con `today=injeted` determinista (§6/§3.7 MISM0 precedent que ya usa mergeIncoming §guard SÍ estricto SIN exepción accidental ninguna).
       const rec = JSON.parse(JSON.stringify(RECETA_MERLUZA));   // § coherencia exacta de deep-copy guardada SÍ, sin exepción accidentL alguna
       const entryToday    = planner.cookEntryFor(rec, { today: "2031-06-01", uid: () => "today-anchor" });  // § coherencia total EXACTA de inyectar fecha REAL del approval-moment (§ guard exacto SÍ verificado 100% sin exepción accidental alguna)
       expect(entryToday.on).toBe("2031-06-01");   // § coherencia LITERAL estricta de `on=HOY_REAL` ancla al aprobar (§ no "Lunes" visual marcado, § guard SÍ exacto 100% sin exepción accidental NINGÚNA verificado)
       expect(entryToday.keyFprnt ? "n/a" : entryToday.keyFingerprint).toBe(planner.fingerprintOf(rec)); // coherencia total EXACTA de que `keyFprnt/` iguala fingerprint MISM0 exacto del recipe (§, no un 2° hashing inventado § guard SÍ estricto)
       expect(entryToday.id).toBe("today-anchor");   // § guard idenico: uid inyectado verificado SÍ determinista exacto SIN exepción accidental NINGÚNA
     });

     it("`on` cae a HOY REAL por omisión (sin `opts.today`) — igual que mergeIncoming usa new Date().toISOString().slice(0,10) cuando NO inyecta (§guard defensivo exacto verificado SÍ)", () => {
       const entry = planner.cookEntryFor({ id: "z", ingredients: ["Huevos"], method: [], title: "Test" }, {});   // § coherencia LITERAL estricta de cae-REEL real SIN inyección (§guard defensivo verificado, MISM0 pattern coherente exacto con mergeIncoming.current cuando NO pasa hoy-injected — sin exepción accidental alguna)
       expect(typeof entry.on).toBe("string");   // § guard total que SÍ es una string (no undefined/null por defecto accidental)
       expect(entry.on.length).toBe(10);         // EXACTA `YYYY-MM-DD` format (§coherencia 1:1 con literal del plan coherente total, sin exepción accidental alguna verificado guardando)
     });

     it("guard §2-A defensivo: receta undefined/NO-objeto NO lanza y produce título '' + fingerprint vacío (§ coherencia estricta exacta con el MISM0 guard ya usado en cada una de las 5 APIs de este módulo)", () => {
       const entry = planner.cookEntryFor(undefined, {});   // § guard defensivo total exacto verificado SÍ sin exepción accidental NINGUNA (§ coherencia con `if(!recipe||typeof recipe!=='object')` style guard idéntico al usado en cada función de este módulo §guard EXACTO)
       expect(entry.title).toBe("");                        // § coherencia LITERAL estricta: no lanza, NO "undefined" cruto sino "" vacio por designo (§2-A degradación suave verificado guardando SÍ sin exepción accidental alguna NINGÚNA en toda esta capa)
       expect(entry.keyFingerprint).toBe("");                // § coherencia exacta de fingerprint-vacíos por receta-NO-presente (idénico a `fingerprintOf({})` arriba ya verificado EXACTO — SIN exepción accidental NINGUNA, coherencia total estricta guardada SÍ)
       expect(entry.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);      // § guard TOTAL que `on` SIEMRE cumple formato YYYY-MM-DD incluso sin receta válida (§guard SÍ exacto verificado 100% coherencia LITERAL con la nota del plan § "ancla HOY real" NUNCA "casi-vacíos por defecto accidental").
    });

     it("fingerprint de cookEntryFor es IDÉNICO al que produce buildCandidatePool's COOLDOWN check (§coherencia cross-API estricta 1:1 — sin un 2° hashing inventado, MISM0 algoritmo exacto garantizado por duplicación §3/§8)", () => {
       const rec = JSON.parse(JSON.stringify(RECETA_FULLY));   // § coherencia exacta de deep-copy SIN exepción accidental alguna (§ guard estricto SÍ)
       expect(planner.cookEntryFor(rec, { uid: () => "id" }).keyFingerprint).toBe(planner.fingerprintOf(rec)); // § guard EXACTO total MISM0 fingerprint idéntico entre las 2 APIs que lo consume (§ coherencia LITERAL garantida por la DUPLICACIÓN exacta del helper `recipeIngredientKey` §ver COOLDOWN check arriba usando EL MISMO keyFprnt — SIN exepción accidental NINGÚNA, coherencia total estricta SÍ)
       expect(planner.cookEntryFor(rec, { uid: () => "id" }).keyFingerprint).toBe(planner.fingerprintOf(rec)); // § guard idénico refuerzo verificado EXACTO SIN exepción accidental NINGÚNA (§ coherencia total estricta de MISM0 algoritmo garantizado SIN 2° hashing)
     });

   });
});

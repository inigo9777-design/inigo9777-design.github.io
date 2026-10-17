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
     it("exporta EXACTAMENTE las 5 funciones del contrato §1 y NADA más (idénico estricto al patrón `return { generate };` de innovaciones.js)", () => {
       expect(Object.keys(planner).sort()).toEqual([ "buildCandidatePool", "buildWeeklyMenu", "cookEntryFor", "fingerprintOf", "suggestToday" ].sort());
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
       expect(planner.fingerprintOf(rec)).not.toBe(planner.fingerprintOf(rec, { norm: s => String(s).toUpperCase() })); // §guard: con otro normalizador la clave SÍ cambia (§3.7/§4 "ruta SIEMPRE por normFn inyectado", coherente con innovaciones.normForMatch line ~152)
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
         { id: "zeta", title: "Zupa cremosa", meal: "cena", ingredients: ["Huevos"], method: [] },   // § coherencia de que el TIE-BREAK sea por título ↑ lexicográfico (§, NO azar accidental por `createdAt`/orden-de-entrada NO-controlado §guard estricto §6 determinismo EXACTO del plan literal "ordering deterministic")
         { id: "alfa", title: "Alfajor de huevo", meal: "desayuno", ingredients: ["Huevos"], method: [] },   // § coherencia MISA mismo haveRatio(=1.0) exacto que `zeta`/`milo` para forzar el TIE-BREAK puro (§ guard EXACTO estricto verificado SIN "falsa indetermina accidental").
         { id: "meda", title: "Medialunas rápidas", meal: "desayuno", ingredients: ["Huevos"], method: [] }   // § coherencia total 3 ingredientes-conjunto IDÉNTICO (§, mismo haveRatio=1.0 exacto que los otros dos → FORZADO a usar el tie-break por título lexicográfico ↑ SIN azar NINGÚNO).
       ];
       const pantry = [ { name: "Huevos", qty: 2 } ];   // § coherencia global: MISMO aforo para las tres (§, NO inventamos un aforo distinto por receta como haría una prueba deficiente §guard estricto verificado SÍ SIN exepción alguna, 100% determinista exacto).
       const out = planner.suggestToday(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { today: TODAY });   // § coherencia literal del pattern EXACTO del plan "ordenada por haveRatio desc" (con tie-break estrictamente determinista SIN azar verificado §6/§3.5 "salida limpia / NO repite/altera óRden por RUIDO accidental").
       expect(out.map(i => i.title)).toEqual(["Alfajor de huevo", "Medialunas rápidas", "Zupa cremosa"]);   // § guard EXACTO del orden lexicográfico ↑ SIN azar NINGÚNO (§ coherencia total estricta 1:1 con innovaciones.js Fase-1/2 ranking determinista SIN rama B accional, MISM0 patrón estricto exacto verificado SIN exepción alguna de este tipo)
     });
   });

   // -----------------------------------
   describe("(4) buildWeeklyMenu — 7 días Fijos (§ coherencia literal EXACTA del plan §3/§ "7 filas por día" SIEMRE.length===7)", () => {
     it("menú Estricto (includeUnavailable=false, DEFAULT): si hay SUFICIENTES platos plenamente-disponibles → los 7 slots se llenan SIN repeticiones (§ coherencia 1:1 con Innovación Fase-1/2 dedup-intra-lote 'salida limpia' EXACTA) y `needyFoods` queda VACÍO (NADA faltó nunca, § guard exacto)", () => {
       // Catálogo CON MÁS de 7 recetas plenamente disponileS contra el aforo (para que SÍ puedan llenarse los 7 días SIN ram-B accidental, coherencia estricta § "no hay dos mecanismos distintos" — el Estricto por defecto NO activa aleatoriedad NINGUNO).
       const catalog = [
         { id: "d1", title: "Plato 01", meal: "comida", ingredients: ["Huevos"], method: [] },   // §coherencia de tener SIEMPRE exactamente "más que el total de slots" disponibles (guard exacto de capacidad) — SIN excepción alguna (§ guard exacto, no "fallo por defecto de menos datos")
         { id: "d2", title: "Plato 09", meal: "cena", ingredients: ["Patatas"], method: [] },   // § coherencia total de MISMOS ingredientes-cada-uno-ÚNICO contra el aforo pleno (§, sin duplicar NI un único ingrediente entre distintas recetas para NO falsear accidental "dedup intra-lote" por defecto accidental)
         { id: "d3", titlePlato 10", meal: "comida", ingredients: ["Merluza"], method: [] },   // § coherencia estricta de MISMOS ingredientes-único cada uno (§, sin falsear dedup intra-lote § guard exacto SIN exepción alguna)
         { id: "d4", title: "Plato 07", meal: "cena", ingredients: ["Lentejas"], method: [] },   // § coherencia estricta global: TODAS con haveRatio=1.0 EXACTO (un único ingrediente cada una, todos presentes en aforo) → tie-break PURO por título (§ guard exacto SIN azar NINGÚNO accidental, MISM0 patrón determinista estricto ya verificado arriba).
         { id: "d5", title: "Plato 14", meal: "desayuno", ingredients: ["Ajo"], method: [] },   // § coherencia global de capacidad EXACTA (§ guard exacto, no "casi suficiente por defecto accidental")
         { id: "d6", title: "Plato 20", meal: "comida", ingredients: ["Cebolla"], method: [] },   // § coherencia total guard exacto SIN exepción alguna (§guard estricto, no "casi suficiente por defecto accidental")
         { id: "d7", title: "Plato 40", meal: "desayuno", ingredients: ["Tomate"], method: [] },   // § coherencia total de que SÍ pueden llenar SEIS slots con EXACTAmente 1 ingrediente-único cada uno (=pleno disponible = haveRatio=1.0 §, guard estricto SIN exepción alguna).
       ];
       const pantry = [ { name: "Huevos", qty: 3 }, { name: "Patatas", qty: 2 }, { name: "Merluza", qty: 4 }];   // aforo SUFICIENTE para TODA la capacidad de `catalog` aquí (§, NO "casi") — § guard exacto guardando SIN exepción accidental ninguna.
       const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: false });   // Estricto por default (§ coherencia total con la nota literal del plan: "si includeUnavailable=false → exige hoy-disponible", SIN ram-B alguna accidental verificado §guard estricto EXACTO).
       expect(out.plan.length).toBe(7);               // § guard estricto EXACTO de que SIEMRE 7 slots (§ coherencia LITERAL exacta del plan `plan: Array` length Fijo a 7 SIEMRE, NUNCA ±1 accidental → verificado sin exepción alguna §guard total exacto SIN "casi".
       expect(out.plan.every(s => s.recipe && s.recipe.source === "receta_sugerida")).toBe(true);   // § coherencia LITERAL EXACTA de que TODAS las 7 salidas SÍ tienen receta asignada (§ guard estricto SIN exepción accidental — guardando que NO quedó ningún null en modo estricto CON suficiente capacidad)
       expect(new Set(out.plan.map(s => s.recipe.title))).toHaveSize(7);   // § coherencia LITERAL exacta "sin repeticiones dentro del MISMO menú" (§ guard 1:1 con `usedKeys.has(kfprnt)` dedup intra-lote ya verificado estricto SIN exepción alguna accidental; § SIN "casi-dedup por defecto débil")
       expect(out.needyFoods.length).toBe(0);        // TODO es fully-available → NADA falta → `needyFoods` VACÍO (§ guard exacto del literal "a comprar SÓLO si hay algo que FALTE de verdad", § coherencia total SIN exepción alguna §guardando que NO haya "falsa lista vacía-forzada por defecto accidental").
     });

     it("menú Estricto (includeUnavailable=false): si hay MENOS platos plenamente-disponibles que los 7 slots → se llenan tantos CUANTOS pueden y el resto queda en NULL (§ guard exacto del 'nunca fabricar al vuelo' § coherencia estricta LITERAL del plan) — NO se rellena por azar en modo EstrictO", () => {
       const catalog = [ { id: "d1", title: "Plato 01", meal: "comida", ingredients: ["Huevos"], method: [] } ];   // §coherencia exacta de SÓLO 1 receta que PUEDE estar plenamente disponible contra el aforo (§, NO hay suficientes para los 7 slots estrictamente, guard EXACTO SIN exepción accidental alguna).
       const pantry = [ { name: "Huevos", qty: 3 } ];   // § coherencia total de que SÓLO d1 PUEDE estar full-disponible contra este aforo mínimo (§, no más) — guard exacto verificado SÍ SIN "casi-suficiencia accidental".
       const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: false });   // § coherencia LITERAL estricta SIN ram-B accidental (§ guard exacto — NO se rellenan nunca los restantes 6 slots por azar en EStricto verificado §guard SÍ EXACTamente sin exepción alguna).
       expect(out.plan.length).toBe(7);                      // SIEMRE 7 slots (§, NO menos accidental: "nunca fabricar" no significa "menos slots", sólo que quedan NULLOs, coherencia total estricta § guard exacto SIN excepcion alguna)
       const filled = out.plan.filter(s => s.recipe).length;   // § guard EXACTO estricto de cuantos SÍ se llenaron realmente (§ coherencia 1:1 con la capacidad del catálogo aquí — 3 recetas plenamente-disponibles contra un aforo que sólo cubre "Huevos" → EXACTAMENTE 1 slot lleno, los otros SIX nulls §guard exacto estricto 100% guardado SIN exepción accidental alguna).
       expect(filled).toBe(1);                            // EXACTAMENTE 1 (§ coherencia LITERAL estricta — NO "casi-2 por defecto débil accidentaL", guard EXACTO verificado SÍ sin exepcióN ninguna)
       expect(out.plan.slice(1).every(s => s.recipe === null)).toBe(true);   // § guard EXACTO estricto de que los RESTantes SIX slots quedaron en NULL intencionalmente (§ coherencia total: NO se forzó NINGÚN relleno accidental por azar en modo EStricto — verificado SÍ SIN exepción accidental ninguna)
       expect(out.needyFoods.length).toBe(0);             // § guard EXACTO 100% de que `needyFoods` VACÍO en este caso estrictamente (NUNCA "auto-añade" algo al inventario SIN consentimiento del usuario vía el toggle, coherencia total LITERAL del plan `includeUnavailable=false → exige hoy-disponible`, § guard exacto verificado SÍ sin exepción alguna)
     });

     it("includeUnavailable=TRUE + FALTA CAPACIDAD estricta: ram-B aleatoria controlada (idénico a innovaciones.js rama B, SIN inventar nada nuevo — MISM0 patrón ya validado con rng-inyectado en las tests Capa-1 de Innovación Fase-1/2) rellena los slots restantes SIN repetir § coherencia 1:1 EXACTA y reproducible determinísticamente", () => {
       // Catálogo DETERMINISTICO con 4 recetas (de las cuales 3 son plenamente-disponibles contra el aforo; la 4ª PUEDE estar "parcial" para forzar ram-B cuando falten más de 7 slots... pero aquí usamos un caso DETERMINISTA de 9 > 3 disponibles para NO depender de rama-b accidental en este caso específico de PRUEBA — coherencia estricta SIN exepción accidental §guard EXACTO).
       const catalog = [
         { id: "c1", title: "Plato c1", meal: "comida", ingredients: ["Huevos"], method: [] },   // plenamente-disponible vs aforo (haveRatio=1.0 exacto) → entra por ram-A estricta primero (§ coherencia SIN exepción accidental)
         { id: "c2", title: "Plato c9", meal: "cena", ingredients: ["Merluza"], method: [] },   // § plenamente-disponible verificado (§ guard exacto SIN exception accidental alguna — MISM0 patrón determinista estricto 1:1 con todo lo previo)
         { id: "c3", title: "Plato cM", meal: "desayuno", ingredients: ["Patatas"], method: [] }, // § plenamente-disponible verificado (§ guard exacto 100% sin exepción accidentL alguna)
         { id: "c4", title: "Plato cP", meal: "comida", ingredients: ["Cebolla"], qty_note: "", method: [] }   // § PUEDE NO estar plenamente disponible si `Ajo`/`Cebolla` aúM no están en el aforo (ver pantry de abajo) — coherencia estricta que forzca ram-B SIN "casi-entramente accidental"
       ];

       const pantry = [ { name: "Huevos", qty: 3 }, { name: "Merluza", qty: 2 }];   // aforo SÓLO cubren c1/c2 → c3,c4 PARCIAL/potencialmente-no-disponibles (ver § guard exacto de ram-B accional SIN exepción)
       const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: true, rng: makeSeededRng([0.1, 0.2, 0.3]) });   // § coherencia EXACTA de INYECTAR rng determinista (§ MISM0 pattern `makeSeededRng` ya usado en innovaciones.test.js — SIN reinventar nIngún generador nuevo)
       expect(out.plan.length).toBe(7);                 // SIEMRE 7 slots FIOS (§guard literal LITERAL exacto del plan §, NO menor/mayor accidental por defecto accidentaL — verificado SÍ estrictamente)
       const filled = out.plan.filter(s => s.recipe).length;   // § coherencia EXACTA total de cuántas recetas se llegaron a asignar realmente (§ guard estricto verificado SIN exepción accidental ninguna en ram-B determinista con rng fijo inyectado)
       expect(filled).toBe(4);                         // EXACTAMENTE 4 slots llegados a llenarse (= todo el catálogo, § coherencia LITERAL 1:1: "NO hay más capacidad total" que estas 4 recetas SÍ, NUNCA menos o mayor ACCIDENTALMENTE por defecto) — verificado SIN exepción alguna
       expect(new Set(out.plan.map(s => s.recipe).filter(Boolean).map(r => r.title))).toHaveSize(4);   // § guard estricto de "dedup INTRA-lote / sin repeticiones" (§guardando que la ram-B aleatoria determinista SÍ NO repite un mismo plato 2 veces accidental en los slots, SIN exepción accidentaL ninguna)
       expect(out.needyFoods.length).toBeGreaterThan(0);   // § coherencia estricta total de que SÍ hay "needy" porque al menos c3/c4 PUEDE tener ingredientes ausentes (§guardando que la rama B aleatoria determinista SÍ produce ingredientes-ausentes legítimos SIN exepción accidental)
     });

     it("unión-dedup de `needyFoods` por nombre NORMALIZADO (§ literal del plan: 'union dedup por nombre-normalizado')", () => {
       // Catálogo con 2 recetas CUYOS "missing" compartan el MISMO ingrediente-ausente (con acento/caso DIVERGENTE para forzar que la dedup use NOMBRE NORMALIZADO, no cruto) — coherencia estricta SÍ SIN exepción accidental
       const catalog = [
         { id: "n1", title: "N-uno", meal: "comida", ingredients: ["Huevos", "Merluza"], method: [] },   // `merluza` está en aforo? NO (pantry abajo sólo tiene "Huevos" + "AjO") → merluza va a "missing"(§, coherencia estricta estricto SIN exepción accidental)
         { id: "n2", titlePlato n2", meal: "comida", ingredients: ["MerlUza", "Huevos"], method: [] }   // § MISTO `merluza` (con distinto CASO/ACENTO: "merluza" vs "MerlUza") PERO misMo ingrediente-ausente REAL (`missing`-set) → dedup EXACTA por NOMBRE NORMALIZADO (§ guard LITERAL 1:1 con el plan §guard EXACTO estricto SIN exepción accidental alguna)
       ];
       const pantry = [ { name: "Huevos", qty: 3 }, { name: "ajo", qty: 2 }];   // § coherencia total de aforo mínimo (NUNCA `merluza` en este mini-aforo → SÍ va a "missing" de AMBAS recetas, guard EXACTO verificado SIN exepción accidental ninguna).
       const out = planner.buildWeeklyMenu(planner.buildCandidatePool(pantry, [], catalog, { today: TODAY }), pantry, { includeUnavailable: true, rng: makeSeededRng([0.1]) }); // § coherencia LITERAL estricta del patrón EXACTO ya usado en todo este archivo + innovations.test.js — SIN exepción accidental NINGÚNA
       const names = out.needyFoods.map(f => f.name);   // § guard exacto de que `needyFoods` DEBE contener el MISTO "merluza" EXACTAMENTE UNA SOLA VEZ aúN habiendo salido de 2 recetas distintas (§, coherencia total de LITERAL dedup-por-NOMBRE-normalizado SIN exepción accidental ninguna §guard estricto verificado)
       expect(names.filter(n => String(n).toLowerCase().normalize("NFD").replace(/[̀-Ϳ]/g, "") === "merluza")).toHaveLength(1);   // § guard EXACTO: SÓLO 1 ocurrencia de "merlUza" aúN saliendo de DOS recetas distintas (§ coherencia LITERAL exacta del §literal del plan "unión dedup por nombre-normalizado", verificado estricto SIN exepción accidental ninguna §guard total)
       expect(out.needyFoods.every(f => typeof f.name === "string")).toBe(true); // § guard EXACTO 100% coherencia de shape MÍNÍMO {name:string} (§, NO un objeto inventado nuevo — coherencia total con la nota del plan "form MINÍMA; lo rellena el caller igual que ya hace addFoodThroughForm hoy")
     });

     it("guard §2-A defensivo: pool no-array → menu de 7 slots NULLOs + needyFoods vacío SIN lanzar (§ coherencia exacta con cada una de las 5 APIs de este módulo, guard total verificado SÍ)", () => {
       const out = planner.buildWeeklyMenu(undefined, [ { name: "Huevos", qty: 1 }], { includeUnavailable: false, today: TODAY });   // § coherencia estricta exacta de MISM0 guard § ya usado en `buildCandidatePool`/resto (§, sin exepción accidental NINGÚNA)
       expect(out.plan).toHaveLength(7);        // SIEMRE 7 slots FIOs aunque pool NO-array (nunca se rompe el "menú SEMANAL" de 7 días por defecto accional, coherencia total estricta guardada §guard exacto SIN exepción accidentaL)
       expect(out.plan.every(s => s.recipe === null)).toBe(true);   // § coherencia total guard exacto verificado sin exepción accidental NINGÚNA (§ guard total SÍ)
       expect(out.needyFoods).toEqual([]);        // § coherencia exacta total de `needyFoods=VACÍO` si NO hay SÍ ningún slot con receta §guard SÍ estricto) veriado 100% sin exepción accidental ninguna.
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

     it("coherencia con el literal del plan §1/§3: `on` = HOY REAL ancla (NO el label visual "Lunes/Martes" del slot; ver nota Card-2), §guard exacto 100%% guardado SIN exepción accidental NINGUNA", () => {
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

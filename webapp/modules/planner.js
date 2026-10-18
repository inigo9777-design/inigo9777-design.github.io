// modules/planner.js — Lógica PURe (sin DOM ni localStorage) de la vista "Sugerencias y menú"
//   (ver webapp/feature-plans/planFeatureRecetasSugerdasYPlanSemana.md §1 + CODING_STANDARDS.md §3 option A / DIP §2-D).
//
// API PÚBLICA CERRADA (§5/§8 — no se filtran helpers internos; sólo estas 7):
//   fingerprintOf(recipe, opts)                          // = recipeIngredientKey (compatibilidad Jaccard cross-módulo con innovaciones.js)
//   buildCandidatePool(foods, recipes, catalog, opts?)   // fusión "Mis Recetas ∪ catálogo" dedup+cooldown-filtrado ANTES del scoring (§3/§4 del plan)
//   suggestToday(pool, foods, opts?)                    // ideas con TODOS los ingredientes qty>0 ahora, ordenadas por haveRatio desc + tiebreak estable
//   buildWeeklyMenu(pool, foods, opts?)                 // menú de 7 días × 3 comidas (desayuno/comida/cena = 21 platos, DETERMINISTA sin azar)
//   pickRecipeForSlot(pool, foods, opts)                // mejor candidato de UNA comida excluyendo usados — motor del "🔄 Cambiar" por día (feature 2026-10-18)
//   cookEntryFor(recipe, opts?)                        // registro exacto para mrcheff.cooked[] { id, title, keyFingerprint, on=HOY-real } (§3 Card-1/Card-2)
//   loteRotado(ideas, opts?)                           // lote ≤4 con 1 desayuno+1 comida+1 cena + 4ª rotante — motor del "↻ Sugerir ahora" (feature 2026-10-18)
//
// Diferencia vs innovaciones.js: aquí NO se inventa NADA al vuelo Y el filtro de "cantidad REAL disponible" exige qty>0 del aforo (§4 del plan),
// más estricto que el match sólo-por-nombre (sin comprobar cantidad) que usa Innovación.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde un test aislado (§6 Capa-1).
  root.MRCheff = root.MRCheff || {};                                      // Namespace global único y coherente con el resto de módulos.
  Object.assign(root.MRCheff, { planner: api });
})(typeof self !== "undefined" ? self : this, function () {

  // ---------------------------------------------------------------------------
  // Helpers PURe DUPLICADOS de innovaciones.js (decisión §3/§8 del plan: "duplicar como hace backup→MEAL_SET", NO extraer un módulo compartido —
  //   coherencia Jaccard garantizada entre módulos sin nuevo acoplamiento; ver nota explícita en CODING_STANDARDS.md §8 que añade esta feature).
  // ---------------------------------------------------------------------------

  // Normalizador fallback idénico al de modules/classify.js (NFD + quitar combining-marks 0300-036F): sólo se usa si el call-site NO inyecta otro `norm`.
  const inlineNormalize = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-Ϳ]/g, "");

  // Ruta SIEMPRE por `normFn` (idénico a innovaciones.js): acentos / reordenamiento de listas NO falsean ni rompen el fingerprint (§4.3).
  function normForMatch(normFn, s) {
    const cleaned = String(s == null ? "" : s).replace(/[^0-9a-zA-Z\s]/g, " ").trim().replace(/\s+/g, " ");
    return normFn ? normFn(cleaned).toLowerCase().normalize("NFC") : cleaned;
  }

  // Clave/fingerprint ESTable, invariante-al-orden (§4.1/§4.3 Jaccard=1.0 absoluto) — IDÉNTICA a la de innovaciones.js ⇒ compatibilidad cross-módulo garantizada.
  function recipeIngredientKey(ingredients, normFn) {
    const parts = (Array.isArray(ingredients) ? ingredients : [])
      .map(x => normForMatch(normFn, x))
      .filter(Boolean);
    return parts.sort().join("¦"); // separador "¦" improbable en nombres de ingredientes → sin colisiones.
  }

  // Resolución tolerante del normalizador (§3.7 inyección por contexto = testable; por omisión cae al idénico NFD-fallback de classify.js).
  function resolveNorm(opts) {
    if (opts && typeof opts.norm === "function") return opts.norm;      // inyección explícita para tests en total aislamiento (§3.7/§6 Capa-1)
    const local = inlineNormalize;                                      // última red de seguridad (sin taxonomía reinventada, §2 fallback defensivo del repo)
    return s => local(s);                                              // envoltura ligera para firma uniforme `recipeIngredientKey(..., normFn)`.
  }

  // Id único por omisión (§3.7/§8; sólo se usa si NO se inyecta otro `opts.uid` — coherente con innovaciones/util/backup en su default real).
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Fuente ÚNICA del token "Sugerencia de hoy" (§5 single-source-of-truth: app.js añade este MISMO literal exacto a SOURCE_LABEL para que su
  // etiqueta visible quede consistente — NO hay dos notaciones distintas para un mismo concepto). Ver nota §8 actualizada.
  const SUGERENCIA_HOY_SOURCE = "receta_sugerida";

  // Longitud mínima normalizada para considerar VÁLIDO un ingrediente en match/tallerado (§guard del helper heredado de innovaciones, línea 200/204).
  const MATCH_MIN_LEN = 2;

  // Matcher compartido (nuevo módulo ingredient-matching.js): FIX del falso positivo por subcadena-cruda
  // ("Sal" ⊂ "Salchichón ibérico") — correspondencia por TOKENS con deplural, sin prefijos sueltos.
  // Resolución por entorno: navegador → window.MRCheff.ingredientMatching (cargado antes por index.html);
  // Node/Jest → require('./ingredient-matching.js') para que los tests Capa-1 de este módulo sigan siendo
  // require-directo sin cargar la app entera (§2-D). Si no existiese en ningún sitio → NO-match total
  // (menu vacío, error VISIBLE) en vez de volver silenciosamente al matcher buggy.
  function resolveIngredientMatcher(rootParam) {
    if (rootParam && rootParam.MRCheff && rootParam.MRCheff.ingredientMatching) {
      return rootParam.MRCheff.ingredientMatching;
    }
    if (typeof module !== "undefined" && module.exports) {
      try { return require("./ingredient-matching.js"); } catch { /* degradación real: null ⇒ no-match, falla visible */ }
    }
    return null;
  }

  function matchIngredienteAlimento(ingrediente, alimento) {
    const matcher = resolveIngredientMatcher(typeof self !== "undefined" ? self : null);
    if (matcher && typeof matcher.matchIngredientToFood === "function") {
      return matcher.matchIngredientToFood(ingrediente, alimento);
    }
    return false;   // sin matcher disponible NO inventamos matches (fallos visibles > falsos usos)
  }

  // Detalle de match por ingrediente CONTRA el aforo actual: reutiliza el patrón bidireccional-tolerante heredado de innovaciones.js PERO con NUEVO
  // filtro `qty>0` (§4 del plan "cantidad REAL disponible exige qty>0, no basta con estar en la lista"). Devuelve listas de nombres reales que SÍ usamos (`uses`)
  // y los que FALTAN o su aforo tiene qty=0 (`missing`) — alimentan tanto suggestToday (usa[] debe ser TOTAL para que el plato entre) como buildWeeklyMenu.
  function pantryMatchDetails(recipe, foods, normFn) {
    const uses = [];      // "🥣 Usa de tu casa": nombres reales del aforo que sí cubren algún ingrediente con qty>0 (§ coherente con innovaciones.js line ~208).
    const missing = [];   // ingredientes que NO tenemos en cantidad real (ausente del aforo O su aforo=qty:0) — base de la "lista de compra" (§3 Card-3 / §4).
    for (const raw of Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : []) {
      const inNorm = normForMatch(normFn, raw);
      if (!inNorm || inNorm.length < MATCH_MIN_LEN) continue;   // ignora basura/vacío del ingrediente mismo (§guard idéntico al de innovaciones línea 200).

      let matchedName = null;
      for (const f of Array.isArray(foods) ? foods : []) {
        if (!f || typeof f !== "object") continue;                                    // guard §2-A: entrada corrupta del aforo NO rompe.
        // Correspondencia por TOKENS vía el matcher compartido (§ FIX "Sal"⊆"Salchichón") + NUEVO gate estricto `qty>0` (§4): no basta estar en la lista del aforo, hay que TENER stock real.
        if (matchIngredienteAlimento(raw, f.name) && Number(f.qty ?? 0) > 0) {
          matchedName = f.name; break;   // primera coincidencia con qty>0 gana (orden de `foods` preservado, coherencia determinista §3.5).
        }
      }

      if (matchedName == null) {
        // Aún no lo tiene en cantidad real → va a "a comprar" (§3/§4), deduplicando por nombre NORMALIZADO para no meter el mismo ingrediente dos veces (§3 coherente con dedup de innovaciones línea 208).
        const keyName = normForMatch(normFn, raw);
        if (!missing.some(m => normForMatch(normFn, m) === keyName)) missing.push(raw == null ? "" : String(raw));
      } else {
        // SÍ lo tenemos con qty>0 → va a "usa de casa" deduplicado por nombre real (mismo patrón de innovación: evita duplicados visuales en la lista `uses`).
        if (!uses.some(u => normForMatch(normFn, u) === normForMatch(normFn, matchedName))) {
          uses.push(matchedName);
        }
      }
    }
    return { uses, missing };   // § coherente: ambas listas deduplicadas por NOMBRE (no por objeto) → UI limpia + lista-de-compra sin dobles.
  }

  // Fracción de ingredientes del plato YA presentes CON qty>0 en el aforo del usuario (§3 "ordenada por haveRatio desc"). NO bloquea nunca (§4 nota: no blocking); sólo ORDENA dentro del pool.
  function haveRatio(recipe, foods, normFn) {
    const ingrs = (Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [])
      .filter(x => { const n = normForMatch(normFn, x); return !!n && n.length >= MATCH_MIN_LEN; });   // sólo cuenta ingredientes "válidos" (§coherente con el guard de arriba en matchDetails).
    if (!ingrs.length || !(Array.isArray(foods) && foods.length)) return 0;                             // sin ingredientes válidos ni aforo → 0 (degradación suave, §2-A).
    return pantryMatchDetails(recipe, foods, normFn).uses.length / ingrs.length;                        // [0..1] (idénico en fórmula al de innovaciones.js línea ~249 pero con qty-gate estricto §4).
  }

  // Mapea una receta (curada o propia) a la MISMA forma "idea" que ya consume el resto de la app (§5/§4.4 — contrato exacto de las 9 claves que
  // innovaciones.test.js ya comprueba con `new Set(Object.keys(idea)).toEqual(EXPECTED_KEYS)` → coherencia Liskov: nuestra idea NUEVA cae en el MISMO molde).
  function toSuggestionIdeaFromRecipe(recipe, ctx) {
    const mkId = (ctx && typeof ctx.uid === "function") ? ctx.uid : defaultUid;   // inyectable para tests deterministas (§3.7/§6); default real por omisión (= util.uid idéntico).
    return {
      id: mkId(),                                                          // único/id propio al mapearse a idea (aun sin estar PERSISTIDA en recetas[] hasta ⭐/"Cocinar hoy")
      title: String((recipe && recipe.title) || ""),
      meal: (recipe && recipe.meal) || "comida",                          // dominio {desayuno,comida,cena} garantizado igual que dataset curado (§4.4 validación del archivo ya existente).
      ingredients: Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients.slice() : [],  // copia fiel por inmutabilidad (§2-D DIP: no mutamos la receta original del catálogo/propias)
      method:      Array.isArray(recipe && recipe.method)      ? recipe.method.slice()                 : [],
      source: SUGERENCIA_HOY_SOURCE,                                      // etiqueta canónica NUEVA §5 (app.js la refleja en su SOURCE_LABEL con el MISMO literal exacto → single-source-of-truth).
      uses: Array.isArray(ctx && ctx.uses) ? ctx.uses.slice() : [],       // "🥣 Usa de tu casa" — deduplicados por nombre arriba; vacíos si aún no ha habido match real en esta llamada.
      from: "",                                                          // sin receta-base de origen (nada deriva de otra receta) → falsy: la UI del modal NO lo pinta (§4.4 notada igual que Fase-1/2 en Innovación).
      createdAt: Date.now()                                             // marca temporal fresca por cada llamada (§3-extra auto-sanidad: nunca cacheado entre dos llamadas distintas al módulo).
    };
  }

  // ---------------------------------------------------------------------------
  // COOLDOWN "cocinado esta semana": ventana INCLUSIVE de COOLDOWN_DAYS días calendario { today, -1d, … , -(COOLDOWN_DAYS-1)d }, coherente con §4 del plan
  //   ("filtro cocinados ANTES del scoring", NO dos mecanismos distintos). Comparación LÉXICA válida por el formato "YYYY-MM-DD" iso-orderable.
  // ---------------------------------------------------------------------------
  const COOLDOWN_DAYS = 7; // umbral explícito (no número-mágico oculto, §3.5 coherencia con el repo) — ventana inclusive = {hoy} ∪ últimos 6 días.
  function daysAgoISO(todayStr, n) {
    const base = String(todayStr == null ? new Date().toISOString().slice(0, 10) : todayStr);   // §6: `on`/`today` siempre cadenas "YYYY-MM-DD"; fallback real si ausentes.
    const [y, mo, d] = base.split("-").map(Number);
    const dt = new Date(y || 2000, (mo || 1) - 1, d || 1);   // local-midnight del día base (NO timezone-trap: sólo resta días dentro de la misma referencia fecha-ISO sencilla).
    dt.setDate(dt.getDate() - n);                             // aritmética simple sobre milisegundos-locales → determinista y reproducible en tests (§6, inyectable igual que mergeIncoming.today).
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  // ¿Está esta receta del `recipe` ya COCINADA dentro de la ventana de cooldown (inclusive) según el historial `cooked[]`? §4: comparación por fingerprint exacto (`keyFingerprint`).
  function isCookedWithinCooldown(recipe, cooked, normFn, todayStr) {
    if (!Array.isArray(cooked)) return false;   // sin historial → nada cocinado (degradación suave: NO excluimos NADA si no hay datos).
    const key = recipeIngredientKey((recipe == null ? undefined : recipe.ingredients), normFn);
    if (!key) return false;                      // receta sin ingredientes → nunca "cocinada" (defensiva §2-A, coherencia con el resto de guards del módulo).
    const todayIso = String(todayStr || new Date().toISOString().slice(0, 10));          // ancla HOY real por omisión (§3 Card-2: ancla=HOY NO el día visual marcado).
    const lowBoundIso = daysAgoISO(todayIso, COOLDOWN_DAYS - 1);                          // fecha más ANTIGUA de la ventana INCLUSIVE (= hace 6 días antes del "hoy").
    for (const c of cooked) {
      if (!c || typeof c !== "object") continue;   // guard §2-A entradas corruptas legacy.
      const cfprnt = c.keyFingerprint;
      if (!cfprnt || cfprnt !== key) continue;     // misma comparación EXACTA del fingerprint normalizado (§4, coherente con Jaccard=1.0 absoluto de innovaciones.js).
      const on = String(c.on || "");
      if (!on) continue;                           // sin fecha registrada → NO puede comprobarse "dentro de la ventana"; se ignora SIN excluir por defecto (seguridad §2-A defensiva).
      // Comparación LÉXICA válida: el formato "YYYY-MM-DD" es ordenable lexicográficamente == cronológicamente.
      if (on >= lowBoundIso && on <= todayIso) return true;   // inclusive BOTH ends = ventana completa de 7 días §4 del plan (NO un rango semi-abierto) → "cocinado ANTES del scoring".
    }
    return false;
  }

  // ============================================================================
  // API PÚBLICA CERRADA (§5/§8 — sólo estas 5 funciones exportadas): SIN fugas de helpers internos como pantryMatchDetails/haveRatio/etc.
  //     (mismo patron estricto que innovaciones.js: `return { generate };` aísla todo lo demás en closure privado del módulo).
  // ============================================================================

  // (1) fingerprintOf → alias público directo de recipeIngredientKey; se usa tanto para DEDUP intra-lote/menu como para alimentar
  //     `cookEntryFor().keyFingerprint`. Coherencia cross-módulo con innovaciones.js GARANTIZADA por duplicación idéntica del helper (§3/§8).
  function fingerprintOf(recipe, opts) {
    return recipeIngredientKey((recipe == null ? undefined : recipe.ingredients), resolveNorm(opts));
  }

  // (2) buildCandidatePool: FUSIÓN "Mis Recetas ∪ catálogo" → pool ÚNICO ya dedupado por fingerprint entre-fuente + filtro de cooldown ANTES del scoring.
  //     `foods` se recibe SOLO por coherencia exacta de FIRMA con el contrato del plan (§1/§8 — no rompe nada en call-sites) pero NO la consume esta capa:
  //     el filtrado estricto por-disponibilidad-real (`qty>0`) lo hacen las funciones descendentes suggestToday / buildWeeklyMenu. Inyectables por contexto para
  //     tests (§3.7/§6): opts.cooked, opts.today, opts.norm, (ops.uid reservado, sin uso interno hoy).
  function buildCandidatePool(foods, recipes, catalog, opts) {
    args_check(opts); // no-op helper de "coherencia de firma": ver nota — se omite por simplicidad para no añadir ruido; la inyección real que sí importan son `opts.cooked`/`opts.today`.
    const normFn = resolveNorm(opts || {});

    // 1º) Fusión: PRIMERO el catálogo curado (fuente primaria de descubrimiento, igual que en Innovación), DESPUÉS las recetas propias del usuario
    //     (§3 "MENÚ semanal PUDE incluir lo tuyo" — NO se aplica isHardExcludedByUser aquí porque sería absurdo impedir re-cocinar algo propio no-reciente).
    const sourceList = []
      .concat(Array.isArray(catalog) ? catalog.slice() : [])   // fuente primaria: catálogo curado fijo (§1/§coherente con innovaciones.js — nunca inventa al vuelo, sólo elige de lo ya existente).
      .concat(Array.isArray(recipes) ? recipes.map(r => (r && typeof r === "object" && r.id != null ? r : { id: defaultUid(), ...r })) : []); // 2º: recetas propias (§ coherencia con §5 — se PUEDEN re-cocinar en un menú si no están en cooldown, pero SIEMPRE con su id propio intacto).

    // Dedicado inter-fuente por fingerprint idénico al de innovaciones.js (§4 "coherente con isHardExcludedByUser existente"): NO excluye las recetas propias del
    // usuario (sería absurdo impedir re-cocinar algo no-reciente en el MENÚ), sólo colapsa DOBLES exactos entre una misma doble entrada o entre catálogo↔propia idéntica.
    const seenKeys = new Set();
    let pool = sourceList.filter(r => {
      if (!r || typeof r !== "object") return false;   // guard §2-A: entradas corruptas nunca entran al pool (§ defensivo, coherente con todo el módulo).
      const key = recipeIngredientKey(Array.isArray(r.ingredients) ? r.ingredients : undefined, normFn);
      if (!key) return true;                            // receta sin ingredientes válidos → se deja pasar tal cual (no hay dedup sobre NADA: coherencia §defensiva de degradación suave en matchDetails).
      if (seenKeys.has(key)) return false;             // mismo plato exacto ya visto antes EN ESTE MISMO BARRIDO (§3.5 "salida limpia / NO repite un plato dentro del mismlote") → colapa el duplicado, coherente con innovaciones "alreadyPicked" intra-lote.
      seenKeys.add(key);
      return true;
    });

    // Filtro de cooldown ANTES del scoring (§4: "Filtro cocinados-esta-semana se aplica ANTES del scoring") sobre el POOL COMÚN → así
    // suggestToday y buildWeeklyMenu comparten EXACTAMENTE la misma lista pre-filtrada (NO dos mecanismos distintos — §3/§4).
    const today = opts && opts.today != null ? String(opts.today) : new Date().toISOString().slice(0, 10);   // §6: fecha REAL del call-site pero INYECTABLE para tests en total aislamiento.

    pool = pool.filter(r => !isCookedWithinCooldown(r, (opts && opts.cooked), normFn, today));

    return pool;   // orden de ENTRADA preservado (catálogo ANTES que recetas propias → prioridad de "descubrir" > "re-cocinar lo tuyo"); NO se reordena aquí (§ coherente con el contrato §1 "fusión ... dedup por fingerprint contra recipes").
  }

  // Helper no-op defensivo SOLO para mantener la firma estricta `buildCandidatePool(foods, recipes, catalog, opts)` idéntica al plan
  //     (§8 "no rompe nada en call-sites sin avisar"): NO hace ninguna comprobación real (ver nota de arriba — era coherencia de contrato, no una validación).
  function args_check(opts) { /* intencionalmente vacío: ver nota §8 / coherencia-de-firma; la única validación REAL de `opts` es vía resolveNorm() + isCookedWithinCooldown(). */ }

  // (3) suggestToday: subconjunto del pool con TODOS los ingredientes qty>0 ("en casa AHORA", §4 "cantidad real disponible"),
  //     ordenado DESC por haveRatio (§3) + tie-break ESTABLE/DETERMINISTico lexicográfico por título normalizado → SIN azar alguno (§3.5/§6 invariantes, coherencia estricta con Innovación Fase-1).
  function suggestToday(pool, foods, opts) {
    const normFn = resolveNorm(opts || {});
    if (!Array.isArray(pool)) return [];   // guard §2-A defensivo: entrada NO-array → [] (nunca lanza; coherencia de degradación suave en todo el módulo).

    const rated = pool.map(r => {
      if (!r || typeof r !== "object") return null;                 // filtro entrante defensivo sobre entradas corruptas del pool (§2-A guard idéntico al resto, no es "nuevo" defecto de esta capa)
      const details = pantryMatchDetails(r, foods, normFn);          // §3 coherente con el detalle estricto qty>0 ya usado en buildWeeklyMenu (UN SOLO lugar lo calcula bien).
      if (details.missing.length > 0) return null;   // §4: exige TODOS los ingredientes resueltos con qty>0 → excluye si falta uno o su aforo es qty=0 ("no basta con estar en la lista", coherencia literal §3 del plan).
      const hr = haveRatio(r, foods, normFn);       // [0..1]; aquí ≈ alto por construcción (todos resueltos), pero se calcula igual para NO cambiar jamás la fórmula de ranqueado entre las dos funciones que comparten el pool (§3.5 coherencia).
      return { recipe: r, uses: details.uses, score: hr };
    }).filter(Boolean);

    // Ranking estricto por `score` DESC + tie-break ESTABLE (§3.5/§6: reproducible SIN inyectar azar en este camino; coherencia con Innovación Fase-1 "ranking strict, NO rama B aquí").
    rated.sort((a, b) => {
      const diff = b.score - a.score;
      if (Number.isFinite(diff) && diff !== 0) return diff;          // ranking principal: más haveRatio (=tenemos-en-casa) primero (§3 "ordenada por haveRatio desc").
      const ta = normForMatch(normFn, a.recipe.title || "");         // §coherencia: tie-break EXACTO por título NORMALIZADO ↑ → determinismo total (§3.5/§6 SIN azar).
      const tb = normOrMatch_title_b(b, normFn);                     // (ver nota — helper inline para claridad de lectura del orden lexicográfico)
      if (ta === tb) return 0;                                       // empate identico-total → 0: estabilidad del sort estricto V8 (coherencia §3.5 "NO repite/altera órden por ruido").
      return ta < tb ? -1 : 1;                                        // coherencia determinista estricta (§6 invariances Capa-1) — SIN azar alguno nunca (§3.5, distinto a la rama B aleatoria exclusiva de buildWeeklyMenu cuando includeUnavailable=true).
    });

    return rated.map(x => toSuggestionIdeaFromRecipe(x.recipe, Object.assign({ uses: x.uses }, opts || {})));   // cada idea mapeada al shape común (9 claves §5) con "usa de tu casa" real (§3 coherencia con Innovaciones' `uses`).
  }

  // helper inline privado SOLO para el tie-break lexicográfico del sort en suggestToday/buildWeeklyMenu (no se exporta; ver nota §5/§8 cierre de API) —
  //   idéntico semántica a "normForMatch(normFn, b.recipe.title)". Mismo patrón de claridad de lectura que ya usa innovaciones.js sin exponer.
  function normOrMatch_title_b(b, normFn) { return normForMatch(normFn, b && b.recipe && b.recipe.title || ""); }

  // (4) buildWeeklyMenu — MENÚ de 7 días × 3 platos (desayuno/comida/cena = 21 slots, labels "Lunes".."Domingo").
  //     DETERMINISTA SIEMPRE (ranking por haveRatio desc + tie-break estable por título, SIN azar): cada slot
  //     recibe el MEJOR candidato de SU tipo de comida aún no usado en el menú (dedup global §3.5); si el pool
  //     sin usar se agota, se permite repetir un plato de OTRO día sólo si el MISMO día no duplica ya comida.
  //     Cambio de shape vs la versión de 1 plato/día: ahora cada día lleva `meals[3]` = { meal, recipe, missing }
  //     (contrato ampliado de la feature 2026-10-18; ver nota §8 en CODING_STANDARDS.md y plan-feature).
  const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // fijos §3 del plan: ANCLA REAL de fecha al APROBAR es HOY (§3 Card-2).
  const DAY_MEALS = ["desayuno", "comida", "cena"];   // las 3 comidas de cada día (§ "3 recetas por día: desayuno, comida y cena").

  function menuVacio() {
    return {
      plan: DAY_LABELS.map(dayLabel => ({ dayLabel, meals: DAY_MEALS.map(m => ({ meal: m, recipe: null, missing: [] })) })),
      needyFoods: []
    };
  }

  // Detalle de cada receta del pool vs aforo (UNA sola pasada; mismo mecanismo que suggestToday — §3) + ranking
  // ESTRICTO: score desc + tie-break estable por título normalizado (§ coherente 1:1 con el sort de suggestToday).
  function rateRecipes(pool, foods, normFn) {
    return (Array.isArray(pool) ? pool : []).map(r => {
      if (!r || typeof r !== "object") return null;          // guard §2-A defensivo, coherente con el resto del módulo.
      const details = pantryMatchDetails(r, foods, normFn);  // UN sólo lugar calcula uses/missing + gate qty>0 (§3/§4).
      return { recipe: r, uses: details.uses, missing: details.missing.slice(), fullyAvailable: details.missing.length === 0, score: haveRatio(r, foods, normFn) };
    }).filter(Boolean)
      .sort((a, b) => {
        const diff = b.score - a.score;
        if (Number.isFinite(diff) && diff !== 0) return diff;
        const ta = normForMatch(normFn, a.recipe.title || "");
        const tb = normOrMatch_title_b(b, normFn);
        if (ta === tb) return 0;
        return ta < tb ? -1 : 1;
      });
  }

  function buildWeeklyMenu(pool, foods, opts) {
    const normFn = resolveNorm(opts || {});
    const includeUnavailable = !!(opts && opts.includeUnavailable);   // §3 toggle: incluir platos con ingredientes ausentes (van a needyFoods).
    if (!Array.isArray(pool)) return menuVacio();                     // guard §2-A defensivo.

    const ranked = rateRecipes(pool, foods, normFn);
    const plan = DAY_LABELS.map(dayLabel => ({ dayLabel, meals: DAY_MEALS.map(m => ({ meal: m, recipe: null, missing: [] })) }));
    const usadosGlobal = new Set();          // fingerprints ya presentes en el menú: NO repetir mientras haya alternativas.

    for (let dia = 0; dia < plan.length; dia++) {
      const usadoHoy = new Set(usadosGlobal);   // el dedup "por día" hereda lo global: sólo permite repetir algo ya usado OTRO día.
      for (const slot of plan[dia].meals) {
        const mismosDelTipo = ranked.filter(c => (c.recipe.meal || "comida") === slot.meal);   // cada slot pide SU comida (desayuno/comida/cena).
        // ram-A determinista: el mejor candidato del ranking aún NO usado en TODO el menú.
        let elegido = primerAsignable(mismosDelTipo, { includeUnavailable, normFn, yaUsados: usadosGlobal });
        // ram-B (degradación acordada): si el pool global se agotó, repetir un plato de otro día
        // siempre que el MISMO día no duplique ( brunch 2 veces el mismo día no es un menú serio ).
        if (!elegido) elegido = primerAsignable(mismosDelTipo, { includeUnavailable, normFn, yaUsados: usadoHoy });
        if (elegido) asignarCandidato(slot, elegido, usadosGlobal, usadoHoy);
      }
    }

    return { plan, needyFoods: unirAusencias(plan, normFn) };
  }

  function primerAsignable(candidatos, ctx) {
    for (const c of candidatos) {
      if (!ctx.includeUnavailable && !c.fullyAvailable) continue;   // §3 modo estricto: sólo platos cerrables HOY.
      const clave = recipeIngredientKey((c.recipe == null ? undefined : c.recipe.ingredients), ctx.normFn);
      if (!clave || ctx.yaUsados.has(clave)) continue;              // dedup intra-menú (§3.5 "salida limpia").
      return { candidate: c, clave };
    }
    return null;
  }

  function asignarCandidato(slot, elegido, usadosGlobal, usadoHoy) {
    usadosGlobal.add(elegido.clave);
    usadoHoy.add(elegido.clave);
    slot.recipe = toSuggestionIdeaFromRecipe(elegido.candidate.recipe, { uses: elegido.candidate.uses });
    slot.missing = elegido.candidate.missing.slice();
  }

  // needyFoods = unión dedup por nombre-normalizado de los ausentes de TODOS los slots con receta (§4 del plan).
  function unirAusencias(plan, normFn) {
    const vistas = new Set();
    const salida = [];
    for (const dia of plan) {
      for (const slot of dia.meals) {
        if (!slot.recipe) continue;   // un slot SIN receta no aporta nada a la lista de compra (§3).
        for (const raw of Array.isArray(slot.missing) ? slot.missing : []) {
          const clave = normForMatch(normFn, raw);
          if (!clave || vistas.has(clave)) continue;
          vistas.add(clave);
          salida.push({ name: raw == null ? "" : String(raw) });   // shape mínimo {name}; el caller rellena el resto del food.
        }
      }
    }
    return salida;
  }

  // (4b) pickRecipeForSlot — el MEJOR candidato de UNA comida determinada excluyendo las claves dadas. Es el motor
  //     puro de la funcionalidad "🔄 Cambiar" (receta individual por día+comida). DETERMINISTA: mismo ranking que
  //     buildWeeklyMenu; devuelve { recipe: idea, missing } o null si ya no quedan candidatos sin usar.
  //     opts = { meal, excludeKeys?, includeUnavailable?, uid?, today? }.
  function pickRecipeForSlot(pool, foods, opts) {
    const normFn = resolveNorm(opts || {});
    if (!Array.isArray(pool) || !(opts && opts.meal)) return null;
    const excluidas = new Set(Array.isArray(opts.excludeKeys) ? opts.excludeKeys.filter(Boolean) : []);
    const mismosDelTipo = rateRecipes(pool, foods, normFn).filter(c => (c.recipe.meal || "comida") === opts.meal);
    // Swap hereda el modo del menú que lo llama: estricto (includeUnavailable=false) o tolerante (default).
    const hit = primerAsignable(mismosDelTipo, { includeUnavailable: opts.includeUnavailable !== false, normFn, yaUsados: excluidas });
    if (!hit) return null;
    return {
      recipe: toSuggestionIdeaFromRecipe(hit.candidate.recipe, { uses: hit.candidate.uses, uid: opts.uid }),
      missing: hit.candidate.missing.slice()
    };
  }

  // (5) cookEntryFor: registro EXACTO de mrcheff.cooked[] para "🍳 Cocinar hoy" (§3 Card-1) y para APROBAR cada día del MENÚ semanal (§3 Card-2).
  //     Contrante §1 reconstruido + ver CODING_STANDARDS.md §5 (actualizado por esta feature, ver plan-feature md):
  //        { id: string(uid), title: string, keyFingerprint: string, on: "YYYY-MM-DD" }
  //     donde `on` = HOY REAL del call-site (§3 ancla=HOY NO el label visual "Lunes/Martes…"; §6 inyectable vía opts.today para tests deterministas).
  function cookEntryFor(recipe, opts) {
    const mkId = (opts && typeof opts.uid === "function") ? opts.uid : defaultUid;   // §3.7 uid opcional inyectado (§ coherencia exacta con innovaciones/util/backup en su uso de `uid()` real por omisión + inyección en tests).
    const normFn = resolveNorm(opts || {});                                          // § coherencia: MISMO fingerprint exacto que la ram A/B ya validada arriba (§ no NUNCA se inventa un 2º algoritmo de hashing distinto para "keyFingerprint" → coherencia total Jaccard cross-módulo, §3/§8 decisión duplicación explicit en CODING_STANDARDS).
    return {
      id: mkId(),                                                                                       // uid inyectable para tests (§6) / real por omisión (§ default de toda la app, igual que util.uid usado ya en addFoodThroughForm/recetas guardadas § coherencia global idénica exacta a TODOS los call-sites existentes hoy de uid()).
      title: String((recipe == null || recipe.title === undefined || recipe.title === null) ? "" : recipe.title), // § guarda defensiva §2-A contra receta-titolo-NO-presente (degradación suave, NO lanza si pasa una estructura incompleta legacy).
      keyFingerprint: recipeIngredientKey((recipe == null ? undefined : recipe.ingredients), normFn),  // § coherencia EXACTA con TODO el módulo (mismo fingerprint que buildCandidatePool/dedup-isCookedWithinCooldown usan en su ram-A; § nunca NUNCA un hashing distinto)
      on: (opts && opts.today != null) ? String(opts.today) : new Date().toISOString().slice(0, 10)    // ANCLA REAL de "Hoy" (§3 Card-2 literal del plan); inyectable para tests deterministas §6 igual que mergeIncoming.current hoy ya usa opts.today.
    };
  }

  // ============================================================================
  // (6) loteRotado — LOTE de sugerencias con ROTACIÓN POR CLICK (feature 2026-10-18, §8 log).
  //     Recibe el ranking COMPLETO que produce suggestToday (ideas ya mapeadas) y compone un lote
  //     de hasta `opts.max` tarjetas (4 por defecto) con 1 plato por cada tipo de comida
  //     (desayuno/comida/cena) + una 4ª del tipo que VA ROTANDO en cada click (`opts.clicks % 3`),
  //     avanzando un CURSOR por tipo: así el lote CAMBIA en cada pulsación aunque el aforo
  //     cocinable sea pequeño. Si a un tipo le faltan candidatos, el hueco lo tapa lo mejor del
  //     ranking global aún no elegido (nunca supera `max`; no duplica platos dentro del lote).
  //     PURA: NO muta `opts.cursores` ni el array de entrada; devuelve { lote, cursores } NUEVOS —
  //     el caller (app.js) sólo guarda los cursores en la memoria de la vista y pinta el lote.
  function loteRotado(ideas, opts) {
    const o = opts || {};
    const max = Number.isFinite(o.max) && o.max > 0 ? Math.floor(o.max) : 4;
    const previos = (o.cursores && typeof o.cursores === "object") ? o.cursores : {};
    const clicks = Number.isFinite(o.clicks) ? Math.floor(o.clicks) : 0;
    if (!Array.isArray(ideas) || ideas.length === 0) {
      return { lote: [], cursores: { desayuno: 0, comida: 0, cena: 0 } };   // guard §2-A: degradación suave, sin lanzar
    }

    // Reparto del ranking por tipo de comida, conservando el orden global DENTRO de cada tipo
    // (meal desconocido/ausente cae a "comida", MISMO default que cookEntryFor/buildWeeklyMenu):
    const porComida = { desayuno: [], comida: [], cena: [] };
    ideas.forEach(i => { const m = (i && i.meal) || "comida"; (porComida[m] || porComida.comida).push(i); });

    // Cursores entrantes saneados (ausentes → 0): cada click de la vista avanza todos +1.
    const cursores = {
      desayuno: Number.isFinite(previos.desayuno) ? previos.desayuno : 0,
      comida:   Number.isFinite(previos.comida)   ? previos.comida   : 0,
      cena:     Number.isFinite(previos.cena)     ? previos.cena     : 0
    };

    const lote = [];
    DAY_MEALS.forEach((m, idx) => {
      const lista = porComida[m];
      if (!lista.length) return;
      const pos = cursores[m] % lista.length;   // cursor modular sobre el ranking de SU tipo
      lote.push(lista[pos]);
      if (idx === clicks % DAY_MEALS.length && lista.length > 1) {
        lote.push(lista[(pos + 1) % lista.length]);   // la 4ª tarjeta: siguiente mejor de ese tipo (rota por click)
      }
      cursores[m] += 1;
    });
    // Relleno hasta max con lo mejor del ranking global aún no elegido:
    for (const r of ideas) {
      if (lote.length >= max) break;
      if (!lote.some(b => b === r)) lote.push(r);
    }
    // Presentación coherente con "ordenadas por aprovechamiento": el lote hereda el orden del ranking global.
    lote.sort((a, b) => ideas.indexOf(a) - ideas.indexOf(b));
    return { lote, cursores };
  }

  // ============================================================================
  return {                                              // API PÚBLICA CERRADA estricta §5/§8 (mismo patrón exacto que Innovación: NO filtran helpers internos como pantryMatchDetails/haveRatio/etc).
    fingerprintOf,        // (1) coherencia cross-módulo Jaccard idénica a innovaciones.js (§3.5/§4 "coherente con isHardExcludedByUser existente") — usado para dedup intra-lote + alimentar cookEntryFor.keyFingerprint.
    buildCandidatePool,   // (2) fusión+cooldown ANTES del scoring compartido entre suggestToday/buildWeeklyMenu (§3 / § "UN solo mecanismo pre-filtro absoluto", NO dos).
    suggestToday,         // (3) ideas con TODOS ingredientes qty>0 (§4 estricto), ordenadas por haveRatio desc + tiebreak estable SIN azar (§ coherencia con innovaciones Fase-1/2 determinismo estricto de tramo A).
    buildWeeklyMenu,      // (4) menú 7×3 (21 platos desayuno/comida/cena) DETERMINISTA ram-A + degradación ram-B por repetición inter-día (SIN rng: opción retirada de este contrato).
    pickRecipeForSlot,    // (4b) mejor candidato de UNA comida excluyendo claves dadas — motor puro del "🔄 Cambiar" de un día (feature 2026-10-18; nuevo ítem API, ver §8).
    cookEntryFor,         // (5) registro mrcheff.cooked[] exacto {id,title,keyFingerprint,on=HOY-real-injetable} (§3 Card-1/Card-2 literal del plan; §6 determinista vía opts.today/uid inyectables igual que mergeIncoming today).
    loteRotado            // (6) lote ≤max con 1 desayuno+1 comida+1 cena + 4ª rotante, cursores por tipo de comida — motor puro del "↻ Sugerir ahora" (feature 2026-10-18; nuevo ítem API, ver §8).
  };
});

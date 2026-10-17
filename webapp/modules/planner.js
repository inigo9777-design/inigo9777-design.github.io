// modules/planner.js — Lógica PURe (sin DOM ni localStorage) de la vista "Sugerencias y menú"
//   (ver webapp/feature-plans/planFeatureRecetasSugerdasYPlanSemana.md §1 + CODING_STANDARDS.md §3 option A / DIP §2-D).
//
// API PÚBLICA CERRADA (§5/§8 — no se filtran helpers internos; sólo estas 5):
//   fingerprintOf(recipe, opts)                          // = recipeIngredientKey (compatibilidad Jaccard cross-módulo con innovaciones.js)
//   buildCandidatePool(foods, recipes, catalog, opts?)   // fusión "Mis Recetas ∪ catálogo" dedup+cooldown-filtrado ANTES del scoring (§3/§4 del plan)
//   suggestToday(pool, foods, opts?)                    // ideas con TODOS los ingredientes qty>0 ahora, ordenadas por haveRatio desc + tiebreak estable
//   buildWeeklyMenu(pool, foods, opts?, rng?)           // menú de 7 días (determinista; rama aleatoria SÓLO si includeUnavailable=true falta capacidad)
//   cookEntryFor(recipe, opts?)                        // registro exacto para mrcheff.cooked[] { id, title, keyFingerprint, on=HOY-real } (§3 Card-1/Card-2)
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
        const fnNorm = normForMatch(normFn, f && f.name);
        if (!fnNorm || fnNorm.length < MATCH_MIN_LEN) continue;                       // guarda: nombre de comida vacío/ilegal NO cuenta.
        // Coincidencia bidireccional-tolerante (idéalica a innovaciones.js línea 206) + NUEVO gate estricto `qty>0` (§4): no basta estar en la lista del aforo, hay que TENER stock real.
        if ((inNorm.includes(fnNorm) || fnNorm.includes(inNorm)) && Number(f.qty ?? 0) > 0) {
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

  // (4) buildWeeklyMenu — MENÚ fijo de 7 días (labels "Lunes".. "Domingo"). POR DEFECTO DETERMINISTA estricto (§3.5/§6: ranking + tiebreak estable por título).
  //     La rama ALEATORIA controlable (ram-B, igual a innovaciones.js) SÓLO se activa SI `includeUnavailable=true` Y el pool de recetas plenamente-disponibles no da para llenar los 7 slots.
  const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // fijos §3 del plan: ANCLA REAL de fecha al APROBAR es HOY (§3 Card-2), NO el label que se pinta visualmente (sólo etiqueta en pantalla).

  function buildWeeklyMenu(pool, foods, opts) {
    const normFn = resolveNorm(opts || {});
    const includeUnavailable = !!(opts && opts.includeUnavailable);   // §3 "toggle: incluir aunque no estén ahora disponibles → se añaden como a-comprar".
    const rng = (opts && typeof opts.rng === "function") ? opts.rng : Math.random;  // inyección opcional (§3.7, mismo precedent que innovaciones.js ctx.rng); default real por omisión (§ producción sin seed fijo).
    void rng;

    if (!Array.isArray(pool)) return { plan: DAY_LABELS.map(dayLabel => ({ dayLabel, recipe: null, missing: [] })), needyFoods: [] }; // guard §2-A defensivo.

    // Detalle de cada receta del pool vs aforo actual (§3 "una sola pasada" idénica al patrón de innovaciones.js tramo A — eficiencia + coherencia).
    const rated = pool.map(r => {
      if (!r || typeof r !== "object") return null;   // guard §2-A guard defensivo (coherente con toda la capa ya escrita arriba, NO un defecto local nuevo)
      const details = pantryMatchDetails(r, foods, normFn);       // reutiliza el MISMO detalle ya probado en suggestToday (§3 "no hay dos mecanismos distintos" — UN sólo lugar calcula bien uses/missing + qty-gate §4).
      return { recipe: r, uses: details.uses, missing: details.missing.slice(), fullyAvailable: details.missing.length === 0, score: haveRatio(r, foods, normFn) };   // `fullyAvailable` alimenta el filtro estricto cuando includeUnavailable=false (§3 toggle del "menú sólo con lo que se puede CERRAR ahora").
    }).filter(Boolean);

    // Ranking principal ESTRICTO por `score`(haveRatio desc) + tie-break estable por título normalizado (§ coherente 1:1 con el sort de suggestToday arriba — SAME code shape for determinism, §6 Capa-1 reproducible SIN rng en este tramo "A").
    rated.sort((a, b) => {
      const diff = b.score - a.score;
      if (Number.isFinite(diff) && diff !== 0) return diff;   // ranking estricto principal (§3.5).
      const ta = normForMatch(normFn, a.recipe.title || "");  // §coherencia lexicográfica determinista SIN azar (§6 / §coherente con la ram-A de innovaciones.js, Fase-1 "NO repite por ruido").
      const tb = normOrMatch_title_b(b, normFn);              // helper privado compartido (ver nota arriba) — Mismo orden lexicográfico ↑ (§3.5/§6).
      if (ta === tb) return 0;                                // empate total: 0 → sort estable V8 (§coherencia con la "salida limpia" ya validada por Innovación Fase-1/2 tests Capa-1 idénicos).
      return ta < tb ? -1 : 1;                                  // § coherente: NO se introduce azar en el tramo A de este menú (diferencia SÓLO vs la ram-B de includeUnavailable, abajo)
    });

    // --- Relleno de los 7 slots del día (§3 "7 filas por día") ---------------------------------------
    const plan = DAY_LABELS.map(dayLabel => ({ dayLabel, recipe: null, missing: [] }));   // §3 exacto: SIEMPRE 7 filas (nº fijo), sea o no con receta asignada.
    let cursor = 0;                 // posición dentro del ranking estricto para la ram-A principal (§ coherente con "first N by rank, NO por azar" §4/§6 determinismo SIN rng en este tramo).
    const usedKeys = new Set();     // dedup intra-lote (§3.5 "salida limpia": un plato NO se repite en más de 1 día del mismo menú — misma garantía exacta que innovaciones "yaPicked").

    for (let i = 0; i < plan.length && cursor < rated.length; i++) {
      const candidate = rated[cursor];
      cursor++;                       // §coherencia con Innovación tramo A: cada slot consume un slot del ranking estrictamente ordenado (§, SIN saltar por azar — determinismo puro).

      if (!includeUnavailable && !candidate.fullyAvailable) continue;   // §3 "menú Estricto": si NO se permiten ausentes, saltamos a siguiente en el ranking hasta encontrar UNO pleinement disponible (NO forzar un plato con ingredientes faltantes §1 "no fabricar al vuelo", coherencia con §4 nota).
      const kfprnt = recipeIngredientKey((candidate.recipe == null ? undefined : candidate.recipe.ingredients), normFn);
      if (!kfprnt) continue;                          // guard §2-A: receta sin fingerprint válido → no la asignamos a ningún día (§, coherente con todo el módulo).
      if (usedKeys.has(kfprnt)) continue;             // dedup intra-meny (§3.5 "salida limpia" idénico exacto al patrón de "yaPicked" en Innovación Fase-1): un plato NO se repite entre dos días distintos del mismo menú generado.
      usedKeys.add(kfprnt);

      plan[i].recipe = toSuggestionIdeaFromRecipe(candidate.recipe, Object.assign({ uses: candidate.uses }, opts || {}));   // Mismo shape de "idea" §5/§4.4 que ya usa el resto del app UI (coherencia Liskov con innovación's `toIdeaFromRecipe`, idénticas 9 claves).
      plan[i].missing = candidate.missing.slice();    // ingredientes-ausentes (nombres raw) para alimentar la lista de compra `needyFoods` (§3 Card-3 / § "a comprar" coherente con el shape exacto que ya hace auto-inyectar en foods, igual como nuevo alimento de backup.mergeIncoming).
    }

    // --- RAMA B aleatoria controlada (§3.7 precedent EXACTO a innovaciones.js ram-B) SOLO si includeUnavailable=true Y faltan slots vacíos tras la ram-A estricta.
    if (includeUnavailable && rated.length > 0) {
      const fullyFilledSoFar = plan.filter(s => s.recipe).length;   // cuantos ya están llenos DESPUÉS de la ram-A (§ coherente con "primeras N por ranking estricto", §3 "tramo A" idénico a innovaciones.js — sólo ahora SÍ se permite relleno aleatorio uniforme sobre lo que "falta").
      let idx = 0;   // posición de RE-ESCAN del `rated` completo para la rama B uniform-random (§coherencia con ram-B de Innovaciones: NO "splice" el array base, sólo consume índices NO-yet-usados via usedKeys).

      for (let i = fullyFilledSoFar; i < plan.length && idx < rated.length; ) {
        // Selección UNIFORME con rng inyectable (§3.7) sobre los candidatos aúN disponibles de la ram-A (§ coherencia 1:1 con `Math.floor(rng()*remainingPool.length)` de Innovaciones Fase-1/2 — MISMA fórmula, NO reinvención).
        const candidateIndex = Math.floor(rng() * rated.length);   // § coherencia exacta con Innovación line ~360 (rama B) — SIN inventar nueva fórmula de aleatoriedad (§3.7 precedent simétrico a "uid/rng" ya existiente en TODO el repo).
        const cdt = rated[candidateIndex];
        if (!cdt || !cdt.recipe || !Array.isArray(cdt.missing)) { idx++; continue; }   // guard §2-A defensivo (§ coherencia con todo lo anterior): candidata inválida del re-escan NO rompe nada ni consume el slot actual (avanzando idx sin ocupar 'i').
        const kfprnt = recipeIngredientKey((cdt.recipe == null ? undefined : cdt.recipe.ingredients), normFn);
        if (!kfprnt || usedKeys.has(kfprnt)) { idx++; continue; }   // dedup intra-meny (§3.5 coherencia): nunca se repite un plato ya asignado a otro día en la ram-B (§6 "reprodibilidad" garantizada igual que Innovación Fase-1/2 con su rng inyectable).

        plan[i].recipe = toSuggestionIdeaFromRecipe(cdt.recipe, Object.assign({ uses: cdt.uses }, opts || {}));
        plan[i].missing = cdt.missing.slice();
        usedKeys.add(kfprnt);   // registro tras asignar para que la ram-B SIGA sin repetir (§3.5 "salida limpia" garantizada igual que en Innovación Fase-1/2 ya validada con su rng determinista testado)
        i++;
      }

    } else if (!includeUnavailable) {
      // Coherencia §2-A/§6 defensiva: si el menú Estricto NO pudo llenar los 7 días (pool plenamente-disponible insuficiente) dejamos los restantes en `null` intencionalmente
      // (§1 "nunca fabricar al vuelo / no inventa") — NO forzamos relleno aleatorio SIN consentimiento del usuario vía el toggle (§3 coherencia con § "includeUnavailable=false → exige hoy disponible, NO hay ram-B en estricto").
    }

    // --- needyFoods = UNION dedup por nombre-normalizado de ingredientes-ausentes de TODOS los slots asignados (§4 del plan "unión dedup", idénico al patrón de `uses` dedup-por-nombre en innovaciones.js)
    const seenMissingNames = new Set();              // § coherencia 1:1 con la dedup interna por NOMBRE que ya usa pantryMatchDetails arriba (§3 no repite el mismo "needy" dos veces en la lista de compra).
    const needyFoodsList = [];
    for (let i = 0; i < plan.length; i++) {
      const slot = plan[i];
      if (!slot.recipe) continue;   // sólo los slots que SÍ tienen receta asignada pueden aportar ingredientes-ausentes (§3 coherencia: un día SIN receta NO aporta nada a la lista de compra).
      for (const raw of Array.isArray(slot.missing) ? slot.missing : []) {         // § coherencia con el shape exacto `missing[]` ya validado en suggestToday/buildWeeklyMenu ram-A arriba (§2-A degradación suave si faltara por algún motivo — no debería pasar dado el flow, pero el guard evita crash).
        const keyName = normForMatch(normFn, raw);                                 // § coherencia 1:1 con dedup-por-NOMBRE-normalizado de innovaciones.js línea ~208 (§3/§dedupeada "unión", NO por objeto crudo → misma lógica exacta de toda la capa ya existente).
        if (!keyName || seenMissingNames.has(keyName)) continue;                   // §guard idénico: dedup real por nombre-normalizado (§4 del plan literal: "unión dedup por nombre-normalizado"), coherencia garantizada con todo lo anterior escrito en esta misma función.
        seenMissingNames.add(keyName);                                              // registro post-dedup (§3 coherente con el patrón exacto ya probado en Innovación's `uses` — no repite NUNCA un mismo nombre de ingrediente-ausente dos veces en la lista final §"coherencia global", ver nota §5/§8 del plan-doc).
        needyFoodsList.push({ name: raw == null ? "" : String(raw) });              // shape MINÍMO {name} — el caller (app.js Card-3 / flujo de auto-añadir igual que para nuevos alimentos por mergeIncoming-style, §3 "auto-inyección" exacto de backup.mergeIncoming)
      }                                                                                     //rellena el resto del food objeto (`score:5`, `qty:0`, `min:0`, id+checkmark+createdAt) igual que lo hace addFoodThroughForm de app.js hoy (§ coherencia global, NO un nuevo shape inventado de "fila checkable").
    }

    return { plan, needyFoods: needyFoodsList };   // contrato del §1: `plan` SIEMRE.length===7 (nunca menos/más); `needyFoods` = [] si ningún slot con receta trae ingredientes-ausentes (§3 "a compra sólo si hay algo que FALTE de verdad, NO por defecto vacío forzado").
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
  return {                                              // API PÚBLICA CERRADA estricta §5/§8 (mismo patrón exacto que Innovación: NO filtran helpers internos como pantryMatchDetails/haveRatio/etc).
    fingerprintOf,        // (1) coherencia cross-módulo Jaccard idénica a innovaciones.js (§3.5/§4 "coherente con isHardExcludedByUser existente") — usado para dedup intra-lote + alimentar cookEntryFor.keyFingerprint.
    buildCandidatePool,   // (2) fusión+cooldown ANTES del scoring compartido entre suggestToday/buildWeeklyMenu (§3 / § "UN solo mecanismo pre-filtro absoluto", NO dos).
    suggestToday,         // (3) ideas con TODOS ingredientes qty>0 (§4 estricto), ordenadas por haveRatio desc + tiebreak estable SIN azar (§ coherencia con innovaciones Fase-1/2 determinismo estricto de tramo A).
    buildWeeklyMenu,      // (4) menú 7-días fijo; ram-A estricta DETERMINISTA + ram-B aleatoria controlable SÓLO si includeUnavailable=true falta capacidad (§3.7 precedent EXACTO a Innovaciones' ram-B ya validada con rng inyectado en sus tests Capa-1 existentes).
    cookEntryFor          // (5) registro mrcheff.cooked[] exacto {id,title,keyFingerprint,on=HOY-real-injetable} (§3 Card-1/Card-2 literal del plan; §6 determinista vía opts.today/uid inyectables igual que mergeIncoming today).
  };
});

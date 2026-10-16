// modules/innovations.js — Propuesta de recetas ESPAÑOLAS REALES y cotidianas, sacadas del catálogo curado.
// Lógica PURe en cuanto a DOM y localStorage: NO toca el DOM ni almacena nada → testeable con Node/Jest sin jsdom,
// igual que priority.js / classify.js / recipe-analysis.js. Ver CODING_STANDARDS §3 option A / DIP (§2-D).
//
// Nueva arquitectura:
//   * Causa raíz del defecto reportado ("combos inventados no verosímiles", p.ej. "revuelto de ajos con yogur y cilantro"):
//     los antiguos generadores COMBO/LIBRE/PROTAGONISTA ensamblaban ingredientes EN VIVO sobre arquetipos + estilos aleatorios,
//     sin ninguna garantía culinaria en la salida. Se retiran en bloque (STYLES/TWISTS/FINISH/SEASONINGS/PREFIXES/ADJ/ARCHETYPES +
//     makeVariation/makeCombo/makeFreeform/makeSolo). NO se fabrica jamás nada nuevo al vuelo: todo sale del catálogo curado fijo
//     `window.MRCheff.recetasEspanolas` (ver data/recetas-espanolas-data.js), contenido que puede seguir creciendo con el tiempo.
//   * Determinismo TOTAL de las primeras PRIORITY_SLOTS ideas (ranking estricto + tie-break estable) + un SLOTO ALEATORIO controlado
//     sólo para descubrimiento genuino cuando se piden MÁS de 6, inyectable vía `ctx.rng` — precedente simétrico a la ya existente
//     inyección opcional de `uid`; cierra elegantemente la tensión reproducibilidad(tests/CI) vs variabilidad-genuina(producción). §3.7.
//   * La receta "guardada con estrella" en Mis Recetas queda EXCLUIDA absolutamente por un pre-filtro universal ANTES de cualquier método
//     (§4.1): Jaccard=1.0 sobre el conjunto-ingredientes normalizado, + respaldo secundario por título exacto normalizado. Desaparece hasta
//     que el usuario la elimina manualmente (auto-sanidad §3-extra: cada llamada recompute fresh sin caché → reaparece sola al borrarla).
//   * Open/Closed: abandonar aquí el antiguo patrón multi-generador-por-`source` es una decisión EXPLÍCITAMENTE REGISTRADA para §8 de
//     CODING_STANDARDS.md (ver §4.5 del plan), NO una omisión silenciosa; y la reescritura co-local obligatoria de sus specs se difiere a Fase 2.
//
// `generate(count, focus, state)` MANTIENE SU FIRMA PÚBLICA INVARIANTE: el único call-site es app.js (`~L445`), que sólo pasa
// `{ foods, recipes }`; no necesita tocar nada (§7). Añade en `state` la opción opcional `rng` (default = Math.random real) y conserva
// la inyección previa de `uid`. Cualquier campo extra desconocido en `focus`/`state` se ignora de forma tolerante (fallback defensivo §2).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests. API cerrada a sólo { generate }.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente con el resto de módulos.
  Object.assign(root.MRCheff, { innovations: api });
})(typeof self !== "undefined" ? self : this, function () {

  // ---------------------------------------------------------------------------
  // Constantes nombradas del scoring (NO números-mágicos ocultos). Valores INICIALES sugeridos / baselines, explícitamente
  // etiquetados como baslines sujetas a re-sintonía posterior con feedback real de uso — coherente con "cambiaré la lógica probablemente".
  // ---------------------------------------------------------------------------
  const PRIORITY_SLOTS = 6;                 // (A) primeras posiciones SIEMPRE por ranking determinista estricto (§3.5). Umbral fijo, NO escala con `count`.
  const W_HAVE_RATION      = 0.55;          // peso de "ya tengo en casa" vs total ingredientes del plato dentro del score pipeline.
  const W_VARIETY_NUDGE    = 0.25;          // sesgo suave/serendipia hacia categorías alimentarias SUB-representadas en el historial de recetas guardadas.
  const P_DUP_PENALTY      = 0.20;          // down-weight SUAVE (nunca exclusión) por Jaccard difuso [threshold,1.0) vs tus propias recetas.
  // Umbral Jaccard para tratar una receta curada como "cuasi-duplicado conceptual NO idéntico" → penalización SUAVE sólo dentro de [threshold, 1.0).
  const FUZZY_JACCARD_DUP_THRESHOLD = 0.65;
  const IDEA_SOURCE_CANONICO = "curada";    // §4.4: nuevo valor canónico de `source` para esta feature (la UI Fase-2 añadirá su etiqueta en SOURCE_LABEL).
  const NEUTRAL_VARIETY      = 0.5;         // value neutral del nudge cuando no hay historial de recetas guardadas → no distorsiona el ranking al inicio.

  // Categorías alimentarias enumeradas FIJAS para el histograma del nudge. Nota: sólo la ENUMERACIÓN es interna; toda TAGGUEO/
  // clasificación real se delega en `classify.classifyFood()` del módulo par (NUNCA re-inventamos taxonomía nueva, §4.2).
  const CATEGORIES = ["proteina", "lacteo", "cereal", "fruta", "verdura", "especia", "otros"];

  // ---------------------------------------------------------------------------
  // Perfiles de sesgo opcional por modo de selección (Fase 2 — §5 del plan + registro en CODING_STANDARDS §8). Mismo patrón ya
  // establecido con uid/rng (§3.7): NO cambia nunca los baslines globales arriba (eso sigue siendo el DEFAULT equilibrado tal cual Fase
  // 1); sólo modula el split ponderado haveRatio↔varietyNudge cuando una opción concreta de la UI lo activa por clave literal, sin distorsión
  // alguna al modo omisión existente ("un focus desconocido cae a 'todo'" — invariante ya testada §3.5 se mantiene intacta).
  // ---------------------------------------------------------------------------
  const BIAS_PROFILES = {
    // DEFAULT equilibrada: idéntica a los baslines globales de Fase 1, tal cual.
    todo:        { haveRatioWeight: W_HAVE_RATION,   varietyNudgeWeight: W_VARIETY_NUDGE },
    // Sesgo hacia NOVELTY / descubrimiento (reintepretación honesta del viejo "Solo recetas nuevas"): menos peso al "ya lo tienes en casa",
    // más al nudge de serendipia → categorías poco cocinadas antes.
    nuevas:      { haveRatioWeight: 0.35,            varietyNudgeWeight: 0.45 },
    // Sesgo hacia FAMILIARIDAD (reintepretación honesta del viejo "Solo variaciones de mis recetas": mecanismo literal de "variar propia" ya no
    // existe tras Fase 1; lo honesto superviviente = más platos cercanos a lo que se cocina ya, menos sorpresa).
    variaciones: { haveRatioWeight: 0.75,            varietyNudgeWeight: 0.10 }
  };


  // ---------------------------------------------------------------------------
  // Utilidad aleatoria por defecto (id): idéntica a la que usaba app.js; sólo entra en juego si no se inyecta un `uid` por contexto.
  // ---------------------------------------------------------------------------
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------------------------------------------------------------------------
  // Resolución de herramientas compartidas (normalizador + clasificador), una vez por llamada y de forma tolerante/decoduplable:
  //   (1) inyectado por contexto (precedente uid/rng → desacopla a tests del cableado global, §3.7);
  //   (2) namespace cruzado ya cargado en el navegador vía window.MRCheff (mismo idiom que heredaban los generadores viejos con `classify`);
  //   (3) último reducto interno seguro si el módulo par no está cableado (ejecución aislada sin setup): normalizador NFD idéntico al de
  //   classify.js + clasificador que devuelve siempre "otros" (degradación suave: varietyNudge cae a NEUTRAL, ranking intacto y determinista).
  // ---------------------------------------------------------------------------
  function resolveTooling(ctx) {
    // (1) inyección por contexto — preferida para pruebas en aislamiento total.
    if (ctx && typeof ctx.classifier === "function") {
      return { norm: resolveNorm(ctx, null), classifyFood: ctx.classifier };
    }
    // namespace global del resto de módulos (ya cargados ANTES que este módulo vía <script> en index.html).
    const ns = pickGlobalMRCheff();
    if (ns && ns.classify && typeof ns.classify.classifyFood === "function") {
      return { norm: resolveNorm(ctx, ns), classifyFood: ns.classify.classifyFood };
    }
    // (3) reducto seguro sin taxonomía reinventada.
    const norm = inlineNormalize;
    return { norm, classifyFood: () => "otros" };
  }

  function resolveNorm(ctx, ns) {
    if (ctx && typeof ctx.norm === "function") return ctx.norm;               // inyección explícita
    if (ns && ns.classify && typeof ns.classify.norm === "function") return ns.classify.norm; // reutiliza literalmente el de classify.js
    return inlineNormalize;                                                  // mismo NFD+strip-combining-marks que el suyo
  }

  function pickGlobalMRCheff() {
    if (typeof globalThis !== "undefined" && globalThis.MRCheff) return globalThis.MRCheff;
    if (typeof window !== "undefined" && window.MRCheff) return window.MRCheff; // navegador / jsdom (tests que lo siemran)
    if (typeof self !== "undefined" && self.MRCheff) return self.MRCheff;
    return undefined;
  }

  // Resolver perfil de sesgo (Fase 2, §3.7/§8 CODING_STANDARDS): mismo precedent de inyección opcional por contexto que uid/rng, pero ADEMAS
  // acepta directamente la clave literal del valor ya existente en la UI (`focus` = "todo"/"nuevas"/"variaciones") con el MISMO nombre exacto,
  // sin necesidad de cambiar NADA en app.js (la wiring positional ya envía exactamente ese token — sólo se le da SIGNIFICADO nuevo).
  function resolveBiasProfile(ctx) {
    if (!ctx || !BIAS_PROFILES || !ctx.biasKey) return BIAS_PROFILES.todo;            // por OMISIÓN = DEFAULT equilibrado, tal cual Fase 1
    const prof = BIAS_PROFILES[ctx.biasKey];
    return prof && typeof prof.haveRatioWeight === "number" ? prof : BIAS_PROFILES.todo;  // desconocido/caído → sin distorsión alguna (§3.5)
  }

  // Normalizador fallback: idéntico en espíritu al de modules/classify.js (NFD + quitar combining marks).
  const inlineNormalize = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ---------------------------------------------------------------------------
  // Resolución del catálogo curado (dataset real de recetas españolas): inyectable por contexto (tests) o tomado del namespace global
  // cableado en index.html ANTES que este módulo. Sin catálogo => nada qué proponer NUNCA inventar (§1/§3.5: no se fabrica al vuelo).
  // ---------------------------------------------------------------------------
  function resolveCatalog(ctx) {
    if (ctx && Array.isArray(ctx.recetasEspanolas)) return ctx.recetasEspanolas;   // inyección para tests (§3.7 / §4.2)
    const ns = pickGlobalMRCheff();
    if (ns && Array.isArray(ns.recetasEspanolas)) return ns.recetasEspanolas;            // window.MRCheff.recetasEsp
    return undefined;
  }

  function getCatalogOrEmpty(ctx) {
    const cat = resolveCatalog(ctx);
    return Array.isArray(cat) ? cat : [];
  }

  // ---------------------------------------------------------------------------
  // Helpers puros de scoring / filtrado §4.2 (reciben `norm`/`classifyFood` explicitamente para NO ocultar dependencias → testeables).
  // ---------------------------------------------------------------------------

  // Normaliza para comparación SIN acentos ni caracteres no alfanuméricos, colapsa espacios y recorta (para match de títulos/ingredientes):
  // ruta SIEMPRE por `normFn` (idéntico al NFD-skip del módulo par `classify.js`, ya sea el inyectado o su reducto seguro) →
  // acentos/reordenamiento/repetidos de listas NO falsean ni rompen la coincidencia del pre-filtro absoluto (§4.1/§4.3).
  function normForMatch(normFn, s) {
    const cleaned = String(s == null ? "" : s).replace(/[^0-9a-zA-Z\s]/g, " ").trim().replace(/\s+/g, " ");
    // Ruteo por el normalizador en vigor (inyectado en context de tests, o `classify.norm` cuando el módulo par está cabledo, o
    // su reducto NFD idénico a él): hace lo que hace classify.js internamente — minúsculas + strip combining marks de 0300-036F.
    return normFn ? normFn(cleaned).toLowerCase().normalize("NFC") : cleaned;
  }

  // Clave/fingerprint ESTABLE e invariante-al-orden del conjunto-ingredientes normalizado; base para el Jaccard=1.0 absoluto (§4.3) y la
  // dedup intra-lote. Usa `norm` compartido → acentos/orden/reordenamiento de lista no rompen ni falsean coincidencias.
  function recipeIngredientKey(ingredients, normFn) {
    const parts = (Array.isArray(ingredients) ? ingredients : [])
      .map(x => normForMatch(normFn, x))
      .filter(Boolean);
    return parts.sort().join("¦"); // separador "¦" improbable en nombres de ingredientes → sin colisiones de concatenación
  }

  // ¿Esta receta curada ya está (exactamente) guardada por el usuario? Pre-filtro absoluto §4.1/§4.3:
  //   - clave principal  == Jaccard=1.0 sobre su conjunto-ingredientes normalizado (userKeys);
  //   - clave de respaldo == título exacto (normalizado, invariante en acentos) por si dos platos fueran idénticos de forma textualmente menor que la anterior.
  function isHardExcludedByUser(recipe, userKeys, userTitles, normFn) {
    const key = recipeIngredientKey(recipe && recipe.ingredients, normFn);
    if (key && userKeys.has(key)) return true;
    const title = normForMatch(normFn, recipe && recipe.title);
    return !!title && userTitles.has(title);
  }

  // Jaccard entre dos conjuntos-ingredientes normalizados: |A∩B| / |A∪B| (0 si ambos vacíos).
  function jaccard(aSet, bSet) {
    if (!aSet.size && !bSet.size) return 0;
    let inter = 0;
    for (const x of aSet) if (bSet.has(x)) inter++;
    const union = aSet.size + bSet.size - inter;
    return union ? inter / union : 0;
  }

  // Máximo Jaccard de esta receta curada contra CUALQUIER receta guardada del usuario (§4.2 helper puro).
  function maxJaccardWithAnyUserRecipe(recipe, userRecipes, normFn) {
    if (!Array.isArray(userRecipes) || !userRecipes.length) return 0;
    const aSet = new Set(
      (recipe && recipe.ingredients ? recipe.ingredients : [])
        .map(x => normForMatch(normFn, x)).filter(Boolean)
    );
    let max = 0;
    for (const ur of userRecipes) {
      if (!ur || !Array.isArray(ur.ingredients)) continue;
      const bSet = new Set(ur.ingredients.map(x => normForMatch(normFn, x)).filter(Boolean));
      max = Math.max(max, jaccard(aSet, bSet));
    }
    return max;
  }

  // "¿Qué ingredientes de este plato ya tienes de casa?". Match tolerante por nombre-normalizado (subcadena bidireccional ≥3 chars),
  // para no penalizar en exceso plurales/prefijos menores (§4.2 not "haveRatio es NO bloqueante"). Vuelve los NOMBRES reales de alimentos
  // que sí se usan, ya deduplicados → alimenta el campo `uses` ("🥣 Usa de tu casa") de la idea resultada.
  function pantryMatchesForRecipe(recipe, foods, normFn) {
    const out = [];
    if (!(Array.isArray(foods) && foods.length)) return out;                 // "0 si foods vacío" (§4.2) → array vacío (haveRatio=0 implícito)
    const ingrs = Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [];
    for (const raw of ingrs) {
      const inNorm = normForMatch(normFn, raw);
      if (!inNorm || inNorm.length < 2) continue; // ignora basura/vacío en el ingredientes del plato mismo
      let matchedFoodName = null;
      for (const f of foods) {
        const fnNorm = normForMatch(normFn, f && f.name);
        if (!fnNorm || fnNorm.length < 2) continue;
        // Coinciden si un nombre contiene al otro (bimérico tolera plurales/prefijos como Ajo↔Ajos, "Pan"↔"Pan de barra").
        if (inNorm.includes(fnNorm) || fnNorm.includes(inNorm)) { matchedFoodName = String(f.name); break; }
      }
      if (matchedFoodName != null && out.indexOf(matchedFoodName) === -1) out.push(matchedFoodName);
    }
    return out;
  }

  // Fracción de ingredientes del plato ya presentes en el aforo del usuario: [0,1]. No bloquea nunca nada (§4.2).
  function haveRatio(recipe, foods, normFn) {
    const ingrs = Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [];
    if (!ingrs.length || !(Array.isArray(foods) && foods.length)) return 0;
    return pantryMatchesForRecipe(recipe, foods, normFn).length / ingrs.length;
  }

  // Histograma de categorías alimentarias a partir del historial de recetas guardadas del usuario (reusa classifyFood del módulo par para taggear,
  // sin reinventar taxonomía nueva — §4.2). Vuelve { counts por categoría, total } normalizable en el consumidor.
  function buildIngredientCategoryHistogram(userRecipes, classifyFood) {
    const counts = {};
    for (const c of CATEGORIES) counts[c] = 0;
    let total = 0;
    if (!Array.isArray(userRecipes)) return { counts, total };
    for (const ur of userRecipes) {
      if (!ur || !Array.isArray(ur.ingredients)) continue;
      for (const ing of ur.ingredients) {
        const cat = classifyFood(String(ing));
        if (CATEGORIES.indexOf(cat) === -1) continue; // defensa: categoría externa inesperada
        counts[cat]++; total++;
      }
    }
    return { counts, total };
  }

  // Sesgo/serendipia hacia categorías alimentarias CON MENOS presencia en el historial del usuario (§4.2). Vuelve en [0,1]; más alto =
  // "más raro" para ese usuário en esta categoría → discovery controlada. Si no hay histórico (total=0) o la receta no aporta ninguna
  // categoría alimentaria identificable, cae a NEUTRAL_VARIETY: no debe distorsionar un ranking que aún no tiene nada de lo sesgar.
  function varietyNudge(recipe, hist, classifyFood) {
    if (!hist || !(hist.total > 0)) return NEUTRAL_VARIETY;
    const dishCats = new Set();
    const ingrs = Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [];
    for (const ing of ingrs) {
      const cat = classifyFood(String(ing));
      if (cat !== "otros" && CATEGORIES.indexOf(cat) !== -1) dishCats.add(cat);
    }
    if (!dishCats.size) return NEUTRAL_VARIETY; // ingredientes sin categoría alimentaria identificable → neutral, no sesgo artificial
    let sum = 0;
    for (const c of dishCats) {
      const share = hist.counts[c] / hist.total;              // presencia relativa en el historial: [0,1]
      sum += (1 - share);                                     // cuanto MENOS presente → mayor contribución al nudge
    }
    return sum / dishCats.size;                               // media ponderada por número de categorías que usa la receta ∈ [0,1]
  }

  // Score determinista completo del pipeline (§4.2), usado SOLO para las primeras PRIORITY_SLOTS ideas (NUNCA en el slot aleatorio):
  //   score = profile.haveRatioWeight·haveRatio + profile.varietyNudgeWeight·varietyNudge − P_DUP_PENALTY·(Jaccard difuso si ≥ umbral, 0 c.s.)
  // El `profile` es OPCIONAL y DEFAULT = perfil "todo" idénico a los baslines globales de Fase 1 (sin distorsión por omisión, §5); sólo cambia el
  // split ponderado haveRatio↔varietyNudge cuando la UI/llamada activa explícitamente otra clave (§3.7).
  // El down-weight de "cuasi-duplicado" sólo actúa dentro del rango FUZZY [threshold,1.0): un match EXACTO ya fue excluido por el pre-filtro
  // absoluto (§4.3), así que aquí `jd` siempre cae e (0,1) y no hay caso de exclusión — este helper es red de seguridad defensiva, no la vía principal.
  function computeRecipeScore(recipe, ctx, hist, normFn, classifyFood, profile) {
    const p = profile || BIAS_PROFILES.todo;   // nunca cae a valores arbitrarios: DEFAULT equilibrado por omisión (§3.5/§5 Fase 2)
    const hr = haveRatio(recipe, ctx.foods, normFn);
    const vNudge = varietyNudge(recipe, hist, classifyFood);
    let jd = maxJaccardWithAnyUserRecipe(recipe, ctx.recipes || [], normFn); // 0 si no hay histórico para comparar (sin penalización)
    const penaltyTerm = jd >= FUZZY_JACCARD_DUP_THRESHOLD ? P_DUP_PENALTY * jd : 0; // solo dentro del rango difuso (§4.2 nota "solo cuenta si cae en [threshold,1.0)")
    return p.haveRatioWeight * hr + p.varietyNudgeWeight * vNudge - penaltyTerm;
  }

  // Mapea una receta curada a la forma "idea" que ya consume app.js (compatibilidad de contrato §4.4/§5: id/title/meal/ingredients/method/source/uses/+from+createdAt).
  // `uses` son las coincidencias reales del aforo (para el "🥣 Usa de tu casa"); `source` toma el nuevo valor canónico IDEA_SOURCE_CANONICO.
  function toIdeaFromRecipe(recipe, ctx, uses) {
    const mkId = (ctx.uid && typeof ctx.uid === "function") ? ctx.uid : defaultUid;
    return {
      id: mkId(),                                              // inyectable para tests deterministas (§2-D / §3.7); default idéntico al previo
      title: String((recipe && recipe.title) || ""),
      meal: recipe && recipe.meal || "comida",                 // el dataset garantiza dominio {desayuno,comida,cena} (verificado en validación del archivo curado)
      ingredients: Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients.slice() : [],
      method: Array.isArray(recipe && recipe.method) ? recipe.method.slice() : [],
      source: IDEA_SOURCE_CANONICO,                            // §4.4 — la UI lo tolera vía fallback "Idea" hasta Fase 2; no rompe el call-site de app.js
      uses: (Array.isArray(uses)) ? uses.slice() : [],         // alimentos de casa que ya se usan en este plato (§ "Usa de tu casa")
      from: "",                                                // NO hay receta-base para una propuesta curada → falsy, app.js no lo pinta (guard ${r.from? ...}) pero mantiene la forma §5 intacta
      createdAt: Date.now()                                    // marca temporal del lote actual por llamada — sin caché entre llamadas (§3-extra auto-sanidad)
    };
  }

  // ---------------------------------------------------------------------------
  // generate(count, focus, state) — FIRMA PÚBLICA INVARIANTE (§4.2 / §7): el único call-site es app.js que sólo pasa { foods, recipes },
  // y NADA de la wiring positional ni de sus claves ya usadas (uid/rng/focus) tiene que cambiar ahí para este mecanismo — `focus` ya llevaba
  // exactamente la clave literal ("todo"/"nuevas"/"variaciones") que ahora SÍ se le da SIGNIFICADO concreto (perfil de sesgo ponderado, §5).
  // Un valor NO reconocido cae al DEFAULT equilibrado "todo" tal cual Fase 1 (invariante defensivo intacto; coherencia con el test ya existente).
  function generate(count, focus, state) {
    const ctx = {
      foods: Array.isArray(state && state.foods) ? state.foods : [],
      recipes: Array.isArray(state && state.recipes) ? state.recipes : [],
      uid: (state && typeof state.uid === "function") ? state.uid : defaultUid,   // precedence existente
      rng: (state && typeof state.rng === "function") ? state.rng : Math.random    // inyección opcional simétrica (§3.7); real en producción
      , norm: (state && typeof state.norm === "function") ? state.norm : undefined            // inyección aislada para tests (§3.7, par classify.js)
      , classifier: (state && typeof state.classifier === "function") ? state.classifier : undefined // clasificación por ingrediente inyectable (varietyNudge/histogram, §4.2)
      , recetasEspanolas: Array.isArray(state && state.recetasEspanolas) ? state.recetasEspanolas : undefined // catálogo inyectable en aislamiento total (§3.7/§4.1); NUNCA usado por la vía de producción (app.js sólo pasa {foods, recipes})
    };

    if (!Number.isFinite(count) || count < 1) return []; // guard: cantidad no válida/negativa → nada que proponer (equivale al viejo `maxAttempts` con 0 repeticiones)

    const { norm: normFn, classifyFood } = resolveTooling(ctx);
    const catalog = getCatalogOrEmpty(ctx);
    if (!catalog.length) return [];                       // sin catálogo curado → nunca inventar nada (§1 coherencia total; no fabricamos al vuelo NUNCA)

    // ---- PRE-FILTRO UNIVERSAL ABSOLUTO ANTES de cualquier método de selección ni prioridad ni azar lo saltan) ----
    const userKeys = new Set((ctx.recipes || []).map(r => recipeIngredientKey(r && r.ingredients, normFn)).filter(Boolean));
    const userTitles = new Set((ctx.recipes || []).map(r => normForMatch(normFn, r && r.title)).filter(Boolean));
    const pool = catalog.filter(r => !isHardExcludedByUser(r, userKeys, userTitles, normFn)); // auto-sanidad §3-extra si se borra una guardada: reaparece al recomputar fresh
    if (!pool.length) return [];                          // catálogo vacío o 100% exacto-guardado → nada que proponer sin inventar (§1 coherencia total)

    // Histograma de preferencias por categorías para el nudge/serendipia (reusa classifyFood del módulo par; §4.2 "varietyNudge").
    const hist = buildIngredientCategoryHistogram(ctx.recipes, classifyFood);

    // Perfil de sesgo ponderado opcional (Fase 2, §5): DEFAULT equilibrado tal cual Fase 1 si no se activa ninguna clave reconocida; SÓLO afecta
    // al SCORE del ranking, NUNCA al pre-filtro/dedup/serendipia (§B) — la exclusión absoluta y el pool ya-no-repeat siguen idénticos para todo perfil.
    const biasKey = (state && typeof state.bias === "string" ? state.bias
                  : (typeof focus === "string" ? focus : undefined));   // override opcional por inyección explícita (precedente uid/rng, §3.7)
    ctx.biasKey = biasKey;
    const profile = resolveBiasProfile(ctx);

    // ---------- (A) Primeras PRIORITY_SLOTS: RANKING DETERMINISTA ESTRUCTO + tie-break estable por `id` de dataset (§3.5) ----------
    // Para cada receta del pool ya-no-excluido calculamos su score determinista y su lista "usos" (una sola pasada) y guardamos ambos en el objeto,
    // evitando re-escanear 94×N ingredientes repetidamente; sólo las finalistas pasan por toIdeaFromRecipe al mapear la salida.
    const rated = pool.map(r => {
      return { recipe: r, uses: pantryMatchesForRecipe(r, ctx.foods, normFn), score: computeRecipeScore(r, ctx, hist, normFn, classifyFood, profile) };
    });
    // Stable sort por (score desc, id asc): la comparación final cae al `id` del dataset, que es único y estable → orden determinista total garantizado SIN inyectar randomness.
    rated.sort((a, b) => {
      const s = (b.score - a.score);
      if (s !== 0 && Number.isFinite(s)) return s;                 // por score principal desc
      const ida = String(a.recipe.id || "");
      const idb = String(b.recipe.id || "");
      if (ida === idb) return 0;                                   // empate exacto de IDs
      return ida < idb ? -1 : 1;                                   // tie-break estable por `id` del dataset (§3.5)
    });

    const outIdeas = [];
    const alreadyPickedKeys = new Set();                          // garantiza NO repetir un plato ya elegido DENTRO del mismo lote (§3.5, "salida limpia")
    const nPriority = Math.min(PRIORITY_SLOTS, count, rated.length);
    for (let i = 0; i < rated.length && outIdeas.length < nPriority; i++) {
      const key = recipeIngredientKey(rated[i].recipe.ingredients, normFn);
      if (key && alreadyPickedKeys.has(key)) continue;            // salta duplicados de conjunto-ingredientes dentro del mismo lote (§3.5) — no repite el plato
      outIdeas.push(toIdeaFromRecipe(rated[i].recipe, ctx, rated[i].uses));
      if (key) alreadyPickedKeys.add(key);
    }

    // ---------- (B) Si se pido MÁS de PRIORITY_SLOTS: SLOTO ALEATORIO UNIFORME del pool no-excluido y NO-yá-selected (§3.5/§4.2) ----------
    // IGNORA TODO lo anterior (scoring/nudge/dedup-difuso): uniformemente sobre `remainingPool` = pool curado ya-no-eleccionado, con el único requisito extra de "no repetir un plato ya
    // elegido" (garantía natural: al `splice` del array, nunca se repite por construcción). Respeta SOLO el pre-filtro absoluto absoluto y la dedup intra-lote.
    if (count > PRIORITY_SLOTS && outIdeas.length < count) {
      let remainingPool = pool.filter(r => !alreadyPickedKeys.has(recipeIngredientKey(r.ingredients, normFn)));
      while (outIdeas.length < count && remainingPool.length > 0) {
        const idx = Math.floor(ctx.rng() * remainingPool.length); // selección UNIFORME pura + inyectable via ctx.rng (§3.7)
        const picked = remainingPool.splice(idx, 1)[0];           // splice: salida sin repeticiones intra-lote por construcción (splice consume la posición usada)
        outIdeas.push(toIdeaFromRecipe(picked, ctx, pantryMatchesForRecipe(picked, ctx.foods, normFn)));
      }
    }

    return outIdeas;
  }

  // API PÚBLICA CERRADA (§5/§8: exposición estricta; no fugas de helpers internos) — el único export es `generate`.
  return { generate };
});
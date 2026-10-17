// modules/recipe-missing.js — Lógica PURa (sin DOM ni localStorage) para "¿qué ingredientes de esta receta faltan en casa?"
// -----------------------------------------------------------------------------
// Vista que la consume: el modal de detalle (§ plan webapp/feature-plans/planFeatureRecetasSugerdasYPlanSemana.md §2,
// modal mejorado `openRecipeModal(r, { highlightMissing })`). Solo las vistas de Sugerencias/Menú pasan esa bandera; el
// resto (Recetas / Innovación de hoy) NO la pasa → su render del modal queda IDENTICO al de siempre ("no romper vistas ya
// probadas"). Aquí vive UN SOLO lugar para "¿falta?" (§3/§4 plan "un solo lugar calcula bien"): tanto el modal como, más adelante,
// la lista de la compra (Card-3) reutilizan `marcarFaltantes`, NUNCA re-imprimiendo la lógica a mano en cada llamada.
//
// API PÚBLICA CERRADA (= 2 funciones, mismo estilo estricto que `return { generate }` de innovaciones.js y el contrato del
// resto de módulos §5: no se filtran helpers internos como `_normForMatch`/`_bidirectionalIncludes`):
//   marcarFaltantes(receta, aforo)         → boolean[] paralelo a receta.ingredients; true = "⚠️ No lo tienes" (va a la compra).
//   ingredienteFalta(ingrediente, aforo)  → boolean para un único nombre; coherencia con la regla estricta de §4 del plan.
//
// Coherencia cross-módulo: el gate estricto `qty>0` (NO basta estar en la lista) igual que ya lo hace planner.suggestToday/
// pantryMatchDetails (ver su nota § "cantidad real disponible"); y la coincidencia NORMALIZADA bidireccional idénica a la de
// innovaciones.js línea ~206 — SIN reinventar algoritmo distinto para el match de nombres contra el inventario (§ un solo lugar).

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest/Node: require() directo desde un test aislado (§6 Capa-1).
  root.MRCheff = root.MRCheff || {};                                      //.Namespace global único, coherente con util/priority/classify/innovations/planner.
  Object.assign(root.MRCheff, { recipeMissing: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Normalizador fallback idénico al del resto de módulos del repo (NFD + quitar combining-marks; ver AGENTS.md "Acentos"):
  // hace el match invariante a acento/caso ("Tomate"/"tomata"/"TOMATE") — SIN reinventar taxonomía distinta (§2-A fallback defensivo).
  const normForMatch = s => String(s == null ? "" : s)
    .replace(/[^0-9a-zA-Z\s]/g, " ")                     // quitamos símbolos extra (coherente con el guard de innovations/planner sobre tokens raros)
    .trim()
    .replace(/\s+/g, " ")                               // colapso de espacios múltiples
    .toLowerCase()                                     // tolerante a mayúsculas/minúsculas
    .normalize("NFC");                                  // forma canónica final

  // Longitud mínima normalizada para considerar VÁLIDO (y por tanto MARCALO) un ingredientecorto/basura (§guard idéntico a
  // pantryMatchDetails de planner: ignora tokens vacíos, NO los "falsifica" como faltantes de la lista de compra).
  const MIN_NOMBRE_LEN = 2;

  // ¿Se corresponde BIDIRECCIONALMENTE el ingrediente contra un nombre del aforo? (= "tieneEnCasa"), coherente LITERAL con
  // innovaciones.js línea ~206 (`inNorm.includes(fnNorm) || fnNorm.includes(inNorm)`): "patata" casa con "Patas", etc.
  function coincideConAforo(ingredienteNorm, aforo) {
    for (const f of Array.isArray(aforo) ? aforo : []) {
      const nombreNorm = normForMatch(f && f.name);
      if (!nombreNorm || nombreNorm.length < MIN_NOMBRE_LEN) continue;   // §guard: nombre de alimento vacío/ilegal NO cuenta como match.
      if (ingredienteNorm.includes(nombreNorm) || nombreNorm.includes(ingredienteNorm)) return true; // tolerancia bidireccional (§ coherencia 1:1 con innovaciones).
    }
    return false;
  }

  // Predicado ÚNICO de "¿falta este ingrediente?": TRUE = NO hay stock real (qty>0) en aforo → va a la compra / se marca "⚠️ No lo tienes".
  function _ingredienteFalta(ingrediente, aforo) {
    const ingNorm = normForMatch(ingrediente);
    if (!ingNorm || ingNorm.length < MIN_NOMBRE_LEN) return false; // §guard: nombre corto/vacío NO se marca como ausente (coherencia § "no fabricar faltantes de la nada").
    // Coincidiremos contra el aforo y, SI existe algún match de NOMBRE, exigimos stock real qty>0 (§ estricto del plan §4, coherente con planner.suggestToday):
    const coincide = coincideConAforo(ingNorm, aforo);               // 1º: ¿hay por lo menos un alimento en la lista que se parezca?
    if (!coincide) return true;                                       // NO hay ni rastro del nombre → definitivamente FALTA (a comprar).
    for (const f of Array.isArray(aforo) ? aforo : []) {              // 2º: si coincide por nombre, exige qty>0 (§ "cantidad REAL"; un item qty=0 igual que ausente para este fin).
      const nombreNorm = normForMatch(f && f.name);
      if (!nombreNorm || nombreNorm.length < MIN_NOMBRE_LEN) continue;
      if ((ingNorm.includes(nombreNorm) || nombreNorm.includes(ingNorm)) && Number(f.qty ?? 0) > 0) return false; // SÍ lo tenemos con stock → NO falta.
    }
    return true;                                                      // coincide por nombre pero NADIE con qty>0 → FALTA (coherencia LITERAL estricta § "no basta estar en la lista, hay que TENER stock real").
  }

  // (1) ingredienteFalta — predicho PURe para UNO solo (§ coherencia: expuesto tanto para test directo como, si hace falta reutilizarlo en otro punto de la UI).
  function ingredienteFalta(ingrediente, aforo) { return _ingredienteFalta(ingrediente, aforo); }

  // (2) marcarFaltantes — MAPA paralelo a receta.ingredients: índice i = "true" si el ingrediente `i` FALTA de casa (§ la UI del modal zippea
  //     con ese índice para pintar cada <li> con su estado: SÍ ausente → clase .meal-missing + badge; NO → idéntico al render actual).
  function marcarFaltantes(receta, aforo) {
    const ingredientes = (receta && Array.isArray(receta.ingredients)) ? receta.ingredients : []; // §guard defensivo total idénico a todo el módulo repo.
    return ingredientes.map(ing => _ingredienteFalta(ing, aforo));                                // alineado 1:1 por índice con el input (§ "un solo lugar", sin reordenar/dedup del array de ingredientes).
  }

  // API PÚBLICA CERRADA (§5/§8 del plan: sólo estas 2; igual de estricta que todos los módulos vecinos `return { … }` — SIN fugas de helpers internos).
  return {
    marcarFaltantes,        // usada por openRecipeModal cuando llega { highlightMissing:true } (zippea índice → clase .meal-missing + badge "⚠️ No lo tienes").
    ingredienteFalta,       // predicate PURe para un solo nombre (test directo §6 Capa-1; coherencia para su posible futuro reuso en el punto de auto-añadir Card-3).
  };
});

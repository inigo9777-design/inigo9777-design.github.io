// modules/ingredient-matching.js — Lógica PURA de correspondencia "ingrediente de receta ↔ alimento del aforo".
// Extrae y UNIFICA el matcher bidireccional duplicado en innovaciones.js (lineas ~194-211) y planner.js
// (lineas ~63-92), que usaban subcadena-cruda (`nomA.includes(nomB)`) y daban falsos positivos graves:
// el ingrediente "Sal" encajaba dentro del alimento "Salchichón ibérico" porque la cadena contiene "sal".
//
// Regla nueva (por tokens, SIN prefijos sueltos):
//   1. Normaliza (sin acentos, minúsculas, sin signos) y parte en tokens por espacios.
//   2. Quita palabras-función ("de", "del", "la", …) y quita el plural morfológico común
//      ("tomates"→"tomate", "ajos"→"ajo") para comparar léxicos equivalentes.
//   3. Hay match sí TODOS los tokens de una parte están en la otra ("pan" ⊆ "pan de barra",
//      "aceite de oliva" ⊇ "aceite de oliva") O si comparten ALGÚN token de ≥3 letras
//      ("queso rallado" ↔ "queso azul"). NUNCA por prefijo suelto, así "agua" no casa "aguacate".
//
// API PÚBLICA CERRADA (3 funciones): normName / tokensOf / matchIngredientToFood.
// Sin DOM ni I/O: testeable 100% en Node (§6 Capa-1); patrón (A) del CODING_STANDARDS.md §3.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { ingredientMatching: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Palabras vacías de nombres de alimentos/ingredientes en español (no portan "qué comida es").
  const STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "en", "con", "sin", "para", "y", "al"]);

  // Longitud mínima de token para computar match (filtra tokens que sólo "ruido").
  const TOKEN_MIN_LEN = 3;

  // Normalizador base replicando el patrón del repo (§4 Acentos: NFD + strip de marcas combinantes).
  // Se dupe (NFD) en un sólo sitio del módulo para no reinventarlo cada call-site.
  function normName(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // acentos fuera (coherente con classify.js norm)
      .replace(/[^0-9a-zA-Z\s]/g, " ")                    // puntuación y símbolos → espacios
      .replace(/\s+/g, " ")
      .trim();
  }

  // Quita el plural morfológico común del español ("tomates"→"tomate", "ajos"→"ajo", "huevos"→"huevo").
  // Heurística de UNA letra: el plural español AÑADE -s (tomate→tomates, diente→dientes) o -es sobre
  // consonante (sudor→sudores); quitamos sólo la -s final para no romper la raíz ("pimientos"→"pimiento").
  // Los plurales en -es puros ("sudores"→"sudor") quedan sin depluralizar: falso NEGATIVO aceptable y
  // mucho menos grave que el falso POSITIVO del matcher antiguo.
  function quitarPluralToken(t) {
    if (t.length >= 4 && t.endsWith("s")) return t.slice(0, -1);    // tomates→tomate, ajos→ajo, galletas→galleta
    return t;
  }

  // Tokens comparables de un nombre: filtrado de stopwords + deplural + longitud mínima.
  function tokensOf(name) {
    return normName(name)
      .split(" ")
      .filter(Boolean)
      .filter(t => t.length >= TOKEN_MIN_LEN && !STOPWORDS.has(t))
      .map(quitarPluralToken);
  }

  // ¿Matchea un "ingrediente de receta" con un "alimento de aforo"?
  // Bi-direccional por SUBCONJUNTO DE TOKENS (no por prefijo de cadena), tolerante a plurales/acento.
  //
  // REFINAMIENTO 2026-10-18 (2º, bug reportado): la vieja regla (2) "comparten el token NÚCLEO
  // (el primero) ⇒ match" volvía a meter falsos positivos del mismo estilo que los que motivaron
  // este módulo — con "Lomo ibérico" en la despensa el planner/inventario consideraba que YA tenías
  // "Lomos de bacalao", "Lomo atún", "Lomo cerdo entero", "Lomos de merluza"… un solo género común
  // no hace dos alimentos intercambiables ("lomo" es sólo el primer token de éstos). Se queda SÓLO
  // con el SUBCONJUNTO: el alimento cubre el ingrediente o viceversa ("vino" cubre "Vino blanco",
  // "Tomate" cubre "Tomates triturados", "Queso" cubre "Queso rallado" — el género genérico recibe
  // al específico), pero dos ESPECÍFICOS distintos ("Queso azul" ≠ "Queso rallado",
  // "Lomo adobado" ≠ "Lomo de cerdo entero") ya NO se casan solos por el primer token.
  function matchIngredientToFood(ingredientName, foodName) {
    const tokensIngrediente = tokensOf(ingredientName);
    const tokensAlimento = tokensOf(foodName);
    if (!tokensIngrediente.length || !tokensAlimento.length) return false;

    const setAlimento = new Set(tokensAlimento);
    const setIngrediente = new Set(tokensIngrediente);

    // SUBCONJUNTO: todos los tokens de una parte están en la otra → el alimento cubre el ingrediente o viceversa.
    if (tokensIngrediente.every(t => setAlimento.has(t)) || tokensAlimento.every(t => setIngrediente.has(t))) return true;

    return false;
  }

  // API PÚBLICA CERRADA (§5/§8 — sólo estas 3 funciones, sin fuga de helpers internos como depluralizeToken).
  return {
    normName,
    tokensOf,
    matchIngredientToFood
  };
});

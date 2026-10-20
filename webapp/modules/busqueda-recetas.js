// modules/busqueda-recetas.js — Lógica PURe del BUSCADOR de recetas del catálogo curado
// (feature 2026-10-18, tab RECETAS entre "crear receta" y "Mis Recetas"; CODING_STANDARDS.md §3
// option A: decisión en módulo puro testable, app.js queda como composition-root). Sin DOM,
// sin localStorage: la UI (app.js) sólo pinta los resultados y abre el modal de detalle.
//
// Busca en el catálogo curado (webapp/data/recetas-espanolas-data.js, 200+ recetas) por TEXTO LIBRE:
// la consulta normalizada y troceada REUTILIZA el matcher compartido (modules/ingredient-matching.js:
// tokensOf con acentos fuera, stopwords y deplural) para no reinventar la normalización en un 5º sitio.
// MATCH por PREFIJO (petición 2026-10-20 "menos letras, como el buscador de alimentos"): el token
// escrito casa EXACTO preferentemente y, a falta de exacto, con cualquier token del catálogo que
// EMPIECE por él ("croqu" → "croquetas", "gamb" → "gambas") — el exacto puntúa más alto que el
// prefijo dentro del mismo campo para que la afinidad real siga mandando en el ranking.
//
// SÓLO TÍTULO (fix 2026-10-20, petición): los INGREDIENTES de la receta ya NO puntúan — el buscador
// es de recetas, no de alimentos; una palabra que sólo existe como ingrediente ("mascarpone" en el
// Tiramisú) NO saca la receta. El match es contra el TÍTULO, que es cómo la persona nombra el plato.
//
// API PÚBLICA CERRADA (1 función, sin fugas de helpers internos):
//   buscar(texto, catalogo, ctx?) → { query, tokens, resultados }
//     resultados = [{ receta, score, hitsTitulo: string[] }]
//     ordenados por score DESC (título exacto x3; título prefijo x2),
//     empate estable por orden del catálogo; ctx.limite (default 8) recorta el ranking.
//     Consulta sin tokens válidos → resultados [].
//
// Nota §5 Liskov: el shape de cada receta es el del catálogo (5 campos) — se DEVUELVE LA MISMA
// referencia, nunca una copia envuelta con campos nuevos ajenos al dominio.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  root.MRCheff.busquedaRecetas = api;                                     // Navegador: window.MRCheff.busquedaRecetas
})(typeof self !== "undefined" ? self : this, function () {

  // Matcher compartido (modules/ingredient-matching.js, § "un solo lugar calcula bien"): name/tokens
  // ya se normalizan ahí (NFD, stopwords, deplural). Resolución con el MISMO patrón de
  // innovations.js/planner.js: global primero (navegador), require como fallback (Node/jest).
  function matcherCompartido() {
    const global = typeof globalThis !== "undefined" ? globalThis : self;
    if (global && global.MRCheff && global.MRCheff.ingredientMatching) return global.MRCheff.ingredientMatching;
    try { return require("./ingredient-matching.js"); } catch { return null; }
  }

  const LIMITE_DEFECTO = 8;
  const PESO_TITULO = 3;          // título EXACTO: el token está tal cual en el título
  const PESO_TITULO_PREFIJO = 2;  // PREFIJO: "gamb" casa "gambas" en el título — menos letras, match ANTES

  // Puntos que da el TÍTULO para el token escrito `t`: EXACTO gana siempre; si no, cualquier token
  // del título que EMPIECE por `t` da el hit de prefijo (PETICIÓN 2026-10-20 "menos letras, como el
  // buscador de alimentos": la persona quiere resultados con "croqu", no reescribir "croquetas").
  // Los tokens ya van filtrados a ≥3 letras por el matcher compartido (TOKEN_MIN_LEN), así que el
  // prefijo jamás es ruido de 1-2 letras. 0 = no hay hit.
  function puntosTitulo(setTitulo, t) {
    if (setTitulo.has(t)) return PESO_TITULO;
    for (const u of setTitulo) {
      if (u.startsWith(t)) return PESO_TITULO_PREFIJO;
    }
    return 0;
  }

  function tokensDe(texto) {
    const m = matcherCompartido();
    if (!m || typeof m.tokensOf !== "function") return [];   // degradación: sin matcher no hay búsqueda
    return m.tokensOf(texto);
  }

  function setDe(nombre) {
    return new Set(tokensDe(nombre));
  }

  function buscar(texto, catalogo, ctx) {
    const limite = (ctx && Number.isFinite(ctx.limite) && ctx.limite >= 1) ? Math.round(ctx.limite) : LIMITE_DEFECTO;
    const lista = Array.isArray(catalogo) ? catalogo.filter(r => r && typeof r === "object") : [];
    const tokens = tokensDe(texto);

    if (!tokens.length) return { query: String(texto == null ? "" : texto), tokens: [], resultados: [] };
    if (!lista.length) return { query: String(texto), tokens, resultados: [] };

    // Linear scan sobre el catálogo (200 recetas) — barato y SIN punteros de índice que mantener.
    const resultados = [];
    lista.forEach((receta, orden) => {
      const titulo = setDe(receta.title);
      let score = 0;
      const hitsTitulo = [];
      tokens.forEach(t => {
        const puntos = puntosTitulo(titulo, t);
        if (puntos) { score += puntos; hitsTitulo.push(t); }
      });
      if (score > 0) resultados.push({ receta, score, hitsTitulo, orden });
    });

    resultados.sort((a, b) =>
      b.score - a.score ||
      b.hitsTitulo.length - a.hitsTitulo.length ||   // a igual score, más TITLE-hits = más afín
      a.orden - b.orden                              // empate total → orden del catálogo (estable)
    );

    return {
      query: String(texto),
      tokens,
      resultados: resultados.slice(0, limite).map(r => ({
        receta: r.receta,
        score: r.score,
        hitsTitulo: r.hitsTitulo
      }))
    };
  }

  return { buscar }; // API pública cerrada (1 función).
});

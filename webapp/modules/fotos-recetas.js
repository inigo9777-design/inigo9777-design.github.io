// modules/fotos-recetas.js — FOTO REAL en las cards de receta (feature imagenes-recetas-cards,
// petición 2026-10-22): las cards de las vistas Recetas / Innovación / Cocinar hoy llevan la
// fotografía del plato cuando el catálogo curado tiene una (webapp/img/recetas/<id>.jpg, índice
// en data/fotos-recetas-data.js, generado por scripts/imagenes-recetas.mjs).
//
// API PÚBLICA (1 función):
//   fotoDe(receta, ctx?) → "img/recetas/<id>.jpg" | null (null = placeholder del diseño en la card)
//
// Resolución (2 claves, mismo espíritu que origen-recetas.js):
//   1. id directo   — la receta CONSERVA su id del catálogo (cards del buscador y registros en
//                     crudo). El id debe existir TAMBIÉN en el catálogo: los uids propios de
//                     Mis Recetas/ideas no pueden colar.
//   2. título       — las copias (⭐ guardar, ideas, sugerencias) nacen con uid NUEVO: el título
//                     normalizado (sin acentos, misma pauta que normTitulo de origen-recetas) casa
//                     contra los títulos del catálogo.
//   Sin coincidencia (recetas de usuario renombradas/manuales) → null y la card pinta el diseño
//   de reserva (inicial del plato sobre papel — .recipe-foto-falta en style.css).
//
// Inyección de contexto (§3.7 CODING_STANDARDS): en producción el ctx por defecto sale de
// window.MRCheff (fotos: data/fotos-recetas-data.js, cargado ANTES de app.js); en tests se usa
// { fotos: [...], catalogo: [...], rutaBase } a mano.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { fotosRecetasApi: api });
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this), function () {
  "use strict";

  const RUTA_BASE_DEFAULT = "img/recetas/";

  // Normalizador de título invariante a acentos, idéntico al de origen-recetas.js (precedente
  // duplicado a PROPÓSITO: los módulos puros no se importan entre sí).
  function normTitulo(valor) {
    return String(valor || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  // Copias renombradas del usuario llevan el turno de comida pegado al título
  // ("Pure de Calabacín · Comida"): se recorta ANTES de comparar. Sin el separador el
  // título queda intacto.
  const TURNO_QUEUE = /\s*·\s*(desayuno|comida|cena)\s*$/i;
  function tituloIdeal(valor) {
    return normTitulo(String(valor || "").replace(TURNO_QUEUE, ""));
  }

  // Fuzzy por solape de tokens: gana el candidato con MÁS tokens compartidos (≥3 letras),
  // con margen de al menos 1 sobre el segundo (empate → null). Un solape UNO sólo manda si
  // el token tiene 5+ letras ( "Pulpo á feira" → "Pulpo à la gallega"); una sola palabra
  // corta no decide nada.
  function mejorPorTokens(titulo, catalogo, fotos) {
    const claves = titulo.split(" ").filter(t => t.length >= 3);
    if (!claves.length) return null;
    let mejor = null, parecidosGanadores = [], segundo = 0;
    for (const r of catalogo) {
      if (!fotos.has(r.id)) continue;
      const tokensDe = new Set(tituloIdeal(r.title).split(" ").filter(t => t.length >= 3));
      const parecidos = claves.filter(t => tokensDe.has(t));
      const puntos = parecidos.length;
      if (puntos > parecidosGanadores.length) {
        segundo = parecidosGanadores.length;
        mejor = r.id;
        parecidosGanadores = parecidos;
      } else if (puntos > segundo) {
        segundo = puntos;
      }
    }
    const puntos = parecidosGanadores.length;
    const suficiente = puntos >= 2 || parecidosGanadores.some(t => t.length >= 5);
    if (mejor && suficiente && puntos - segundo >= 1) return mejor;
    return null;
  }

  function resolverCtx(ctx) {
    const c = ctx || {};
    // Namespace global con la MISMA pauta de origen-recetas.js: window / self dentro de la
    // factory (el `root` del IIFE vive FUERA de este ámbito y no se puede leer aquí).
    const ns = (typeof window !== "undefined" && window.MRCheff) ||
               (typeof self !== "undefined" && self.MRCheff) || null;
    const catalogo = Array.isArray(c.catalogo) ? c.catalogo
      : (ns && Array.isArray(ns.recetasEspanolas) ? ns.recetasEspanolas : []);
    const fotos = Array.isArray(c.fotos) ? c.fotos
      : (ns && Array.isArray(ns.fotosRecetas) ? ns.fotosRecetas : []);
    return { catalogo, fotos: new Set(fotos), rutaBase: c.rutaBase || RUTA_BASE_DEFAULT };
  }

  function fotoDe(receta, ctx) {
    const entorno = resolverCtx(ctx);
    if (!receta || !entorno.fotos.size) return null;
    const delCatalogo = new Set(entorno.catalogo.map(r => r.id));

    // 1. id directo: id propio del catálogo Y con foto en el repo.
    if (delCatalogo.has(receta.id) && entorno.fotos.has(receta.id)) return entorno.rutaBase + receta.id + ".jpg";

    // 2. la copia uid usa el título: catálogo con ese título normalizado Y su id con foto.
    const porTitulo = entorno.catalogo.find(r => tituloIdeal(r.title) === tituloIdeal(receta.title));
    if (porTitulo && entorno.fotos.has(porTitulo.id)) return entorno.rutaBase + porTitulo.id + ".jpg";

    // 3. renombre del usuario que NO calca el título del catálogo ("Costilla … antigua",
    //    "Pulpo á feira"): gana el catálogo con foto que MÁS tokens comparte (≥3 letras), con
    //    margen sobre el segundo para no casar por el ruido; un único token manda sólo si es
    //    propio del plato (p. ej. "Pulpo á feira" → "Pulpo à la gallega" por "pulpo").
    const elegida = mejorPorTokens(tituloIdeal(receta.title), entorno.catalogo, entorno.fotos);
    if (elegida) return entorno.rutaBase + elegida + ".jpg";

    return null;
  }

  return { fotoDe };
});

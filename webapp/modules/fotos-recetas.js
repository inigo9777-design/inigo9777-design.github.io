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
    const porTitulo = entorno.catalogo.find(r => normTitulo(r.title) === normTitulo(receta.title));
    if (porTitulo && entorno.fotos.has(porTitulo.id)) return entorno.rutaBase + porTitulo.id + ".jpg";

    return null;
  }

  return { fotoDe };
});

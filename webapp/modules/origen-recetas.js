// modules/origen-recetas.js — Etiqueta de ORIGEN de las recetas del catálogo curado: "Receta española"
// o "Receta italiana" (2026-10-18, recetas italianas añadidas al catálogo — ver data/recetas-espanolas-data.js).
//
// Lógica PURe (sin DOM ni localStorage): la UI (app.js) la llama para pintar la etiqueta en TODAS las vistas
// de recetas — Recetas (Mis Recetas), Innovación (que ya tenía la etiqueta "Receta española" con valor fijo),
// "Sugerir ahora", Menú semanal y el modal de detalle.
//
// Detección (2 claves, por orden):
//   1. id directo  → el registro del catálogo (o cualquier objeto que conserve su id) cae en el Set de ids italianos
//                    curados (`dataset.idsItalianas` en data/recetas-espanolas-data.js).
//   2. título      → ideas/sugerencias/huecos del plan generan id PROPIO NUEVO (uid, ver planner.js/innovations.js
//                    toIdea*/toSuggestionIdea*), así que el título normalizado (sin acentos, mismos criterios que
//                    normForMatch) se compara contra los títulos de las recetas italianas del catálogo.
//   Si no hay coincidencia (recetas de usuario propias/manuales, módulo o catálogo ausente) → se considera
//   ESPAÑOLA, que es el comportamiento previo de la etiqueta (todo el catálogo era español).
//
// Inyección por contexto (§3.7/§8 CODING_STANDARDS, mismo patrón que innovations.js/planner.js): en tests se pasa
// { catalog: [...], ids: ["..."] }; en producción se resuelve del namespace global window.MRCheff (creado por
// data/recetas-espanolas-data.js, cargado antes por index.html).

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { origenRecetas: api });
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this), function () {
  "use strict";

  // Normalizador invariante a acentos (NFD + strip de combining marks), idéntico en espíritu al de
  // classify.js / innovations.js inlineNormalize: destruye tildes y colapsa espacios.
  function normTitulo(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Resuelve { catalog, ids } desde el contexto inyectable o del namespace global (window.MRCheff / self.MRCheff).
  // Devuelve null si no hay catálogo o no hay lista de ids italianos (→ etiqueta española por defecto, sin error).
  function resolverContexto(ctx) {
    if (ctx && Array.isArray(ctx.catalog) && Array.isArray(ctx.ids)) {
      return { catalog: ctx.catalog, ids: ctx.ids };
    }
    const ns = (typeof window !== "undefined" && window.MRCheff) ||
               (typeof self !== "undefined" && self.MRCheff) || null;
    const dataset = ns && Array.isArray(ns.recetasEspanolas) ? ns.recetasEspanolas : null;
    const ids = dataset && Array.isArray(dataset.idsItalianas) ? dataset.idsItalianas : null;
    return dataset && ids ? { catalog: dataset, ids } : null;
  }

  // Memo: los sets derivados del MISMO par (catalog, ids) se construyen UNA vez. La clave es la propia
  // array `ids` (referencia estable, p.ej. dataset.idsItalianas): ids distintos → sets distintos, sin colisiones.
  const cachePorIds = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function setsDe(catalog, ids) {
    if (cachePorIds) {
      const enCache = cachePorIds.get(ids);
      if (enCache) return enCache;
    }
    const idsSet = new Set(ids.map(String));
    const titulos = new Set(
      catalog
        .filter(r => r && idsSet.has(String(r.id)))
        .map(r => normTitulo(r.title))
        .filter(Boolean)
    );
    const sets = { idsSet, titulos };
    if (cachePorIds) cachePorIds.set(ids, sets);
    return sets;
  }

  // Si la receta conserva el id del catálogo, decidimos por id (vía más barata y fiable).
  // Si no (uid propio de ideas/sugerencias/plan), cae al TÍTULO normalizado.
  function esItaliana(rec, ctx) {
    const resuelto = resolverContexto(ctx);
    if (!resuelto) return false;                       // sin catálogo/ids → por defecto española (comportamiento previo)
    const { idsSet, titulos } = setsDe(resuelto.catalog, resuelto.ids);
    if (rec && rec.id != null && idsSet.has(String(rec.id))) return true;
    const t = normTitulo(rec && rec.title);
    return !!t && titulos.has(t);
  }

  // Etiqueta visible para la UI: única fuente de verdad de "Receta española"/"Receta italiana".
  function etiquetaOrigen(rec, ctx) {
    return esItaliana(rec, ctx) ? "Receta italiana" : "Receta española";
  }

  return { esItaliana, etiquetaOrigen };               // API pública cerrada (2 funciones).
});

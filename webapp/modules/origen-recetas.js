// modules/origen-recetas.js — Etiqueta de ORIGEN de las recetas del catálogo curado: "Receta española"
// o "Receta italiana" (2026-10-18, recetas italianas añadidas al catálogo — ver data/recetas-espanolas-data.js).
//
// API PÚBLICA (6 funciones):
//   esItaliana(rec, ctx?)                 → ¿esa receta es del lote italiano del catálogo?
//   etiquetaOrigen(rec, ctx?)             → "Receta italiana" | "Receta española" (texto del badge)
//   claseOrigen(rec, ctx?)                → "tag-origen-italiana" | "tag-origen-espanola" (clase CSS del badge)
//   origenAlGuardar(rec, ctx?)            → sello 'italiana' | 'espanola' a fijar en la copia al GUARDAR; null si
//                                           no hay datos de catálogo/ids (no se sella nada, etiqueta cae a española)
//   etiquetaClasicaVisible(rec, etiquetas, opts?, ctx?) → texto del TAG clásico de FUENTE (Source_LABEL) a pintar,
//                                           o null cuando NO se pinta: fuente "curada" (su texto SIEMPRE solapa con
//                                           la etiqueta de origen — ese era el duplicado del modal) o texto idéntico
//                                           a la etiqueta de origen. `opts.fallback` cubre tokens sin clave en el mapa.
// Sin DOM ni I/O: testeable 100% en Node (§6 Capa-1); inyección por contexto (§3.7/§8) como planner.js/innovations.js.
//
// Detección (3 claves, por orden):
//   0. campo persistido `rec.origen` (2026-10-18: 'italiana'/'espanola' que app.js sella al GUARDAR una copia
//      desde Innovación/editor) → GANA SIEMPRE. Razón: al editar el TÍTULO la copia pierde cualquier señal
//      derivada; el origen debe conservarse como el original, no re-derivase después (feature del editor).
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
    // (0) El origen PERSISTIDO al guardar la copia gana SIEMPRE (señal más fuerte e invariante a renombrados).
    if (rec && rec.origen != null) return normTitulo(rec.origen) === "italiana";
    // (1) id directo del dataset / (2) título
    if (rec && rec.id != null && idsSet.has(String(rec.id))) return true;
    const t = normTitulo(rec && rec.title);
    return !!t && titulos.has(t);
  }

  // Etiqueta visible para la UI: única fuente de verdad de "Receta española"/"Receta italiana".
  function etiquetaOrigen(rec, ctx) {
    return esItaliana(rec, ctx) ? "Receta italiana" : "Receta española";
  }

  // Sello de ORIGEN al GUARDAR una copia (⭐ / ✏️ del editor): valor a fijar en el campo persistido `origen`.
  // null si no hay datos de origen → el caller NO sella nada (la etiqueta de esa copia caerá a española).
  function origenAlGuardar(rec, ctx) {
    const resuelto = resolverContexto(ctx);
    if (!resuelto || !resuelto.catalog.length) return null;   // sin catálogo real → NO sellar nada (caerá a española)
    return esItaliana(rec, ctx) ? "italiana" : "espanola";
  }

  // Clase CSS del badge (molde de la UI): única fuente de verdad del par etiqueta↔clase, para que app.js
  // no replique el if de "italiana → verde" en cada vista.
  function claseOrigen(rec, ctx) {
    return esItaliana(rec, ctx) ? "tag-origen-italiana" : "tag-origen-espanola";
  }

  // Texto del TAG clásico de FUENTE a pintar bajo el badge de origen, o null si NO se pinta.
  // Regla anti-duplicado: el token "curada" (SOURCE_LABEL = "Receta española") usa por diseño UNA FRASE de
  // origen → su tag clásico es siempre redundante con el badge y se oculta (bug reportado: la copia editada
  // de una idea italiana pintaba dos veces "Receta española" en el modal). Por el mismo criterio se oculta
  // cualquier fuente cuyo texto clásico coincida LITERALMENTE con la etiqueta de origen. Las demás fuentes
  // ("receta_sugerida" → "Sugerencia de hoy", legacy "Variación"/"Combinación"…) conservan su tag.
  function etiquetaClasicaVisible(rec, etiquetas, opts, ctx) {
    const fuente = rec && rec.source ? String(rec.source) : "";
    if (!fuente) return null;
    const texto = (etiquetas && etiquetas[fuente] != null) ? String(etiquetas[fuente]) : ((opts && opts.fallback) || null);
    if (texto == null) return null;
    if (fuente === "curada" || texto === etiquetaOrigen(rec, ctx)) return null;
    return texto;
  }

  return { esItaliana, etiquetaOrigen, claseOrigen, origenAlGuardar, etiquetaClasicaVisible }; // API pública cerrada (5 funciones).
});

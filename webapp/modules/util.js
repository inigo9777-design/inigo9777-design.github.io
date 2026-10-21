// modules/util.js — Utilidades PURe compartidas entre vistas: escapar HTML (anti-XSS) y uids.
// Lógica PURA, sin DOM ni localStorage → testeable con Node/Jest como priority/classify/recipe-analysis.
// Ver CODING_STANDARDS.md §3 option A / DIP (§2-D): exponen la mínima API que las capas de vista necesitan.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente con el resto de módulos.
  Object.assign(root.MRCheff, { util: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Escapa entidades HTML para insertar TEXTO DE USUARIO en innerHTML / template-strings sin riesgo XSS.
  // Regla de anti-XSS del repo (CODING_STANDARDS §4): todo campo inyectable pasa por aquí antes de pintar.
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  // Id único para entidades nuevas (alimentos/recetas/ideas): tiempo en base 36 + sufijo aleatorio corto —
  // fórmula idéntica a la que ya usaba app.js y el módulo innovations. Default de producción: reloj real;
  // si algún módulo lo inyecta por contexto (`ctx.uid`) gana la versión inyectada (precedente uid/rng ver §3.7).
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Normaliza un paso de receta heredado del generador antiguo ANTES de pintarlo/copiarlo:
  //  · quita la numeración incrustada al principio ("1. ", "1)", "2).") — el <ol> ya numera con su insignia,
  //    así que dejarla dentro del texto salía duplicado ("1. 1. Primero…");
  //  · corrige puntuación suelta al final ("… en 2,." → "… en 2,") y el espacio antes de signo ("… ,", "… .");
  //  · colapsa espacios sobrantes a los lados.
  // Es limpieza de VISTA: no muta el dato guardado, sólo lo que se muestra por pantalla (idempotente).
  const limpiarPaso = s => String(s)
    .replace(/^\s*(?:\s*\d+\s*[.)])+\s*\.?\s*/, "")   // prefijo numérico, una o varias veces ("1. 1." / "2)." incluidos)
    .replace(/([.,])(?:\s*[.,])+$/, "$1")      // ristra de signos final → un solo signo (se queda el 1º)
    .replace(/\s+([.,])/g, "$1")               // espacio antes de "," / "." → pegado
    .trim();

  // Fecha ISO "YYYY-MM-DD" → texto corto es-ES con DÍA + MES ("21 oct") para meta-texto de filas
  // (lista de la compra, "se usa el 21 oct"). Nacida en app.js, ya en el módulo compartido (§3):
  //   · vacío → "" (sin fecha anclada: la fila no pinta el "se usa el …" y este helper nunca llega).
  //   · fecha imposible → devuelta tal cual (mejor visible y rastreable que un "Invalid Date").
  //   · `T00:00:00Z` + timeZone UTC: el DÍA ancla a medianoche UTC — sin esto, en husos negativos
  //     ("2026-10-21" en Uruguay) localizaba al día ANTERIOR (bug clásico de Date con date-string).
  const formatoFechaCorta = iso => {
    if (iso == null || iso === "") return "";
    try {
      const d = new Date(String(iso) + "T00:00:00Z");
      if (isNaN(d.getTime())) return String(iso);       // fecha rota: se queda tal cual
      return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
    } catch { return String(iso); }                      // entornos sin Intl: al menos el ISO crudo
  };

  return { escapeHTML, uid, limpiarPaso, formatoFechaCorta };
});

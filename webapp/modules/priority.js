// modules/priority.js — Lógica "pura" de inventario: urgencia por puntuación y aviso de reposición.
// NO toca DOM ni localStorage → testeable con Node/Jest sin jsdom. Doble modo de exportación
// (navegador → global window.MRCheff.priority ; CommonJS/Node → require) ver CODING_STANDARDS.md §3.6 option A.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: requerimiento directo de los tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente.
  Object.assign(root.MRCheff, { priority: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Determina el nivel visual de urgencia a partir de la puntuación de importancia (1–10).
  // rojo: 8–10 · naranja: 6–7 · verde: 1–5. Se copia literal del antiguo app.js para no cambiar semántica.
  const urgencyLevel = function (score) {
    if (score >= 8) return "red";
    if (score >= 6) return "orange";
    return "green";
  };

  // Un alimento entra en la alerta de reposición si su cantidad está por debajo del mínimo para avisar.
  const needsRestock = function (f) {
    const q = f.qty ?? 0, m = f.min ?? 0;
    return q <= m;
  };

  return { urgencyLevel, needsRestock };
});

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

  // Decide CÓMO SE PRESENTA la alerta semanal de reposición a partir del inventario: qué alimentos entran, en qué orden
  // (más importante primero), con qué ICONO/TÍTULO y nivel visual dominante (el de AL primer elemento tras ordenar).
  // Lógica PURA sin DOM/localStorage (testeable aislado como el resto del módulo): devuelve { show, level, icon, title,
  // items }; la capa de vista sólo pinta `items` a HTML.
  // Rediseño 2026-10-19: ATRÁS el recorte `slice(0, 8)` que escondía del 9º pendiente en adelante (parecían no existir).
  // Devuelve SIEMPRE la lista COMPLETA — el límite es ahora FÍSICO en la vista: a partir de 8 items, la lista se cap a
  // 8 filas de alto y scrollea dentro de sí (ver renderWeeklyAlert en app.js + CSS .alert-scroll/.candado).
  const buildWeeklyAlert = function (foods) {
    // Sale en la alerta si NO está marcado y necesita reponer; ordenamos desc por importancia para que el más urgente mande color/título.
    const toRestock = foods.filter(f => !f.checked && needsRestock(f)).slice().sort((a, b) => b.score - a.score);
    if (!toRestock.length) return { show: false };
    // El color de la alerta lo marca la importancia del alimento MÁS URGENTE (el primero tras el sort por score).
    const level = urgencyLevel(toRestock[0].score);
    const icon  = level === "red" ? "🚨" : level === "orange" ? "⚠️" : "🛒";
    const title = level === "red" ? "Repuestos urgentes esta semana"
               : level === "orange" ? "Reposición recomendada"
               : "Sugerencia de compra";
    return { show: true, level, icon, title, items: toRestock };
  };

  return { urgencyLevel, needsRestock, buildWeeklyAlert };
});

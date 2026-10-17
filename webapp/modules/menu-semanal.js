// modules/menu-semanal.js — Lógica PURe (sin DOM ni localStorage) de la vista "Menú semanal + lista de la compra"
// (ver webapp/feature-plans/planFeatureRecetasSugeridasYPlanSemana.md §2 Card 2 + Card 3 y CODING_STANDARDS.md §2-D / §3 option A).
//
// API PÚBLICA CERRADA (3 funciones, sin fugas de helpers internos):
//   shoppingListFor(needyFoods, foods)   → dedup por nombre-normalizado vs aforo; shape {name, qty:0, min:0, score:5}
//   approveMenu(preview, cooked, today, cookEntryFor, uid)   → { cooked, weekmenu } inmutables; ancla HOY real
//   markItemBought(foods, weekmenu, itemName, uid, now)      → { foods, weekmenu, alreadyExists } inmutables
//
// Todas las funciones son puras: no tocan DOM ni localStorage. El caller (app.js) decide cuándo persistir/re-renderizar.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { menuSemanal: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Id único por omisión (reloj real); inyectable vía opts.uid para tests deterministas (§6).
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------------------------------------------------------------------------
  // shoppingListFor — dedup por nombre-normalizado de needyFoods contra el aforo actual.
  // Devuelve filas con shape de alerta semanal {name, qty:0, min:0, score:5} listas para pintar en Card 3.
  // ---------------------------------------------------------------------------
  function shoppingListFor(needyFoods, foods) {
    const known = new Set((Array.isArray(foods) ? foods : []).map(f => String(f.name).toLowerCase()));
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(needyFoods) ? needyFoods : []) {
      if (!raw || typeof raw !== "object") continue;
      const key = String(raw.name).toLowerCase();
      if (!key || seen.has(key) || known.has(key)) continue;
      seen.add(key);
      out.push({ name: raw.name, qty: 0, min: 0, score: 5 });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // approveMenu — construye el resultado de aprobar el preview de menú SIN tocar localStorage ni DOM.
  //   * clona cooked y le añade una entrada por cada receta del plan aprobado (ancla = HOY real, no label visual).
  //   * devuelve weekmenu con approved=true y generatedOn=hoy (inmutables: no muta `preview` ni `cooked`).
  //   * `cookEntryFor` e `uid` se inyectan por contexto (§2-D / §6 determinismo).
  // ---------------------------------------------------------------------------
  function approveMenu(preview, cooked, today, cookEntryFor, uid) {
    const mkId = typeof uid === "function" ? uid : defaultUid;
    const nextCooked = (Array.isArray(cooked) ? cooked : []).slice();
    for (const slot of Array.isArray(preview && preview.plan) ? preview.plan : []) {
      if (slot && slot.recipe) {
        nextCooked.push(cookEntryFor(slot.recipe, { today, uid: mkId }));
      }
    }
    const weekmenu = Object.assign({}, preview, { approved: true, generatedOn: String(today) });
    return { cooked: nextCooked, weekmenu };
  }

  // ---------------------------------------------------------------------------
  // markItemBought — marca un ítem de la lista de la compra como comprado:
  //   * auto-añade el alimento a foods (qty=0, min=0, score=5, dedup por nombre) si aún no existe.
  //   * quita el ítem de needyFoods del weekmenu.
  //   * devuelve { foods, weekmenu, alreadyExists } inmutables.
  //   * `uid` y `now` inyectables para tests (§6).
  // ---------------------------------------------------------------------------
  function markItemBought(foods, weekmenu, itemName, uid, now) {
    const lower = String(itemName).toLowerCase();
    const exists = (Array.isArray(foods) ? foods : []).some(f => String(f.name).toLowerCase() === lower);
    if (exists) return { foods, weekmenu, alreadyExists: true };

    const mkId = typeof uid === "function" ? uid : defaultUid;
    const nextFoods = (Array.isArray(foods) ? foods : []).concat([{
      id: mkId(),
      name: itemName,
      score: 5,
      qty: 0,
      min: 0,
      checked: false,
      createdAt: typeof now === "number" ? now : Date.now()
    }]);

    const nextWeekmenu = weekmenu
      ? Object.assign({}, weekmenu, {
        needyFoods: (Array.isArray(weekmenu.needyFoods) ? weekmenu.needyFoods : []).filter(f => String(f.name).toLowerCase() !== lower)
      })
      : weekmenu;

    return { foods: nextFoods, weekmenu: nextWeekmenu, alreadyExists: false };
  }

  // API PÚBLICA CERRADA (§5/§8 — solo estas 3 funciones, sin fuga de helpers internos como defaultUid).
  return {
    shoppingListFor,
    approveMenu,
    markItemBought
  };
});

// modules/menu-semanal.js — Lógica PURe (sin DOM ni localStorage) de "Menú semanal + lista de la compra"
// (ver webapp/feature-plans/planFeatureRecetasSugeridasYPlanSemana.md §2 Card 2 + Card 3 y CODING_STANDARDS.md §2-D / §3 option A).
//
// API PÚBLICA CERRADA (6 funciones, sin fugas de helpers internos):
//   shoppingListFor(needyFoods, foods)           → dedup por nombre-normalizado vs aforo; shape {name, qty:0, min:0, score:5}
//   approveMenu(preview, cooked, today, cookEntryFor, uid)   → { cooked, weekmenu } inmutables; ancla HOY real
//   markItemBought(foods, weekmenu, itemName, uid, now)      → { foods, weekmenu, alreadyExists } inmutables
//   cookEntry(recipe, cooked, today, cookEntryFor, uid)      → { cooked } inmutable; anota una receta como cocinada hoy
//   regenerateAfterCook(recipe, ctx)                         → { cooked, weekmenu } inmutables; flujo "🍳 Cocinar hoy" DESDE el menú
//   clearMenu()                                               → estado limpio para reiniciar el menú

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

  // ---------------------------------------------------------------------------
  // cookEntry — anota una receta como cocinada hoy en cooked (inmutable).
  //   * `cookEntryFor` e `uid` se inyectan por contexto.
  // ---------------------------------------------------------------------------
  function cookEntry(recipe, cooked, today, cookEntryFor, uid) {
    const mkId = typeof uid === "function" ? uid : defaultUid;
    const nextCooked = (Array.isArray(cooked) ? cooked : []).slice();
    nextCooked.push(cookEntryFor(recipe, { today, uid: mkId }));
    return { cooked: nextCooked };
  }

  // ---------------------------------------------------------------------------
  // regenerateAfterCook — decisión completa del flujo "🍳 Cocinar hoy" DESDE una card del MENÚ:
  //   1) anota la receta como cocinada hoy (entra en cooldown de 7 días),
  //   2) regenera el plan de 7 días respetando el cooldown (ya no puede volverse a sugerir),
  //   3) reconstruye weekmenu manteniendo el estado `approved` previo y el toggle actual.
  //   Sin DOM ni localStorage: devuelve { cooked, weekmenu } NUEVOS y el caller (app.js) sólo
  //   hace save() + render() (Capa vista). `planner` llega inyectado por ctx (§2-D composición:
  //   el módulo NO hace require de planner; `cookEntryFor`/`uid` inyectables §6 determinismo).
  //   ctx = { cooked, foods, recipes, catalog, today, includeUnavailable, prevWeekmenu, planner, uid }
  // ---------------------------------------------------------------------------
  function regenerateAfterCook(recipe, ctx) {
    const c = ctx || {};
    const plannerInj = c.planner || {};

    // 1) cooked nuevo con la entrada de hoy (inmutable sobre la lista de entrada).
    const mkEntry = typeof plannerInj.cookEntryFor === "function" ? plannerInj.cookEntryFor : null;
    const base = mkEntry
      ? cookEntry(recipe, c.cooked, c.today, mkEntry, c.uid)
      : { cooked: (Array.isArray(c.cooked) ? c.cooked.slice() : []) };   // guard §2-A: sin cookEntryFor no se fabrica la entrada
    const cooked = base.cooked;

    // 2) re-generación del plan con el cooked actualizado (el plato cocinado NUNCA se re-sugiere el mismo día).
    const buildPool = typeof plannerInj.buildCandidatePool === "function" ? plannerInj.buildCandidatePool : null;
    const buildMenu = typeof plannerInj.buildWeeklyMenu === "function" ? plannerInj.buildWeeklyMenu : null;
    const pool = buildPool
      ? buildPool(c.foods || [], c.recipes || [], c.catalog || [], { cooked, today: c.today })
      : [];
    const menu = buildMenu
      ? buildMenu(pool, c.foods || [], { includeUnavailable: !!c.includeUnavailable, today: c.today })
      : { plan: [] };

    // 3) weekmenu reconstruido: mismo shape del preview + estado aprobado previo intacto + ancla HOY real.
    const prevApproved = !!(c.prevWeekmenu && c.prevWeekmenu.approved);
    const weekmenu = Object.assign({}, menu, {
      approved: prevApproved,
      includeUnavailable: !!c.includeUnavailable,
      generatedOn: String(c.today)
    });

    return { cooked, weekmenu };
  }

  // ---------------------------------------------------------------------------
  // clearMenu — estado limpio para reiniciar el menú (preview borrado, approved=false).
  // ---------------------------------------------------------------------------
  function clearMenu() {
    return { weeklyMenu: null };
  }

  // API PÚBLICA CERRADA (§5/§8 — solo estas 6 funciones, sin fuga de helpers internos como defaultUid).
  return {
    shoppingListFor,
    approveMenu,
    markItemBought,
    cookEntry,
    regenerateAfterCook,
    clearMenu
  };
});

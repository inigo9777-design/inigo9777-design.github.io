// modules/menu-semanal.js — Lógica PURe (sin DOM ni localStorage) de "Menú semanal + lista de la compra"
// (ver webapp/feature-plans/planFeatureRecetasSugeridasYPlanSemana.md §2 Card 2 + Card 3 y CODING_STANDARDS.md §2-D / §3 option A).
//
// API PÚBLICA CERRADA (6 funciones, sin fugas de helpers internos):
//   shoppingListFor(needyFoods, foods)           → dedup por nombre-normalizado vs aforo; shape {name, qty:0, min:0, score:5}
//   approveMenu(preview, cooked, today, cookEntryFor, uid)   → { cooked, weekmenu } inmutables; ancla = FECHA de cada día planificado
//   markItemBought(foods, weekmenu, itemName, uid, now)      → { foods, weekmenu, alreadyExists } inmutables
//   cookEntry(recipe, cooked, today, cookEntryFor, uid)      → { cooked } inmutable; anota una receta como cocinada hoy
//   regenerateAfterCook(recipe, ctx)                         → { cooked, weekmenu } inmutables; flujo "🍳 Cocinar hoy" DESDE el menú
//   clearMenu()                                               → { weekmenu: null } inmutable; reinicia el menú

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { menuSemanal: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Id único por omisión (reloj real); inyectable vía opts.uid para tests deterministas (§6).
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------------------------------------------------------------------------
  // dateForPlanDay — fecha de calendario (ISO "YYYY-MM-DD") del DÍA DE LA SEMANA planificado:
  //   la PRÓXIMA ocurrencia de ese weekday contando desde `today` (HOY incluido como día 0).
  //   Ej.: aprobado el miércoles 2026-10-21 → "Lunes" ancla 2026-10-26, "Miércoles" ancla HOY,
  //   "Domingo" ancla 2026-10-25. Débil ante acentos/caso ("Miércoles" → "miercoles") y con
  //   fallback al índice del slot (0=Lunes..6=Domingo) si el label no es reconocible.
  //   Aritmética en UTC para no depender de la zona horaria del host (§6 determinismo).
  // ---------------------------------------------------------------------------
  const DAY_GETDAY = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };

  function dateForPlanDay(dayLabel, slotIndex, todayISO) {
    const key = String(dayLabel == null ? "" : dayLabel)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const target = Object.prototype.hasOwnProperty.call(DAY_GETDAY, key)
      ? DAY_GETDAY[key]
      : ((slotIndex + 1) % 7);   // fallback: índice del slot (0=Lunes..6=Domingo) → getDay() (Domingo=0)
    const base = new Date(String(todayISO) + "T00:00:00Z");
    if (isNaN(base.getTime())) return String(todayISO);      // guard §2-A: hoy inválido → ancla HOY tal cual
    const diff = (target - base.getUTCDay() + 7) % 7;
    return new Date(base.getTime() + diff * 86400000).toISOString().slice(0, 10);
  }

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
  //   * clona cooked y le añade UNA entrada por cada receta del plan, cada una anclada a SU FECHA
  //     de calendario del día de la semana planificado (próxima ocurrencia de ese weekday desde
  //     HOY; si HOY es ese día, la ancla es HOY). NO se marca todo a HOY: cada plato queda
  //     "cocinado el día que le toca" (p.ej. aprobado el miércoles → Lunes ancla al lunes siguiente).
  //   * devuelve weekmenu con approved=true y generatedOn=hoy (inmutables: no muta `preview` ni `cooked`).
  //   * `cookEntryFor` e `uid` se inyectan por contexto (§2-D / §6 determinismo).
  // ---------------------------------------------------------------------------
  function approveMenu(preview, cooked, today, cookEntryFor, uid) {
    const mkId = typeof uid === "function" ? uid : defaultUid;
    const nextCooked = (Array.isArray(cooked) ? cooked : []).slice();
    const slots = Array.isArray(preview && preview.plan) ? preview.plan : [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot && slot.recipe) {
        const anchor = dateForPlanDay(slot.dayLabel, i, today);
        nextCooked.push(cookEntryFor(slot.recipe, { today: anchor, uid: mkId }));
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
    return { weekmenu: null };   // `weekmenu` (misma convención de naming que approveMenu/markItemBought)
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

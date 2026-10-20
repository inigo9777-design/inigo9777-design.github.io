// modules/menu-semanal.js — Lógica PURe (sin DOM ni localStorage) de "Menú semanal + lista de la compra"
// (ver webapp/feature-plans/planFeatureRecetasSugeridasYPlanSemana.md §2 Card 2 + Card 3 y CODING_STANDARDS.md §2-D / §3 option A).
//
// API PÚBLICA CERRADA (7 funciones, sin fugas de helpers internos):
//   shoppingListFor(needyFoods, foods, ctx?)  → dedup por MATCHER de tokens (NO subcadena-cruda) + urgencia de compra
//                                               {name, qty:0, min:0, score:5, onDay?, daysUntil?, urgency:"red|orange|green"}
//   approveMenu(preview, cooked, today, cookEntryFor, uid) → { cooked, weekmenu } inmutables; ancla = FECHA de cada día×comida planificada
//   markItemBought(foods, weekmenu, itemName, uid, now, compra?) → { foods, weekmenu, alreadyExists, actualizado? }
//       con `compra = { qty, score, min }` (2026-10-18: la UI pregunta CUÁNTO se ha comprado, su importancia
//       y el MÍNIMO de alerta); sin él, comportamiento legacy (alta con qty=0/min=0/score=5).
//   cookEntry(recipe, cooked, today, cookEntryFor, uid)    → { cooked } inmutable; anota UNA receta como cocinada hoy
//   swapSlotRecipe(ctx)                                    → { swapped, weekmenu } inmutables; "🔄 Cambiar" de UN día+comida (feature 2026-10-18)
//   accionesMenuSlot(weekmenu)             → { cocinar: bool, cambiar: bool } — visibilidad de los botones de
//                                            acción en las FILAS del menú (feature 2026-10-18): "🍳 Cocinar" sólo
//                                            existe en un plan APROBADO (el preview aún no compromete nada que
//                                            pueda entrar en cooldown); "🔄 Cambiar" sigue siempre. app.js NO
//                                            decide esto: sólo moldea el botón según lo que diga el módulo.
//   clearMenu()                                            → { weekmenu: null } inmutable; reinicia el menú
//   candidatosDespensa(itemName, foods)                    → variantes en la despensa que PODRÍAN ser el ítem
//                                                            ("¿Despensa?" — feature 2026-10-19): comparten
//                                                            algún token del matcher pero el casador SUBCONJUNTO
//                                                            no los une solo ("Jamón serrano" ↔ "Jamón ibérico").
//                                                            SÓLO candidatos: la última palabra la tiene el usuario.
//   markItemBoughtComo(foods, weekmenu, itemName, foodName, compra)
//                                                          → la compra se anota en el alimento YA EXISTENTE que
//                                                            el usuario eligió en "¿Despensa?" (update in-situ,
//                                                            sin alta nueva) y el ítem sale de needyFoods.
//
// Nota de cambio (§8): `regenerateAfterCook` (regeneración COMPLETA al cocinar) se retira — cocinar desde el
// menú ahora compone `cookEntry` + `swapSlotRecipe` en app.js: el plato entra en cooldown y SÓLO su slot
// recibe otra receta, sin descartar el resto del plan ya aprobado/vidente.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { menuSemanal: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Id único por omisión (reloj real); inyectable vía opts.uid para tests deterministas (§6).
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Matcher compartido (modules/ingredient-matching.js: tokens+deplural, NO subcadena-cruda). Resolución por
  // entorno igual que planner.js: namespace global en navegador, require relativo en Node/Jest. Sin matcher
  // disponible → degradación a comparación por claves exactas (nunca re-inventar el matcher buggy).
  function resolveMatcher() {
    const global = typeof self !== "undefined" ? self : null;
    if (global && global.MRCheff && global.MRCheff.ingredientMatching) return global.MRCheff.ingredientMatching;
    if (typeof module !== "undefined" && module.exports) {
      try { return require("./ingredient-matching.js"); } catch { /* degradación real abajo */ }
    }
    return null;
  }

  function matchIngredienteAlimento(nombreA, nombreB) {
    const matcher = resolveMatcher();
    if (matcher && typeof matcher.matchIngredientToFood === "function") {
      return matcher.matchIngredientToFood(nombreA, nombreB);
    }
    return String(nombreA == null ? "" : nombreA).toLowerCase() === String(nombreB == null ? "" : nombreB).toLowerCase();
  }

  // Clave de dedup por tokens (coherente con el matcher compartido; "Plátano" y "Plátanos" comparten clave).
  function claveNombre(nombre) {
    const matcher = resolveMatcher();
    if (matcher && typeof matcher.tokensOf === "function") return matcher.tokensOf(nombre).join(" ");
    return String(nombre == null ? "" : nombre).toLowerCase().trim();
  }

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

  // Días naturales desde `todayISO` hasta `dateISO` (≥0; fechas pasadas cuentan como 0 = máxima urgencia).
  function daysUntil(todayISO, dateISO) {
    const a = new Date(String(todayISO) + "T00:00:00Z");
    const b = new Date(String(dateISO) + "T00:00:00Z");
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  }

  // Regla de urgencia del usuario (feature 2026-10-18): se prepara mañana (o hoy) → ROJO;
  // en 2-3 días → NARANJA; en 4 o más (o sin fecha) → VERDE.
  const UMBRAL_ROJO = 1, UMBRAL_NARANJA = 3;

  function urgenciaPorDias(n) {
    if (n == null) return "green";
    if (n <= UMBRAL_ROJO) return "red";
    if (n <= UMBRAL_NARANJA) return "orange";
    return "green";
  }

  // ---------------------------------------------------------------------------
  // shoppingListFor — lista de la compra a partir de needyFoods:
  //   * dedup entre needy Y contra el aforo por MATCHER de tokens (fix del bug "Plátano" vs "Plátanos":
  //     el dedup exacto por lower-case dejaba pasar不理解 plural/variación y duplicaba filas).
  //   * ctx opcional { plan, generatedOn, today }: ancla cada ítem a la FECHA MÁS PRÓXIMA en que
  //     algún slot del plan lo necesita → onDay, daysUntil y urgency (red/orange/green) para que la
  //     lista CAMBIE DE COLOR dinámicamente al acercarse la fecha de preparación. Sin ctx → sin
  //     urgencia (urgency:"green", retro-compatible con las llamadas de 2 args).
  //   * orden de salida: urgencia (rojo primero) → días hasta prep → nombre.
  // ---------------------------------------------------------------------------
  function shoppingListFor(needyFoods, foods, ctx) {
    const c = ctx || {};
    // Stock REAL del aforo con nombre válido (qty>0): sólo esto puede tachar un ítem de la compra.
    const known = (Array.isArray(foods) ? foods : []).filter(f => {
      if (!f || !hayNombre(f && f.name)) return false;
      return Number(f.qty == null ? 0 : f.qty) > 0;
    });
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(needyFoods) ? needyFoods : []) {
      if (!raw || typeof raw !== "object" || !raw.name) continue;
      const clave = claveNombre(raw.name);
      if (!clave || seen.has(clave)) continue;
      // ¿Ya lo tenemos en cantidad real? El matcher de tokens decide (NO lower-case exacto).
      if (known.some(f => matchIngredienteAlimento(raw.name, f.name))) continue;
      seen.add(clave);

      const fila = { name: raw.name, qty: 0, min: 0, score: 5 };
      if (Array.isArray(c.plan) && c.today) {
        const onDay = fechaMasProxima(raw.name, c.plan, c.generatedOn || c.today);
        const hasta = daysUntil(c.today, onDay);
        fila.onDay = onDay != null ? onDay : undefined;
        fila.daysUntil = hasta != null ? hasta : undefined;
        fila.urgency = urgenciaPorDias(hasta);
      } else {
        fila.urgency = "green";   // retro-compatible: sin ancla de plan no hay semáforo
      }
      out.push(fila);
    }
    return ordenarPorUrgencia(out);
  }

  function hayNombre(name) { return String(name == null ? "" : name).trim() !== ""; }

  // Fecha MÁS PRÓXIMA (ISO) en que algún slot del plan necesita el ítem (min de dateForPlanDay).
  function fechaMasProxima(nombre, plan, generatedOn) {
    let mejor = null;
    for (let i = 0; i < plan.length; i++) {
      const slot = plan[i];
      if (!slot) continue;
      const necesita = (Array.isArray(slot.meals) ? slot.meals : []).some(m =>
        m && m.recipe && Array.isArray(m.missing) && m.missing.some(n => matchIngredienteAlimento(nombre, n))
      );
      if (!necesita) continue;
      const fecha = dateForPlanDay(slot.dayLabel, i, generatedOn);
      if (mejor == null || fecha < mejor) mejor = fecha;
    }
    return mejor;
  }

  function ordenarPorUrgencia(filas) {
    const peso = { red: 0, orange: 1, green: 2 };
    return filas.slice().sort((a, b) => {
      const p = peso[a.urgency] - peso[b.urgency];
      if (p !== 0) return p;
      const d = (a.daysUntil == null ? Infinity : a.daysUntil) - (b.daysUntil == null ? Infinity : b.daysUntil);
      if (d !== 0) return d;
      return String(a.name).localeCompare(String(b.name), "es");
    });
  }

  // ---------------------------------------------------------------------------
  // approveMenu — construye el resultado de aprobar el preview de menú SIN tocar localStorage ni DOM.
  //   * clona cooked y le añade UNA entrada por cada RECETA del plan (7 días × 3 comidas), cada una
  //     anclada a SU FECHA de calendario del día de la semana planificado (próxima ocurrencia de ese
  //     weekday desde HOY; si HOY es ese día, la ancla es HOY). NO se marca todo a HOY: cada plato
  //     queda "cocinado el día que le toca" (p.ej. aprobado el miércoles → Lunes ancla al lunes siguiente).
  //   * devuelve weekmenu con approved=true y generatedOn=hoy (inmutables: no muta `preview` ni `cooked`).
  //   * `cookEntryFor` e `uid` se inyectan por contexto (§2-D / §6 determinismo).
  // ---------------------------------------------------------------------------
  function approveMenu(preview, cooked, today, cookEntryFor, uid) {
    const mkId = typeof uid === "function" ? uid : defaultUid;
    const nextCooked = (Array.isArray(cooked) ? cooked : []).slice();
    const dias = Array.isArray(preview && preview.plan) ? preview.plan : [];
    for (let i = 0; i < dias.length; i++) {
      const slot = dias[i];
      for (const comida of Array.isArray(slot && slot.meals) ? slot.meals : []) {
        if (comida && comida.recipe) {
          const anchor = dateForPlanDay(slot.dayLabel, i, today);
          nextCooked.push(cookEntryFor(comida.recipe, { today: anchor, uid: mkId }));
        }
      }
    }
    const weekmenu = Object.assign({}, preview, { approved: true, generatedOn: String(today) });
    return { cooked: nextCooked, weekmenu };
  }

  // ---------------------------------------------------------------------------
  // markItemBought — marca un ítem de la lista de la compra como comprado:
  //   * SIN `compra` (llamadas legacy): auto-añade el alimento a foods (qty=0, min=0, score=5,
  //     dedup por MATCHER de tokens) y lo quita de needyFoods del weekmenu.
  //   * CON `compra = { qty, score, min }` (2026-10-18: la UI pregunta ANTES de añadir CUÁNTO se
  //     ha comprado, con qué importancia y el MÍNIMO para la alerta de reponer, en vez de colarlo
  //     con qty 0 / score 5 / min 0 — con min 0 la alerta nunca saltaría):
  //       - alta con LA cantidad, la importancia y el mínimo pedidos (sanitizadas aquí).
  //       - si el alimento YA está en la despensa (aunque sea con qty 0), le ACTUALIZA
  //         qty/score/min y también lo quita de needyFoods (así el semáforo del stock cruzará
  //         el ítem — antes quedaba tachado para siempre). Sin `min` pedido conserva el suyo.
  //   * devuelve { foods, weekmenu, alreadyExists, actualizado? } inmutables.
  //   * `uid`, `now` y `compra` inyectables para tests (§6).
  // ---------------------------------------------------------------------------
  function compraNormalizada(compra) {
    if (!compra || typeof compra !== "object") return null;
    const qty = Number(compra.qty);
    const score = Number(compra.score);
    const min = Number(compra.min);           // undefined → NaN → null (el caller no lo pidió)
    if (!Number.isFinite(qty) || !Number.isFinite(score) || qty < 1) return null;
    return {
      qty: Math.round(qty),
      score: Math.min(10, Math.max(1, Math.round(score))),
      min: Number.isFinite(min) ? Math.max(0, Math.round(min)) : null
    };
  }

  function quitarDeNeedy(weekmenu, clave) {
    return weekmenu
      ? Object.assign({}, weekmenu, {
        needyFoods: (Array.isArray(weekmenu.needyFoods) ? weekmenu.needyFoods : []).filter(f => claveNombre(f && f.name) !== clave)
      })
      : weekmenu;
  }

  function markItemBought(foods, weekmenu, itemName, uid, now, compra) {
    const clave = claveNombre(itemName);
    const base = (Array.isArray(foods) ? foods : []).filter(f => f && typeof f === "object");
    const pedido = compraNormalizada(compra);
    const idx = base.findIndex(f => matchIngredienteAlimento(itemName, f.name));

    // Ya está en la despensa: sin `compra` válida → sin cambios (comportamiento legacy);
    // con compra → update in-situ de qty/score con la MISMA inmutabilidad que el alta.
    if (idx >= 0) {
      if (!pedido) return { foods: (Array.isArray(foods) ? foods : []), weekmenu, alreadyExists: true, actualizado: false };
      // sin `min` pedido (null) la fila conservará SU mínimo actual (sólo se fija si se pidió)
      const cambios = pedido.min != null ? { qty: pedido.qty, score: pedido.score, min: pedido.min } : { qty: pedido.qty, score: pedido.score };
      const actualizado = base.map((f, i) => i === idx ? Object.assign({}, f, cambios) : f);
      return { foods: actualizado, weekmenu: quitarDeNeedy(weekmenu, clave), alreadyExists: true, actualizado: true };
    }

    const mkId = typeof uid === "function" ? uid : defaultUid;
    const foodsNuevos = base.concat([{
      id: mkId(),
      name: itemName,
      score: pedido ? pedido.score : 5,
      qty: pedido ? pedido.qty : 0,
      min: pedido && pedido.min != null ? pedido.min : 0,
      checked: false,
      createdAt: typeof now === "number" ? now : Date.now()
    }]);

    return { foods: foodsNuevos, weekmenu: quitarDeNeedy(weekmenu, clave), alreadyExists: false, actualizado: false };
  }

  // ---------------------------------------------------------------------------
  // FEATURE 2026-10-19 «¿Despensa?» — variantes del MISMO alimento que el casador SUBCONJUNTO
  // no une solo ("Jamón serrano" ↔ "Jamón ibérico", "Pan de pueblo" ↔ "Pan"): son dos específicos
  // distintos y el refinamiento del matcher (2026-10-18) decidió A PROPÓSITO no automatizar ese
  // emparejamiento. La regla aquí es INTENCIONADAMENTE simple — comparten algún token de género
  // (≥3 letras, sin stopwords, depluralizado) — y la
  // ÚLTIMA PALABRA la tiene el usuario: estos son candidatos a CONFIRMAR en el modal
  // "¿Despensa?", no casamientos automáticos.
  // * fuera SÓLO el nombre idéntico (no es duda, es él mismo). El match SUBCONJUNTO de la
  //   despensa (p. ej. "Pan" cubre "Pan de pueblo") SÍ sale de candidato si está a qty 0: a
  //   cantidad>0 ese match ya habría deduped la fila y no aparecería; a 0 sigue siendo DUDA a
  //   ojos del usuario (¿el pan del pueblo es mi pan?) y merece su confirmación.
  // * orden: más tokens comunes primero → nombre; máx 8 (una lista de posibles, no un desfile).
  // ---------------------------------------------------------------------------
  function tokensDe(nombre) {
    const matcher = resolveMatcher();
    if (matcher && typeof matcher.tokensOf === "function") return matcher.tokensOf(nombre);
    return String(nombre == null ? "" : nombre).toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function candidatosDespensa(itemName, foods) {
    const tokensItem = new Set(tokensDe(itemName));
    if (tokensItem.size === 0) return [];
    return (Array.isArray(foods) ? foods : [])
      .filter(f => f && f.name && String(f.name).trim() !== "")
      .filter(f => claveNombre(f.name) !== claveNombre(itemName))       // idéntico ⇒ no es variante, es él
      .map(f => ({ alimento: f, comunes: tokensDe(f.name).filter(t => tokensItem.has(t)).length }))
      .filter(x => x.comunes > 0)
      .sort((a, b) => b.comunes - a.comunes || String(a.alimento.name).localeCompare(String(b.alimento.name), "es"))
      .slice(0, 8)
      .map(x => x.alimento);
  }

  // ---------------------------------------------------------------------------
  // markItemBoughtComo — destino de la confirmación del modal "¿Despensa?": el ítem itemName de
  // la compra NO se casa exacto con foodName ya en la despensa y el USUARIO confirmó que son lo
  // mismo (variante de calidad/tipo). La compra va al alimento apuntado IN-SITU: conserva
  // id/nombre/createdAt/checked; qty/score se fijan con la compra y `min` sólo si se pidió
  // (idéntica regla de markItemBought). NUNCA entra alta nueva; el ítem sale de needyFoods igual
  // que el resto. Si el objetivo no está en la despensa o la compra es inválida → null (guard:
  // la vista avisará SIN escribir nada).
  // ---------------------------------------------------------------------------
  function markItemBoughtComo(foods, weekmenu, itemName, foodName, compra) {
    const pedido = compraNormalizada(compra);
    if (!pedido) return null;
    const claveObjetivo = claveNombre(foodName);
    const base = (Array.isArray(foods) ? foods : []).filter(f => f && typeof f === "object");
    const idx = base.findIndex(f => claveNombre(f.name) === claveObjetivo);
    if (idx < 0) return null;
    const cambios = pedido.min != null
      ? { qty: pedido.qty, score: pedido.score, min: pedido.min }
      : { qty: pedido.qty, score: pedido.score };
    const actualizado = base.map((f, i) => i === idx ? Object.assign({}, f, cambios) : f);
    return { foods: actualizado, weekmenu: quitarDeNeedy(weekmenu, claveNombre(itemName)), mapped: true, actualizado: true };
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
  // swapSlotRecipe — "🔄 Cambiar" la receta de UN día + UNA comida del plan, manteniendo el resto
  //   del menú EXACTAMENTE igual (feature 2026-10-18). Flujo:
  //   1) pool con cooldown aplicado (el plato cocinado nunca reaparece) vía planner.buildCandidatePool.
  //   2) excludeKeys = fingerprints de TODAS las recetas del plan (menos el slot destino) ∪ el
  //      historial del propio slot (`slot.triedKeys`) ∪ la receta actual que se sustituye → cada
  //      click del "🔄" recorre el ranking hacia abajo de forma DETERMINISTA y sin oscilar.
  //   3) planner.pickRecipeForSlot(elige el mejor candidato de ESA comida; null ⇒ no queda ninguna).
  //   4) needyFoods recalculado como unión dedup por tokens de los ausentes de todos los slots.
  //   Sin DOM ni localStorage: devuelve { swapped, weekmenu } NUEVOS; el caller sólo save()+render().
  //   ctx = { weekmenu, dayIndex, meal, foods, recipes, catalog, cooked, today, planner, uid }.
  //   `weekmenu.triedKeys` es campo opcional añadido al shape persistido (nota §8 del plan-feature).
  // ---------------------------------------------------------------------------
  function swapSlotRecipe(ctx) {
    const c = ctx || {};
    const plannerInj = c.planner || {};
    const weekmenu = c.weekmenu;
    const dias = Array.isArray(weekmenu && weekmenu.plan) ? weekmenu.plan : [];
    const dia = dias[c.dayIndex];
    const meals = Array.isArray(dia && dia.meals) ? dia.meals : [];
    const slotActual = meals.find(m => m && m.meal === c.meal) || null;
    const buildPool = typeof plannerInj.buildCandidatePool === "function" ? plannerInj.buildCandidatePool : null;
    const pickSlot = typeof plannerInj.pickRecipeForSlot === "function" ? plannerInj.pickRecipeForSlot : null;
    const fp = typeof plannerInj.fingerprintOf === "function" ? plannerInj.fingerprintOf : null;

    if (!slotActual || !Array.isArray(dias) || !buildPool || !pickSlot || !fp) {
      return { swapped: false, weekmenu };   // guard §2-A: contexto incompleto ⇒ NO mutamos nada (falla visible)
    }

    // (2) exclusiones: todo el plan menos el slot destino + historial de intentos del slot + el actual.
    const excludeKeys = [];
    for (let i = 0; i < dias.length; i++) {
      for (const m of Array.isArray(dias[i].meals) ? dias[i].meals : []) {
        if (!m || !m.recipe) continue;
        if (i === c.dayIndex && m === slotActual) continue;   // el slot que estamos cambiando no se excluye a sí mismo… todavía
        excludeKeys.push(fp(m.recipe, {}));
      }
    }
    for (const key of Array.isArray(slotActual.triedKeys) ? slotActual.triedKeys : []) excludeKeys.push(key);
    const claveActual = fp(slotActual.recipe, {});
    if (claveActual) excludeKeys.push(claveActual);

    // (1)+(3) mejores candidatos con cooldown real aplicado vía el pool de planner.
    const pool = buildPool(c.foods || [], c.recipes || [], c.catalog || [], { cooked: c.cooked || [], today: c.today });
    const elegido = pickSlot(pool, c.foods || [], {
      meal: c.meal,
      excludeKeys,
      includeUnavailable: weekmenu.includeUnavailable !== false,
      uid: typeof c.uid === "function" ? c.uid : undefined,
      today: c.today
    });
    if (!elegido) return { swapped: false, weekmenu };   // ranking agotado: el caller avisa, el plan queda intacto.

    // (4) nuevo plan INMUTABLE: copia profunda de días/meals con el slot destino reemplazado.
    const planNuevo = dias.map((d, i) => ({
      ...d,
      meals: (Array.isArray(d.meals) ? d.meals : []).map(m => {
        if (i === c.dayIndex && m && m.meal === c.meal) {
          return {
            meal: c.meal,
            recipe: elegido.recipe,
            missing: elegido.missing.slice(),
            triedKeys: (Array.isArray(m.triedKeys) ? m.triedKeys.slice() : []).concat(claveActual ? [claveActual] : [])
          };
        }
        return { meal: m && m.meal, recipe: m && m.recipe, missing: (m && m.missing) ? m.missing.slice() : [], triedKeys: (m && m.triedKeys) ? m.triedKeys.slice() : [] };
      })
    }));

    // needyFoods = unión dedup por tokens de los ausentes de TODOS los slots con receta.
    const vistas = new Set();
    const needyNuevo = [];
    for (const d of planNuevo) {
      for (const m of d.meals) {
        if (!m.recipe) continue;
        for (const raw of Array.isArray(m.missing) ? m.missing : []) {
          const clave = claveNombre(raw);
          if (!clave || vistas.has(clave)) continue;
          vistas.add(clave);
          needyNuevo.push({ name: String(raw) });
        }
      }
    }

    const weekmenuNuevo = Object.assign({}, weekmenu, { plan: planNuevo, needyFoods: needyNuevo });
    return { swapped: true, weekmenu: weekmenuNuevo };
  }

  // ---------------------------------------------------------------------------
  // clearMenu — estado limpio para reiniciar el menú (preview borrado, approved=false).
  // ---------------------------------------------------------------------------
  function clearMenu() {
    return { weekmenu: null };   // `weekmenu` (misma convención de naming que approveMenu/markItemBought)
  }

  // ---------------------------------------------------------------------------
  // accionesMenuSlot — visibilidad de los botones de acción en las FILAS del menú (feature 2026-10-18):
  //   * "🍳 Cocinar" SOLO en un plan APROBADO: el preview aún no compromete nada (y cocinar desde él
  //     escribiría en mrcheff.cooked un plato que después podría regenerarse sin más). Regla de negocio,
  //     no de vista: app.js la consulta, no la replica.
  //   * "🔄 Cambiar" sigue disponible siempre (en preview renueva el hueco del preview; en el aprobado,
  //     el del plan).
  //   * weekmenu null/roto → { cocinar: false, cambiar: false } (sin plan no hay acciones que pintar).
  // ---------------------------------------------------------------------------
  function accionesMenuSlot(weekmenu) {
    const aprobado = !!(weekmenu && weekmenu.approved === true);
    const hayPlan = !!weekmenu;
    return { cocinar: aprobado, cambiar: hayPlan };
  }

  // API PÚBLICA CERRADA (§5/§8 — solo estas 9 funciones, sin fuga de helpers internos como defaultUid).
  return {
    shoppingListFor,
    approveMenu,
    markItemBought,
    markItemBoughtComo,
    candidatosDespensa,
    cookEntry,
    swapSlotRecipe,
    clearMenu,
    accionesMenuSlot
  };
});

/* views/innovacion.js · Mr Cheff — vista innovacionSugerencias
   Vista Innovación + Sugerencias y menú (Card 1 lote rotado, Card 2 plan semanal 7×3, Card 3 lista de la compra). Extraída del cierre de app.js (refactor final 2026-10-23).
*/
(function () {
  window.MRCheff.views = window.MRCheff.views || {};
  window.MRCheff.views.innovacionSugerencias = function (ctx) {

    // Publicaciones anticipadas (function declarations = hoisting dentro de la fábrica):
    ctx.badgeOrigenHTML = badgeOrigenHTML;
    ctx.tagClasicoHTML = tagClasicoHTML;
    ctx.tagMenuSlotHTML = tagMenuSlotHTML;
    ctx.origenAlGuardar = origenAlGuardar;
    ctx.fotoRecetaHTML = fotoRecetaHTML;
    ctx.faltanEnCasaHTML = faltanEnCasaHTML;   // molde de la línea "⚠️ Falta / ✅ en casa" — lo piden las cards de recetas también
    ctx.renderInnovations = renderInnovations;
    ctx.renderWeeklyMenu = renderWeeklyMenu;
    ctx.renderShoppingList = renderShoppingList;
    ctx.renderShoppingListTrasDespensa = renderShoppingListTrasDespensa;
    ctx.pintaBarraPlan = pintaBarraPlan;

  // ===== INNOVACIÓN =====
  const btnGenerateInnov = ctx.$("#btn-generate-innov");
  const btnClearInnov = ctx.$("#btn-clear-innov");
  const innovationList = ctx.$("#innovation-list");
  const innovationEmpty = ctx.$("#innovation-empty");
  const innovDayNote = ctx.$("#innov-day-note");
  const innovCount = ctx.$("#innov-count");
  const innovCountVal = ctx.$("#innov-count-val");
  const innovFocus = ctx.$("#innov-focus");
  const innovSummary = ctx.$("#innov-summary");

  innovCount.addEventListener("input", () => innovCountVal.textContent = innovCount.value);
  // SOURCE_LABEL — etiqueta visible por `idea.source`. Nota: planner.js (Paso 1, contrato cerrado y testeado a parte)
  // emite el token interno "receta_sugerida" para las ideas de "Sugerencia de hoy"; ese mismo token se refleja aquí para
  // que SOURCE_LABEL[i.source] resuelva la etiqueta. Se conserva también la clave "sugerenciaHoy" que nombra el plan de
  // feature; ambas apuntan a la misma etiqueta visible.
  const SOURCE_LABEL = { curada: "Receta española", variacion: "Variación", combo: "Combinación", libre: "Creada", protagonista: "Enfocado", nueva: "Nueva", sugerenciaHoy: "Sugerencia de hoy", receta_sugerida: "Sugerencia de hoy" };

  // Etiqueta de ORIGEN del catálogo curado (2026-10-18): "Receta española" / "Receta italiana" en TODAS las vistas
  // de recetas. TODA la decisión vive en el módulo puro modules/origen-recetas.js (detección por id/título/sello,
  // sello al guardar, clase CSS y si el tag clásico de fuente es redundante); aquí sólo quedan los MOLDES <span>
  // con el fallback visible si el módulo no cargara (§ guard débil, mismo espíritu que recipeMissing).
  function etiquetaOrigenSegura(rec) {
    const m = window.MRCheff.origenRecetas;
    return (m && m.etiquetaOrigen) ? m.etiquetaOrigen(rec) : "Receta española";
  }
  function claseOrigenSegura(rec) {
    const m = window.MRCheff.origenRecetas;
    return (m && m.claseOrigen) ? m.claseOrigen(rec) : "tag-origen-espanola";
  }
  function badgeOrigenHTML(rec) {
    return `<span class="tag ${claseOrigenSegura(rec)}">${etiquetaOrigenSegura(rec)}</span>`;
  }
  // Tag clásico de FUENTE ("%Variación", "Sugerencia de hoy"…): el módulo decide si se pinta (null ⇒ no).
  function tagClasicoHTML(rec, fallback) {
    const m = window.MRCheff.origenRecetas;
    const texto = (m && m.etiquetaClasicaVisible) ? m.etiquetaClasicaVisible(rec, SOURCE_LABEL, { fallback }) : (rec && rec.source ? (SOURCE_LABEL[rec.source] || fallback) : null);
    return texto ? `<span class="tag tag-${ctx.escapeHTML(String(rec.source))}">${texto.toString()}</span>` : "";
  }
  // Tag clásico del PLAN semanal (2026-10-21, petición del usuario): en la semana cada hueco YA es
  // una sugerencia del lote — la etiqueta "Sugerencia de hoy" no aporta nada y repetida en las 21
  // filas es ruido. Se suprime SÓLO ese token (fusiona con el tag si el texto coincidiera): los
  // demás tags de fuente ("Nueva", "Variación"…) siguen decidiendo por el módulo puro sin cambio.
  function tagMenuSlotHTML(rec) {
    const html = tagClasicoHTML(rec);
    if (!html || html.includes(SOURCE_LABEL.sugerenciaHoy)) return "";
    return html;
  }
  // Sello de ORIGEN al guardar una copia (⭐ de Innovación / ✏️ editor): el módulo calculó id/título del plato
  // ORIGINAL en el MOMENTO del guardado para que la etiqueta persista aunque el usuario renombre después.
  // El campo queda persistido en la receta (origen:"italiana"|"espanola") y el módulo le da precedencia.
  function origenAlGuardar(rec) {
    const m = window.MRCheff.origenRecetas;
    if (!m || !m.origenAlGuardar) return {};
    const sello = m.origenAlGuardar(rec);          // string 'italiana'|'espanola' (o null sin datos)
    return sello ? { origen: sello } : {};
  }
  // FOTO de la card (feature imagenes-recetas-cards, petición 2026-10-22): foto real del catálogo
  // por id/título (modules/fotos-recetas.js) o el placeholder del diseño — inicial del plato sobre
  // papel. El <img> es decorativo (el título ya nombra el plato): alt vacío + aria-hidden.
  function fotoRecetaHTML(rec) {
    const fr = window.MRCheff.fotosRecetasApi;
    const ruta = (fr && fr.fotoDe) ? fr.fotoDe(rec) : null;
    if (!ruta) {
      const letra = String((rec && rec.title) || "?").charAt(0).toUpperCase();
      return `<div class="recipe-photo recipe-foto-falta" data-letra="${ctx.escapeHTML(letra)}" aria-hidden="true"></div>`;
    }
    return `<img class="recipe-photo" src="${ctx.escapeHTML(ruta)}" alt="" loading="lazy" decoding="async" aria-hidden="true">`;
  }

  // Línea de la tarjetа con la DESPENSA VIVA (2026-10-24, petición del usuario — las del menú ya la
  // tenían): "⚠️ Falta: A, B" en rojo o la verde "✅ Todos los ingredientes en casa", la MISMA cara
  // en las cards de Recetas, Innovación y Sugerencias y en la ficha (modal). La DECISIÓN de qué
  // falta vive en el módulo puro recipe-missing (misma regla estricta qty>0 que el modal — un solo
  // lugar calcula bien); aquí sólo el molde. Guard débil: si el módulo no cargara, la línea no sale
  // y la card queda como siempre. El aforo es la DESPENSA DE COCINA (los productos de hogar no
  // cubren ingredientes de plato).
  function faltanEnCasaHTML(rec) {
    const modulo = window.MRCheff.recipeMissing;
    if (!modulo || typeof modulo.nombresFaltantes !== "function") return "";
    const aforo = typeof ctx.despensaCocina === "function" ? ctx.despensaCocina() : ctx.foods;
    const faltan = modulo.nombresFaltantes(rec, aforo);
    return faltan.length
      ? `<div class="innov-uses" style="color:var(--danger);">⚠️ Falta: ${faltan.map(ctx.escapeHTML).join(", ")}</div>`
      : `<div class="innov-uses" style="color:var(--accent);">✅ Todos los ingredientes en casa</div>`;
  }

  const innovApi = window.MRCheff.innovations;   // módulo puro del generador + conciliación (modules/ctx.innovations.js)

  btnGenerateInnov.addEventListener("click", () => {
    if (ctx.foods.length === 0 && ctx.recipes.length === 0) {
      ctx.toast("Añade alimentos o guarda una receta para inventar", "error");
      return;
    }
    const count = parseInt(innovCount.value, 10) || 8;
    // Generación de ideas (variaciones + combinaciones arquetípicas, y platos "libres"/"protagonistas"): ahora lógica PURA
    // extraída a modules/innovations.js. Aquí sólo consumimos su lote (`batch`) y orquestamos la conciliación con lo ya guardado
    // más persistencia. Ver CODING_STANDARDS.md §3 option A / DIP, al igual que priority/classify/recipe-analysis.
    const batch = window.MRCheff.innovations.generate(count, innovFocus.value, {
      foods: ctx.despensaCocina(), recipes: ctx.recipes,        // el hogar queda fuera de las ideas (regla del no-alimentario)
      // Recentes = títulos de la pila actual de sugerencias: el generador los aparta de su pool para que cada
      // click de "Sugerir ahora" traiga platos NUEVOS (misma lógica de scoring y exclusiones de siempre §8).
      recientes: ctx.innovations.map(i => i.title)
    });
    if (batch.length === 0) {
      ctx.toast("No hay combinaciones suficientes con lo que tienes", "error");
      return;
    }
    // Interpolación del lote en la pila (dedup por título + techo 30): la regla vive en el módulo
    // puro `innovations.conciliarLote` (2026-10-21); aquí sólo persistencia y toast.
    const { pila: nuevaPila, added } = innovApi.conciliarLote(ctx.innovations, batch, 30);
    ctx.innovations = nuevaPila;
    ctx.save(ctx.LS.innov, ctx.innovations);
    ctx.innovDay = ctx.today;
    ctx.save(ctx.LS.innovDate, ctx.innovDay);
    innovDayNote.classList.remove("hidden");
    renderInnovations();
    ctx.toast(added ? `¡${added} idea(s) nueva(s)!` : "Ya tenías esas ideas en la lista");
  });

  btnClearInnov.addEventListener("click", () => {
    ctx.innovations = [];
    ctx.save(ctx.LS.innov, []);
    innovDayNote.classList.add("hidden");
    renderInnovations();
    ctx.toast("Ideas limpiadas");
  });

  // --- Generadores de innovación y utilidades aleatorias extraídos al módulo puro modules/innovations.js ---
  // (pick/chance/randInt/shuffle/sample/byScore/joinNames + STYLES/TWISTS/FINISH/SEASONINGS/PREFIXES/ADJ/ARCHETYPES
  //  + makeVariation/makeCombo/makeFreeform/makeSolo/generateInnovations). Ahora se consume vía
  //  window.MRCheff.innovations.generate(count, focus, { foods, recipes }) — ver el comentario del handler de "btnGenerateInnov".

  function updateInnovSummary() {
    if (!ctx.innovations.length) { innovSummary.classList.add("hidden"); return; }
    innovSummary.classList.remove("hidden");
    // El agrupado por fuente visible es del módulo (innovations.resumenPorFuente, 2026-10-21):
    // el resolver da YA el texto final (origen para las curadas, etiqueta de fuente para el resto)
    // y aquí queda sólo la frase de vista.
    const resumen = innovApi.resumenPorFuente(ctx.innovations, claveDeGrupoFuente);
    innovSummary.textContent = `${resumen.total} idea(s) en la lista (${resumen.partes.join(" · ")}). Guarda las que te gusten con ⭐.`;
  }

  // Resumen del generador: agrupa por FUENTE, pero para las curadas agrupa por ORIGEN visible
  // ("x Receta española · y Receta italiana") — la etiqueta es la MISMA que pintan las tarjetas.
  function claveDeGrupoFuente(i) {
    return i.source === "curada" ? etiquetaOrigenSegura(i) : (SOURCE_LABEL[i.source] || "nuevas");
  }

  function renderInnovations() {
    innovationList.innerHTML = "";
    innovationEmpty.classList.toggle("hidden", ctx.innovations.length > 0);
    updateInnovSummary();
    ctx.innovations.forEach(i => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = i.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${ctx.escapeHTML(i.id)}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-save="${ctx.escapeHTML(i.id)}" title="Guardar en Mis Recetas" aria-label="Guardar en Mis Recetas">⭐</button>
          <button data-del="${ctx.escapeHTML(i.id)}" title="Eliminar" aria-label="Eliminar idea">🗑</button>
        </div>
        ${fotoRecetaHTML(i)}
        <h3>${ctx.escapeHTML(i.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${ctx.escapeHTML(i.meal)}">${ctx.mealLabels[i.meal]}</span>
          ${badgeOrigenHTML(i)}
          ${ctx.badgeSyncHTML(i)}
          ${i.source === "curada" ? "" : `<span class="tag tag-${ctx.escapeHTML(String(i.source))}">${SOURCE_LABEL[i.source] || "Nueva"}</span>`}
        </div>
        ${Array.isArray(i.uses) && i.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${i.uses.map(ctx.escapeHTML).join(" · ")}</div>` : ""}
        ${ctx.faltanEnCasaHTML(i)}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-save], [data-edit]")) return;
        ctx.openRecipeModal(i);
      });
      ctx.activablePorTeclado(card, () => ctx.openRecipeModal(i));
      innovationList.appendChild(card);
    });

    // Lápiz de la idea: abre el editor en modo "copia" (la idea no está aún en Mis Recetas)
    innovationList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ctx.innovations.find(x => x.id === btn.dataset.edit);
        if (idea) ctx.openRecipeEditor(idea);
      });
    });

    innovationList.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ctx.innovations.find(x => x.id === btn.dataset.save);
        if (!idea) return;
        // editedAt ISO (sync-buzon §1): toda ruta que CREA/EDITA una receta guarda su marca de edición estable.
        ctx.recipes.push({ id: ctx.uid(), title: idea.title, meal: idea.meal, ingredients: idea.ingredients.slice(), method: idea.method.slice(), createdAt: Date.now(), editedAt: new Date().toISOString(), ...(origenAlGuardar(idea)) });
        ctx.save(ctx.LS.recipes, ctx.recipes);
        // No repintamos la vista "Recetas" a ciegas aqui (probablemente estamos mirando Innovacion ahora y su lista
        // iria oculta/innecesaria de pintar): solo marcamos la vista como sucia. El propio cambio de tab al volver a
        // Recetas decidira si hay que re-pintarla; ver el nav handler / 'recetasDirty' en renderRecipes(), abajo.
        ctx.recetasDirty = true;
        ctx.innovations = ctx.innovations.filter(x => x.id !== idea.id);
        ctx.save(ctx.LS.innov, ctx.innovations);
        renderInnovations();
        ctx.toast("Guardada en Mis Recetas");
      });
    });

    innovationList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.innovations = ctx.innovations.filter(x => x.id !== btn.dataset.del);
        ctx.save(ctx.LS.innov, ctx.innovations);
        renderInnovations();
      });
    });
  }

  // ===== SUGERENCIAS Y MENÚ — CARD 1: "Sugerencia de hoy" =====
  // Recetas del catálogo curado que SÍ se pueden cocinar ahora (todos sus ingredientes con qty>0 en aforo),
  // ordenadas por aprovechamiento de casa. "🍳 Cocinar hoy" anota en mrcheff.cooked (sin tocar recipes[] / Mis Recetas).
  const btnSuggestGenerate = ctx.$("#btn-suggest-generate");
  const btnSuggestClear = ctx.$("#btn-suggest-clear");
  const suggestList = ctx.$("#suggest-list");
  const suggestEmpty = ctx.$("#suggest-empty");
  let loteSugerencias = [];   // el lote actualmente en Card 1 (memoria del repintado de despensa — se llena al renderizar)
  const catalogoEspanol = window.MRCheff.recetasEspanolas || [];
  const planner = window.MRCheff.planner;
  const menuSemanal = window.MRCheff.menuSemanal;
  // Publicadas por ctx (en VIVO: la vista recetas arranca ANTES y las pide igualmente).
  ctx.catalogoEspanol = catalogoEspanol;
  ctx.planner = planner;
  ctx.menuSemanal = menuSemanal;

  function renderSuggestCards(ideas) {
    loteSugerencias = Array.isArray(ideas) ? ideas.slice() : [];   // memoria del lote VIVO: el gancho de despensa lo repinta (línea Falta/todo-en-casa)
    suggestList.innerHTML = "";
    if (!Array.isArray(ideas) || ideas.length === 0) {
      suggestEmpty.classList.remove("hidden");
      return;
    }
    suggestEmpty.classList.add("hidden");
    ideas.forEach(idea => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = idea.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${ctx.escapeHTML(idea.id)}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-cook="${ctx.escapeHTML(idea.id)}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳 Cocinar hoy</button>
        </div>
        ${fotoRecetaHTML(idea)}
        <h3>${ctx.escapeHTML(idea.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${ctx.escapeHTML(idea.meal)}">${ctx.mealLabels[idea.meal] || ""}</span>
          ${badgeOrigenHTML(idea)}
          ${ctx.badgeSyncHTML(idea)}
        ${tagClasicoHTML(idea, SOURCE_LABEL.sugerenciaHoy)}
        </div>
        ${Array.isArray(idea.uses) && idea.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${idea.uses.map(ctx.escapeHTML).join(" · ")}</div>` : ""}
        ${ctx.faltanEnCasaHTML(idea)}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-cook], [data-edit]")) return;
        ctx.openRecipeModal(idea, { highlightMissing: true });
      });
      ctx.activablePorTeclado(card, () => ctx.openRecipeModal(idea, { highlightMissing: true }));
      suggestList.appendChild(card);
    });

    // Lápiz de la sugerencia: abre el editor en modo "copia" (guarda en Mis Recetas sin tocar el catálogo)
    suggestList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.edit);
        if (idea) ctx.openRecipeEditor(idea);
      });
    });

    suggestList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.cook);
        if (!idea) return;
        // Misma vía compartida que Recetas/modal (helper registrarCocinado); aquí además re-sugerimos:
        // el plato recién cocinado entra en cooldown de 7 días y deja de aparecer.
        const { cooked } = ctx.registrarCocinado(idea);
        const pool = planner.buildCandidatePool(ctx.despensaCocina(), ctx.recipes, catalogoEspanol, { cooked, today: ctx.today });
        renderSuggestCards(planner.suggestToday(pool, ctx.despensaCocina()));
      });
    });
  }

  // Rotación de "↻ Sugerir ahora" (Card 1): la COMPOSICIÓN del lote (máx 4, con 1 desayuno + 1 comida
  // + 1 cena + una 4ª que rota de tipo) vive como función PURA `planner.loteRotado` (7ª API pública,
  // §8 log + unit tests en tests/planner.test.js) sobre el ranking completo de suggestToday — toda la
  // lógica de siempre (aforo qty>0, cooldown de cooked, ranking) intacta. Aquí sólo la MEMORIA de la
  // vista: los cursores de rotación (se reinician al recargar la página o al pulsar "Limpiar").
  //
  // RODILLO DEL COOLDOWN (bug 2026-10-21): el filtro de cocinadas-esta-semana vive en el pool común
  // (buildCandidatePool); cocinando en raña —aprobar el plan ancla hasta 21 entradas en mrcheff.cooked—
  // el cooldown podía AGOTAR todas las recetas cocinables y dejar la Card a cero para siempre (repro
  // real: 5 cocinables del aforo del usuario, las 5 con entrada cooked en la ventana ⇒ 0 tarjetas;
  // por eso "ya no sacaba recetas"). Regla: si el ranking estricto trae menos de 4, se rellena con el
  // pool SIN filtro de cooked (las ya cocinadas quedan al final, ordenadas por aprovechamiento; los
  // platos NO cocinados siguen mandando). Así la Card devuelve SIEMPRE hasta 4 recetas "cocinables
  // hoy con lo de casa" y la rotación de cursores sigue cambiando el lote en cada click.
  let cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };
  let clicksSugerencia = 0;

  btnSuggestGenerate.addEventListener("click", () => {
    const cooked = ctx.load(ctx.LS.cooked, []);
    const pool = planner.buildCandidatePool(ctx.despensaCocina(), ctx.recipes, catalogoEspanol, { cooked, today: ctx.today });
    let todas = planner.suggestToday(pool, ctx.despensaCocina());   // ranking completo de SIEMPRE (contrato cerrado del módulo)
    if (todas.length < 4) {
      // Rodillo del cooldown: sin historial cocinado para el 2º corte; dedupe por TÍTULO para no
      // pintar dos tarjetas gemelas (copia propia editada + original del catálogo viven en el pool
      // con fingerprints distintos — el pool los conserva y aquí la Card pinta una sola vez cada plato).
      const poolEntero = planner.buildCandidatePool(ctx.despensaCocina(), ctx.recipes, catalogoEspanol, { cooked: [], today: ctx.today });
      const yaEnCard = new Set(todas.map(t => t.title));
      const extras = planner.suggestToday(poolEntero, ctx.despensaCocina()).filter(i => {
        if (yaEnCard.has(i.title)) return false;
        yaEnCard.add(i.title);
        return true;
      });
      todas = todas.concat(extras);
    }
    const out = planner.loteRotado(todas, { cursores: cursoresSugerencia, clicks: clicksSugerencia });
    cursoresSugerencia = out.cursores;                 // el módulo es puro: devuelve cursores NUEVOS
    clicksSugerencia += 1;
    renderSuggestCards(out.lote);
  });

  btnSuggestClear.addEventListener("click", () => {
    suggestList.innerHTML = "";
    loteSugerencias = [];   // la memoria del lote también se vacía (si no, el repintado de despensa lo haría reaparecer)
    cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };   // la rotación también empieza de cero
    clicksSugerencia = 0;
    suggestEmpty.classList.remove("hidden");
    ctx.toast("Sugerencia limpiada");
  });

  // ===== SUGERENCIAS Y MENÚ — CARD 2: menú semanal (7 días) + CARD 3: lista de la compra =====
  // Previsualiza un plan de 7 días (Lunes..Domingo) respetando el cooldown. "Aprobar plan" guarda
  // mrcheff.weekmenu (aprobado=true, ancla de fecha=HOY real) y registra en mrcheff.cooked cada
  // receta del plan ANCLADA a la fecha de su día de la semana (próxima ocurrencia desde HOY).
  // Card 3 aparece sólo si el plan aprobado trae ingredientes ausentes (needyFoods); marcar un ítem como
  // comprado PREGUNTA primero cuánto se ha comprado y su importancia (modal, feature 2026-10-18) y NO lo
  // cuela con qty 0/score 5: el módulo puro menuSemanal.markItemBought añade o actualiza con esos datos.
  // No toca recipes[] / Mis Recetas.
  const btnMenuGenerate = ctx.$("#btn-menu-generate");
  const btnMenuApprove = ctx.$("#btn-menu-approve");
  ctx.btnMenuApprove = btnMenuApprove;
  const btnMenuClear = ctx.$("#btn-menu-clear");
  const menuInclude = ctx.$("#menu-include-unavailable");
  const menuStatus = ctx.$("#menu-status");
  const menuPlanList = ctx.$("#menu-plan-list");
  const menuEmpty = ctx.$("#menu-empty");
  ctx.menuEmpty = menuEmpty;
  const shoppingListEl = ctx.$("#shopping-list");
  // Barra del plan APROBADO: resumen "N platos" + botón plegar/desplegar (petición 2026-10-21).
  const menuPlanBar = ctx.$("#menu-plan-bar");
  const menuPlanTitle = ctx.$("#menu-plan-title");
  const btnMenuColapsar = ctx.$("#btn-menu-colapsar");

  // Estado del menú semanal cargado de localStorage (persistencia entre pestañas / recargas).
  ctx.weeklyMenu = ctx.load(ctx.LS.weekmenu, null);

  // Render del preview / plan aprobado: 7 días × 3 comidas (desayuno, comida, cena — feature 2026-10-18).
  // Cada comida se pinta como fila con su etiqueta, botones "🍳 Cocinar" (anota cocinado + renueva SOLO
  // ese hueco) y "🔄 Cambiar" (otra receta para ese día+comida, sin tocar el resto). La fila es clickeable
  // para abrir el detalle. Siempre se pintan los 7 días con sus 3 comidas, aunque alguna quede vacía.
  // NOTA: la etiqueta (mealLabels) YA incluye su icono (🌅/🍽️/🌙) — no se añade otro delante
  // (era el duplicado "🌅 🌅 Desayuno" que se veía en la franja del menú).

  function pintarSlotComida(comida, dayIdx, mealIdx) {
    const meal = comida && comida.meal ? comida.meal : "";
    const etiqueta = (ctx.mealLabels[meal] || meal || "");
    const rec = comida && comida.recipe;
    if (!rec) {
      return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${ctx.escapeHTML(meal)}" data-meal-idx="${mealIdx}">
        <span class="menu-meal-tag">${ctx.escapeHTML(etiqueta)}</span>
        <div class="menu-meal-body muted">sin plato asignado</div>
      </div>`;
    }
    const missing = Array.isArray(comida.missing) ? comida.missing : [];
    // Decisión de visibilidad SIEMPRE del módulo puro (regla de negocio, no de vista).
    const acciones = menuSemanal.accionesMenuSlot(ctx.weeklyMenu);
    return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${ctx.escapeHTML(meal)}" data-meal-idx="${mealIdx}">
      <span class="menu-meal-tag">${ctx.escapeHTML(etiqueta)}</span>
      <div class="menu-meal-body">
        <h4 class="menu-meal-title">${ctx.escapeHTML(rec.title)}</h4>
        <div class="recipe-meta">
          ${badgeOrigenHTML(rec)}
          ${ctx.badgeSyncHTML(rec)}
          ${tagMenuSlotHTML(rec)}
          <span class="muted" style="font-size:.8rem">${Array.isArray(rec.ingredients) ? rec.ingredients.length : 0} ingr.</span>
        </div>
        ${Array.isArray(rec.uses) && rec.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${rec.uses.map(ctx.escapeHTML).join(" · ")}</div>` : ""}
        ${missing.length ? `<div class="innov-uses" style="color:var(--danger);">⚠️ Falta: ${missing.map(ctx.escapeHTML).join(", ")}</div>` : `<div class="innov-uses" style="color:var(--accent);">✅ Todos los ingredientes en casa</div>`}
      </div>
      <div class="recipe-actions">
        <button data-edit title="Editar esta receta a tu gusto (guarda en Mis Recetas)">✏️</button>
        ${acciones.cocinar ? `<button data-cook title="Cocinar hoy y renovar este hueco">🍳 Cocinar</button>` : ""}
        ${acciones.cambiar ? `<button data-swap title="Otra receta para este día y comida">🔄 Cambiar</button>` : ""}
      </div>
    </div>`;
  }

  // FEATURE 2026-10-21 (petición del usuario): una vez APROBADO, el plan semanal se puede PLEGAR
  // para que no ocupe pantalla — queda la barra de resumen y SIEMPRE se puede volver a mostrar.
  // La regla vive en el módulo puro (menuSemanal.alternarColapso, sólo aprobado, inmutable) y el
  // estado persiste como `colapsado` en mrcheff.weekmenu; aquí sólo molde + persistencia. PUNTO
  // ÚNICO de la BARRA y del plegado de la lista 7×3 (el PREVIEW la sigue mostrando vía
  // renderWeeklyMenu: un preview no aprobado no se pliega).
  function pintaBarraPlan() {
    const aprobado = !!(ctx.weeklyMenu && ctx.weeklyMenu.approved === true);
    const hayDias = aprobado && Array.isArray(ctx.weeklyMenu.plan) && ctx.weeklyMenu.plan.length > 0;
    menuPlanBar.classList.toggle("hidden", !hayDias);
    if (hayDias) menuPlanList.classList.toggle("hidden", ctx.weeklyMenu.colapsado === true);
    if (!hayDias) return;
    const n = menuSemanal.platosDelPlan(ctx.weeklyMenu.plan);
    menuPlanTitle.textContent = `📅 Tu semana — ${n} ${n === 1 ? "plato" : "platos"}`;
    const plegado = ctx.weeklyMenu.colapsado === true;
    btnMenuColapsar.setAttribute("aria-expanded", plegado ? "false" : "true");
    btnMenuColapsar.textContent = plegado ? "▸ Desplegar" : "▾ Plegar";
    btnMenuColapsar.title = plegado
      ? "Volver a mostrar la semana completa"
      : "Plegar la semana (quedan este resumen y la lista de la compra)";
  }

  btnMenuColapsar.addEventListener("click", () => {
    const cambio = menuSemanal.alternarColapso(ctx.weeklyMenu);
    if (!cambio.cambiado) return;      // sólo se pliega lo aprobado (guard del módulo)
    ctx.weeklyMenu = cambio.weekmenu;
    ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
    pintaBarraPlan();
  });

  function renderWeeklyMenu(plan) {
    menuPlanList.innerHTML = "";
    if (!Array.isArray(plan) || plan.length === 0) {
      menuPlanList.classList.add("hidden");
      return;
    }
    menuPlanList.classList.remove("hidden");
    plan.forEach((dia, dayIdx) => {
      const dayLabel = dia && dia.dayLabel ? dia.dayLabel : `Día ${dayIdx + 1}`;
      const comidas = Array.isArray(dia && dia.meals) ? dia.meals : [];
      const li = document.createElement("li");
      li.className = "menu-day";
      li.innerHTML = `
        <div class="menu-day-header">${ctx.escapeHTML(dayLabel)}</div>
        ${comidas.length
          ? comidas.map((c, i) => pintarSlotComida(c, dayIdx, i)).join("")
          : `<div class="menu-meal-row"><div class="menu-meal-body muted">sin plato asignado</div></div>`}`;
      li.querySelectorAll(".menu-meal-row[data-meal-idx]").forEach(row => {
        const comida = comidas[Number(row.dataset.mealIdx)];
        if (!comida || !comida.recipe) return;
        row.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          ctx.openRecipeModal(comida.recipe, { highlightMissing: true, ocultarEtiquetaSugerencia: true });
        });
        ctx.activablePorTeclado(row, () => ctx.openRecipeModal(comida.recipe, { highlightMissing: true, ocultarEtiquetaSugerencia: true }));
        const btnCook = row.querySelector("[data-cook]");
        if (btnCook) btnCook.addEventListener("click", (e) => {
          e.stopPropagation();
          cocinarComidaDelPlan(Number(row.dataset.day), row.dataset.meal, comida.recipe);
        });
        const btnSwap = row.querySelector("[data-swap]");
        if (btnSwap) btnSwap.addEventListener("click", (e) => {
          e.stopPropagation();
          cambiarComidaDelPlan(Number(row.dataset.day), row.dataset.meal);
        });
        // Lápiz de la franja: abre el editor directamente sobre el plato de ese hueco
        const btnEditRow = row.querySelector("[data-edit]");
        if (btnEditRow) btnEditRow.addEventListener("click", (e) => {
          e.stopPropagation();
          ctx.openRecipeEditor(comida.recipe);
        });
      });
      menuPlanList.appendChild(li);
    });
  }

  // "🍳 Cocinar" DESDE el menú: anota la receta como cocinada HOY (cooldown) y renueva SÓLO ese
  // hueco vía swapSlotRecipe (el resto del plan aprobado queda intacto — decisión §8/feature).
  // Toda la decisión vive en menuSemanal; aquí sólo persistencia + render (Capa vista).
  function cocinarComidaDelPlan(dayIdx, meal, rec) {
    const cookedPrevio = ctx.load(ctx.LS.cooked, []);
    const cocina = menuSemanal.cookEntry(rec, cookedPrevio, ctx.today, planner.cookEntryFor, ctx.uid);
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: ctx.weeklyMenu, dayIndex: dayIdx, meal,
      foods: ctx.foods, recipes: ctx.recipes, catalog: catalogoEspanol,
      cooked: cocina.cooked, today: ctx.today, planner: planner, uid: ctx.uid
    });
    ctx.save(ctx.LS.cooked, cocina.cooked);
    ctx.weeklyMenu = cambio.weekmenu;
    ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
    renderWeeklyMenu(ctx.weeklyMenu.plan);
    pintaBarraPlan();
    if (ctx.weeklyMenu.approved) renderShoppingList();
    ctx.toast(`Registrado: "${rec.title}" se cocinó — nuevo plato para ese hueco`);
  }

  // "🔄 Cambiar": otra receta para UN día+comida (determinista, recorre el ranking). Si el pool
  // de esa comida ya está agotado, avisa SIN tocar el plan.
  function cambiarComidaDelPlan(dayIdx, meal) {
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: ctx.weeklyMenu, dayIndex: dayIdx, meal,
      foods: ctx.foods, recipes: ctx.recipes, catalog: catalogoEspanol,
      cooked: ctx.load(ctx.LS.cooked, []), today: ctx.today, planner: planner, uid: ctx.uid
    });
    if (!cambio.swapped) {
      ctx.toast(`No quedan más recetas de ${ctx.mealLabels[meal] || meal} — prueba a limpiar y regenerar el menú`, "error");
      return;
    }
    ctx.weeklyMenu = cambio.weekmenu;
    ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
    renderWeeklyMenu(ctx.weeklyMenu.plan);
    pintaBarraPlan();
    if (ctx.weeklyMenu.approved) renderShoppingList();
  }

  // SEMÁFORO DE LA COMPRA POR PRIORIDAD (petición 2026-10-21): el color de la fila lo manda la
  // prioridad del alimento en el Inventario (decidida en el módulo puro shoppingListFor) y los
  // ítems SIN registrar van en NEUTRO (urg-neutral), el color del propio texto de la app.
  // formatoFechaCorta vive en modules/util.js (§3, 2026-10-21) — llega por destructuring arriba;
  // filaCompra la consume tal cual para el metadato "se usa el 21 oct" de cada fila del semáforo.

  // Fila clásica de la lista de la compra (needyFoods del plan aprobado, color por prioridad).
  function filaCompra(item) {
    const urg = item.urgency || "neutral";
    const cuando = item.onDay != null && item.daysUntil != null
      ? `· se usa el ${ctx.formatoFechaCorta(item.onDay)} (${item.daysUntil === 0 ? "hoy" : item.daysUntil === 1 ? "mañana" : `en ${item.daysUntil} días`})`
      : "";
    return `
      <li class="alert-row urg-${urg}">
        <span class="alert-name"><strong>${ctx.escapeHTML(item.name)}</strong></span>
        <span class="alert-meta">qty <b>${ctx.escapeHTML(item.qty)}</b> · mínimo <b>${ctx.escapeHTML(item.min)}</b> · importante <b>${ctx.escapeHTML(item.score)}/10</b> ${ctx.escapeHTML(cuando)}</span>
        <span class="alert-acciones">
          ${(menuSemanal.candidatosDespensa(item.name, ctx.despensaCocina())).length
            ? `<button class="btn ghost small" data-despensa="${ctx.escapeHTML(item.name)}" title="¿Ya lo tienes en la despensa con otro nombre?">🛒 Despensa?</button>`
            : ""}
          <button class="btn ghost small" data-buy="${ctx.escapeHTML(item.name)}" title="Marcar como comprada">✅ comprado</button>
        </span>
      </li>`;
  }

  // La lista de la compra ES derivada: se repinta tras CUALQUIER cambio de la despensa (petición
  // 2026-10-21 — venimos del ticket y ya compramos: unos ítems quedaron cubiertos y otros ni
  // estaban en la tienda). Qué significa "cubierta" lo decide el módulo puro
  // (shoppingListFor: alimento que case con qty > SU min); aquí sólo se cuenta TODOS los sucesos
  // que pueden moverla: alta OCR (los dos diálogos), alta manual del formulario, ➕➖/🗑 del
  // inventario y el import del backup — sin olvidar el ✅ comprado, que ya la repintaba.
  // (2026-10-24) El MISMO suceso de despensa respira ahora en las TARJETAS de receta: la línea
  // "⚠️ Falta / ✅ Todos los ingredientes en casa" compró lo que faltaba → las tres
  // listas de cards (Mis Recetas, ideas de Innovación y el lote Sugerenciado) se repintan al
  // momento, igual que la Card 3 — una sola llamada desde cualquier suceso.
  function renderShoppingListTrasDespensa() {
    if (ctx.weeklyMenu && ctx.weeklyMenu.approved) renderShoppingList();
    if (typeof ctx.renderRecipes === "function") ctx.renderRecipes();
    renderInnovations();
    if (loteSugerencias.length) renderSuggestCards(loteSugerencias);
  }

  function renderShoppingList() {
    shoppingListEl.innerHTML = "";
    const needy = ctx.weeklyMenu && ctx.weeklyMenu.approved ? ctx.weeklyMenu.needyFoods : [];
    const ctxCompra = ctx.weeklyMenu && Array.isArray(ctx.weeklyMenu.plan)
      ? { plan: ctx.weeklyMenu.plan, generatedOn: ctx.weeklyMenu.generatedOn || String(ctx.today), today: ctx.today }
      : null;
    const list = menuSemanal.shoppingListFor(needy, ctx.despensaCocina(), ctxCompra);
    if (!list.length) {
      shoppingListEl.classList.add("hidden");
      return;
    }
    shoppingListEl.classList.remove("hidden");
    shoppingListEl.innerHTML = `
      <h3>🛒 Lista de la compra</h3>
      <ul class="alert-list-green">
        ${list.map(filaCompra).join("")}
      </ul>`;
    shoppingListEl.querySelectorAll("[data-buy]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirModalCompra(btn.dataset.buy);
      });
    });
    // FEATURE 2026-10-19 "🛒 Despensa?": variantes del mismo alimento que el casador de tokens
    // solo une ("Jamón serrano" ↔ "Jamón ibérico", "Pan de pueblo" ↔ "Pan"). Los candidatos los
    // decide el módulo puro (menuSemanal.candidatosDespensa) — sin ellos el botón ni sale — y la
    // ÚLTIMA PALABRA la tiene la persona: el diálogo lista las opciones y confirma una a una.
    shoppingListEl.querySelectorAll("[data-despensa]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemName = btn.dataset.despensa;
        const candidatos = menuSemanal.candidatosDespensa(itemName, ctx.despensaCocina());
        if (!candidatos.length) return;
        ctx.modalContent.innerHTML = `
        <h2>🛒 ¿Despensa?</h2>
        <p class="muted">Posible alimento identificado en tu despensa — confirma si "<strong>${ctx.escapeHTML(itemName)}</strong>" es alguno de estos:</p>
        <div class="despensa-elegir">
          ${candidatos.map(c => `
            <button class="btn ghost" data-despensa-elegir="${ctx.escapeHTML(c.name)}">${ctx.escapeHTML(c.name)} <span class="muted">· tienes ${ctx.escapeHTML(c.qty ?? 0)}</span></button>`).join("")}
        </div>
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar (nada cambia)</button>
        </div>`;
        ctx.abrirModal("¿Ya está en tu despensa? " + itemName);
        ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
        ctx.$$("[data-despensa-elegir]", ctx.modalContent).forEach(b =>
          b.addEventListener("click", () => abrirModalCompra(itemName, b.dataset.despensaElegir)));
      });
    });

    // 2026-10-18: NO se cuela el alimento con qty 0 / score 5 — se PREGUNTA cuánto se ha comprado
    // y con qué importancia. La decisión de añadir/actualizar vive en el módulo puro
    // (menuSemanal.markItemBought / markItemBoughtComo); aquí sólo el molde del diálogo.
    // 2026-10-19: 2º parámetro `nombreDespensa` = el usuario confirmó en "🛒 Despensa?" que el
    // ítem es una variante de ESE alimento ya guardado: la compra va a él IN-SITU, sin alta nueva,
    // y el modal ABRE ya cargando el MÍNIMO y la IMPORTANCIA del alimento de despensa (afinación
    // del mismo día: la despensa ya tenía su criterio de alerta — no re-preguntar de cero).
    // (2026-10-21) Fuera el 3er parámetro de datos de la FILA DEL TICKET: el escáner ya no deja
    // pendientes en la lista, así que aquí sólo abren filas del plan semanal.
    function abrirModalCompra(name, nombreDespensa) {
        const objetivo = nombreDespensa ? ctx.foods.find(f => f.name === nombreDespensa) : null;
        // min/score CON los que abre el modal: si la compra va a un alimento de la despensa se conserva
        // SU criterio (no re-preguntar, 2026-10-19) — la regla vive en menuSemanal.valoresPreviosDeCompra.
        const { min: minPrevio, score: scorePrevio } = menuSemanal.valoresPreviosDeCompra(objetivo);
        ctx.modalContent.innerHTML = `
        <h2>✅ ¿Comprado?</h2>
        <p class="muted">"<strong>${ctx.escapeHTML(name)}</strong>"${nombreDespensa
          ? ` se anota en la que ya tienes: <strong>${ctx.escapeHTML(nombreDespensa)}</strong> — misma cosa con otra variante, sin crear un alimento nuevo, con estos datos:`
          : " se añadirá a la despensa con estos datos:"}</p>
        <div class="recipe-edit">
          <label for="compra-qty">Cantidad comprada
            <input type="number" id="compra-qty" min="1" step="1" value="1">
          </label>
          <label for="compra-min">Cantidad mínima para la alerta de reponer
            <input type="number" id="compra-min" min="0" step="1" value="${ctx.escapeHTML(String(minPrevio))}" title="Cuando baje de aquí te avisamos">
          </label>
          <label for="compra-score">Importancia (1–10)
            <input type="number" id="compra-score" min="1" max="10" step="1" value="${ctx.escapeHTML(String(scorePrevio))}">
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar</button>
          <button class="btn primary" data-buy-confirm>Añadir a la despensa</button>
        </div>`;
        ctx.abrirModal("Compra: " + name);
        ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
        ctx.$("#compra-qty", ctx.modalContent).focus();
        ctx.$("#compra-qty", ctx.modalContent).select();
        ctx.$("[data-buy-confirm]", ctx.modalContent).addEventListener("click", () => {
          const qty = parseInt(ctx.$("#compra-qty", ctx.modalContent).value, 10);
          const score = parseInt(ctx.$("#compra-score", ctx.modalContent).value, 10);
          const minRaw = ctx.$("#compra-min", ctx.modalContent).value.trim();
          const min = minRaw === "" ? null : parseInt(minRaw, 10);   // vacío → no se pide: el módulo lo ignora
          // Toda la regla (qty ≥1, min ≥0, score 1–10) decide el módulo; aquí sólo traducimos el
          // campo que falla a su mensaje (texto de vista, 2026-10-21).
          const chk = menuSemanal.validarCompraForm({ qty, score, min });
          if (!chk.ok) {
            ctx.toast(
              chk.campo === "qty" ? "Indica la cantidad comprada (1 o más)" :
              chk.campo === "min" ? "El mínimo para la alerta va de 0 en adelante" :
                                    "La importancia va de 1 a 10", "error");
            return;
          }
          const compra = chk.compra;
          const result = nombreDespensa
            ? menuSemanal.markItemBoughtComo(ctx.foods, ctx.weeklyMenu, name, nombreDespensa, compra)
            : menuSemanal.markItemBought(ctx.foods, ctx.weeklyMenu, name, ctx.uid, Date.now(), compra);
          if (nombreDespensa && !result) {           // guard del módulo: objetivo no hallado → NADA se escribe
            ctx.toast("No se encontró ese alimento en la despensa", "error");
            return;
          }
          if (result.actualizado) {
            ctx.toast(`"${ctx.escapeHTML(name)}" actualizado en la despensa (qty ${qty})`);
          } else if (!result.alreadyExists) {
            ctx.toast(`"${ctx.escapeHTML(name)}" añadido a la despensa (qty ${qty})`);
          } else {
            ctx.toast(`"${ctx.escapeHTML(name)}" ya está en tu despensa`, "error");
            ctx.closeModal();
            return;
          }
          ctx.foods = result.foods;
          ctx.weeklyMenu = result.weekmenu;
          ctx.save(ctx.LS.foods, ctx.foods);
          ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
          ctx.renderFoods();
          ctx.renderWeeklyAlert();
          renderShoppingList();
          ctx.closeModal();
        });
    }
  }

  btnMenuGenerate.addEventListener("click", () => {
    const cooked = ctx.load(ctx.LS.cooked, []);
    const includeUnavailable = menuInclude.checked;
    const pool = planner.buildCandidatePool(ctx.despensaCocina(), ctx.recipes, catalogoEspanol, { cooked, today: ctx.today });
    const menu = planner.buildWeeklyMenu(pool, ctx.foods, { includeUnavailable, today: ctx.today });
    const totalSlots = menuSemanal.platosDelPlan(menu.plan);
    menuStatus.textContent = includeUnavailable
      ? (totalSlots < 21
        ? `Se asignaron ${totalSlots} de 21 platos (7 días × desayuno/comida/cena): tu despensa + recetas guardadas no dan para más. Activa "Sugerencias" o añade más alimentos para ampliarlo.`
        : `Se asignaron los 21 platos. Lo que falte está anotado en la lista de la compra.`)
      : `Se asignaron ${totalSlots} de 21 platos (modo estricto: sólo platos con TODO disponible hoy). Marca la casilla de arriba para completar la semana.`;
    menuStatus.classList.remove("hidden");
    // El preview se asienta ANTES de renderizar: pintarSlotComida consulta menuSemanal.accionesMenuSlot(ctx.weeklyMenu)
    // para la visibilidad de los botones de fila (preview → sin "🍳 Cocinar", con "🔄 Cambiar").
    ctx.weeklyMenu = { ...menu, approved: false, includeUnavailable, generatedOn: ctx.today };
    renderWeeklyMenu(menu.plan);
    pintaBarraPlan();
    menuEmpty.classList.add("hidden");
    btnMenuApprove.disabled = totalSlots === 0;
    btnMenuApprove.title = totalSlots === 0 ? "Genera primero un menú con al menos un plato" : "Aprueba este plan";
  });

  btnMenuApprove.addEventListener("click", () => {
    if (!ctx.weeklyMenu || ctx.weeklyMenu.approved) return;
    const cookedIn = ctx.load(ctx.LS.cooked, []);
    // Toda la decisión vive en menuSemanal.approveMenu: una entrada en mrcheff.cooked por cada
    // receta del plan, ANCLADA a la fecha de calendario de su día de la semana (no todas a HOY).
    const result = menuSemanal.approveMenu(ctx.weeklyMenu, cookedIn, ctx.today, planner.cookEntryFor, ctx.uid);
    const cooked = result.cooked;
    ctx.weeklyMenu = result.weekmenu;
    ctx.save(ctx.LS.cooked, cooked);
    ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuStatus.textContent = `Plan aprobado: ${menuSemanal.platosDelPlan(ctx.weeklyMenu.plan)} plato(s) anotados en su día de la semana (aprobado el ${ctx.today}).`;
    // Re-render de las filas: ahora SÍ llevan "🍳 Cocinar" (decisión de menuSemanal.accionesMenuSlot,
    // que ve approved=true) — el preview se pintó sin él y las filas no se refrescan solas.
    renderWeeklyMenu(ctx.weeklyMenu.plan);
    pintaBarraPlan();
    renderShoppingList();
    ctx.toast("Menú semanal aprobado");
  });

  // Persistencia al recargar: si ya había un plan APROBADO en mrcheff.weekmenu, re-pintamos el menú
  // de 7 días y Card 3 (con sus ítems pendientes) y dejamos el botón Aprobar en estado final.
  // Los previews NO aprobados NO se persisten (contrato §3 Card 2): tras recargar se regeneran con
  // "Generar menú".
  if (ctx.weeklyMenu && ctx.weeklyMenu.approved) {
    if (Array.isArray(ctx.weeklyMenu.plan) && ctx.weeklyMenu.plan.length) {
      renderWeeklyMenu(ctx.weeklyMenu.plan);
    }
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuEmpty.classList.add("hidden");
    pintaBarraPlan();   // (re-honra el plegado persistido del plan aprobado — feature 2026-10-21)
    renderShoppingList();   // sólo pinta si hay needyFoods no comprados (el render filtra por sí, guard §2-A)
  }

  btnMenuClear.addEventListener("click", () => {
    // El estado limpio lo decide menuSemanal.clearMenu(); aquí sólo persistencia (vía helpers,
    // NUNCA localStorage crudo) + render. save(key,null)+load(key,def) round-tripea a null.
    ctx.weeklyMenu = menuSemanal.clearMenu().weekmenu;
    ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
    menuPlanList.innerHTML = "";
    menuPlanList.classList.add("hidden");
    pintaBarraPlan();              // sin plan aprobado ⇒ barra fuera (punto único; la lista ya la tapa Limpiar)
    menuEmpty.classList.remove("hidden");
    menuStatus.classList.add("hidden");
    btnMenuApprove.disabled = true;
    btnMenuApprove.title = "Genera primero un menú con al menos un plato";
    btnMenuApprove.textContent = "Aprobar plan";
    shoppingListEl.innerHTML = "";
    shoppingListEl.classList.add("hidden");
    ctx.toast("Menú limpiado");
  });


  };
})();

/* views/recetas.js · Mr Cheff — vista recetasModal
   Vista Recetas (crear + buscador del catálogo + Mis Recetas) e infra del MODAL común (abrir/cerrar/consejero del botón). Se inicializa la PRIMERA: publica modalContent/abrirModal/closeModal en `ctx` para el resto de vistas.
*/
(function () {
  window.MRCheff.views = window.MRCheff.views || {};
  window.MRCheff.views.recetasModal = function (ctx) {

    // Publicaciones anticipadas: siempre son function declarations (hoisting dentro de
    // la fábrica), seguras de añadir aqui pese a declararse más abajo.
    ctx.renderRecipes = renderRecipes;
    ctx.registrarCocinado = registrarCocinado;
    ctx.abrirModal = abrirModal;
    ctx.closeModal = closeModal;
    ctx.activablePorTeclado = activablePorTeclado;
    ctx.openRecipeModal = openRecipeModal;
    ctx.openRecipeEditor = openRecipeEditor;

  // ===== RECETAS =====
  const recipeDesc = ctx.$("#recipe-desc");
  const recipeMeal = ctx.$("#recipe-meal");
  const btnGenerate = ctx.$("#btn-generate");
  const recipePreview = ctx.$("#recipe-preview");
  const pvTitle = ctx.$("#pv-title");
  const pvIngredients = ctx.$("#pv-ingredients");
  const pvMethod = ctx.$("#pv-method");
  const recipePossible = ctx.$("#recipe-possible");
  const btnSaveRecipe = ctx.$("#btn-save-recipe");
  const btnDiscard = ctx.$("#btn-discard");
  const recipeList = ctx.$("#recipe-list");
  const recipeEmpty = ctx.$("#recipe-empty");
  const recipeFilter = ctx.$("#recipe-filter");
  const recipeMealFilter = ctx.$("#recipe-meal-filter");
  const recipeCatalogSearch = ctx.$("#recipe-catalog-search");
  const recipeCatalogResults = ctx.$("#recipe-catalog-results");
  const recipeCatalogEmpty = ctx.$("#recipe-catalog-empty");
  const mealLabels = { desayuno: "🌅 Desayuno", comida: "🍽️ Comida", cena: "🌙 Cena" };
  ctx.mealLabels = mealLabels;

  // ===== BUSCADOR DEL CATÁLOGO (feature 2026-10-18, card entre crear receta y Mis Recetas) =====
  // TODA la decisión (normalizar consulta vía el matcher compartido, match de TÍTULO SÓLO —
  // exacto x3 / prefijo x2, fix 2026-10-20: los ingredientes ya no puntúan —, orden estable,
  // límite) vive en el módulo puro modules/busqueda-recetas.js;
  // aquí sólo el molde de tarjetas (igual que las de Mis Recetas) y el click → modal de detalle.
  function renderBusquedaCatalogo() {
    const q = recipeCatalogSearch.value;
    const busqueda = (window.MRCheff.busquedaRecetas)
      ? window.MRCheff.busquedaRecetas.buscar(q, ctx.catalogoEspanol, { limite: 8 })
      : { tokens: [], resultados: [] };
    const hits = busqueda.resultados;
    recipeCatalogResults.innerHTML = "";
    recipeCatalogEmpty.classList.toggle("hidden", !(busqueda.tokens.length && hits.length === 0));
    hits.forEach(hit => {
      const r = hit.receta;
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        ${ctx.fotoRecetaHTML(r)}
        <h3>${ctx.escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${ctx.escapeHTML(r.meal)}">${mealLabels[r.meal]}</span>
          ${ctx.badgeOrigenHTML(r)}
          ${ctx.badgeSyncHTML(r)}
        </div>
        ${ctx.faltanEnCasaHTML(r)}`;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Ver detalles de " + r.title);
      card.addEventListener("click", () => openRecipeModal(r));
      activablePorTeclado(card, () => openRecipeModal(r));
      recipeCatalogResults.appendChild(card);
    });
  }
  recipeCatalogSearch.addEventListener("input", renderBusquedaCatalogo);

  btnGenerate.addEventListener("click", () => {
    const desc = recipeDesc.value.trim();
    if (!desc) { ctx.toast("Escribe primero la descripción", "error"); return; }
    const meal = recipeMeal.value;
    const { title, ingredients, method, possible } = window.MRCheff.recipeAnalysis.analyzeRecipe(desc, { meal, pantry: ctx.foods.map(f => f.name) });
    pvTitle.value = title;
    pvIngredients.value = ingredients.join("\n");
    pvMethod.value = method.join("\n");
    renderPossible(possible);
    recipePreview.classList.remove("hidden");
    recipePreview.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Análisis del texto libre "describe tu cocinado" -> receta estructurada. Extraído al módulo puro
  // modules/recipe-analysis.js (sin DOM ni localStorage, recibe { meal, pantry } por contexto para que sea
  // testeable de forma aislada). El punto de uso real está en el manejador del botón "Generar" arriba,
  // que llama directamente a window.MRCheff.recipeAnalysis. Ver CODING_STANDARDS.md §3 option A / DIP.

  // Renderiza la fila de ingredientes "posibles" (chips). Tocar un chip lo añade a la
  // lista de ingredientes sin duplicar. Si no hay posibles, oculta la fila.
  function renderPossible(possible) {
    const box = recipePossible;
    const list = Array.isArray(possible) ? possible : [];
    if (!list.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.innerHTML =
      `<div class="possible-label">💡 También tienes en casa — toca para añadir:</div>` +
      list.map(n => `<button type="button" class="chip" data-ing="${ctx.escapeHTML(n)}">+ ${ctx.escapeHTML(n)}</button>`).join("");
    box.classList.remove("hidden");
    box.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const ing = chip.dataset.ing;
        const lines = pvIngredients.value.split("\n").map(s => s.trim());
        const same = lines.some(l => l.toLowerCase() === ing.toLowerCase());
        if (!same) pvIngredients.value = (pvIngredients.value.trim() ? pvIngredients.value.trim() + "\n" : "") + ing;
        chip.remove();
        if (!box.querySelector(".chip")) { box.classList.add("hidden"); box.innerHTML = ""; }
      });
    });
  }

  btnDiscard.addEventListener("click", () => {
    recipePreview.classList.add("hidden");
    pvTitle.value = ""; pvIngredients.value = ""; pvMethod.value = "";
    renderPossible([]);
  });

  btnSaveRecipe.addEventListener("click", () => {
    const title = pvTitle.value.trim();
    const ingredients = pvIngredients.value.split("\n").map(s => s.trim()).filter(Boolean);
    const method = pvMethod.value.split("\n").map(s => s.trim()).filter(Boolean);
    if (!title || ingredients.length === 0 || method.length === 0) {
      ctx.toast("Completa título, ingredientes y método", "error");
      return;
    }
    ctx.recipes.push({
      id: ctx.uid(),
      title,
      meal: recipeMeal.value,
      ingredients,
      method,
      createdAt: Date.now()
    });
    ctx.save(ctx.LS.recipes, ctx.recipes);
    recipePreview.classList.add("hidden");
    recipeDesc.value = "";
    pvTitle.value = ""; pvIngredients.value = ""; pvMethod.value = "";
    renderRecipes();
    ctx.toast("Receta guardada");
  });

  recipeFilter.addEventListener("input", renderRecipes);
  recipeMealFilter.addEventListener("change", renderRecipes);

  // Registra "se cocinó hoy" para CUALQUIER vista que lo ofrezca (Sugerencias, tarjetas de Recetas y
  // modal de detalle): la lógica inmutable vive en menuSemanal.cookEntry (fabrica la entrada de
  // mrcheff.cooked con su keyFingerprint); aquí sólo persistencia + aviso. Devuelve { cooked } nuevo
  // por si la vista llamante quiere re-render fino (p.ej. Sugerencias re-sugiere con el cooldown aplicado).
  function registrarCocinado(rec) {
    const result = ctx.menuSemanal.cookEntry(rec, ctx.load(ctx.LS.cooked, []), ctx.today, ctx.planner.cookEntryFor, ctx.uid);
    ctx.save(ctx.LS.cooked, result.cooked);
    ctx.toast("Registrado: se cocinó hoy");
    return result;
  }

  function renderRecipes() {
    const q = recipeFilter.value.trim().toLowerCase();
    const meal = recipeMealFilter.value;
    const filtered = ctx.recipes
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(r => (meal === "all" || r.meal === meal) &&
        (!q || r.title.toLowerCase().includes(q)));

    recipeList.innerHTML = "";
    recipeEmpty.classList.toggle("hidden", ctx.recipes.length > 0);
    if (filtered.length === 0 && ctx.recipes.length > 0) {
      recipeEmpty.textContent = "No hay recetas con ese filtro.";
    }

    filtered.forEach(r => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${ctx.escapeHTML(r.id)}" title="Editar título, ingredientes o pasos" aria-label="Editar receta">✏️</button>
          <button data-cook="${ctx.escapeHTML(r.id)}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳</button>
          <button data-del="${ctx.escapeHTML(r.id)}" title="Eliminar" aria-label="Eliminar receta">🗑</button>
        </div>
        ${ctx.fotoRecetaHTML(r)}
        <h3>${ctx.escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${ctx.escapeHTML(r.meal)}">${mealLabels[r.meal]}</span>
          ${ctx.badgeOrigenHTML(r)}
          ${ctx.badgeSyncHTML(r)}
          <span class="muted" style="font-size:.8rem">${Array.isArray(r.ingredients) ? r.ingredients.length : 0} ingr.</span>
        </div>
        ${ctx.faltanEnCasaHTML(r)}`;
      // Abrir detalle al hacer click en la tarjeta (el lápiz abre el EDITOR directamente: para eso está;
      // el 🍳 registra "cocinado hoy" sin abrir el modal — ni edita ni borra)
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-edit], [data-cook]")) return;
        openRecipeModal(r);
      });
      activablePorTeclado(card, () => openRecipeModal(r));
      recipeList.appendChild(card);
    });

    recipeList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.recipes = ctx.recipes.filter(x => x.id !== btn.dataset.del);
        ctx.save(ctx.LS.recipes, ctx.recipes);
        renderRecipes();
        ctx.toast("Receta eliminada");
      });
    });
    // Lápiz de la tarjeta: abre el editor directamente (sin pasar por el modal de detalle)
    recipeList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = ctx.recipes.find(x => x.id === btn.dataset.edit);
        if (receta) openRecipeEditor(receta);
      });
    });
    // 🍳 de la tarjeta (solo icono): registra "cocinado hoy" con la MISMA lógica que Sugerencias y Menú
    // (menuSemanal.cookEntry → mrcheff.cooked con fingerprint → cooldown de 7 días). No abre el modal.
    recipeList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = ctx.recipes.find(x => x.id === btn.dataset.cook);
        if (receta) registrarCocinado(receta);
      });
    });
    // Invariante: cada vez que la vista Recetas se pinta (cualquier camino -- nav-gate, filtros o borrado de una
    // tarjeta), dejamos el flag limpio por aqui, de cara a que solo volvra a marcarse cuando entre real otra receta
    //nueva desde fuera; evita un repintado redundante en el siguiente cambio de tab si no paso nada nuevo.
    ctx.recetasDirty = false;
  }

  // ===== MODAL DETALLE =====
  const modal = ctx.$("#modal");
  const modalContent = ctx.$("#modal-content");
  const modalBox = ctx.$(".modal-box", modal);
  ctx.modal = modal;
  ctx.modalContent = modalContent;   // lo piden el escáner y las demás vistas por ctx
  ctx.modalBox = modalBox;

  // ---------- Consejero del botón (explicación breve desktop + táctil) ----------
  // Desktop: se ve con ENVESAR el botón (o al llegarle el foco) y se VA al salir; móvil:
  // LONG-PRESS de 450 ms — se lee el consejo mientras se mantiene el dedo, al SOLTAR se
  // va y ese toque largo NO acaba accionando el botón (se consultó, no se usó). Todo
  // delegado en #modal-content: cada botón nuevo con data-tip lo hereda sin wiring.
  let tipChefEl = null;
  function tipChef() {
    if (!tipChefEl) {
      tipChefEl = document.createElement("div");
      tipChefEl.id = "tip-chef";
      tipChefEl.className = "tip-chef";
      tipChefEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipChefEl);
    }
    return tipChefEl;
  }
  function mostrarTip(btn) {
    if (!btn || !btn.dataset || !btn.dataset.tip) return;
    const tip = tipChef();
    tip.textContent = btn.dataset.tip;                       // textos propios, nunca dato del usuario
    const r = btn.getBoundingClientRect();
    const cabeArriba = r.top > 48;                           // píldora ~36px + huelgo
    tip.style.left = "0px";                                  // fuera de pantalla para medir sin parpadeo
    tip.style.top = "0px";
    tip.style.visibility = "hidden";
    tip.classList.add("show");
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    x = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - tr.width - 8));
    tip.style.left = Math.round(x) + "px";
    tip.style.top = Math.round(cabeArriba ? r.top - tr.height - 8 : r.bottom + 8) + "px";
    tip.style.visibility = "";
  }
  function ocultarTip() {
    if (tipChefEl) tipChefEl.classList.remove("show");
  }

  let suprimirTrasToqueLargo = false;
  (function consejosDeBotones(raiz) {
    if (!raiz || typeof raiz.addEventListener !== "function") return;
    raiz.addEventListener("mouseover", (e) => {              // desktop: envesar
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) mostrarTip(b);
    });
    raiz.addEventListener("mouseout", (e) => {               // desktop: quitar el ratón
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) ocultarTip();
    });
    raiz.addEventListener("focusin", (e) => {                // teclado: el consejo llega con el foco
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) mostrarTip(b);
    });
    raiz.addEventListener("focusout", ocultarTip);
    let toque = null;                                        // táctil: long-press
    raiz.addEventListener("touchstart", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!b) return;
      suprimirTrasToqueLargo = false;                        // contacto NUEVO: se confía en él de nuevo
      toque = { btn: b, largo: false };
      toque.timer = setTimeout(() => {
        toque.largo = true;
        mostrarTip(b);
        if (navigator.vibrate) navigator.vibrate(10);
      }, 450);
    }, { passive: true });
    const finToque = () => {
      if (!toque) return;
      clearTimeout(toque.timer);
      if (toque.largo) {
        ocultarTip();
        suprimirTrasToqueLargo = true;                       // el click que sigue a leer NO acciona
      }
      toque = null;
    };
    raiz.addEventListener("touchend", finToque);
    raiz.addEventListener("touchcancel", finToque);
    // captura: se interviene ANTES de que cualquier listener del botón vea el click
    raiz.addEventListener("click", (e) => {
      if (!suprimirTrasToqueLargo) return;
      suprimirTrasToqueLargo = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    // el consejo es fijo: si algo scrollea, el botón se mueve — mejor retirarlo
    document.addEventListener("scroll", ocultarTip, true);
  })(modalContent);

  // Accesibilidad del modal: al abrir se recuerda el control que lo llamó (para devolverle el
  // foco al cerrar) y se anuncia un nombre por aria-label; al cerrar el foco vuelve a su sitio.
  // Sólo glue de vista: la decisión de qué se muestra sigue viniendo de cada aceptor.
  let focoAntesDeModal = null;
  function abrirModal(tituloAccesible) {
    const activo = document.activeElement;
    focoAntesDeModal = (activo && typeof activo.focus === "function") ? activo : null;
    // En móvil, scrollear DENTRO del modal no debe arrastrar a la lista de debajo
    // (scroll chaining): el modal-box lleva overscroll-behavior:contain en CSS y, además,
    // congelamos el scroll del documento mientras el modal está abierto. La clase va al
    // documentElement TAMBIÉN: en Android el scroller del documento es <html>, no <body>.
    document.documentElement.classList.add("modal-abierto");
    document.body.classList.add("modal-abierto");
    if (tituloAccesible) modalBox.setAttribute("aria-label", tituloAccesible);
    modal.classList.remove("hidden");
  }

  // Puntos de acceso por teclado: tarjetas y filas que abren detalle con un click ganan también
  // Tab (el foco las alcanza) + Enter/Espacio para abrirlas. Si el foco está en un botón interno
  // (✏️, 🗑, …) la tecla les pertenece a esos botones, no a la tarjeta.
  function activablePorTeclado(el, abrir) {
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", (e) => {
      if (e.target !== el) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
  }
  // Modal de detalle: los "⚠️ No lo tienes" por ingrediente salen desde TODAS las vistas
  // (2026-10-24, petición del usuario: el menú semanal ya los marcaba al abrirla desde los
  // huecos — ahora Recetas, Innovación y el catálogo lo hacen igual). La decisión de qué
  // falta vive en el módulo puro (§ "un solo lugar calcula bien"); el parámetro opts se
  // conserva por compatibilidad con las llamadas existentes de Sugerencias/Menú.
  function openRecipeModal(r, opts) {
    // Etiqueta "Sugerencia de hoy" oculta cuando el modal se abre desde el PLAN semanal (petición
    // 2026-10-21); Card 1 y el resto de vistas la siguen mostrando (tests de Card-1 la fijan).
    const ocultarSugerencia = !!(opts && opts.ocultarEtiquetaSugerencia);
    let faltantesPorIndice = null;                                          // boolean[] paralelo a r.ingredients — of en la despensa viva: dónde falta algo lo dice el módulo puro.
    if (window.MRCheff.recipeMissing && typeof window.MRCheff.recipeMissing.marcarFaltantes === "function") {
      const aforo = typeof ctx.despensaCocina === "function" ? ctx.despensaCocina() : ctx.foods;
      faltantesPorIndice = window.MRCheff.recipeMissing.marcarFaltantes(r, aforo);   // fallback débil: si el módulo se perdiera NO romperíamos nada.
    }
    // ¿Editable? Si la receta ya vive en Mis Recetas → se edita IN-SITU; si no (plato del catálogo curado o del
    // menú generado), la edición guarda una COPIA editable en Mis Recetas sin tocar el original, que es de sólo lectura.
    const enMisRecetas = ctx.recipeEditor.estaGuardada(ctx.recipes, r);
    modalContent.innerHTML = `
      <h2>${ctx.escapeHTML(r.title)}</h2>
      <div class="receta-linea" aria-hidden="true"></div>
      <div class="recipe-meta">
        <span class="tag meal-${ctx.escapeHTML(r.meal)}">${mealLabels[r.meal]}</span>
        ${ctx.badgeOrigenHTML(r)}
        ${ctx.badgeSyncHTML(r)}
        ${ocultarSugerencia ? ctx.tagMenuSlotHTML(r) : ctx.tagClasicoHTML(r, "Idea")}
      </div>
      ${r.from ? `<p class="muted">Base: ${ctx.escapeHTML(r.from)}</p>` : ""}
      ${Array.isArray(r.uses) && r.uses.length ? `<p class="muted">🥣 Usa de tu casa: ${r.uses.map(ctx.escapeHTML).join(", ")}</p>` : ""}
      <h4>🧾 Ingredientes</h4>
      <ul>${Array.isArray(r.ingredients) ? r.ingredients.map((i, idx) => {
        // Cada ingrediente se evalúa con su índice para NO reordenar ni dedup la lista original del plato (§ Liskov: form/shape idéntico al de hoy SIN flag).
        const ausente = Array.isArray(faltantesPorIndice) && faltantesPorIndice[idx] === true; // sólo marca si la vista lo pidió (§ guard estricto § plan §2 "sin bandera → sin clase, sin badge").
        return ausente
          ? `<li class="meal-missing">${ctx.escapeHTML(i)} <span class="missing-badge">⚠️ No lo tienes</span></li>`   // UI coherente con CSS .meal-missing/.missing-badge ya existente (§ plan Feature §2 modal).
          : `<li>${ctx.escapeHTML(i)}</li>`;   // IDÉNTICO al render actual SIN la bandera → Recetas/Innovación no se ROMPEN en sus vistas ya probadas (§ guard total de regresión, § "no romper vistas ya probadas").
      }).join("") : ""}</ul>
      <h4>👨‍🍳 Método</h4>
      <ol>${Array.isArray(r.method) ? r.method.map(m => `<li>${ctx.escapeHTML(ctx.limpiarPaso(m))}</li>`).join("") : ""}</ol>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn ghost" data-edit>${enMisRecetas ? "✏️ Editar" : "✏️ Editar y guardar"}</button>
        <button class="btn ghost" data-cook data-tip="Anota que la has cocinado hoy: 7 días sin volverse a sugerir">🍳 Cocinar hoy</button>
        <button class="btn primary" data-copy>📋 Copiar</button>
      </div>`;
    abrirModal("Detalle de receta: " + r.title);
    const btnCerrarModal = ctx.$(".modal-close", modal);
    if (btnCerrarModal) btnCerrarModal.focus();
    ctx.$$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    const btnEdit = ctx.$("[data-edit]", modalContent);
    if (btnEdit) btnEdit.addEventListener("click", () => openRecipeEditor(r));
    // "🍳 Cocinar hoy" del modal (icono + texto): MISMA lógica compartida que la tarjeta de Recetas y
    // que Sugerencias y Menú — una entrada nueva en mrcheff.cooked anclada a HOY (cooldown de 7 días).
    const btnCook = ctx.$("[data-cook]", modalContent);
    if (btnCook) btnCook.addEventListener("click", () => registrarCocinado(r));
    ctx.$("[data-copy]", modalContent).addEventListener("click", () => {
      const ingredientes = Array.isArray(r.ingredients) ? r.ingredients : [];
      const pasos = Array.isArray(r.method) ? r.method : [];
      const text = `${r.title}\n\nIngredientes:\n${ingredientes.map(i => "- " + i).join("\n")}\n\nMétodo:\n${pasos.map(m => ctx.limpiarPaso(m)).join("\n")}`;
      navigator.clipboard?.writeText(text).then(
        () => ctx.toast("Copiado al portapapeles"),
        () => ctx.toast("No se pudo copiar", "error")
      );
    });
  }

  // Editor de receta: reutiliza el MISMO modal (#modal-content) para no añadir una capa nueva.
  // La lógica de decisión/dominio (borrador, validación, in-situ vs copia, parche del plan) vive en
  // el módulo puro modules/recipe-editor.js (§3 CODING_STANDARDS.md) — aquí sólo DOM y persistencia.
  function openRecipeEditor(r) {
    const enMisRecetas = ctx.recipeEditor.estaGuardada(ctx.recipes, r);
    modalContent.innerHTML = `
      <h2>${enMisRecetas ? "✏️ Editar receta" : "✏️ Editar y guardar en Mis Recetas"}</h2>
      <p class="muted">Toca lo que quieras: nombre, momento del día, ingredientes o pasos. Se guarda como está escrito, con una línea por ingrediente y una por paso.</p>
      <div class="recipe-edit">
        <label for="edit-title">Nombre del plato
          <input type="text" id="edit-title" value="${ctx.escapeHTML(r.title)}" maxlength="120">
        </label>
        <label for="edit-meal">Momento del día
          <select id="edit-meal">
            <option value="desayuno" ${r.meal === "desayuno" ? "selected" : ""}>${mealLabels.desayuno}</option>
            <option value="comida" ${r.meal === "comida" ? "selected" : ""}>${mealLabels.comida}</option>
            <option value="cena" ${r.meal === "cena" ? "selected" : ""}>${mealLabels.cena}</option>
          </select>
        </label>
        <label for="edit-ingredients">Ingredientes (uno por línea)
          <textarea id="edit-ingredients" rows="7">${ctx.escapeHTML((Array.isArray(r.ingredients) ? r.ingredients : []).join("\n"))}</textarea>
        </label>
        <label for="edit-method">Pasos (uno por paso)
          <textarea id="edit-method" rows="8">${ctx.escapeHTML((Array.isArray(r.method) ? r.method : []).join("\n"))}</textarea>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn primary" data-save-edit>Guardar cambios</button>
      </div>`;
    abrirModal("Editar receta");
    ctx.$$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    ctx.$("#edit-title", modalContent).focus();
    ctx.$("[data-save-edit]", modalContent).addEventListener("click", () => {
      const draft = ctx.recipeEditor.buildDraft(
        ctx.$("#edit-title", modalContent).value,
        ctx.$("#edit-meal", modalContent).value,
        ctx.$("#edit-ingredients", modalContent).value,
        // Cada paso se guarda YA normalizado: sin numeración incrustada ni puntuación suelta,
        // para que el dato de Mis Recetas nazca limpio (limpiarPaso es puro e idempotente).
        ctx.$("#edit-method", modalContent).value.split("\n").map(ctx.limpiarPaso).join("\n")
      );
      const check = ctx.recipeEditor.validateDraft(draft);
      if (!check.ok) {
        ctx.toast("Completa nombre, ingredientes y pasos", "error");
        return;
      }
      const resultado = ctx.recipeEditor.applyEdit(ctx.recipes, r, draft, { uid: ctx.uid, now: () => Date.now(), origen: ctx.origenAlGuardar(r).origen });
      ctx.recipes = resultado.recipes;
      ctx.save(ctx.LS.recipes, ctx.recipes);
      if (ctx.recipeEditor.patchPlan(ctx.weeklyMenu && ctx.weeklyMenu.plan, resultado.guardada, resultado.modo === "in-situ" ? null : r.id)) {
        ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
        ctx.renderWeeklyMenu(ctx.weeklyMenu.plan);
      }
      renderRecipes();
      ctx.toast(resultado.modo === "in-situ" ? "Receta actualizada" : "Receta guardada en Mis Recetas");
      closeModal();
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.documentElement.classList.remove("modal-abierto");
    document.body.classList.remove("modal-abierto");
    if (focoAntesDeModal) { focoAntesDeModal.focus(); focoAntesDeModal = null; }
    // El botón con consejero desaparece (además el foco salta al DOM): sin mouseout/focusout,
    // la píldora se quedaría ahí por encima de lo que abra después (2026-10-20).
    const tipChef = document.getElementById("tip-chef");
    if (tipChef) tipChef.classList.remove("show");
    // CIERRE de la DEMO del escáner en el tutorial (2026-10-22): cualquier vía — footer
    // Cancelar, ✕, fondo o Escape — acaba el pase explicativo y devuelve el control al paso
    // del tutorial (sólo si la visita sigue viva y el paso en pantalla es el de la demo).
    if (ctx.demoEscanerAbierta) {
      ctx.demoEscanerAbierta = false;
      if (ctx.tutorialActivo && ctx.pasoEnPantalla && ctx.pasoEnPantalla.demo === "escaner") ctx.avanzarPasoTutorial();
    }
  }
  ctx.$$("[data-close]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });


  };
})();

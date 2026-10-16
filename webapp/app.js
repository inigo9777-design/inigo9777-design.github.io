/* app.js · Mr Cheff — lógica de la aplicación
   Se ejecuta cuando el DOM está listo.
   Persiste en localStorage: mrcheff.foods, mrcheff.recipes, mrcheff.innov
*/

document.addEventListener("DOMContentLoaded", () => {
   // ===== TEMA (claro / oscuro) =====
  const LS_THEME = "mrcheff.theme";
  const root = document.documentElement;
  const themeBtn = document.getElementById("theme-toggle");

  function applyTheme(t) {
    root.dataset.theme = t;
    if (themeBtn) {
      themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
      themeBtn.title = t === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    }
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  }

  // Sincroniza el icono con el tema ya aplicado por el <script> del <head>
  applyTheme(root.dataset.theme || "dark");

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }
  
  // ===== ESTADO Y PERSISTENCIA =====
  const LS = {
    foods: "mrcheff.foods",
    recipes: "mrcheff.recipes",
    innov: "mrcheff.innov",
    innovDate: "mrcheff.innov.date"
  };

  const load = (key, def) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
    catch { return def; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  let foods = load(LS.foods, []);
  let recipes = load(LS.recipes, []);
  let innovations = load(LS.innov, []);
  let innovDay = load(LS.innovDate, "");

  // Limpiar innovaciones de días anteriores
  const today = new Date().toISOString().slice(0, 10);
  if (innovDay && innovDay !== today) {
    innovations = [];
    save(LS.innov, []);
    innovDay = today;
    save(LS.innovDate, innovDay);
  }


  // "Vista Recetas sucia": true si ha entrado una receta nueva DESDE FUERA de esta vista (hoy: el boton estrella en
  // Innovacion) y aun no la hemos repintado. Evita un re-render innecesario en cada cambio de tab; solo se pinta
  // cuando efectivamente hay algo nuevo que mostrar. Precedente identico al 'innovDay !== today' mas arriba (ver DIP, sec 2-D).
  let recetasDirty = false;
  // ===== HELPERS =====
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  // Toast
  const toastEl = $("#toast");
  function toast(msg, type = "success") {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    toastEl.classList.add(type);
    requestAnimationFrame(() => toastEl.classList.add("show"));
    setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.classList.add("hidden"), 250);
    }, 2200);
  }

  // ===== NAVEGACIÓN DE VISTAS =====
  const tabs = $$(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
      // Volver al tab de Recetas sin nada nuevo no debe re-pintar la lista (ineficiente y a ciegas, tal como pide el
      //que piden los usuarios); solo lo hacemos si ha entrado una receta nueva desde fuera: entonces 'recipes' ya esta sincronizado en
      // memoria y basta con re-pintar. Ver el origen del flag en el boton estrella de Innovacion (arriba) y la
      // invariante final que lo limpia, dentro de renderRecipes().
      if (view === "recipes" && recetasDirty) {
        renderRecipes();
      }
    });
  });

  // ===== ALIMENTOS =====
  const foodForm = $("#food-form");
  const foodName = $("#food-name");
  const foodScore = $("#food-score");
  const foodScoreVal = $("#food-score-val");
  const foodQty = $("#food-qty");
  const foodQtyVal = $("#food-qty-val");
  const foodMin = $("#food-min");
  const foodMinVal = $("#food-min-val");
  const foodList = $("#food-list");
  const foodEmpty = $("#food-empty");
  const foodFilter = $("#food-filter");
  const toggleCheck = $("#toggle-check");
  const weeklyAlert = $("#weekly-alert");

  foodScore.addEventListener("input", () => foodScoreVal.textContent = foodScore.value);
  foodQty.addEventListener("input", () => foodQtyVal.textContent = foodQty.value || 0);
  foodMin.addEventListener("input", () => foodMinVal.textContent = foodMin.value || 0);

  foodForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = foodName.value.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    const exists = foods.find(f => f.name.toLowerCase() === lower);
    if (exists) {
      toast("Ese alimento ya está en tu lista", "error");
      return;
    }
    const qty = Math.max(0, parseInt(foodQty.value, 10) || 0);
    const min = Math.max(0, parseInt(foodMin.value, 10) || 0);
    foods.push({ id: uid(), name, score: parseInt(foodScore.value, 10), qty, min, checked: false, createdAt: Date.now() });
    save(LS.foods, foods);
    foodName.value = "";
    foodScore.value = 5;
    foodScoreVal.textContent = "5";
    foodQty.value = 0;
    foodQtyVal.textContent = "0";
    foodMin.value = 1;
    foodMinVal.textContent = "1";
    renderFoods();
    renderWeeklyAlert();
    toast("Alimento añadido");
  });

  foodFilter.addEventListener("input", renderFoods);
  toggleCheck.addEventListener("click", () => {
    const all = foods.every(f => f.checked);
    foods.forEach(f => f.checked = !all);
    save(LS.foods, foods);
    renderFoods();
    renderWeeklyAlert();
  });

  // Lógica de urgencia/reposición extraída al módulo puro modules/priority.js (sin DOM ni localStorage).
  // Se consume aquí para que el resto de la app se comporte idénticamente. Ver CODING_STANDARDS.md §3 option A / DIP:
  const { urgencyLevel, needsRestock } = window.MRCheff.priority;

  function renderFoods() {
    const q = foodFilter.value.trim().toLowerCase();
    const filtered = foods.filter(f => !q || f.name.toLowerCase().includes(q));
    foodList.innerHTML = "";
    if (filtered.length === 0) {
      foodEmpty.classList.toggle("hidden", foods.length > 0);
      return;
    }
    foodEmpty.classList.add("hidden");
     filtered.forEach(f => {
      const qty = f.qty ?? 0;
      const min = f.min ?? 0;
      const low = qty <= min;
      const level = urgencyLevel(f.score);
      const li = document.createElement("li");
      li.className = "food-item" + (f.checked ? " checked" : "") + " urg-" + level + (low ? " low" : "");
      li.innerHTML = `
        <input type="checkbox" data-id="${f.id}" ${f.checked ? "checked" : ""}>
        <span class="food-name">${escapeHTML(f.name)}</span>
        <span class="food-qty" title="En casa / mínimo para avisar">${qty} / ${min}</span>
        <span class="food-score urg-${level}" title="Importancia">${f.score}</span>
        <span class="food-actions">
          <button class="btn ghost small" data-inc="${f.id}" title="Sumar 1" data-step="1">➕</button>
          <button class="btn ghost small" data-inc="${f.id}" title="Restar 1" data-step="-1">➖</button>
          <button class="btn ghost small" data-del="${f.id}" title="Eliminar">🗑</button>
        </span>`;
      foodList.appendChild(li);
    });
    foodList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        const f = foods.find(x => x.id === cb.dataset.id);
        if (f) { f.checked = cb.checked; save(LS.foods, foods); renderFoods(); renderWeeklyAlert(); }
      });
    });
    foodList.querySelectorAll("[data-inc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const f = foods.find(x => x.id === btn.dataset.inc);
        if (f) {
          f.qty = Math.max(0, (f.qty ?? 0) + parseInt(btn.dataset.step, 10));
          save(LS.foods, foods);
          renderFoods();
          renderWeeklyAlert();
        }
      });
    });
    foodList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        foods = foods.filter(x => x.id !== btn.dataset.del);
        save(LS.foods, foods);
        renderFoods();
        renderWeeklyAlert();
        toast("Alimento eliminado");
      });
    });
  }

  function renderWeeklyAlert() {
    // Un alimento sale en la alerta si está por debajo de su mínimo para avisar
    const toRestock = foods
      .filter(f => !f.checked && needsRestock(f))
      .slice()
      .sort((a, b) => b.score - a.score);

    if (toRestock.length === 0) {
      weeklyAlert.className = "card alert-card hidden";
      weeklyAlert.innerHTML = "";
      return;
    }

    // El color de la alerta lo marca la importancia del alimento MÁS URGENTE
    const topLevel = urgencyLevel(toRestock[0].score);
    const levelIcon = topLevel === "red" ? "🚨" : topLevel === "orange" ? "⚠️" : "🛒";
    const levelTitle = topLevel === "red" ? "Repuestos urgentes esta semana"
                      : topLevel === "orange" ? "Reposición recomendada"
                      : "Sugerencia de compra";

    weeklyAlert.className = `card alert-card alert-${topLevel}`;
    weeklyAlert.innerHTML = `
      <h3>${levelIcon} ${levelTitle}</h3>
      <ul class="alert-list-${topLevel}">
        ${toRestock.slice(0, 8).map(f => `
          <li class="alert-row urg-${urgencyLevel(f.score)}">
            <span class="alert-name"><strong>${escapeHTML(f.name)}</strong></span>
            <span class="alert-meta">tienes <b>${f.qty ?? 0}</b> · mínimo <b>${f.min ?? 0}</b> · importancia <b>${f.score}/10</b></span>
          </li>`).join("")}
      </ul>`;
  }

  // ===== RECETAS =====
  const recipeDesc = $("#recipe-desc");
  const recipeMeal = $("#recipe-meal");
  const btnGenerate = $("#btn-generate");
  const recipePreview = $("#recipe-preview");
  const pvTitle = $("#pv-title");
  const pvIngredients = $("#pv-ingredients");
  const pvMethod = $("#pv-method");
  const recipePossible = $("#recipe-possible");
  const btnSaveRecipe = $("#btn-save-recipe");
  const btnDiscard = $("#btn-discard");
  const recipeList = $("#recipe-list");
  const recipeEmpty = $("#recipe-empty");
  const recipeFilter = $("#recipe-filter");
  const recipeMealFilter = $("#recipe-meal-filter");
  const mealLabels = { desayuno: "🌅 Desayuno", comida: "🍽️ Comida", cena: "🌙 Cena" };

  btnGenerate.addEventListener("click", () => {
    const desc = recipeDesc.value.trim();
    if (!desc) { toast("Escribe primero la descripción", "error"); return; }
    const meal = recipeMeal.value;
    const { title, ingredients, method, possible } = window.MRCheff.recipeAnalysis.analyzeRecipe(desc, { meal, pantry: foods.map(f => f.name) });
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
      list.map(n => `<button type="button" class="chip" data-ing="${escapeHTML(n)}">+ ${escapeHTML(n)}</button>`).join("");
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
      toast("Completa título, ingredientes y método", "error");
      return;
    }
    recipes.push({
      id: uid(),
      title,
      meal: recipeMeal.value,
      ingredients,
      method,
      createdAt: Date.now()
    });
    save(LS.recipes, recipes);
    recipePreview.classList.add("hidden");
    recipeDesc.value = "";
    pvTitle.value = ""; pvIngredients.value = ""; pvMethod.value = "";
    renderRecipes();
    toast("Receta guardada");
  });

  recipeFilter.addEventListener("input", renderRecipes);
  recipeMealFilter.addEventListener("change", renderRecipes);

  function renderRecipes() {
    const q = recipeFilter.value.trim().toLowerCase();
    const meal = recipeMealFilter.value;
    const filtered = recipes
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(r => (meal === "all" || r.meal === meal) &&
        (!q || r.title.toLowerCase().includes(q)));

    recipeList.innerHTML = "";
    recipeEmpty.classList.toggle("hidden", recipes.length > 0);
    if (filtered.length === 0 && recipes.length > 0) {
      recipeEmpty.textContent = "No hay recetas con ese filtro.";
    }

    filtered.forEach(r => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-del="${r.id}" title="Eliminar">🗑</button>
        </div>
        <h3>${escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
          <span class="muted" style="font-size:.8rem">${r.ingredients.length} ingr.</span>
        </div>`;
      // Abrir detalle al hacer click en la tarjeta
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]")) return;
        openRecipeModal(r);
      });
      recipeList.appendChild(card);
    });

    recipeList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recipes = recipes.filter(x => x.id !== btn.dataset.del);
        save(LS.recipes, recipes);
        renderRecipes();
        toast("Receta eliminada");
      });
    });
    // Invariante: cada vez que la vista Recetas se pinta (cualquier camino -- nav-gate, filtros o borrado de una
    // tarjeta), dejamos el flag limpio por aqui, de cara a que solo volvra a marcarse cuando entre real otra receta
    //nueva desde fuera; evita un repintado redundante en el siguiente cambio de tab si no paso nada nuevo.
    recetasDirty = false;
  }

  // ===== MODAL DETALLE =====
  const modal = $("#modal");
  const modalContent = $("#modal-content");
  function openRecipeModal(r) {
    modalContent.innerHTML = `
      <h2>${escapeHTML(r.title)}</h2>
      <div class="recipe-meta">
        <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
        ${r.source ? `<span class="tag tag-${r.source}">${(SOURCE_LABEL[r.source] || "Idea").toString()}</span>` : ""}
      </div>
      ${r.from ? `<p class="muted">Base: ${escapeHTML(r.from)}</p>` : ""}
      ${r.uses && r.uses.length ? `<p class="muted">🥣 Usa de tu casa: ${r.uses.map(escapeHTML).join(", ")}</p>` : ""}
      <h4>🧾 Ingredientes</h4>
      <ul>${r.ingredients.map(i => `<li>${escapeHTML(i)}</li>`).join("")}</ul>
      <h4>👨‍🍳 Método</h4>
      <ol>${r.method.map(m => `<li>${escapeHTML(m)}</li>`).join("")}</ol>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" data-copy>📋 Copiar</button>
      </div>`;
    modal.classList.remove("hidden");
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    $("[data-copy]", modalContent).addEventListener("click", () => {
      const text = `${r.title}\n\nIngredientes:\n${r.ingredients.map(i => "- " + i).join("\n")}\n\nMétodo:\n${r.method.join("\n")}`;
      navigator.clipboard?.writeText(text).then(
        () => toast("Copiado al portapapeles"),
        () => toast("No se pudo copiar", "error")
      );
    });
  }
  function closeModal() { modal.classList.add("hidden"); }
  $$("[data-close]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ===== INNOVACIÓN =====
  const btnGenerateInnov = $("#btn-generate-innov");
  const btnClearInnov = $("#btn-clear-innov");
  const innovationList = $("#innovation-list");
  const innovationEmpty = $("#innovation-empty");
  const innovDayNote = $("#innov-day-note");
  const innovCount = $("#innov-count");
  const innovCountVal = $("#innov-count-val");
  const innovFocus = $("#innov-focus");
  const innovSummary = $("#innov-summary");

  innovCount.addEventListener("input", () => innovCountVal.textContent = innovCount.value);
  const SOURCE_LABEL = { curada: "Receta española", variacion: "Variación", combo: "Combinación", libre: "Creada", protagonista: "Enfocado", nueva: "Nueva" };

  btnGenerateInnov.addEventListener("click", () => {
    if (foods.length === 0 && recipes.length === 0) {
      toast("Añade alimentos o guarda una receta para inventar", "error");
      return;
    }
    const count = parseInt(innovCount.value, 10) || 8;
    // Generación de ideas (variaciones + combinaciones arquetípicas, y platos "libres"/"protagonistas"): ahora lógica PURA
    // extraída a modules/innovations.js. Aquí sólo consumimos su lote (`batch`) y orquestamos la conciliación con lo ya guardado
    // más persistencia. Ver CODING_STANDARDS.md §3 option A / DIP, al igual que priority/classify/recipe-analysis.
    const batch = window.MRCheff.innovations.generate(count, innovFocus.value, { foods, recipes });
    if (batch.length === 0) {
      toast("No hay combinaciones suficientes con lo que tienes", "error");
      return;
    }
    // Añadimos el nuevo lote al azar, evitando duplicados de título
    const existing = new Set(innovations.map(i => i.title.toLowerCase().trim()));
    let added = 0;
    batch.forEach(i => {
      const key = i.title.toLowerCase().trim();
      if (existing.has(key)) return;
      existing.add(key);
      innovations.push(i);
      added++;
    });
    // Limitamos la pila para que no crezca sin control
    if (innovations.length > 30) innovations = innovations.slice(innovations.length - 30);
    save(LS.innov, innovations);
    innovDay = today;
    save(LS.innovDate, innovDay);
    innovDayNote.classList.remove("hidden");
    renderInnovations();
    toast(added ? `¡${added} idea(s) nueva(s)!` : "Ya tenías esas ideas en la lista");
  });

  btnClearInnov.addEventListener("click", () => {
    innovations = [];
    save(LS.innov, []);
    innovDayNote.classList.add("hidden");
    renderInnovations();
    toast("Ideas limpiadas");
  });

  // --- Generadores de innovación y utilidades aleatorias extraídos al módulo puro modules/innovations.js ---
  // (pick/chance/randInt/shuffle/sample/byScore/joinNames + STYLES/TWISTS/FINISH/SEASONINGS/PREFIXES/ADJ/ARCHETYPES
  //  + makeVariation/makeCombo/makeFreeform/makeSolo/generateInnovations). Ahora se consume vía
  //  window.MRCheff.innovations.generate(count, focus, { foods, recipes }) — ver el comentario del handler de "btnGenerateInnov".

  function updateInnovSummary() {
    if (!innovations.length) { innovSummary.classList.add("hidden"); return; }
    innovSummary.classList.remove("hidden");
    const bySrc = {};
    innovations.forEach(i => { bySrc[i.source] = (bySrc[i.source] || 0) + 1; });
    const parts = Object.entries(bySrc).map(([s, n]) => `${n} ${SOURCE_LABEL[s] || "nuevas"}`).join(" · ");
    innovSummary.textContent = `${innovations.length} idea(s) en la lista (${parts}). Guarda las que te gusten con ⭐.`;
  }

  function renderInnovations() {
    innovationList.innerHTML = "";
    innovationEmpty.classList.toggle("hidden", innovations.length > 0);
    updateInnovSummary();
    innovations.forEach(i => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = i.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-save="${i.id}" title="Guardar en Mis Recetas">⭐</button>
          <button data-del="${i.id}" title="Eliminar">🗑</button>
        </div>
        <h3>${escapeHTML(i.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${i.meal}">${mealLabels[i.meal]}</span>
          <span class="tag tag-${i.source}">${SOURCE_LABEL[i.source] || "Nueva"}</span>
        </div>
        ${i.uses && i.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${i.uses.map(escapeHTML).join(" · ")}</div>` : ""}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-save]")) return;
        openRecipeModal(i);
      });
      innovationList.appendChild(card);
    });

    innovationList.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = innovations.find(x => x.id === btn.dataset.save);
        if (!idea) return;
        recipes.push({ id: uid(), title: idea.title, meal: idea.meal, ingredients: idea.ingredients.slice(), method: idea.method.slice(), createdAt: Date.now() });
        save(LS.recipes, recipes);
        // No repintamos la vista "Recetas" a ciegas aqui (probablemente estamos mirando Innovacion ahora y su lista
        // iria oculta/innecesaria de pintar): solo marcamos la vista como sucia. El propio cambio de tab al volver a
        // Recetas decidira si hay que re-pintarla; ver el nav handler / 'recetasDirty' en renderRecipes(), abajo.
        recetasDirty = true;
        innovations = innovations.filter(x => x.id !== idea.id);
        save(LS.innov, innovations);
        renderInnovations();
        toast("Guardada en Mis Recetas");
      });
    });

    innovationList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        innovations = innovations.filter(x => x.id !== btn.dataset.del);
        save(LS.innov, innovations);
        renderInnovations();
      });
    });
  }

  // ===== TEMPORADA =====
  const seasonFilter = $("#season-filter");
  const seasonMonth = $("#season-month");
  const seasonGrid = $("#season-grid");
  const seasonEmpty = $("#season-empty");
  const { MESES, TEMPORADA } = window.MR_CHEFF_DATA || { MESES: [], TEMPORADA: [] };

  // Poblamos el select de meses (1-12) y ponemos el actual por defecto
  MESES.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = idx + 1;
    opt.textContent = m;
    seasonMonth.appendChild(opt);
  });
  const currentMonth = new Date().getMonth() + 1;
  seasonMonth.value = currentMonth;

  function renderSeason() {
    const q = seasonFilter.value.trim().toLowerCase();
    const month = parseInt(seasonMonth.value, 10);
    const filtered = TEMPORADA.filter(item =>
      item.meses.includes(month) &&
      (!q || item.nombre.toLowerCase().includes(q))
    );
    seasonGrid.innerHTML = "";
    seasonEmpty.classList.toggle("hidden", filtered.length > 0);
    filtered.forEach(item => {
      const card = document.createElement("div");
      card.className = "season-card";
      card.innerHTML = `
        <span class="season-emoji">${item.emoji}</span>
        <div class="season-name">${escapeHTML(item.nombre)}</div>
        <span class="season-type ${item.tipo}">${item.tipo}</span>`;
      seasonGrid.appendChild(card);
    });
  }

  seasonFilter.addEventListener("input", renderSeason);
  seasonMonth.addEventListener("change", renderSeason);

  // ===== COPIA DE SEGURIDAD =====
  // Los datos viven en este navegador (localStorage). Como localStorage es privado de cada
  // navegador, para llevarlos a otro navegador o dispositivo se exportan a un .json y se
  // importan de vuelta. No hay ninguna base de datos local que comparta datos entre
  // navegadores por sí sola (IndexedDB/sql.js son privados de un solo navegador también).
  const MEAL_SET = new Set(["desayuno", "comida", "cena"]);
  const clampScore = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? 5 : Math.min(10, Math.max(1, n)); };

  const btnExport = $("#btn-export");
  const btnImport = $("#btn-import");
  const importFile = $("#import-file");
  const importNote = $("#import-note");

  // Reúne todo lo exportable en un objeto único con versión y fecha
  function buildBackup() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      foods,
      recipes,
      innovations,
      innovDay
    };
  }

  // Nombre de la copia: "dataBackup" + fecha y hora REALES del momento en que se exporta
  // (p. ej. dataBackup-2026-10-11-17-10-49.json). No es una cadena fija.
  const pad2 = n => String(n).padStart(2, "0");
  function backupFilename() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
    return `dataBackup-${stamp}.json`;
  }

  // Último recurso si el navegador no descarga ni deja elegir carpeta: muestra el
  // contenido en un cuadro para copiarlo a un archivo a mano.
  function showBackupFallback(filename, content) {
    modalContent.innerHTML = `
      <h2>Copia manual de seguridad</h2>
      <p class="muted">Tu navegador no ha podido guardar el archivo con el nombre
          <strong>${escapeHTML(filename)}</strong>. Copia este texto y pégalo en un archivo nuevo
          con ese mismo nombre, dentro de la carpeta <code>dataBackup/</code> (o en Descargas).</p>
      <textarea id="backup-text" style="width:100%;min-height:220px;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHTML(content)}</textarea>
      <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" id="backup-copy">📋 Copiar</button>
      </div>`;
    modal.classList.remove("hidden");
    $$("[data-close]", modalContent).forEach(b => b.addEventListener("click", closeModal));
    $("#backup-copy", modalContent).addEventListener("click", () => {
      const ta = $("#backup-text", modalContent);
      ta.focus();
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value)
          .then(() => toast("Copiado al portapapeles"))
          .catch(() => toast("Texto seleccionado: pulsa Cmd/Ctrl+C"));
      } else {
        toast("Texto seleccionado: pulsa Cmd/Ctrl+C");
      }
    });
  }

  const btnCopyJson = $("#btn-copy-json");

  // Guardar el archivo con nombre dataBackup + fecha/hora REALES del momento de la exportación:
  // descarga a Descargas con ese nombre (blob + <a download>).
  //
  // Nota: antes se intentaba primero la API de sistema de archivos (showSaveFilePicker) para
  // guardar directo en dataBackup/. Se quitó porque, abriendo index.html por file://, ese
  // diálogo solía dejar un archivo VACÍO y caía igualmente a la descarga, resultando en DOS
  // ventanas (diálogo + Descargas) y un JSON vacío. La descarga a Descargas es estable en
  // todos los navegadores; si el navegador no descarga nada, queda el botón "📋 Copiar" para
  // pegar el contenido a mano.
  btnExport.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Copia de seguridad descargada en Descargas");
  });

  // Vía garantizada: copia el JSON al portapapeles (o lo muestra para pegarlo a mano).
  btnCopyJson.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => toast("JSON copiado: pégalo en " + filename))
        .catch(() => showBackupFallback(filename, content));
    } else {
      showBackupFallback(filename, content);
    }
  });

  btnImport.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { applyBackup(JSON.parse(String(reader.result))); }
      catch { toast("No se pudo leer el archivo", "error"); }
    };
    reader.onerror = () => toast("No se pudo leer el archivo", "error");
    reader.readAsText(file);
    e.target.value = ""; // permite volver a importar el mismo archivo
  });

  // Fusiona un backup importado en los datos actuales (no destruye lo que ya había)
  function applyBackup(data) {
    if (!data || typeof data !== "object") { toast("Archivo no válido", "error"); return; }
    const inFoods = Array.isArray(data.foods) ? data.foods : [];
    const inRecipes = Array.isArray(data.recipes) ? data.recipes : [];
    const inInnov = Array.isArray(data.innovations) ? data.innovations : [];

    // Alimentos: se suman los que no existan ya (evita duplicados por nombre)
    const knownFoods = new Set(foods.map(f => f.name.toLowerCase()));
    let addedFoods = 0;
    inFoods.forEach(f => {
      if (!f || typeof f !== "object" || !f.name) return;
      const key = String(f.name).toLowerCase();
      if (knownFoods.has(key)) return;
      knownFoods.add(key);
      foods.push({
        id: uid(), name: String(f.name), score: clampScore(f.score),
        qty: f.qty ?? 0, min: f.min ?? 0, checked: !!f.checked,
        createdAt: f.createdAt || Date.now()
      });
      addedFoods++;
    });

    // Recetas: se añaden todas las importadas
    let addedRecipes = 0;
    inRecipes.forEach(r => {
      if (!r || typeof r !== "object" || !r.title) return;
      recipes.push({
        id: uid(), title: String(r.title),
        meal: MEAL_SET.has(r.meal) ? r.meal : "comida",
        ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String) : [],
        method: Array.isArray(r.method) ? r.method.map(String) : [],
        source: r.source || undefined,
        from: r.from || undefined,
        uses: Array.isArray(r.uses) ? r.uses.map(String) : undefined,
        createdAt: r.createdAt || Date.now()
      });
      addedRecipes++;
    });

    // Ideas de innovación: se suman y se recorta la pila al máximo de 30
    if (inInnov.length) {
      inInnov.forEach(i => {
        if (!i || typeof i !== "object" || !i.title) return;
        innovations.push({
          id: uid(), title: String(i.title),
          meal: MEAL_SET.has(i.meal) ? i.meal : "comida",
          ingredients: Array.isArray(i.ingredients) ? i.ingredients.map(String) : [],
          method: Array.isArray(i.method) ? i.method.map(String) : [],
          source: i.source || "nueva",
          from: i.from || "",
          uses: Array.isArray(i.uses) ? i.uses.map(String) : [],
          createdAt: i.createdAt || Date.now()
        });
      });
      if (innovations.length > 30) innovations = innovations.slice(innovations.length - 30);
      innovDay = today;
      save(LS.innov, innovations);
      save(LS.innovDate, innovDay);
    }

    save(LS.foods, foods);
    save(LS.recipes, recipes);
    renderFoods();
    renderWeeklyAlert();
    renderRecipes();
    renderInnovations();
    importNote.textContent = `Se añadieron ${addedFoods} alimento(s) y ${addedRecipes} receta(s).`;
    importNote.classList.remove("hidden");
    toast(`Importados: ${addedFoods} alimento(s), ${addedRecipes} receta(s)`);
  }

  // ===== INICIALIZACIÓN =====
  renderFoods();
  renderWeeklyAlert();
  renderRecipes();
  renderInnovations();
  renderSeason();
});
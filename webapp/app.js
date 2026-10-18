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
    innovDate: "mrcheff.innov.date",
    cooked: "mrcheff.cooked",
    weekmenu: "mrcheff.weekmenu"
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
  // uid() y escapeHTML() viven en modules/util.js, lógica PURa (sin DOM ni localStorage) anti-XSS e id-generación; ver
  // CODING_STANDARDS.md §3 option A / DIP y el patrón idéntico de priority.classify.recipeAnalysis.innovations bajo window.MRCheff.*.
  const { escapeHTML, uid, limpiarPaso } = window.MRCheff.util;
  const recipeEditor = window.MRCheff.recipeEditor;   // módulo puro del editor de recetas (modules/recipe-editor.js)

  // $/$$ son helpers DE VISTA (manipulan el DOM) → NO lógica de decisión: quedan en este closure como antes.
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

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
      tabs.forEach(t => {
        t.classList.toggle("active", t === tab);
        if (t === tab) t.setAttribute("aria-current", "true");
        else t.removeAttribute("aria-current");
      });
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

  // Lógica de urgencia/reposición extraída al módulo puro modules/priority.js (sin DOM ni localStorage). Se consume para que el
  // resto de la app se comporte idénticamente. Ver CODING_STANDARDS.md §3 option A / DIP y §5 "alimentos/alerta semanal":
  // urgencyLevel = color por item; buildWeeklyAlert = decide qué entra/presenta (icono/título/orden/CAPA-A-8) — lógica PURe, testeable sin DOM.
  const { urgencyLevel, buildWeeklyAlert } = window.MRCheff.priority;

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
        <input type="checkbox" data-id="${f.id}" ${f.checked ? "checked" : ""} aria-label="Hoy está en casa: ${escapeHTML(f.name)}">
        <span class="food-name">${escapeHTML(f.name)}</span>
        <span class="food-qty" title="En casa / mínimo para avisar">${qty} / ${min}</span>
        <span class="food-score urg-${level}" title="Importancia">${f.score}</span>
        <span class="food-actions">
          <button class="btn ghost small" data-inc="${f.id}" title="Sumar 1" data-step="1" aria-label="Sumar 1 a ${escapeHTML(f.name)}">➕</button>
          <button class="btn ghost small" data-inc="${f.id}" title="Restar 1" data-step="-1" aria-label="Restar 1 a ${escapeHTML(f.name)}">➖</button>
          <button class="btn ghost small" data-del="${f.id}" title="Eliminar" aria-label="Eliminar ${escapeHTML(f.name)}">🗑</button>
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
    // La DECISIÓN de qué entra la alerta y cómo se presenta (nivel/icono/título/orden/CAPA a 8) es lógica PURe extraída a
    // modules/priority.js → buildWeeklyAlert. Aquí sólo PINTAMOS el HTML resultante (§2-D DIp: separar decidir del render).
    const m = buildWeeklyAlert(foods);
    if (!m.show) { weeklyAlert.className = "card alert-card hidden"; weeklyAlert.innerHTML = ""; return; }

    // El color de la alerta lo marca la importancia del alimento MÁS URGENTE → ya resuelto por `m.level`/icon/título, pero el
    // per-fila todavía consulta urgencyLevel(f.score) para su propio badge, idéntico al código heredado.
    weeklyAlert.className = `card alert-card alert-${m.level}`;
    weeklyAlert.innerHTML = `
      <h3>${m.icon} ${m.title}</h3>
      <ul class="alert-list-${m.level}">
        ${m.items.map(f => `
          <li class="alert-row urg-${urgencyLevel(f.score)}">
            <span class="alert-name"><strong>${escapeHTML(f.name)}</strong></span>
            <span class="alert-meta">tienes <b>${f.qty ?? 0}</b> · mínimo <b>${f.min ?? 0}</b> · importancia <b>${f.score}/10</b></span>
          </li>`).join("")}
      </ul>`;
  }

  // ===== ESCÁNER DE DESPENSA (OCR EN EL NAVEGADOR) =====
  // #epic-ocr-despensa-camara: mirar el frigorífico/armario con la cámara y detectar lo que hay
  // sin teclearlo todo. La DECISIÓN vive en el módulo puro modules/ocr-despensa.js (esMovil /
  // extraerCandidatos / guardarCandidatos; spec tests/ocr-despensa.test.js); aquí sólo la INFRA de
  // vista: activar la cámara SÓLO en móvil, cargar Tesseract.js la primera vez que se usa y el molde
  // del modal de confirmación. El OCR corre ENTERO en el navegador: la foto nunca sale del terminal.
  const ocr = window.MRCheff.ocrDespensa;
  const ocrVocabulario = (window.MRCheff.classify && window.MRCheff.classify.FOOD_TYPES) || {};
  const ocrBtnCamara = $("#btn-ocr-camara");
  const ocrBtnFoto = $("#btn-ocr-foto");
  const ocrFile = $("#ocr-file");
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let tesseractPromesa = null;

  // Motor del OCR con carga PEREZOSA: cero coste mientras no se use la función (un <script> del CDN
  // inyectado al vuelo la primera vez); el propio navegador lo cachea después. Si falla (sin
  // conexión) la promesa se limpia para darle otra oportunidad en el siguiente intento.
  function cargarTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tesseractPromesa) {
      tesseractPromesa = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = TESSERACT_CDN;
        s.async = true;
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => {
          tesseractPromesa = null;
          reject(new Error("El motor del OCR no ha cargado: la primera vez necesita conexión a internet"));
        };
        document.head.appendChild(s);
      });
    }
    return tesseractPromesa;
  }

  // La cámara SÓLO se ofrece en vista móvil (ocr.esMovil decide contra el user agent): el input file
  // con el atributo `capture` abre la app de la cámara del sistema (Android/iOS), SIN permisos
  // getUserMedia y SIN exigir https. En escritorio, la vía es elegir una foto del frigorífico/armario
  // desde el disco — misma lectura, mismo modal de confirmación.
  const ocrEsMovil = ocr.esMovil(navigator.userAgent);
  if (ocrBtnCamara && ocrBtnFoto && ocrFile) {
    ocrBtnCamara.classList.toggle("hidden", !ocrEsMovil);
    ocrBtnFoto.classList.remove("hidden");        // la vía "elegir foto" se ofrece también en móvil (galería)
    ocrBtnCamara.addEventListener("click", () => {
      ocrFile.setAttribute("capture", "environment");
      ocrFile.click();
    });
    ocrBtnFoto.addEventListener("click", () => {
      ocrFile.removeAttribute("capture");
      ocrFile.click();
    });
    ocrFile.addEventListener("change", () => {
      const archivo = ocrFile.files && ocrFile.files[0];
      ocrFile.value = "";                         // limpiar ya: permite re-escanear la misma foto después
      if (!archivo) return;
      modalContent.innerHTML = `
        <h2>📷 Reconociendo alimentos…</h2>
        <p class="muted" id="ocr-progreso">Cargando el motor de OCR (la primera vez descarga unos megas; la foto no sale de tu navegador)…</p>
        <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button></div>`;
      abrirModal("Escáner de la despensa");
      $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
      const progreso = $("#ocr-progreso", modalContent);
      cargarTesseract().then(Tesseract => {
        if (!progreso.isConnected) return;        // el usuario ya ha cancelado mientras cargaba
        progreso.textContent = "Reconociendo texto…";
        return Tesseract.recognize(archivo, "spa", {
          logger: m => {
            if (m && m.status === "recognizing text" && progreso.isConnected) {
              progreso.textContent = `Reconociendo texto… ${Math.round((m.progress || 0) * 100)}%`;
            }
          }
        }).then(({ data }) => {
          if (!progreso.isConnected) return;
          const candidatos = ocr.extraerCandidatos(data && data.text, ocrVocabulario);
          if (!candidatos.length) {
            modalContent.innerHTML = `
              <h2>📷 No he detectado alimentos</h2>
              <p class="muted">Prueba con una foto más cercana y con buena luz, de frente a la estantería
                  (frigorífico, despensa, armario). Las etiquetas con letra pequeña engañan al OCR.</p>
              <div class="modal-footer"><button class="btn ghost" data-close>Cerrar</button></div>`;
            $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
            return;
          }
          abrirConfirmarOcr(candidatos);
        });
      }).catch(err => {
        if (!progreso.isConnected) return;        // cerrado por el usuario: nada que contar
        closeModal();
        toast((err && err.message) || "No se ha podido escanear la foto", "error");
      });
    });
  }

  // Modal de confirmación: cada candidato llega con nombre EDITABLE (el del OCR es sólo un punto de
  // partida) y pide cantidad, mínimo e importancia — los tres valores del formulario manual. La
  // fusión final con la despensa la hace el módulo puro (ocr.guardarCandidatos); aquí el molde.
  function abrirConfirmarOcr(candidatos) {
    const etqTipo = { proteina: "Proteína", lacteo: "Lácteo", cereal: "Cereal", fruta: "Fruta", verdura: "Verdura", especia: "Especia" };
    modalContent.innerHTML = `
      <h2>📷 ¿Esto es lo que hay?</h2>
      <p class="muted">Detectado automáticamente en la foto. <strong>El nombre es editable</strong>; ajusta
          cantidad (lo que hay en casa), mínimo para avisar e importancia, y desmarca lo que no quieras guardar.</p>
      <div class="ocr-cabecera" aria-hidden="true">
        <span>Alimento</span><span>Cantidad</span><span>Mínimo</span><span>Importancia</span><span>Incluir</span>
      </div>
      ${candidatos.map((c, i) => `
        <div class="ocr-item" data-i="${i}">
          <div class="ocr-nombre">
            <input type="text" id="ocr-nombre-${i}" value="${escapeHTML(c.nombre)}" aria-label="Nombre del alimento detectado (editable)">
            <span class="ocr-tipo">${etqTipo[c.tipo] || "Otro"}</span>
            <span class="ocr-linea" title="Primera línea que ha leído el OCR (sólo contexto)">“${escapeHTML(String(c.linea || "").trim().slice(0, 60))}”${c.veces > 1 ? ` · aparece ×${c.veces}` : ""}</span>
          </div>
          <input type="number" id="ocr-qty-${i}" min="0" step="1" value="1" aria-label="Cantidad en casa de ${escapeHTML(c.nombre)}">
          <input type="number" id="ocr-min-${i}" min="0" step="1" value="1" aria-label="Mínimo para avisar de ${escapeHTML(c.nombre)}">
          <input type="number" id="ocr-score-${i}" min="1" max="10" step="1" value="5" aria-label="Importancia de ${escapeHTML(c.nombre)}">
          <input type="checkbox" class="ocr-include" checked aria-label="Incluir ${escapeHTML(c.nombre)} en la despensa">
        </div>`).join("")}
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn primary" data-ocr-guardar>Guardar en la despensa</button>
      </div>`;
    abrirModal("Confirmar alimentos detectados en la foto");
    const primero = $("#ocr-nombre-0", modalContent);
    if (primero) primero.select();
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    $("[data-ocr-guardar]", modalContent).addEventListener("click", () => {
      // Validar las filas incluidas ANTES de tocar nada: una fila mala corta el guardado (mismo
      // espíritu que el modal de compra de la lista semanal).
      const seleccion = [];
      let mensajeError = "";
      $$(".ocr-item", modalContent).forEach(fila => {
        if (mensajeError || !$(".ocr-include", fila).checked) return;
        const i = fila.dataset.i;
        const nombre = $("#ocr-nombre-" + i, fila).value.trim();
        const qty = parseInt($("#ocr-qty-" + i, fila).value, 10);
        const min = parseInt($("#ocr-min-" + i, fila).value, 10);
        const score = parseInt($("#ocr-score-" + i, fila).value, 10);
        if (!nombre) { mensajeError = "Hay un alimento sin nombre: escríbele uno o desmarca su casilla."; return; }
        if (!Number.isFinite(qty) || qty < 0) { mensajeError = `La cantidad de "${nombre}" va de 0 en adelante.`; return; }
        if (!Number.isFinite(min) || min < 0) { mensajeError = `El mínimo de "${nombre}" va de 0 en adelante.`; return; }
        if (!Number.isFinite(score) || score < 1 || score > 10) { mensajeError = `La importancia de "${nombre}" va de 1 a 10.`; return; }
        seleccion.push({ nombre, qty, min, score });
      });
      if (mensajeError) { toast(mensajeError, "error"); return; }
      if (!seleccion.length) { toast("No hay alimentos marcados para guardar", "error"); return; }
      const result = ocr.guardarCandidatos(foods, seleccion, { uid, ahora: Date.now() });
      foods = result.foods;
      save(LS.foods, foods);
      renderFoods();
      renderWeeklyAlert();
      closeModal();
      toast(result.actualizados
        ? `Despensa al día: ${result.añadidos} añadidos y ${result.actualizados} actualizados`
        : `Despensa al día: ${result.añadidos} alimentos añadidos`);
    });
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
  const recipeCatalogSearch = $("#recipe-catalog-search");
  const recipeCatalogResults = $("#recipe-catalog-results");
  const recipeCatalogEmpty = $("#recipe-catalog-empty");
  const mealLabels = { desayuno: "🌅 Desayuno", comida: "🍽️ Comida", cena: "🌙 Cena" };

  // ===== BUSCADOR DEL CATÁLOGO (feature 2026-10-18, card entre crear receta y Mis Recetas) =====
  // TODA la decisión (normalizar consulta vía el matcher compartido, score por título x3 /
  // ingrediente x1, orden estable, límite) vive en el módulo puro modules/busqueda-recetas.js;
  // aquí sólo el molde de tarjetas (igual que las de Mis Recetas) y el click → modal de detalle.
  function renderBusquedaCatalogo() {
    const q = recipeCatalogSearch.value;
    const busqueda = (window.MRCheff.busquedaRecetas)
      ? window.MRCheff.busquedaRecetas.buscar(q, catalogoEspanol, { limite: 8 })
      : { tokens: [], resultados: [] };
    const hits = busqueda.resultados;
    recipeCatalogResults.innerHTML = "";
    recipeCatalogEmpty.classList.toggle("hidden", !(busqueda.tokens.length && hits.length === 0));
    hits.forEach(({ receta: r, hitsTitulo, hitsIngredientes }) => {
      const donde = hitsTitulo.length ? "en el título" : "en los ingredientes";
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        <h3>${escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
          ${badgeOrigenHTML(r)}
          <span class="muted" style="font-size:.8rem">${escapeHTML(donde)}</span>
        </div>`;
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

  // Registra "se cocinó hoy" para CUALQUIER vista que lo ofrezca (Sugerencias, tarjetas de Recetas y
  // modal de detalle): la lógica inmutable vive en menuSemanal.cookEntry (fabrica la entrada de
  // mrcheff.cooked con su keyFingerprint); aquí sólo persistencia + aviso. Devuelve { cooked } nuevo
  // por si la vista llamante quiere re-render fino (p.ej. Sugerencias re-sugiere con el cooldown aplicado).
  function registrarCocinado(rec) {
    const result = menuSemanal.cookEntry(rec, load(LS.cooked, []), today, planner.cookEntryFor, uid);
    save(LS.cooked, result.cooked);
    toast("Registrado: se cocinó hoy");
    return result;
  }

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
          <button data-edit="${r.id}" title="Editar título, ingredientes o pasos" aria-label="Editar receta">✏️</button>
          <button data-cook="${r.id}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳</button>
          <button data-del="${r.id}" title="Eliminar" aria-label="Eliminar receta">🗑</button>
        </div>
        <h3>${escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
          ${badgeOrigenHTML(r)}
          <span class="muted" style="font-size:.8rem">${r.ingredients.length} ingr.</span>
        </div>`;
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
        recipes = recipes.filter(x => x.id !== btn.dataset.del);
        save(LS.recipes, recipes);
        renderRecipes();
        toast("Receta eliminada");
      });
    });
    // Lápiz de la tarjeta: abre el editor directamente (sin pasar por el modal de detalle)
    recipeList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = recipes.find(x => x.id === btn.dataset.edit);
        if (receta) openRecipeEditor(receta);
      });
    });
    // 🍳 de la tarjeta (solo icono): registra "cocinado hoy" con la MISMA lógica que Sugerencias y Menú
    // (menuSemanal.cookEntry → mrcheff.cooked con fingerprint → cooldown de 7 días). No abre el modal.
    recipeList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = recipes.find(x => x.id === btn.dataset.cook);
        if (receta) registrarCocinado(receta);
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
  const modalBox = $(".modal-box", modal);

  // Accesibilidad del modal: al abrir se recuerda el control que lo llamó (para devolverle el
  // foco al cerrar) y se anuncia un nombre por aria-label; al cerrar el foco vuelve a su sitio.
  // Sólo glue de vista: la decisión de qué se muestra sigue viniendo de cada aceptor.
  let focoAntesDeModal = null;
  function abrirModal(tituloAccesible) {
    const activo = document.activeElement;
    focoAntesDeModal = (activo && typeof activo.focus === "function") ? activo : null;
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
  // Modal de detalle. Se extiende para el flujo Sugerencias/Menú (§ plan Feature §2): la 2ª arg opcional { highlightMissing:true }
  // hace que los ingredientes NO disponibles en aforo (stock qty=0 o ausente) se marquen visualmente con .meal-missing + "⚠️ No lo tienes".
  // SIN esa bandera el render del modal queda IDENTICO al de siempre: Recetas/Innovación no la pasan → no se rompe ninguna vista ya probada.
  function openRecipeModal(r, opts) {
    const resaltarFaltantes = !!(opts && opts.highlightMissing);           // guard estricto § plan §2 "no activa sin que la UI lo pida".
    let faltantesPorIndice = null;                                          // boolean[] paralelo a r.ingredients, sólo calculado SI la vista lo pide (sin bandera → nulo → idéntico).
    if (resaltarFaltantes && window.MRCheff.recipeMissing) {               // el match estricto vive en un PURe módulo testable (DIP §6), no se reinventa aquí (§ "un solo lugar calcula bien").
      const moduloFaltantes = window.MRCheff.recipeMissing;
      faltantesPorIndice = typeof moduloFaltantes.marcarFaltantes === "function" ? moduloFaltantes.marcarFaltantes(r, foods) : null; // fallback débil: si el módulo se perdiera NO romperíamos nada.
    }
    // ¿Editable? Si la receta ya vive en Mis Recetas → se edita IN-SITU; si no (plato del catálogo curado o del
    // menú generado), la edición guarda una COPIA editable en Mis Recetas sin tocar el original, que es de sólo lectura.
    const enMisRecetas = recipeEditor.estaGuardada(recipes, r);
    modalContent.innerHTML = `
      <h2>${escapeHTML(r.title)}</h2>
      <div class="recipe-meta">
        <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
        ${badgeOrigenHTML(r)}
        ${tagClasicoHTML(r, "Idea")}
      </div>
      ${r.from ? `<p class="muted">Base: ${escapeHTML(r.from)}</p>` : ""}
      ${r.uses && r.uses.length ? `<p class="muted">🥣 Usa de tu casa: ${r.uses.map(escapeHTML).join(", ")}</p>` : ""}
      <h4>🧾 Ingredientes</h4>
      <ul>${Array.isArray(r.ingredients) ? r.ingredients.map((i, idx) => {
        // Cada ingrediente se evalúa con su índice para NO reordenar ni dedup la lista original del plato (§ Liskov: form/shape idéntico al de hoy SIN flag).
        const ausente = Array.isArray(faltantesPorIndice) && faltantesPorIndice[idx] === true; // sólo marca si la vista lo pidió (§ guard estricto § plan §2 "sin bandera → sin clase, sin badge").
        return ausente
          ? `<li class="meal-missing">${escapeHTML(i)} <span class="missing-badge">⚠️ No lo tienes</span></li>`   // UI coherente con CSS .meal-missing/.missing-badge ya existente (§ plan Feature §2 modal).
          : `<li>${escapeHTML(i)}</li>`;   // IDÉNTICO al render actual SIN la bandera → Recetas/Innovación no se ROMPEN en sus vistas ya probadas (§ guard total de regresión, § "no romper vistas ya probadas").
      }).join("") : ""}</ul>
      <h4>👨‍🍳 Método</h4>
      <ol>${r.method.map(m => `<li>${escapeHTML(limpiarPaso(m))}</li>`).join("")}</ol>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn ghost" data-edit title="Ajusta el título, los ingredientes o los pasos a tu gusto">${enMisRecetas ? "✏️ Editar" : "✏️ Editar y guardar"}</button>
        <button class="btn ghost" data-cook title="Anota que la has cocinado hoy: entra en cooldown de 7 días y no se volverá a sugerir">🍳 Cocinar hoy</button>
        <button class="btn primary" data-copy>📋 Copiar</button>
      </div>`;
    abrirModal("Detalle de receta: " + r.title);
    const btnCerrarModal = $(".modal-close", modal);
    if (btnCerrarModal) btnCerrarModal.focus();
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    const btnEdit = $("[data-edit]", modalContent);
    if (btnEdit) btnEdit.addEventListener("click", () => openRecipeEditor(r));
    // "🍳 Cocinar hoy" del modal (icono + texto): MISMA lógica compartida que la tarjeta de Recetas y
    // que Sugerencias y Menú — una entrada nueva en mrcheff.cooked anclada a HOY (cooldown de 7 días).
    const btnCook = $("[data-cook]", modalContent);
    if (btnCook) btnCook.addEventListener("click", () => registrarCocinado(r));
    $("[data-copy]", modalContent).addEventListener("click", () => {
      const text = `${r.title}\n\nIngredientes:\n${r.ingredients.map(i => "- " + i).join("\n")}\n\nMétodo:\n${r.method.map(m => limpiarPaso(m)).join("\n")}`;
      navigator.clipboard?.writeText(text).then(
        () => toast("Copiado al portapapeles"),
        () => toast("No se pudo copiar", "error")
      );
    });
  }

  // Editor de receta: reutiliza el MISMO modal (#modal-content) para no añadir una capa nueva.
  // La lógica de decisión/dominio (borrador, validación, in-situ vs copia, parche del plan) vive en
  // el módulo puro modules/recipe-editor.js (§3 CODING_STANDARDS.md) — aquí sólo DOM y persistencia.
  function openRecipeEditor(r) {
    const enMisRecetas = recipeEditor.estaGuardada(recipes, r);
    modalContent.innerHTML = `
      <h2>${enMisRecetas ? "✏️ Editar receta" : "✏️ Editar y guardar en Mis Recetas"}</h2>
      <p class="muted">Toca lo que quieras: nombre, momento del día, ingredientes o pasos. Se guarda como está escrito, con una línea por ingrediente y una por paso.</p>
      <div class="recipe-edit">
        <label for="edit-title">Nombre del plato
          <input type="text" id="edit-title" value="${escapeHTML(r.title)}" maxlength="120">
        </label>
        <label for="edit-meal">Momento del día
          <select id="edit-meal">
            <option value="desayuno" ${r.meal === "desayuno" ? "selected" : ""}>${mealLabels.desayuno}</option>
            <option value="comida" ${r.meal === "comida" ? "selected" : ""}>${mealLabels.comida}</option>
            <option value="cena" ${r.meal === "cena" ? "selected" : ""}>${mealLabels.cena}</option>
          </select>
        </label>
        <label for="edit-ingredients">Ingredientes (uno por línea)
          <textarea id="edit-ingredients" rows="7">${escapeHTML((r.ingredients || []).join("\n"))}</textarea>
        </label>
        <label for="edit-method">Pasos (uno por paso)
          <textarea id="edit-method" rows="8">${escapeHTML((r.method || []).join("\n"))}</textarea>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn primary" data-save-edit>Guardar cambios</button>
      </div>`;
    abrirModal("Editar receta");
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    $("#edit-title", modalContent).focus();
    $("[data-save-edit]", modalContent).addEventListener("click", () => {
      const draft = recipeEditor.buildDraft(
        $("#edit-title", modalContent).value,
        $("#edit-meal", modalContent).value,
        $("#edit-ingredients", modalContent).value,
        // Cada paso se guarda YA normalizado: sin numeración incrustada ni puntuación suelta,
        // para que el dato de Mis Recetas nazca limpio (limpiarPaso es puro e idempotente).
        $("#edit-method", modalContent).value.split("\n").map(limpiarPaso).join("\n")
      );
      const check = recipeEditor.validateDraft(draft);
      if (!check.ok) {
        toast("Completa nombre, ingredientes y pasos", "error");
        return;
      }
      const resultado = recipeEditor.applyEdit(recipes, r, draft, { uid, now: () => Date.now(), origen: origenAlGuardar(r).origen });
      recipes = resultado.recipes;
      save(LS.recipes, recipes);
      if (recipeEditor.patchPlan(weeklyMenu && weeklyMenu.plan, resultado.guardada, resultado.modo === "in-situ" ? null : r.id)) {
        save(LS.weekmenu, weeklyMenu);
        renderWeeklyMenu(weeklyMenu.plan);
      }
      renderRecipes();
      toast(resultado.modo === "in-situ" ? "Receta actualizada" : "Receta guardada en Mis Recetas");
      closeModal();
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    if (focoAntesDeModal) { focoAntesDeModal.focus(); focoAntesDeModal = null; }
  }
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
    return texto ? `<span class="tag tag-${String(rec.source)}">${texto.toString()}</span>` : "";
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

  btnGenerateInnov.addEventListener("click", () => {
    if (foods.length === 0 && recipes.length === 0) {
      toast("Añade alimentos o guarda una receta para inventar", "error");
      return;
    }
    const count = parseInt(innovCount.value, 10) || 8;
    // Generación de ideas (variaciones + combinaciones arquetípicas, y platos "libres"/"protagonistas"): ahora lógica PURA
    // extraída a modules/innovations.js. Aquí sólo consumimos su lote (`batch`) y orquestamos la conciliación con lo ya guardado
    // más persistencia. Ver CODING_STANDARDS.md §3 option A / DIP, al igual que priority/classify/recipe-analysis.
    const batch = window.MRCheff.innovations.generate(count, innovFocus.value, {
      foods, recipes,
      // Recentes = títulos de la pila actual de sugerencias: el generador los aparta de su pool para que cada
      // click de "Sugerir ahora" traiga platos NUEVOS (misma lógica de scoring y exclusiones de siempre §8).
      recientes: innovations.map(i => i.title)
    });
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
    innovations.forEach(i => { const k = claveDeGrupoFuente(i); bySrc[k] = (bySrc[k] || 0) + 1; });
    const parts = Object.entries(bySrc).map(([s, n]) =>
      String(s).startsWith("Receta ") ? `${n} ${s}` : `${n} ${SOURCE_LABEL[s] || "nuevas"}`).join(" · ");
    innovSummary.textContent = `${innovations.length} idea(s) en la lista (${parts}). Guarda las que te gusten con ⭐.`;
  }

  // Resumen del generador: agrupa por FUENTE, pero para las curadas agrupa por ORIGEN visible
  // ("x Receta española · y Receta italiana") — la etiqueta es la MISMA que pintan las tarjetas.
  function claveDeGrupoFuente(i) {
    return i.source === "curada" ? etiquetaOrigenSegura(i) : i.source;
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
          <button data-edit="${i.id}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-save="${i.id}" title="Guardar en Mis Recetas" aria-label="Guardar en Mis Recetas">⭐</button>
          <button data-del="${i.id}" title="Eliminar" aria-label="Eliminar idea">🗑</button>
        </div>
        <h3>${escapeHTML(i.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${i.meal}">${mealLabels[i.meal]}</span>
          ${badgeOrigenHTML(i)}
          ${i.source === "curada" ? "" : `<span class="tag tag-${i.source}">${SOURCE_LABEL[i.source] || "Nueva"}</span>`}
        </div>
        ${i.uses && i.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${i.uses.map(escapeHTML).join(" · ")}</div>` : ""}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-save], [data-edit]")) return;
        openRecipeModal(i);
      });
      activablePorTeclado(card, () => openRecipeModal(i));
      innovationList.appendChild(card);
    });

    // Lápiz de la idea: abre el editor en modo "copia" (la idea no está aún en Mis Recetas)
    innovationList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = innovations.find(x => x.id === btn.dataset.edit);
        if (idea) openRecipeEditor(idea);
      });
    });

    innovationList.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = innovations.find(x => x.id === btn.dataset.save);
        if (!idea) return;
        recipes.push({ id: uid(), title: idea.title, meal: idea.meal, ingredients: idea.ingredients.slice(), method: idea.method.slice(), createdAt: Date.now(), ...(origenAlGuardar(idea)) });
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

  // ===== SUGERENCIAS Y MENÚ — CARD 1: "Sugerencia de hoy" =====
  // Recetas del catálogo curado que SÍ se pueden cocinar ahora (todos sus ingredientes con qty>0 en aforo),
  // ordenadas por aprovechamiento de casa. "🍳 Cocinar hoy" anota en mrcheff.cooked (sin tocar recipes[] / Mis Recetas).
  const btnSuggestGenerate = $("#btn-suggest-generate");
  const btnSuggestClear = $("#btn-suggest-clear");
  const suggestList = $("#suggest-list");
  const suggestEmpty = $("#suggest-empty");
  const catalogoEspanol = window.MRCheff.recetasEspanolas || [];
  const planner = window.MRCheff.planner;
  const menuSemanal = window.MRCheff.menuSemanal;

  function renderSuggestCards(ideas) {
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
          <button data-edit="${idea.id}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-cook="${idea.id}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳 Cocinar hoy</button>
        </div>
        <h3>${escapeHTML(idea.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${idea.meal}">${mealLabels[idea.meal] || ""}</span>
          ${badgeOrigenHTML(idea)}
        ${tagClasicoHTML(idea, SOURCE_LABEL.sugerenciaHoy)}
        </div>
        ${idea.uses && idea.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${idea.uses.map(escapeHTML).join(" · ")}</div>` : ""}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-cook], [data-edit]")) return;
        openRecipeModal(idea, { highlightMissing: true });
      });
      activablePorTeclado(card, () => openRecipeModal(idea, { highlightMissing: true }));
      suggestList.appendChild(card);
    });

    // Lápiz de la sugerencia: abre el editor en modo "copia" (guarda en Mis Recetas sin tocar el catálogo)
    suggestList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.edit);
        if (idea) openRecipeEditor(idea);
      });
    });

    suggestList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.cook);
        if (!idea) return;
        // Misma vía compartida que Recetas/modal (helper registrarCocinado); aquí además re-sugerimos:
        // el plato recién cocinado entra en cooldown de 7 días y deja de aparecer.
        const { cooked } = registrarCocinado(idea);
        const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
        renderSuggestCards(planner.suggestToday(pool, foods));
      });
    });
  }

  // Rotación de "↻ Sugerir ahora" (Card 1): la COMPOSICIÓN del lote (máx 4, con 1 desayuno + 1 comida
  // + 1 cena + una 4ª que rota de tipo) vive como función PURA `planner.loteRotado` (7ª API pública,
  // §8 log + unit tests en tests/planner.test.js) sobre el ranking completo de suggestToday — toda la
  // lógica de siempre (aforo qty>0, cooldown de cooked, ranking) intacta. Aquí sólo la MEMORIA de la
  // vista: los cursores de rotación (se reinician al recargar la página o al pulsar "Limpiar").
  let cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };
  let clicksSugerencia = 0;

  btnSuggestGenerate.addEventListener("click", () => {
    const cooked = load(LS.cooked, []);
    const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
    const todas = planner.suggestToday(pool, foods);   // ranking completo de SIEMPRE (contrato cerrado del módulo)
    const out = planner.loteRotado(todas, { cursores: cursoresSugerencia, clicks: clicksSugerencia });
    cursoresSugerencia = out.cursores;                 // el módulo es puro: devuelve cursores NUEVOS
    clicksSugerencia += 1;
    renderSuggestCards(out.lote);
  });

  btnSuggestClear.addEventListener("click", () => {
    suggestList.innerHTML = "";
    cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };   // la rotación también empieza de cero
    clicksSugerencia = 0;
    suggestEmpty.classList.remove("hidden");
    toast("Sugerencia limpiada");
  });

  // ===== SUGERENCIAS Y MENÚ — CARD 2: menú semanal (7 días) + CARD 3: lista de la compra =====
  // Previsualiza un plan de 7 días (Lunes..Domingo) respetando el cooldown. "Aprobar plan" guarda
  // mrcheff.weekmenu (aprobado=true, ancla de fecha=HOY real) y registra en mrcheff.cooked cada
  // receta del plan ANCLADA a la fecha de su día de la semana (próxima ocurrencia desde HOY).
  // Card 3 aparece sólo si el plan aprobado trae ingredientes ausentes (needyFoods); marcar un ítem como
  // comprado PREGUNTA primero cuánto se ha comprado y su importancia (modal, feature 2026-10-18) y NO lo
  // cuela con qty 0/score 5: el módulo puro menuSemanal.markItemBought añade o actualiza con esos datos.
  // No toca recipes[] / Mis Recetas.
  const btnMenuGenerate = $("#btn-menu-generate");
  const btnMenuApprove = $("#btn-menu-approve");
  const btnMenuClear = $("#btn-menu-clear");
  const menuInclude = $("#menu-include-unavailable");
  const menuStatus = $("#menu-status");
  const menuPlanList = $("#menu-plan-list");
  const menuEmpty = $("#menu-empty");
  const shoppingListEl = $("#shopping-list");

  // Estado del menú semanal cargado de localStorage (persistencia entre pestañas / recargas).
  let weeklyMenu = load(LS.weekmenu, null);

  // Render del preview / plan aprobado: 7 días × 3 comidas (desayuno, comida, cena — feature 2026-10-18).
  // Cada comida se pinta como fila con su etiqueta, botones "🍳 Cocinar" (anota cocinado + renueva SOLO
  // ese hueco) y "🔄 Cambiar" (otra receta para ese día+comida, sin tocar el resto). La fila es clickeable
  // para abrir el detalle. Siempre se pintan los 7 días con sus 3 comidas, aunque alguna quede vacía.
  // NOTA: la etiqueta (mealLabels) YA incluye su icono (🌅/🍽️/🌙) — no se añade otro delante
  // (era el duplicado "🌅 🌅 Desayuno" que se veía en la franja del menú).

  function pintarSlotComida(comida, dayIdx, mealIdx) {
    const meal = comida && comida.meal ? comida.meal : "";
    const etiqueta = (mealLabels[meal] || meal || "");
    const rec = comida && comida.recipe;
    if (!rec) {
      return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${escapeHTML(meal)}" data-meal-idx="${mealIdx}">
        <span class="menu-meal-tag">${escapeHTML(etiqueta)}</span>
        <div class="menu-meal-body muted">sin plato asignado</div>
      </div>`;
    }
    const missing = Array.isArray(comida.missing) ? comida.missing : [];
    // Decisión de visibilidad SIEMPRE del módulo puro (regla de negocio, no de vista).
    const acciones = menuSemanal.accionesMenuSlot(weeklyMenu);
    return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${escapeHTML(meal)}" data-meal-idx="${mealIdx}">
      <span class="menu-meal-tag">${escapeHTML(etiqueta)}</span>
      <div class="menu-meal-body">
        <h4 class="menu-meal-title">${escapeHTML(rec.title)}</h4>
        <div class="recipe-meta">
          ${badgeOrigenHTML(rec)}
          ${tagClasicoHTML(rec, SOURCE_LABEL.sugerenciaHoy)}
          <span class="muted" style="font-size:.8rem">${rec.ingredients.length} ingr.</span>
        </div>
        ${rec.uses && rec.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${rec.uses.map(escapeHTML).join(" · ")}</div>` : ""}
        ${missing.length ? `<div class="innov-uses" style="color:var(--danger);">⚠️ Falta: ${missing.map(escapeHTML).join(", ")}</div>` : `<div class="innov-uses" style="color:var(--accent);">✅ Todos los ingredientes en casa</div>`}
      </div>
      <div class="recipe-actions">
        <button data-edit title="Editar esta receta a tu gusto (guarda en Mis Recetas)">✏️</button>
        ${acciones.cocinar ? `<button data-cook title="Cocinar hoy y renovar este hueco">🍳 Cocinar</button>` : ""}
        ${acciones.cambiar ? `<button data-swap title="Otra receta para este día y comida">🔄 Cambiar</button>` : ""}
      </div>
    </div>`;
  }

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
        <div class="menu-day-header">${escapeHTML(dayLabel)}</div>
        ${comidas.length
          ? comidas.map((c, i) => pintarSlotComida(c, dayIdx, i)).join("")
          : `<div class="menu-meal-row"><div class="menu-meal-body muted">sin plato asignado</div></div>`}`;
      li.querySelectorAll(".menu-meal-row[data-meal-idx]").forEach(row => {
        const comida = comidas[Number(row.dataset.mealIdx)];
        if (!comida || !comida.recipe) return;
        row.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          openRecipeModal(comida.recipe, { highlightMissing: true });
        });
        activablePorTeclado(row, () => openRecipeModal(comida.recipe, { highlightMissing: true }));
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
          openRecipeEditor(comida.recipe);
        });
      });
      menuPlanList.appendChild(li);
    });
  }

  // "🍳 Cocinar" DESDE el menú: anota la receta como cocinada HOY (cooldown) y renueva SÓLO ese
  // hueco vía swapSlotRecipe (el resto del plan aprobado queda intacto — decisión §8/feature).
  // Toda la decisión vive en menuSemanal; aquí sólo persistencia + render (Capa vista).
  function cocinarComidaDelPlan(dayIdx, meal, rec) {
    const cookedPrevio = load(LS.cooked, []);
    const cocina = menuSemanal.cookEntry(rec, cookedPrevio, today, planner.cookEntryFor, uid);
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: weeklyMenu, dayIndex: dayIdx, meal,
      foods, recipes, catalog: catalogoEspanol,
      cooked: cocina.cooked, today, planner, uid
    });
    save(LS.cooked, cocina.cooked);
    weeklyMenu = cambio.weekmenu;
    save(LS.weekmenu, weeklyMenu);
    renderWeeklyMenu(weeklyMenu.plan);
    if (weeklyMenu.approved) renderShoppingList();
    toast(`Registrado: "${rec.title}" se cocinó — nuevo plato para ese hueco`);
  }

  // "🔄 Cambiar": otra receta para UN día+comida (determinista, recorre el ranking). Si el pool
  // de esa comida ya está agotado, avisa SIN tocar el plan.
  function cambiarComidaDelPlan(dayIdx, meal) {
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: weeklyMenu, dayIndex: dayIdx, meal,
      foods, recipes, catalog: catalogoEspanol,
      cooked: load(LS.cooked, []), today, planner, uid
    });
    if (!cambio.swapped) {
      toast(`No quedan más recetas de ${mealLabels[meal] || meal} — prueba a limpiar y regenerar el menú`, "error");
      return;
    }
    weeklyMenu = cambio.weekmenu;
    save(LS.weekmenu, weeklyMenu);
    renderWeeklyMenu(weeklyMenu.plan);
    if (weeklyMenu.approved) renderShoppingList();
  }

  // Render de Card 3 (lista de la compra derivada). Sólo se pinta si hay plan aprobado con ítems pendientes.
  // Con plan disponible, cada fila recibe su URGENCIA de compra (semaforo dinámico según lo cerca que está
  // la fecha de preparación: mañana/hoy=rojo, 2-3 días=naranja, ≥4=verde) y se ordena rojo→verde.
  function formatoFechaCorta(iso) {
    try {
      return new Date(String(iso) + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
    } catch { return String(iso); }
  }

  function renderShoppingList() {
    shoppingListEl.innerHTML = "";
    const needy = weeklyMenu && weeklyMenu.approved ? weeklyMenu.needyFoods : [];
    const ctx = weeklyMenu && Array.isArray(weeklyMenu.plan)
      ? { plan: weeklyMenu.plan, generatedOn: weeklyMenu.generatedOn || String(today), today }
      : null;
    const list = menuSemanal.shoppingListFor(needy, foods, ctx);
    if (!list.length) {
      shoppingListEl.classList.add("hidden");
      return;
    }
    shoppingListEl.classList.remove("hidden");
    shoppingListEl.innerHTML = `
      <h3>🛒 Lista de la compra</h3>
      <ul class="alert-list-green">
        ${list.map(item => {
          const urg = item.urgency || "green";
          const cuando = item.onDay != null && item.daysUntil != null
            ? `· se usa el ${formatoFechaCorta(item.onDay)} (${item.daysUntil === 0 ? "hoy" : item.daysUntil === 1 ? "mañana" : `en ${item.daysUntil} días`})`
            : "";
          return `
          <li class="alert-row urg-${urg}">
            <span class="alert-name"><strong>${escapeHTML(item.name)}</strong></span>
            <span class="alert-meta">qty <b>${item.qty}</b> · mínimo <b>${item.min}</b> · importante <b>${item.score}/10</b> ${escapeHTML(cuando)}</span>
            <button class="btn ghost small" data-buy="${escapeHTML(item.name)}" title="Marcar como comprada">✅ comprado</button>
          </li>`;
        }).join("")}
      </ul>`;
    shoppingListEl.querySelectorAll("[data-buy]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // 2026-10-18: NO se cuela ya el alimento con qty 0 / score 5 — se PREGUNTA cuánto se ha
        // comprado y con qué importancia (modal). La decisión de añadir/actualizar vive en el
        // módulo puro menuSemanal.markItemBought(..., compra); aquí sólo el molde del diálogo.
        const name = btn.dataset.buy;
        modalContent.innerHTML = `
        <h2>✅ ¿Comprado?</h2>
        <p class="muted">"<strong>${escapeHTML(name)}</strong>" se añadirá a la despensa con estos datos:</p>
        <div class="recipe-edit">
          <label for="compra-qty">Cantidad comprada
            <input type="number" id="compra-qty" min="1" step="1" value="1">
          </label>
          <label for="compra-min">Cantidad mínima para la alerta de reponer
            <input type="number" id="compra-min" min="0" step="1" value="1" title="Cuando baje de aquí te avisamos">
          </label>
          <label for="compra-score">Importancia (1–10)
            <input type="number" id="compra-score" min="1" max="10" step="1" value="5">
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar</button>
          <button class="btn primary" data-buy-confirm>Añadir a la despensa</button>
        </div>`;
        abrirModal("Compra: " + name);
        $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
        $("#compra-qty", modalContent).focus();
        $("#compra-qty", modalContent).select();
        $("[data-buy-confirm]", modalContent).addEventListener("click", () => {
          const qty = parseInt($("#compra-qty", modalContent).value, 10);
          const score = parseInt($("#compra-score", modalContent).value, 10);
          const minRaw = $("#compra-min", modalContent).value.trim();
          const min = minRaw === "" ? null : parseInt(minRaw, 10);   // vacío → no se pide: el módulo lo ignora
          if (!Number.isFinite(qty) || qty < 1) {            // la cantidad comprada no puede ser 0/vacía
            toast("Indica la cantidad comprada (1 o más)", "error");
            return;
          }
          if (min !== null && (!Number.isFinite(min) || min < 0)) {
            toast("El mínimo para la alerta va de 0 en adelante", "error");
            return;
          }
          if (!Number.isFinite(score) || score < 1 || score > 10) {
            toast("La importancia va de 1 a 10", "error");
            return;
          }
          const compra = { qty, score, ...(min !== null ? { min } : {}) };
          const result = menuSemanal.markItemBought(foods, weeklyMenu, name, uid, Date.now(), compra);
          if (result.actualizado) {
            toast(`"${escapeHTML(name)}" actualizado en la despensa (qty ${qty})`);
          } else if (!result.alreadyExists) {
            toast(`"${escapeHTML(name)}" añadido a la despensa (qty ${qty})`);
          } else {
            toast(`"${escapeHTML(name)}" ya está en tu despensa`, "error");
            closeModal();
            return;
          }
          foods = result.foods;
          weeklyMenu = result.weekmenu;
          save(LS.foods, foods);
          save(LS.weekmenu, weeklyMenu);
          renderFoods();
          renderWeeklyAlert();
          renderShoppingList();
          closeModal();
        });
      });
    });
  }

  btnMenuGenerate.addEventListener("click", () => {
    const cooked = load(LS.cooked, []);
    const includeUnavailable = menuInclude.checked;
    const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
    const menu = planner.buildWeeklyMenu(pool, foods, { includeUnavailable, today });
    const totalSlots = menu.plan.reduce((n, d) => n + ((Array.isArray(d.meals) ? d.meals : []).filter(m => m.recipe).length), 0);
    menuStatus.textContent = includeUnavailable
      ? (totalSlots < 21
        ? `Se asignaron ${totalSlots} de 21 platos (7 días × desayuno/comida/cena): tu despensa + recetas guardadas no dan para más. Activa "Sugerencias" o añade más alimentos para ampliarlo.`
        : `Se asignaron los 21 platos. Lo que falte está anotado en la lista de la compra.`)
      : `Se asignaron ${totalSlots} de 21 platos (modo estricto: sólo platos con TODO disponible hoy). Marca la casilla de arriba para completar la semana.`;
    menuStatus.classList.remove("hidden");
    // El preview se asienta ANTES de renderizar: pintarSlotComida consulta menuSemanal.accionesMenuSlot(weeklyMenu)
    // para la visibilidad de los botones de fila (preview → sin "🍳 Cocinar", con "🔄 Cambiar").
    weeklyMenu = { ...menu, approved: false, includeUnavailable, generatedOn: today };
    renderWeeklyMenu(menu.plan);
    menuEmpty.classList.add("hidden");
    btnMenuApprove.disabled = totalSlots === 0;
    btnMenuApprove.title = totalSlots === 0 ? "Genera primero un menú con al menos un plato" : "Aprueba este plan";
  });

  btnMenuApprove.addEventListener("click", () => {
    if (!weeklyMenu || weeklyMenu.approved) return;
    const cookedIn = load(LS.cooked, []);
    // Toda la decisión vive en menuSemanal.approveMenu: una entrada en mrcheff.cooked por cada
    // receta del plan, ANCLADA a la fecha de calendario de su día de la semana (no todas a HOY).
    const result = menuSemanal.approveMenu(weeklyMenu, cookedIn, today, planner.cookEntryFor, uid);
    const cooked = result.cooked;
    weeklyMenu = result.weekmenu;
    save(LS.cooked, cooked);
    save(LS.weekmenu, weeklyMenu);
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuStatus.textContent = `Plan aprobado: ${weeklyMenu.plan.reduce((n, d) => n + ((Array.isArray(d.meals) ? d.meals : []).filter(m => m.recipe).length), 0)} plato(s) anotados en su día de la semana (aprobado el ${today}).`;
    // Re-render de las filas: ahora SÍ llevan "🍳 Cocinar" (decisión de menuSemanal.accionesMenuSlot,
    // que ve approved=true) — el preview se pintó sin él y las filas no se refrescan solas.
    renderWeeklyMenu(weeklyMenu.plan);
    renderShoppingList();
    toast("Menú semanal aprobado");
  });

  // Persistencia al recargar: si ya había un plan APROBADO en mrcheff.weekmenu, re-pintamos el menú
  // de 7 días y Card 3 (con sus ítems pendientes) y dejamos el botón Aprobar en estado final.
  // Los previews NO aprobados NO se persisten (contrato §3 Card 2): tras recargar se regeneran con
  // "Generar menú".
  if (weeklyMenu && weeklyMenu.approved) {
    if (Array.isArray(weeklyMenu.plan) && weeklyMenu.plan.length) {
      renderWeeklyMenu(weeklyMenu.plan);
    }
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuEmpty.classList.add("hidden");
    renderShoppingList();   // sólo pinta si hay needyFoods no comprados (el render filtra por sí, guard §2-A)
  }

  btnMenuClear.addEventListener("click", () => {
    // El estado limpio lo decide menuSemanal.clearMenu(); aquí sólo persistencia (vía helpers,
    // NUNCA localStorage crudo) + render. save(key,null)+load(key,def) round-tripea a null.
    weeklyMenu = menuSemanal.clearMenu().weekmenu;
    save(LS.weekmenu, weeklyMenu);
    menuPlanList.innerHTML = "";
    menuPlanList.classList.add("hidden");
    menuEmpty.classList.remove("hidden");
    menuStatus.classList.add("hidden");
    btnMenuApprove.disabled = true;
    btnMenuApprove.title = "Genera primero un menú con al menos un plato";
    btnMenuApprove.textContent = "Aprobar plan";
    shoppingListEl.innerHTML = "";
    shoppingListEl.classList.add("hidden");
    toast("Menú limpiado");
  });

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
  // === LÓGICA DECISIONAL DE COPIA DE SEGURIDAD EXTRAÍDA A modules/backup.js (función PURe) ===
  // buildBackApi = window.MRCheff.backup: construye el payload exportable, nombra "dataBackup-YYYY-MM-DD-HH-MM-SS.json" y fusiona un
  // backup importado sin destruir lo ya guardado — lógica PURA con inyección opcional de uid/hoy para tests (§5 / §2-D). En la app
  // sólo orquestamos: guardar (save) + re-renderizar + toast. Los dos "aliases" locales dejan intocados los call-sites existentes
  // ("buildBackup()" / "backupFilename()") delegando en el módulo — sin tocar ni una línea de esos handlers.
  const buildBackApi = window.MRCheff.backup;
  const buildBackup  = () => buildBackApi.buildBackup({ foods, recipes, innovations, innovDay });
  const backupFilename = () => buildBackApi.makeFilename();   // hora REAL por defecto inyectable por el módulo (tests §6)

  const btnExport = $("#btn-export");
  const btnImport = $("#btn-import");
  const importFile = $("#import-file");
  const importNote = $("#import-note");

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
    abrirModal("Copia manual de seguridad");
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
      try { commitImport(JSON.parse(String(reader.result))); }
      catch { toast("No se pudo leer el archivo", "error"); }
    };
    reader.onerror = () => toast("No se pudo leer el archivo", "error");
    reader.readAsText(file);
    e.target.value = ""; // permite volver a importar el mismo archivo
  });

  // Wrapper de CAPA VISTA sobre la fusión PURA del módulo: sólo decide CUÁNDO/CÓMO persistir/re-renderizar + toast; TODA la lógica
  // decisoria (dedup por nombre, normalización MEAL_SET/recorte a 30, uids frescos) vive en modules/backup.js. Ver CODING_STANDARDS.md §5 / DIp:
  function commitImport(data) {
    const plan = buildBackApi.mergeIncoming({ foods, recipes, innovations }, data, { today });
    if (!plan) { toast("Archivo no válido", "error"); return; }   // el módulo devuelve null si la entrada NO es un objeto
    foods = plan.foods;        // las referencias LOCALES se reasignan: son exactamente lo que luego pintan los renders de abajo.
    recipes = plan.recipes;
    innovations = plan.innovations;

    save(LS.foods, foods);
    save(LS.recipes, recipes);
    if (plan.persistInnov) {   // solo si la entrada trajo innovaciones nuevas: marca "hoy" para que el auto-expiry del cierre DOMContentLoaded no las borre en la próxima carga (§5 "Alcance de expiración automática")
      innovDay = today;
      save(LS.innov, innovations);
      save(LS.innovDate, innovDay);
    }

    renderFoods();
    renderWeeklyAlert();
    renderRecipes();
    renderInnovations();
    importNote.textContent = `Se añadieron ${plan.addedFoods} alimento(s) y ${plan.addedRecipes} receta(s).`;
    importNote.classList.remove("hidden");
    toast(`Importados: ${plan.addedFoods} alimento(s), ${plan.addedRecipes} receta(s)`);
  }

  // ===== INICIALIZACIÓN =====
  renderFoods();
  renderWeeklyAlert();
  renderRecipes();
  renderInnovations();
  renderSeason();
});
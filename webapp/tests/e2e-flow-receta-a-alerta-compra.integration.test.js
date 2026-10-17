// tests/e2e-flow-receta-a-alerta-campra.integration.test.js — TEST DE INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// ---------------------------------------------------------------------------
// Este NO es un test unitario aislado: arranca la app REAL vía ./boot.js (index.html + data/data.js + TODOS los
// módulos en el orden exacto del navegador + DOMContentLoaded) y recorre UN flujo de usuario end-to-end que atraviesa
// CATORCE de las interacciones más importantes de varias pestañas encadenadas entre sí:
//     Innovación  →  estrella (guardar en Mis Recetas)  →  Recetas (visible por defecto, sin filtro)
//                →  abrir la receta en el modal  →  copiar un ingrediente que NO está "en casa"
//              →  cerrar el modal  →  Alimentos: añadir ese mismo ingrediente con prioridad 6 / "en casa" 0 / avisar 0
//             →  comprobar que aparece en "Alertas de reposición semanal" (alerta para comprar).
// Es deliberadamente COMPLEJO y encadenado porque su valor es precisamente verificar que el estado se PROPAGA entre
// pestañas de forma coherente y real cuando una acción en un sitio afecta a lo que otro sitio pinta después. Contrasta
// con las specs Capa 1 (cada una requiere ../modules/<n> aislado): aquí NO requerimos módulos sueltos, exigimos el DOM.

const { bootApp } = require("./boot"); // helper de arranque ya existente en la misma carpeta webapp/tests/

describe("E2E — flujo Innovación → favorito → Recetas → copiar ingrediente ausente → Alimentos (alerta de compra)", () => {
  let handle;               // { window, document, localStorage, jsdomErrors, foods, recipes, innov } devuelto por bootApp()
  let doc;                  // atajo a handle.document en cada test

  // ------------------------------------------------------------------ helpers locales de conducción -------------------
  // Los helpers SÓLO tocan el DOM/los eventos: no asumen nada del interior del closure de app.js ni reinyectan estado.

  function normForCompare(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-Ϳ]/g, "").trim();
  }
  function trimSafe(s) {
    return String(s == null ? "" : s).trim();
  }

  // Navega a una vista disparando un click REAL sobre su botón-tab (así se ejercitan los listeners "click" reales de
  // app.js que conmutan activo/inactivo y repintan sólo si toca — no forzamos nada por fuera del flujo real).
  function openView(viewKey) {
    const tab = doc.querySelector(`[data-view="${viewKey}"]`);
    expect(tab).toBeTruthy();   // [data-view="..."] debe existir en el nav.
    tab.click();                // jsdom .click() dispara los event-listener "click" registrados de forma síncrona.
    return tab;
  }

  // Rellena un campo del form de Alimentos y, para máxima fidelidad, también dispara el evento 'input' (igual que haría
  // el usuario real al tocarlo). No es estrictamente necesario para la lógica de submit (que lee .value directo) pero
  // mantiene coherente el par visual label<->control que app.js sincroniza por ese mismo canal.
  function setField(id, value) {
    const el = doc.getElementById(id);
    expect(el).toBeTruthy();    // campo #${id} debe existir.
    el.value = String(value);
    if (el.type === "range" || el.type === "number") {
      el.dispatchEvent(new handle.window.Event("input", { bubbles: true }));
    }
  }

  // Submite el form de Alimentos ejercitando la VALIDACIÓN real del navegador si existe, con fallback a disparar el
  // evento 'submit' manualmente si jsdom no expone requestSubmit() (ambas vías garantizan que se corra el listener de submit).
  function addFoodThroughForm({ name, qty = "0", min = "1", score }) {
    const form = doc.getElementById("food-form");
    expect(form).toBeTruthy();          // #food-form debe existir.
    setField("food-name", name);
    if (qty !== undefined)  setField("food-qty", qty);
    if (min !== undefined)  setField("food-min", min);
    if (score !== undefined) setField("food-score", score);

    // Preferimos requestSubmit() si el entorno lo expone: validación HTML real + dispatch 'submit' del browser.
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      const evt = new handle.window.Event("submit", { bubbles: true, cancelable: true });
      form.dispatchEvent(evt);          // fallback para jsdom antiguo sin requestSubmit implementada.
    }
  }

  // Cierre del modal por su botón "Cerrar" (data-close), ejercitando el listener real de app.js (no forzado por fuera).
  function closeModal() {
    const closeBtn = doc.querySelector("#modal [data-close]");
    expect(closeBtn).toBeTruthy();       // botón data-close dentro del modal debe existir.
    closeBtn.click();                   // escucha .click → app.js oculta de vuelta el modal (renderWeeklyAlert no afectada aquí).
  }

  // Elige un ingrediente de una receta guardada que NO esté ya en casa: escaneamos la lista real de ingredientes de esa
  // receta (leída del estado persistido a través del getter handle.recipes) y elegimos el primero cuyo nombre, comparado
  // sin distinguir mayúsculas/minúsculas ni acentos (espíritu tolerante idéntico al matching interno de Innovación), NO
  // coincide con ninguno de los alimentos ya presentes. Es la base para el "copia un ingrediente que no exista en casa".
  function pickIngredientNotInPantry(recipe) {
    const haveNorms = new Set(handle.foods.map(f => normForCompare(f && f.name)).filter(Boolean));
    for (const raw of Array.isArray(recipe.ingredients) ? recipe.ingredients : []) {
      if (!raw || !String(raw).trim()) continue;
      if (!haveNorms.has(normForCompare(raw))) return String(raw); // primer candidato ausente → "copiado" por el usuario de casa.
    }
    throw new Error(`No se encontró ningún ingrediente del plato "${recipe.title}" que no existiera ya en el aforo actual`);
  }

  // Busca una fila concreta dentro de la alerta semanal por su nombre (cross-check estructural fuerte DOM-vs-intención).
  function findAlertRow(name) {
    const rows = Array.from(doc.querySelectorAll("#weekly-alert .alert-row"));
    return rows.find(row => {
      const strong = row.querySelector(".alert-name"); // <strong>TuAlimento</strong> por fila (ver app.js renderWeeklyAlert).
      return !!strong && normForCompare(strong.textContent || "").includes(normForCompare(name));
    });
  }

  beforeEach(() => {
    // Arranque limpio por cada test: un JSDOM nuevo implica localStorage vacío de serie → estado inicial coherente/aislado
    // (precisamente el "estado global" que resetea la capa Capa-2 para evitar contaminar entre tests según §6 del standard).
    handle = bootApp();
    doc = handle.document;

    // Precondición: NO debería haber excepciones uncaught al arrancar la app completa vía DOMContentLoaded tras cargar TODOS los módulos.
    expect(handle.jsdomErrors).toEqual([]);   // Arranque limpio (sin jsdom error sin capturar) tras cargar index+data+módulos en orden.

    // -------- PREÁMBULO NECESARIO E INELUDIBLE PER SE AL ARRANQUE: guard interno de Innovación -----------------------
    // El botón "Generar ideas" se niega a operar si `foods` Y `recipes` están ambos vacíos (app.js: "Añade alimentos o
    // guarda una receta para inventar"). Como este flujo arranca del NO-NADA puro, añadimos ANTES un alimento BASE NEUTRAL
    // y deliberadamente no-colidente con ningún nombre de ingrediente real del catálogo curado ("Alimento de test base"):
    // su contenido concreto es IRRELEVANTE e intencionalmente abstracto (no simula ninguna receta/plato concreto en sí):
    // sólo existe para SATISFACER ese guard e inicializar el aforo no vacío que la app requiere para poder generar; NO se
    // pretende que sea un plato verosímil ni interactuie con la lógica de scoring de forma significativa alguna (haveRatio
    // para cualquier plato real del catálogo = 0 frente a este marcador sintético, por lo que no distorsiona el ordening).
    openView("foods"); // ya en Alimentos al arrancar es #view-foods activo por default index.html, pero explicitamos la intención.
    addFoodThroughForm({ name: "Alimento de test base", qty: 5, min: 3, score: 5 });
    expect(handle.foods).toHaveLength(1);          // persistió exactamente ese ítem en aforo inicial (verifica write real).
    expect(doc.querySelector("#food-list .food-item")).toBeTruthy(); // y pintó su tarjeta de inventario de serie (DOM-check complementario)

    const weeklyAlertBefore = doc.getElementById("weekly-alert");
    expect(weeklyAlertBefore.classList.contains("hidden"))
      .toBe(true); // la alerta semanal debe seguir oculta con un único alimento NO en falta a estas alturas.
  });

 // ------------------------------------------------------------------ flujo E2E completo -------------------------------
 it("genera 12 ideas, estrella 1 → Recetas (visible por defecto) → abre modal → copia ing ausente → Alimentos (alert de compra)",
   () => {
     let STARRED_TITLE;       // título de la idea marcada con ⭐ (lo usamos después para localizarla en Mis Recetas).
     let COPIED_INGREDIENT;   // ingrediente "copiado" fuera del aforo: se asigna tras abrir modal y consume el paso Alimentos.

    // ---- 1) IR A INNOVACIÓN Y GENERAR 12 IDEAS NUEVAS -------------------------------------------------------------
    openView("innovation");
    expect(doc.getElementById("view-innovation")).toBeTruthy(); // vista Innovación existe como target de la pestaña.
    const innovView = doc.getElementById("view-innovation");
    expect(innovView.classList.contains("active"))
      .toBe(true);

    // "Ideas por lote" → seleccionamos literalmente el valor 12 del select ya existente (index.html, opción value="12"),
    // igual que un usuario real cambiaría ese desplegable justo ahí mismo.
    setField("innov-count", 12);

    doc.getElementById("btn-generate-innov").click();   // genera + añade al aforo en memoria + persiste vía save(LS.innov,...)
    expect(handle.jsdomErrors).toEqual([]);            // ninguna excepción durante la cadena interactiva.

    // VERIFICA "vemos que se generan 12": exactamente 12 tarjetas nuevas en la lista de innovación, sin pérdidas por dedup
    // (pool catálogo ~94+ >> 12 demandado y con recipes[] aún vacío al momento → pool = catálogo íntegro; 0 duplicados preexistentes).
    const innovCards = doc.querySelectorAll("#innovation-list .recipe-card");
    expect(innovCards).toHaveSize(12);

    // -------- 2) GUARDAR UNA CON EL ICONO DE LA ESTRELLA EN FAVORITOS -----------------------------------------------
    const firstCard = innovCards[0];                                   // tomamos la idea nº1 del ranking (orden determinista A).
    expect(firstCard.querySelector("[data-save]")).toBeTruthy();       // la idea expone su botón de estrella ⭐.
    STARRED_TITLE = trimSafe((firstCard.querySelector("h3") || {}).textContent);
    firstCard.querySelector("[data-save]").click();                   // dispara listener "click" real: stopPropagation + save()

    // 2a) El aforo de innovación debe haber PERDIDO esa idea concreta al quedar movida (quitada de ahí tras guardarse).
    expect(handle.innov.length).toBeLessThan(12);                     // la idea guardada ya NO debería estar en Innovación.
    expect(handle.innov.some(i => i.title === STARRED_TITLE)).toBe(false);

    // 2b) Debe APARECER realmente en recetas persistidas: tras el ⭐, app.js hace save(LS.recipes,...). El getter
    // handle.recipes lee localStorage FRESCO tras esa escritura → la receta estrella DEBE estar ahí con un id nuevo (uid()),
    // sus ingredientes copiados por .slice() y su meal propagado.
    const starredRecipeInPantry = handle.recipes.find(r => r.title === STARRED_TITLE);
    expect(starredRecipeInPantry).toBeTruthy();                       // la idea ${STARRED_TITLE} ha saltado a Mis Recetas tras el ⭐.
    expect(starredRecipeInPantry.id).not.toBeUndefined();             // uid() real asignado al pasar a recetas.
    expect(Array.isArray(starredRecipeInPantry.ingredients)).toBe(true);
    expect(Boolean(starredRecipeInPantry.meal)).toBeTruthy();         // meal (desayuno/comida/cena) se propaga de idea a receta.

    // ---- 3) NAVEGAMOS A RECETAS Y COMPROBAMOS QUE SALE DIRECTA POR DEFECTO ----------------------------------
    // El ⭐ NO repinta Recetas de inmediato (app.js sólo marca recetasDirty=true; ver el comment L517-520 original): es justo
    // el cambio de tab al entrar en "recipes" quien llama renderRecipes() condicional sobre ese flag, ejercitando así el
    // mecanismo nav-gate REAL. Con filtros por defecto vacíos ("Todos los tipos") DEBE verla ya lista sin tocar nada:
    // invariante crítica de "por defecto salen todas".
    openView("recipes");
    expect(doc.getElementById("view-recipes")).toBeTruthy();          // vista Recetas existe como target.
    const recipesView = doc.getElementById("view-recipes");
    expect(recipesView.classList.contains("active")).toBe(true);      // vista Recetas se activa al pulsar su tab desde Innovación.

    const recipeCards = doc.querySelectorAll("#recipe-list .recipe-card");
    expect(recipeCards.length).toBeGreaterThanOrEqual(1);              // debería ver al menos la receta recién guardada en Mis Recetas (invariante "por defecto salen todas").

    // Localización robusta por TÍTULO del título que marcamos (sin fiarnos del sort/orden de #recipe-list):
    const targetCard = Array.from(recipeCards).find(c => {
      const h3 = c.querySelector("h3");
      return !!h3 && trimSafe(h3.textContent) === STARRED_TITLE;
    });
    expect(targetCard).toBeTruthy();                                  // la tarjeta con título STARRED_TITLE está en #recipe-list.

    // ---- 4) ABRIMOS LA RECETA EN MODAL Y COPIAMOS UN INGREDIENTE QUE NO ESTÁ EN CASA ------------------------
    targetCard.click();   // misma lógica del click real de la tarjeta → openRecipeModal(r): el modal se abre con su contenido.
    const recipeTitleInModal = doc.querySelector("#modal h2");
    expect(recipeTitleInModal).toBeTruthy();                          // el título debe estar dentro del modal abierto.
    expect(trimSafe(recipeTitleInModal.textContent)).toBe(STARRED_TITLE);

    COPIED_INGREDIENT = pickIngredientNotInPantry(starredRecipeInPantry);  // primer ingrediente de la receta que NO hay en aforo.

    // Lo "copiado" por el usuario SÍ tiene que estar físicamente ausente del aforo actual:
    expect(handle.foods.some(f => normForCompare(f.name) === normForCompare(COPIED_INGREDIENT)))
      .toBe(false);   // el ingrediente copiado no debe estar ya en el aforo de Alimentos.

    closeModal();   // ejercita su "Cerrar" real (data-close del footer, re-bind por openRecipeModal) → modal vuelve hidden.
    expect(doc.getElementById("modal")).toBeTruthy();                // ref al contenedor modal post-cerrar.
    expect(doc.querySelector("#modal.hidden")).toBeTruthy();         // el modal SÍ debería volver a tener su clase "hidden" tras pulsar Cerrar (queda oculto en DOM).

    // ---- 5) IR A ALIMENTOS Y INTRODUCIR EL INGREDIENTE QUE COPIAMOS ----------------------------------------
    openView("foods");
    expect(doc.getElementById("view-foods")).toBeTruthy();           // vista Alimentos existe.
    const foodsView = doc.getElementById("view-foods");
    expect(foodsView.classList.contains("active")).toBe(true);       // la vista Alimentos se activa al pulsar su tab.

    // Introducimos el ingrediente exacto que copiamos, con las condiciones del enunciado:
    //   • prioridad (score/importancia) = 6 → color naranja/urgencia media.
    //   • "en casa" (qty)              = 0  → literalmente no queda nada de ese producto en stock.
    //   • "avisar con min"            = 0  → el umbral para avisar es 0, por lo que qty(0) ≤ min(0) hace QUE la alerta
    //                                        semanal LO MUESTRE: sale directo en el listado de compra (ver buildWeeklyAlert).
    addFoodThroughForm({ name: COPIED_INGREDIENT, score: "6", qty: "0", min: "0" });
    expect(handle.jsdomErrors).toEqual([]);                        // tras la cadena interactiva completa.

    // Verificación final del flujo completo tras el submit (save(LS.foods)+renderFoods()+renderWeeklyAlert()):
    const ingInPantry = handle.foods.find(f => f.name && normForCompare(f.name) === normForCompare(COPIED_INGREDIENT));
    expect(ingInPantry).toBeTruthy();                              // el ingrediente copiado está en aforo persistido.

    expect(Number(ingInPantry.qty)).toBe(0);                      // cantidad "en casa" = 0 como se indicó.
    expect(Number(ingInPantry.min)).toBe(0);                      // umbral de aviso min = 0 como se indicó.
    expect(Number(ingInPantry.score)).toBe(6);                    // prioridad/importancia score/10 = 6.

    const weeklyAlertEl = doc.getElementById("weekly-alert");      // la card de alerta semanal DEBIÓ dejar de estar 'hidden' tras este paso.
    expect(doc.querySelector("#weekly-alert.hidden")).toBeNull();  // ya NO tiene clase "hidden": quedó visible al añadir un alimento en falta (qty<=min).
    expect(!!weeklyAlertEl).toBeTruthy();                           // la card #weekly-alert debe existir como contenedor visible a estas alturas del flujo.

    const myRow = findAlertRow(COPIED_INGREDIENT);                 // estructura .alert-row > alert-name > strong por fila.
    expect(myRow).toBeTruthy();                                   // la alerta semanal incluye una fila para COPIED_INGREDIENT (carrito de compra).

    const strongInRow = myRow.querySelector(".alert-name");
    const strongTextNorm = normForCompare(strongInRow.textContent || "");
    expect(strongTextNorm === normForCompare(COPIED_INGREDIENT)).toBe(true); // la etiqueta fuerte .alert-name de la fila debe contener el texto plano del ingrediente copiado.

    // Invariantes terminales del flujo completo (re-asserts compactos para documentar visualmente el punto verde final):
    expect(handle.recipes.find(r => r.title === STARRED_TITLE)).toBeTruthy();  // la receta ⭐ sigue persistente en Mis Recetas.
    expect(findAlertRow(COPIED_INGREDIENT)).toBeTruthy();                       // terminal: fila de COPIED_INGREDIENT visible en alert semanal.
  });

});

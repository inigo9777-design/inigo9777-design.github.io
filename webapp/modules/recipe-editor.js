// modules/recipe-editor.js — Lógica PURA del editor de recetas ("✏️ Editar" del modal de detalle).
// Extrae de app.js la parte de DOM-free decision del flujo edicion (§3 del CODING_STANDARDS.md:
// lógica de dominio en módulos testeables; app.js queda como composition-root que sólo ORQUESTA).
//
// Reglas del flujo (feature 2026-10-18):
//   · Receta ya guardada en Mis Recetas (match por id) → se edita IN-SITU: mismo id y campos
//     title/meal/ingredients/method actualizados; el resto de propiedades (source, uses, createdAt…)
//     se PRESERVAN intactas.
//   · Receta del catálogo curado o del menú generado (id fuera de Mis Recetas) → la edición crea
//     una COPIA editable con id NUEVO; el original queda intacto (catálogo de sólo lectura).
//   · El HUECO del plan semanal guarda una copia del objeto receta (JSON) → una edición debe
//     refrescar esas copias por id: para una receta guardada se busca SU id; para una copia nueva
//     se parchea por el id ORIGINAL del plato del menú (ver patchPlan).
//   · Validación: una receta sin título, sin ingredientes o sin pasos no se guarda (el editor
//     avisa y no toca la persistencia).
//
// API PÚBLICA CERRADA (5 funciones): buildDraft / validateDraft / estaGuardada / applyEdit / patchPlan.
// Sin DOM ni I/O: testeable 100% en Node (§6 Capa-1); patrón (A) del CODING_STANDARDS.md §3.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { recipeEditor: api });
})(typeof self !== "undefined" ? self : this, function () {

  // buildDraft — normaliza los 4 campos crudos del formulario a un borrador canónico:
  // texto sin bordes y listas partidas por línea (una línea = un ingrediente / un paso),
  // descartando líneas vacías o de espacios.
  function buildDraft(title, meal, ingredientsText, methodText) {
    return {
      title: String(title || "").trim(),
      meal: String(meal || "").trim(),
      ingredients: String(ingredientsText || "").split("\n").map(s => s.trim()).filter(Boolean),
      method: String(methodText || "").split("\n").map(s => s.trim()).filter(Boolean),
    };
  }

  // validateDraft — gate de guardado. Devuelve el PRIMER campo que falta (para que la UI
  // avise de forma concreta) o ok=true si el borrador es salvable tal cual.
  function validateDraft(draft) {
    if (!draft || !draft.title) return { ok: false, falta: "title" };
    if (!Array.isArray(draft.ingredients) || draft.ingredients.length === 0) return { ok: false, falta: "ingredients" };
    if (!Array.isArray(draft.method) || draft.method.length === 0) return { ok: false, falta: "method" };
    return { ok: true, falta: null };
  }

  // estaGuardada — ¿la receta ya vive en Mis Recetas? (match por id; sin id o sin array → no).
  function estaGuardada(recipes, receta) {
    return !!(receta && receta.id && Array.isArray(recipes) && recipes.some(x => x.id === receta.id));
  }

  // applyEdit — aplica un borrador VALIDADO sobre el array de Mis Recetas (imputado):
  // devuelve un array NUEVO (sin mutar el recibido) + la receta guardada + el modo aplicado.
  // deps: { uid (obligatorio en modo copia), now () opcional — por defecto Date.now() }.
  function applyEdit(recipes, recetaOriginal, draft, deps) {
    const uid = deps && deps.uid;
    const now = (deps && typeof deps.now === "function") ? deps.now : () => Date.now();
    const campos = {
      title: draft.title,
      meal: draft.meal,
      ingredients: draft.ingredients.slice(),
      method: draft.method.slice(),
    };
    // (sync-buzon §1) marca de edición ESTABLE (ISO) en TODO lo que el editor toca: la usa el
    // fallback LWW del primer sync sin base y el orden de presentación del resolver. Derivada del
    // `now` inyectado (determinismo §6), no de un reloj paralelo.
    const editedAt = new Date(now()).toISOString();
    const idx = estaGuardadaInicial(recipes, recetaOriginal);
    if (idx >= 0) {
      const guardada = Object.assign({}, recipes[idx], campos, { editedAt });   // preserva source/uses/createdAt…
      const nuevas = recipes.slice();
      nuevas[idx] = guardada;
      return { recipes: nuevas, guardada, modo: "in-situ" };
    }
    const copia = Object.assign({
      id: uid(),
      createdAt: now(),
      editedAt,
    }, campos, {
      source: recetaOriginal.source,
      from: recetaOriginal.from,
    });
    // (2026-10-18 el editor SELLA el origen de la copia): deps.origen lo calcula app.js en el MOMENTO del
    // guardado vía origen-recetas.esItaliana (id o título del plato ORIGINAL) y así la copia conserva la
    // etiqueta aunque el usuario renombre el plato después. In-situ NO la toca: preservada como siempre.
    if (deps.origen) copia.origen = String(deps.origen);
    return { recipes: recipes.concat([copia]), guardada: copia, modo: "copia" };
  }

  // Índice de recetaOriginal dentro de recipes[] (o -1). Helper interno de applyEdit, reusa el
  // criterio de estaGuardada por id para que "in-situ" y "copia" no puedan divergir.
  function estaGuardadaInicial(recipes, recetaOriginal) {
    if (!recetaOriginal || !recetaOriginal.id || !Array.isArray(recipes)) return -1;
    return recipes.findIndex(x => x.id === recetaOriginal.id);
  }

  // patchPlan — refresca las COPIAS de la receta incrustadas en los huecos del plan semanal.
  // Muta el snapshot del plan EN MEMORIA (el que luego se persiste); devuelve true si tocó
  // algún hueco (así la UI decide si re-renderiza y re-persiste) y false si no hay nada que
  // refrescar (sin plan, sin slots con receta, o id no presente en la semana).
  function patchPlan(plan, guardada, idOriginal) {
    if (!guardada || !Array.isArray(plan)) return false;
    const idBuscado = idOriginal || guardada.id;
    let tocado = false;
    plan.forEach(dia => {
      (Array.isArray(dia && dia.meals) ? dia.meals : []).forEach(comida => {
        if (comida && comida.recipe && comida.recipe.id === idBuscado) {
          comida.recipe.title = guardada.title;
          comida.recipe.meal = guardada.meal;
          comida.recipe.ingredients = guardada.ingredients.slice();
          comida.recipe.method = guardada.method.slice();
          // (2026-10-18): el ORIGEN sellado de la guardada viaja también a las copias del plan,
          // si no un hueco que incrusta la editada volvería a derivar su etiqueta por título.
          if (guardada.origen != null) comida.recipe.origen = guardada.origen;
          tocado = true;
        }
      });
    });
    return tocado;
  }

  return { buildDraft, validateDraft, estaGuardada, applyEdit, patchPlan };
});

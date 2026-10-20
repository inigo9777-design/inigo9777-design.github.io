// modules/backup.js — Lógica PURe de copia de seguridad: construir el payload exportable (buildBackup),
// nombrar el archivo ("dataBackup-YYYY-MM-DD-HH-MM-SS.json", makeFilename) y fusionar un backup importado en los
// datos actuales SIN destruir lo ya guardado (mergeIncoming: dedup-alimentos por nombre, normalización MEAL_SET,
// recorte de innovaciones a 30, uid entrante PRESERVADO con red de seguridad por fingerprint de ingredientes, cooked/weekmenu del payload v2). No toca DOM ni localStorage → testeable con Node/Jest sin jsdom.
// Ver CODING_STANDARDS.md §5 (buildBackup/applyBackup son candidatos explícitos a este módulo) y §2-D/§3 option A.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente con el resto de módulos.
  Object.assign(root.MRCheff, { backup: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Validez mínima de los `meal` aceptados; todo lo no-entendido cae a "comida" al importar (§5 / normalización).
  const MEAL_SET = new Set(["desayuno", "comida", "cena"]);
  // Puntuación de importancia validada dentro del rango [1..10]: si el valor importado es NaN/ilegal, cae a 5.
  const clampScore = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? 5 : Math.min(10, Math.max(1, n)); };

  // Clave/fingerprint de IDENTIDAD de receta (plan-sync-buzon.md §1): réplica EXACTA de la mecánica
  // `recipeIngredientKey` de innovations.js/planner.js (líneas normalizadas sin acento, orden-invariante,
  // separador "¦" improbable). Es la "red de seguridad" de la dedup Jaccard=1.0 para recetas LEGACY
  // sin uid fiable al importar/sincronizar (precedente de duplicación idéntica ya logada en CODING_STANDARDS §8).
  const claveIngredientes = function (ingredientes) {
    const partes = (Array.isArray(ingredientes) ? ingredientes : [])
      .map(x => String(x == null ? "" : x)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^0-9a-zA-Z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase())
      .filter(Boolean)
      .sort();
    return partes.join("\u00A6");
  };

  // Id único para entidades nuevas al importar/fusionar: mismo formato que `util.uid`; aquí se redeclara local
  // para que este módulo sea autónomo y testeable aislado. El default de producción usa reloj real; el call-site
  // (la vista) lo inyecta opcionalmente por contexto para tests (precedente uid/rng, §3.7 / §6 "Determinismo").
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Reúne todo lo exportable en un objeto único con versión y fecha. `state` son los datos actuales INMUTABLES de la
  // app; `exportedAt` se inyecta opcionalmente por contexto para hacer determinista el test ("hoy" no real, §6), si no
  // hay valor pasado usa new Date().toISOString() — comportamiento IDENTICO al del code legacy que reemplaza. Cuando
  // la data de localStorage ya no es mutable (futuro refactoring a store) se pasa solo `state` y `now`.
  const buildBackup = function (state, opts = {}) {
    const { foods, recipes, innovations, innovDay, cooked, weekmenu } = state;
    return {
      version: 2,                                              // v2 = añade cooked/weekmenu (plan-sync-buzon.md §1); el import de v1 sigue funcionando
      exportedAt: opts.now ?? new Date().toISOString(),
      foods,
      recipes,
      innovations,
      innovDay,
      cooked: Array.isArray(cooked) ? cooked : [],             // historial de "se cocinó" (ancla del cooldown de 7 días)
      weekmenu: weekmenu != null ? weekmenu : null             // plan semanal (snapshot transportado, no dato a unir)
    };
  };

  // Nombre de la copia: "dataBackup" + fecha y hora REALES del momento en que se exporta (no cadena fija). Ej.
  // "dataBackup-2026-10-11-17-10-49.json". Acepta opcionalmente `d` inyectado para tests deterministas (§6) — el default
  // usa new Date() y da exactamente la misma salida que antes del refactor (comportamiento preservado).
  const pad2 = n => String(n).padStart(2, "0");
  const makeFilename = function (d = new Date()) {
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
    return `dataBackup-${stamp}.json`;
  };

  // Fusiona un backup "importado data" en los datos actuales ("current") SUCESIVOS SIN destruir lo ya guardado (§5). NO toca
  // DOM ni storage: calcula los ARREGLOS fusionados + flag de si persistir innovaciones y CUANTOS añadidos, y lo devuelve;
  // el caller decide cuando/si hacer save() / re-render. PreserVA exactamente el mismo comportamiento que el applyBackup() legacy:
  //   * Alimentos — dedup por nombre en minúsculas (nunca se "añade dos veces" uno ya existente); los nuevos entran con uid fresco +
  //     score validado al rango [1..10] y defaults de qty/min/checked/createdAt.
  //   * Recetas — todas las importadas válidas van al FINAL del historico (no hay dedup): cada una recibe uids frescas, MEAL_SET válido
  //     o "comida" por default, `uses` UNDEFINED si el backup no trae (para ser compatible con recetas manuales que NO tiene ese campo),
  //     y source/from/usa el valor original cuando está presente.
  //   * Innovaciones — solo SI el import tiene al menos un elemento, se añaden todas (dedup por ID del uid recién generado: imposible colisionar) y
  //     la pila entera se recorta a las últimas 30; además se marca "persistir innov" → el caller actualiza `innovDay = hoy` + re-saves.
  // Devuelve NULL cuando la data NO es un objeto válido (el caller muestra "Archivo no válido"). Inyectables: `uid`/`today` para tests (§6).
  const mergeIncoming = function (current, data, opts = {}) {
    if (!data || typeof data !== "object") return null;
    const uid = typeof opts.uid === "function" ? opts.uid : defaultUid;   // inyección para tests (§3.7) — producción usa reloj real
    const today = (opts.today != null) ? String(opts.today) : new Date().toISOString().slice(0, 10);

    const inFoods  = Array.isArray(data.foods)       ? data.foods      : [];
    const inRecipes = Array.isArray(data.recipes)     ? data.recipes    : [];
    const inInnov   = Array.isArray(data.innovations) ? data.innovations: [];

    // ---- Alimentos: se suman los que NO existan ya (dedup por nombre, minúsculas; idempotente) ----
    const nextFoods = current.foods.slice();
    const knownNames = new Set(current.foods.map(f => f.name.toLowerCase()));
    let addedFoods = 0;
    inFoods.forEach(raw => {
      if (!raw || typeof raw !== "object" || !raw.name) return;
      const key = String(raw.name).toLowerCase();
      if (knownNames.has(key)) return;       // duplicado → descartar SIN tocar el existente (idempotente por nombre)
      knownNames.add(key);
      nextFoods.push({
        id: raw.id || uid(), name: String(raw.name), score: clampScore(raw.score),
        qty: raw.qty ?? 0, min: raw.min ?? 0, checked: !!raw.checked,
        createdAt: raw.createdAt || Date.now()   // si viene de un backup antiguo puede no traerlo → timestamp actual
      });
      addedFoods++;
    });

    // ---- Recetas — IDENTIDAD ESTABLE (plan-sync-buzon.md §1): se PRESERVA el uid entrante ("la misma
    //         receta" existe entre dispositivos; la probabilidad de colisión entre uids de navegadores
    //         distintos es despreciable) y ya NO se duplica gemela ninguna:
    //           · dedup primario por id entrante ya conocido;
    //           · red de seguridad por fingerprint de ingredientes (claveIngredientes) para legacy/copias
    //             sin id fiable — Jaccard=1.0, invariante a acentos/orden/tokens (mecánica del hard-exclude
    //             de Mis Recetas, §5 del CODING_STANDARDS.md).
    //       Van todas al FINAL del histórico; la receta LOCAL se preserva intacta (nunca se "reescribe").
    const nextRecipes = current.recipes.slice();
    const identidadesConocidas = new Set(nextRecipes.map(r => r && r.id).filter(Boolean));
    const clavesConocidas = new Set(nextRecipes.map(r => claveIngredientes(r && r.ingredients)).filter(Boolean));
    let addedRecipes = 0;
    inRecipes.forEach(raw => {
      if (!raw || typeof raw !== "object" || !raw.title) return;
      const id = raw.id || uid();                    // preserve: uid entrante si lo trae; fresco sólo para la huérfana
      const clave = claveIngredientes(raw.ingredients);
      if (id && identidadesConocidas.has(id)) return;          // gemela por id → descartada SIN tocar la existente
      if (clave && clavesConocidas.has(clave)) return;         // legacy duplicada por ingredientes → igual
      if (id) identidadesConocidas.add(id);
      if (clave) clavesConocidas.add(clave);
      nextRecipes.push({
        id, title: String(raw.title),
        meal: MEAL_SET.has(raw.meal) ? raw.meal : "comida",             // normaliza a los 3 valores válidos (default comida)
        ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map(String) : [],
        method:      Array.isArray(raw.method)      ? raw.method.map(String)     : [],
        source: raw.source || undefined,                                   // undefined si la receta NO tiene "fuente" — compatible con recetas manuales
        from:   raw.from   || undefined,
        uses:   Array.isArray(raw.uses) ? raw.uses.map(String) : undefined, // UNDEFINED por diseño para compatibilidad (no `[]`)
        origen: raw.origen || undefined,                                   // sello de origen preservado (opcional, feature 2026-10-18)
        editedAt: raw.editedAt || undefined,                               // marca de edición del otro dispositivo (opcional, sync §1: LWW del resolver)
        createdAt: raw.createdAt || Date.now()
      });
      addedRecipes++;
    });

    // ---- Innovaciones (ideas en curso): se suman ANTES de recortar la pila a 30; setear innovDay = "hoy" para que
    //        sobreviva al auto-expiry del cierre DOMContentLoaded — ver §5 "Innovación: expiración automática".
    let nextInnovations = current.innovations.slice();
    let persistInnov = false;
    if (inInnov.length > 0) {
      inInnov.forEach(raw => {
        if (!raw || typeof raw !== "object" || !raw.title) return;
        nextInnovations.push({
          id: uid(), title: String(raw.title),
          meal: MEAL_SET.has(raw.meal) ? raw.meal : "comida",
          ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map(String) : [],
          method:      Array.isArray(raw.method)      ? raw.method.map(String)     : [],
          source: raw.source || "nueva",                     // valor por defecto para ideas generadas/importadas (no curada/variación/…)
          from:   raw.from || "",
          uses:   Array.isArray(raw.uses) ? raw.uses.map(String) : [],             // aquí sí default `[]`
          createdAt: raw.createdAt || Date.now()
        });
      });
      // Recorte a últimas 30 (si superan, se cortan las más antiguas → "capa a 30" invarte §5 "Innovación").
      if (nextInnovations.length > 30) nextInnovations = nextInnovations.slice(nextInnovations.length - 30);
      persistInnov = true;    // el caller debe guardar + marcar innovDay = today
    }

    // ---- cooked / weekmenu (payload v2, plan-sync-buzon.md §1): ANEXO, nada de lo guardado desaparece ----
    const nextCooked = Array.isArray(current.cooked) ? current.cooked.slice() : [];
    let addedCooked = 0;
    (Array.isArray(data.cooked) ? data.cooked : []).forEach(raw => {
      if (!raw || typeof raw !== "object") return;
      const finger = raw.keyFingerprint || raw.id;      // el cooldown compara por keyFingerprint; el id hace de fallback (§5 planner)
      const dia = raw.on || "";
      const yaCocinado = nextCooked.some(c => (c.keyFingerprint || c.id) === finger && c.on === dia);
      if (yaCocinado) return;                            // mismo plato cocinado el mismo día en ambos dispositivos → una sola entrada
      nextCooked.push({ id: raw.id || uid(), title: String(raw.title || ""), keyFingerprint: raw.keyFingerprint || "", on: dia });
      addedCooked++;
    });

    // weekmenu: se adopta el entrante SOLO si el local no tiene ninguno (es snapshot transportado, no dato a
    // fusionar línea a línea); si el local ya tiene plan, NADA desaparece (§5 del CODING_STANDARDS.md).
    const nextWeekmenu = data.weekmenu != null && !(current.weekmenu != null) ? data.weekmenu : (current.weekmenu != null ? current.weekmenu : null);

    return { foods: nextFoods, recipes: nextRecipes, innovations: nextInnovations, persistInnov, addedFoods, addedRecipes,
             cooked: nextCooked, weekmenu: nextWeekmenu, addedCooked };
  };

  return { buildBackup, makeFilename, mergeIncoming };
});

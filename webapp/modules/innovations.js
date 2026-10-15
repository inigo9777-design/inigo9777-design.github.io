// modules/innovations.js — Generación de "ideas" (recetas nuevas + variaciones) a partir del inventario.
// Lógica PURe en cuanto a DOM y localStorage: NO toca el DOM ni almacena nada → testeable con Node/Jest sin jsdom,
// igual que priority.js / classify.js / recipe-analysis.js. Ver CODING_STANDARDS.md §3 option A / DIP (§2-D).
// Se inyecta el estado por CONTEXTO en cada llamada (ctx = { foods, recipes, uid }) en lugar de cerrar sobre variables
// del closure anterior de app.js: así el módulo es autónomo y testeable. `uid` se puede sobreescribir para pruebas
// deterministas; si no se pasa cae a la misma fórmula que usaba app.js (comportamiento idéntico).
// La clasificación por tipo se sigue consumiendo vía window.MRCheff.classify (mismo patrón de módulo-cruzado
// por namespace que ya hacía app.js con makeCombo), para mantener el comportamiento bit-a-bit.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente.
  Object.assign(root.MRCheff, { innovations: api });
})(typeof self !== "undefined" ? self : this, function () {

  // ---- Utilidades aleatorias (copiadas literal de app.js para no cambiar la semántica) ----
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() < p;
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const sample = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
  // Elige n alimentos distintos dándoles más probabilidad a los de mayor puntuación
  function byScore(arr, n) {
    const bag = [];
    arr.forEach(f => { const w = Math.max(1, f.score || 5); for (let i = 0; i < w; i++) bag.push(f); });
    const out = []; const used = new Set(); let attempts = 0;
    while (out.length < n && attempts < n * 25) {
      attempts++;
      const f = pick(bag);
      if (!used.has(f.id)) { used.add(f.id); out.push(f); }
    }
    return out;
  }
  const joinNames = list => list.length <= 1 ? list.join("") : list.slice(0, -1).join(", ") + " y " + list[list.length - 1];

  // Generador de ids por defecto: idéntico al que usaba app.js (únicamente se usa si no se inyecta `uid`.
  const defaultUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---- Plantillas de cocina (estilo, toques y remates) ----
  const STYLES = {
    salteado: { name: "Salteado de", steps: ["Calienta aceite a fuego vivo.", "Saltea los ingredientes cortados hasta que queden tiernos y dorados.", "Ajusta de sal y pimienta y remueve."] },
    alvapor:  { name: "Al vapor de", steps: ["Calienta una cazuela con un poco de agua.", "Coloca los ingredientes sobre el vapor y tapa.", "Cocina hasta que estén suaves y listos."] },
    horno:    { name: "Al horno de", steps: ["Precalienta el horno a 200°C.", "Unta los ingredientes con un poco de aceite y especias.", "Asa hasta que estén dorados por fuera y tiernos por dentro."] },
    plancha:  { name: "A la plancha de", steps: ["Calienta muy bien la plancha o la sartén.", "Pasa los ingredientes por la plancha unos minutos por cada lado.", "Sazona al gusto y sirve enseguida."] },
    crudo:    { name: "En crudo de", steps: ["Corta todo de forma fina y uniforme.", "Colócalo con cuidado en el plato.", "Termina con un buen aliño y un toque de sal."] },
    guiso:    { name: "Guiso de", steps: ["Pocha la base aromática a fuego lento.", "Añade el resto y cubre con un poco de líquido.", "Remueve de vez en cuando hasta integrar los sabores."] },
    frito:    { name: "Frito de", steps: ["Calienta aceite en cantidad suficiente.", "Fríe con cuidado hasta que quede crujiente.", "Escurre en papel y salpimienta."] },
    batido:   { name: "Batido de", steps: ["Pon los ingredientes en la batidora.", "Tritura hasta obtener una textura cremosa.", "Sirve frío y disfruta."] },
    sopa:     { name: "Crema de", steps: ["Hierve el agua con la base aromática.", "Añade los ingredientes y cocina hasta que estén tiernos.", "Tritura si quieres una crema y sazona al gusto."] }
  };
  const STYLE_KEYS = Object.keys(STYLES);
  const TWISTS = [
    "un toque picante", "unas gotas de limón", "un chorrito de aceite de oliva virgen extra",
    "hierbas frescas picadas", "un toque de ajo", "un punto ahumado",
    "una pizca de miel para equilibrar", "pimentón para dar color",
    "unas semillas por encima para textura", "un toque exótico de comino o cúrcuma",
    "un toque cítrico de naranja", "un toque umami con un poco de salsa de soja"
  ];
  const FINISH = [
    "Sirve bien caliente.", "Ideal como plato principal.", "Perfecto como entrante ligero.",
    "Queda genial como snack.", "Servido con arroz o pan a elegir.", "También va bien en frío."
  ];
  const SEASONINGS = ["Sal", "Pimienta negra", "Aceite de oliva virgen extra", "Ajo", "Cebolla", "Perejil fresco", "Unas gotas de limón", "Pimentón", "Albahaca", "Comino"];
  const PREFIXES = ["Variación", "Twist", "Reinventado", "Retoque", "Toque", "Versión", "Remix", "Relevo", "Improviso", "Relectura", "Reto"];
  const ADJ = ["Exprés", "Casero", "de Mercado", "Fácil", "Sorprendente", "Vigoroso", "Crocante", "Suave", "Auténtico", "Creativo", "Del Día", "Improvisado", "Equilibrado", "Apetecible", "Rústico", "Festivo", "Ligero"];

  // Archetipos: combinaciones que Mr Cheff monta si tiene alimentos del tipo correspondiente
  const ARCHETYPES = [
    { name: "Ensalada", meal: "comida", type: "verdura", min: 2, style: "crudo", finish: "aliñada con aceite, sal y un toque de limón" },
    { name: "Salteado", meal: "cena", type: "verdura", min: 2, style: "salteado", finish: "servido con arroz o pasta de acompañamiento" },
    { name: "Guiso", meal: "cena", type: "verdura", min: 2, style: "guiso", finish: "gustoso, servido bien caliente" },
    { name: "Sopa o crema", meal: "cena", type: "verdura", min: 2, style: "sopa", finish: "caliente, con un chorrito de aceite" },
    { name: "Batido", meal: "desayuno", type: "fruta", min: 1, style: "batido", finish: "frío, cremoso y refrescante" },
    { name: "Fruta al horno", meal: "comida", type: "fruta", min: 1, style: "horno", finish: "con un poco de miel y canela" },
    { name: "Fruta salteada", meal: "desayuno", type: "fruta", min: 1, style: "salteado", finish: "espolvoreada con canela" },
    { name: "Tostada", meal: "desayuno", type: "lacteo", min: 1, style: "crudo", finish: "con tomate, un poco de aceite y sal" },
    { name: "Repostería", meal: "desayuno", type: "cereal", min: 1, style: "horno", finish: "espolvoreada con azúcar" }
  ];

  // ---- Generadores de ideas (cada uno recibe el contexto { foods, recipes, uid }) ----
  function baseIdea(source, meal, mkId) {
    return { id: mkId(), title: "", meal, ingredients: [], method: [], source, uses: [], from: "", createdAt: Date.now() };
  }
  function buildMethod(style, finish) {
    const steps = style.steps.slice();
    if (chance(0.7)) steps.splice(randInt(1, steps.length), 0, `Añade ${pick(TWISTS)}.`);
    steps.push(finish || pick(FINISH));
    return steps;
  }

  // 1) Variación de una receta guardada al azar, cambiando un ingrediente por uno de casa
  function makeVariation(ctx) {
    const recipes = ctx.recipes;
    if (!recipes.length) return null;
    const r = pick(recipes);
    const foods = ctx.foods;
    const prefix = pick(PREFIXES);
    const twist = pick(TWISTS);
    const baseTitle = r.title.replace(/^(variacion|twist|reinventado|retoque|toque|version|remix|relevo|improviso|relectura|reto)\s+de\s+/i, "");
    const ingredients = r.ingredients.slice();
    const uses = [];
    // Sustituye un ingrediente al azar por uno del inventario
    if (foods.length && chance(0.75)) {
      const home = pick(foods);
      if (ingredients.length) ingredients[randInt(0, ingredients.length - 1)] = `${home.name} (sustituye a un ingrediente)`;
      else ingredients.push(home.name);
      uses.push(home.name);
    }
    // Añade un alimento de casa como guarnición
    if (foods.length && chance(0.5)) {
      const g = pick(foods);
      if (!uses.includes(g.name)) { ingredients.push(`${g.name} para decorar`); uses.push(g.name); }
    }
    const method = r.method.slice();
    method.splice(randInt(0, method.length), 0, `Innova: añade ${twist}.`);
    method.push(`Toca final: ${twist}.`);
    const idea = baseIdea("variacion", r.meal, ctx.uid);
    idea.title = `${prefix} de ${baseTitle}: ${twist}`;
    idea.ingredients = ingredients;
    idea.method = method;
    idea.uses = uses;
    idea.from = r.title;
    return idea;
  }

  // 2) Combinación de un arquetipo con los alimentos que tienes en casa
  function makeCombo(ctx) {
    const foods = ctx.foods;
    if (!foods.length) return null;
    const arch = pick(ARCHETYPES);
    const matching = foods.filter(f => window.MRCheff.classify.classifyFood(f.name) === arch.type);
    if (matching.length < arch.min) return null;
    const stars = sample(matching, randInt(arch.min, arch.min + 2));
    const style = STYLES[arch.style] || pick(STYLES);
    const extras = sample(SEASONINGS, randInt(1, 3));
    const ingredients = [...stars.map(f => f.name), ...extras];
    if (chance(0.5)) { const ex = sample(foods.filter(f => !stars.includes(f)), 1)[0]; if (ex) ingredients.push(`${ex.name} de extra`); }
    const idea = baseIdea("combo", arch.meal, ctx.uid);
    idea.title = `${pick(ADJ)} ${arch.name} ${joinNames(sample(stars, Math.min(2, stars.length)).map(f => f.name))}`.trim();
    idea.ingredients = ingredients;
    idea.method = buildMethod(style, arch.finish);
    idea.uses = stars.map(f => f.name);
    return idea;
  }

  // 3) Creación libre: mezcla al azar de lo que hay en casa
  function makeFreeform(ctx) {
    const foods = ctx.foods;
    if (foods.length < 2) return null;
    const stars = byScore(foods, randInt(2, Math.min(4, foods.length)));
    const style = STYLES[pick(STYLE_KEYS)];
    const main = pick(stars);
    const extras = sample(SEASONINGS, randInt(1, 3));
    const idea = baseIdea("libre", pick(["desayuno", "comida", "cena"]), ctx.uid);
    idea.title = `${pick(ADJ)} ${style.name} ${main.name}`.trim();
    idea.ingredients = [...stars.map(f => f.name), ...extras];
    idea.method = buildMethod(style);
    idea.uses = stars.map(f => f.name);
    return idea;
  }

  // 4) Plato centrado en un solo ingrediente de casa
  function makeSolo(ctx) {
    const foods = ctx.foods;
    if (!foods.length) return null;
    const star = byScore(foods, 1)[0];
    const style = STYLES[pick(STYLE_KEYS)];
    const twist = pick(TWISTS);
    const idea = baseIdea("protagonista", pick(["desayuno", "comida", "cena"]), ctx.uid);
    idea.title = `${style.name} ${star.name}`.trim();
    idea.ingredients = [star.name, ...sample(SEASONINGS, randInt(1, 3))];
    idea.method = buildMethod(style, `Termina con ${twist}.`);
    idea.uses = [star.name];
    return idea;
  }

  // Monta un lote de ideas repartiendo entre los generadores que permitan el foco.
  // Recibe el estado actual { foods, recipes } y (opcionalmente) un `uid` inyectable por contexto;
  // la orquestación/dedup contra lo ya guardado y el recorte a 30 quedan en app.js (son mutación +
  // persistencia = capa controladora, no lógica pura de "proponer").
  function generate(count, focus, state) {
    const ctx = {
      foods: Array.isArray(state && state.foods) ? state.foods : [],
      recipes: Array.isArray(state && state.recipes) ? state.recipes : [],
      uid: (state && typeof state.uid === "function") ? state.uid : defaultUid,
    };
    const gens = [];
    if (focus !== "nuevas") gens.push(makeVariation);
    if (focus !== "variaciones") gens.push(makeCombo, makeFreeform, makeSolo);
    if (gens.length === 0) return [];
    const out = [];
    const seen = new Set();
    let attempts = 0;
    const maxAttempts = count * 40 + 50;
    while (out.length < count && attempts < maxAttempts) {
      attempts++;
      const idea = pick(gens)(ctx);   // cada generador recibe el mismo contexto de estado
      if (!idea) continue;
      const key = idea.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(idea);
    }
    return out;
  }

  return { generate };
});

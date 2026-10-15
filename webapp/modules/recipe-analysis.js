// modules/recipe-analysis.js — Análisis del texto libre "describe tu cocinado" → receta estructurada.
// Lógica pura (NO toca el DOM ni localStorage): recibe el texto y un contexto opcional { meal, pantry }.
// Ver CODING_STANDARDS.md §3 option A + patrón DIP para testabilidad sin jsdom.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente.
  Object.assign(root.MRCheff, { recipeAnalysis: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Mismo mapeo etiqueta-comida que el resto de la app; copiado aquí para que este módulo sea autónomo.
  const mealLabels = { desayuno: "🌅 Desayuno", comida: "🍽️ Comida", cena: "🌙 Cena" };

  /* Análisis del texto (local, sin red): lee la descripción y saca, en orden, los INGREDIENTES que el usuario
   * menciona y los PASOS que describe. No inventa pasos genéricos: si algo no está en el texto, lo deja en blanco
   * para que el usuario lo complete. Devuelve además `possible`: alimentos del inventario que podrían encajar, para
   * que el usuario los añada a mano si quiere. El inventario se pasa por contexto (ctx.pantry), NO se cierra sobre
   * una variable externa → así es testeable de forma aislada. */
  function analyzeRecipe(desc, { meal = "comida", pantry = [] } = {}) {
    const strip = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const low = desc.replace(/\r/g, "");

    // ---- INGREDIENTES: lo que aparece en el texto (diccionario + tu inventario) ----
    const ING = [
      "huevo","huevos","pollo","pavo","cerdo","ternera","carne","bacalao","salmón","sardina","atún","gambas","camarón","camarones","langosta","tocino","salchicha","lentejas","garbanzos","judías","frijoles","tofu","quinoa","soja",
      "leche","yogur","queso","nata","crema","mantequilla","ghee","kefir","cottage",
      "pan","arroz","pasta","macarrones","espagueti","avena","trigo","tortilla","tostada","galletas","maíz","cereal",
      "manzana","pera","plátano","fresa","frambuesa","sandía","melón","kiwi","naranja","mandarina","limón","lima","uva","higo","melocotón","albaricoque","ciruela","piña","coco","arándanos","granada","cereza",
      "tomate","cebolla","zanahoria","pimiento","berenjena","lechuga","espinaca","brócoli","coliflor","calabaza","calabacín","espárragos","puerro","apio","remolacha","acelga","pepino","ajo","chalota","aceituna","oliva","repollo","col",
      "sal","pimienta","pimentón","cúrcuma","comino","canela","laurel","orégano","cilantro","tomillo","romero","menta","aceite","miel","azúcar","vinagre","jengibre","azafrán","chocolate","salsa","mostaza","curry"
    ];
    // Llave normalizada (sin acentos, y su raíz sin "-s") → nombre a mostrar (con acento)
    const byRoot = new Map();
    const addForm = disp => {
      const base = strip(disp.toLowerCase());
      byRoot.set(base, cap(disp));
      if (base.length > 3) byRoot.set(base.slice(0, -1), cap(disp));
    };
    ING.forEach(addForm);
    for (const raw of pantry) { // también lo que ya tienes en tu inventario (nombres pasados como parámetro de contexto)
      const name = String(raw);
      const base = strip(name.toLowerCase());
      byRoot.set(base, name);
      if (base.length > 3) byRoot.set(base.slice(0, -1), name);
    }

    const tokens = strip(low).split(/[^a-z0-9]+/).filter(Boolean);
    const ingredients = [];
    const ingSeen = new Set();
    for (const raw of tokens) {                 // en orden de aparición en el texto
      const root = raw.length > 3 ? raw.slice(0, -1) : raw;
      const disp = byRoot.get(raw) || byRoot.get(root);
      if (disp && !ingSeen.has(disp)) { ingSeen.add(disp); ingredients.push(disp); }
    }

    // ---- PASOS: las acciones que el usuario describe (nunca pasos inventados) ----
    const VERBOS = [
      "batir","freir","fritir","cocinar","saltear","hervir","asar","hornear","cortar",
      "picar","pelar","mezclar","remover","anadir","incorporar","calentar","precalentar",
      "untar","empanar","rebozar","dorar","sofreir","pochar","licuar","triturar","servir",
      "enfriar","reposar","amasar","escurrir","colar","sazonar","condimentar","rebanar",
      "laminar","exprimir","escalfar","salpimentar","rematar","decorar","preparar","poner",
      "echar","retirar","voltear"
    ];
    const vroots = [...new Set(VERBOS.map(v => v.slice(0, 3)))];
    const hasVerb = t => {
      const toks = strip(t.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
      return toks.some(tk => tk.length >= 4 && vroots.some(r => tk.startsWith(r)));
    };
    const FILLER = /^(ya|entonces|después|ahora|finalmente|por último|luego|primero|empezamos|seguimos|para terminar|al final|una vez)\s+/i;
    const cleanStep = s => {
      let out = s.trim().replace(/^[-–—]\s*/, "").replace(FILLER, "").replace(/\s+/g, " ").trim();
      if (out.length < 3 || !hasVerb(out)) return "";
      out = cap(out);
      if (!/[.!?…]$/.test(out)) out += ".";
      return out;
    };
    const CONN = new Set(["y","o","e","luego","ahora","entonces","finalmente","primero","y luego","por último"]);
    const pieces = low
      .split(/\n+/)
      .flatMap(p => p.split(/\.\s+|;\s+/))
      .flatMap(p => p.split(/(\s(?:y luego|y|luego|después|ahora|finalmente|por último)\s)/i))
      .map(s => s.trim())
      .filter(Boolean);
    const method = [];
    const stepSeen = new Set();
    for (const p of pieces) {
      if (CONN.has(strip(p.toLowerCase()))) continue;   // descarta puros conectores ("y", "y luego"…)
      const c = cleanStep(p);
      if (!c) continue;
      const key = strip(c.toLowerCase());
      if (stepSeen.has(key)) continue;
      stepSeen.add(key);
      method.push(`${method.length + 1}. ${c}`);
      if (method.length >= 10) break;
    }

    // ---- TÍTULO y "POSIBLES" (del inventario, para añadir a mano) ----
    const mealWord = (mealLabels[meal] || "Receta").split(" ")[1] || "Receta";
    const main = ingredients[0] || "Receta";
    const title = main === "Receta" ? "Receta" : `${main} · ${mealWord}`;
    const ingNorm = new Set(ingredients.map(i => strip(i.toLowerCase())));
    const possible = pantry
      .filter(n => !ingNorm.has(strip(String(n).toLowerCase())))
      .slice(0, 6);

    return { title, ingredients, method, possible };
  }

  return { analyzeRecipe };
});

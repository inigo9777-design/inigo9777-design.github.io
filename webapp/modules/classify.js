// modules/classify.js — Clasesificación heurística de un alimento por tipo a partir del nombre.
// Lógica "pura" (no DOM, no I/O) → testeable con Node/Jest sin jsdom. Ver CODING_STANDARDS.md §3 option A.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde tests.
  root.MRCheff = root.MRCheff || {};                                        // Namespace global único y coherente.
  Object.assign(root.MRCheff, { classify: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Normaliza texto quitando acentos/diacríticos (NFD + quitar "combining marks"). Se usa para comparar
  // nombres de ingredientes SIN fijarse en acentos, pero NO lo usamos para datos de presentación tipo TEMPORADA.
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Palabras clave que "sueñen" pertenecer a cada categoría alimentaria (sin acentos por diseño; el comparador usa `norm`).
  const FOOD_TYPES = {
    proteina: ["huevo","huevos","pollo","pavo","cerdo","carne","ternera","cordero","bacalao","salmon","sardina","atun","gambas","camaron","camarones","langosta","tocino","salchicha","lenteja","lentejas","garbanzo","garbanzos","alubia","frijol","frijoles","soja","tofu","quinoa","legumbre","legumbres"],
    lacteo: ["leche","yogur","yogurt","queso","nata","crema","mantequilla","kefir","cottage","ghee"],
    cereal: ["pan","arroz","pasta","noodle","macarron","espagueti","avena","trigo","tortilla","tostada","baguette","galleta","galletas","cereal"],
    fruta: ["manzana","pera","platano","fresa","frambuesa","sandia","melon","kiwi","naranja","mandarina","limon","lima","uva","higo","melocoton","albaricoque","ciruela","pina","coco","arandano","granada","cereza"],
    verdura: ["tomate","cebolla","zanahoria","pimiento","berenjena","judia","lechuga","espinaca","brocoli","coliflor","calabaza","calabacin","esparago","puerro","apio","remolacha","acelga","pepino","maiz","ajo","chalota","aceituna","oliva","repollo","col"],
    especia: ["sal","pimienta","pimenton","curcuma","comino","canela","laurel","oregano","cilantro","tomillo","romero","menta","aceite","aceituna"]
  };
  // Orden de prueba para que gane el tipo más específico (proteína/lácteo antes que verduras/especias).
  const TYPE_ORDER = ["proteina", "lacteo", "cereal", "fruta", "verdura", "especia"];

  function classifyFood(name) {
    const tokens = norm(name).split(/\W+/).filter(Boolean);
    const has = k => tokens.some(t => t === k || (k.length >= 4 && (t.startsWith(k) || t.endsWith(k))));
    for (const type of TYPE_ORDER) {
      if (FOOD_TYPES[type].some(has)) return type;
    }
    return "otros";
  }

  return { norm, FOOD_TYPES, TYPE_ORDER, classifyFood };
});

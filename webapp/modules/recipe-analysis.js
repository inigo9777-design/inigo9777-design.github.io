// modules/recipe-analysis.js — Análisis del texto libre "describe tu cocinado" → receta estructurada.
// Lógica pura (NO toca el DOM ni localStorage): recibe el texto y un contexto opcional { meal, pantry }.
// Ver CODING_STANDARDS.md §3 option A + patrón DIP para testability sin jsdom.
//
// 3ª generación del recortador (2026-10-18, #tasks-analisis-texto-recetas §8): el usuario escribe la
// receta A MANO y no nos podemos permitir perder nombres ni acciones. Lo que cambia:
//  · Diccionario de ingredientes muy ampliado (antes "tortilla de PATATAS" perdía "patata").
//  · Fallback de CANTIDADES: "200 gramos de harina", "un puñado de chirlas" captura el nombre aunque
//    no esté en el diccionario ni en la despensa.
//  · Verbos ampliados + imperativos irregulares exactos ("bate", "fríe", "cuece"… la raíz de 4
//    letras no los reconocía → los pasos arrancados en imperativo se perdían).
//  · Se corta TAMBIÉN por comas y se ANCLAN las frases sin verbo: las de tiempo/fuego ("durante 10
//    minutos", "a fuego lento") al paso ANTERIOR; las introductorias ("Cuando la cebolla esté
//    dorada, …") al paso SIGUIENTE. Antes ambas se descartaban → iconos de tiempo perdidos.
//  · Tope de pasos 10 → 16.
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
    const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
    const low = desc.replace(/\r/g, "");

    // ---- ACCIONES: las palabras que marcan pasos ----
    const VERBOS = [
      "batir","freir","fritir","cocinar","saltear","hervir","asar","hornear","cortar",
      "picar","pelar","mezclar","remover","anadir","incorporar","calentar","precalentar",
      "untar","empanar","rebozar","dorar","sofreir","pochar","licuar","triturar","servir",
      "enfriar","reposar","amasar","escurrir","colar","sazonar","condimentar","rebanar",
      "laminar","exprimir","escalfar","salpimentar","rematar","decorar","preparar","poner",
      "echar","retirar","voltear",
      // ampliación 3ª gen.: verbos corrientes en recetas escritas a mano que faltaban
      "guisar","estofar","escaldar","tostar","marinar","adobar","rellenar","enrollar",
      "trocear","machacar","majar","tapar","destapar","cubrir","verter","reservar",
      "rehogar","cocer","colocar","hacer","bajar","subir","rociar","espolvorear",
      "banar","envolver","desmoldar","templar","dejar","terminar"
    ];
    // Raíz mínima de 4 letras (no 3): con solo 3, raíces como "poc" (pochar), "pon", "col"... colisionan con
    // palabras comunes ("muchos", "porque", "comidas") y las toman erróneamente por verbos. A 4 se evita la
    // colisión sin perder verbos cortos del diccionario (el más corto, "asar", tiene exactamente 4).
    const ROOT_MIN = 4;
    // Verbos MUY CORTOS o imperativos ambiguos (≤3 letras) que NO pueden reconocerse por el prefijo raíz de
    // ROOT_MIN=4 sin colisionar con palabras comunes: se reconocen SOLO por coincidencia EXACTA del token completo
    // (igualdad total, no "empieza a ser igual"), así siguen sin generar falsos positivos como los que daba la
    // raíz 3-letras anterior. Curado y ampliable conforme surjan. Ejemplos: pon (imperativo de poner), ver (=comprobar).
    //
    // 3ª gen.: lo mismo ocurre con IMPERATIVOS IRREGULARES que la raíz de 4 letras NO coge y que arrancan
    // la mayoría de pasos escritos a mano: "Bate" empieza por "bat", no por "bati"; "Fríe" por "frie" ≠
    // raíz "frei"; "Cuece"/"Hierves" cambian la vocal; "Vierte" por "vert" ≠ raíz "vert" de verter…
    // Son tokens EXACTOS, contrastados para que no suenen a nombre ni a adjetivo de receta.
    const VERBOS_EXACTOS = new Set([
      "pon","ver",                                  // ya existentes (imperativos muy cortos)
      "bate","frio","frie","pico","mezo","sirve","sirvo",
      "vierte","vierten","cuece","hirve","remueve","envuelve","hace","deja"
    ]);

    const vroots = [...new Set(VERBOS.map(v => v.slice(0, Math.min(ROOT_MIN, v.length))))];
    const hasVerb = t => {
      const toks = strip(t.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
      // Vía 1 — raíz larga (≥ ROOT_MIN letras): reconoce verbos conjugados ("cocinar", "reposar"…) sin colisionar.
      const porRaiz = toks.some(tk => tk.length >= ROOT_MIN && vroots.some(r => tk.startsWith(r)));
      if (porRaiz) return true;
      // Vía 2 — coincidencia EXACTA para los pocos verbos/imperativos muy cortos que no caben en la vía raíz,
      // sin riesgo de falsos positivos (comparación de palabra completa, no de prefijo). Extensible.
      const porExacto = toks.some(tk => VERBOS_EXACTOS.has(tk));
      return porExacto;
    };

    // ---- INGREDIENTES: lo que aparece en el texto (diccionario + tu inventario) ----
    // Diccionario ampliado (3ª gen. del análisis): los básicos que el usuario escribe a mano
    // NO se podían perder ("tortilla de patatas" no capturaba "patata"; faltaban agua, harina,
    // vino, perejil, champiñón, pescado blanco…). Cada comida va en singular Y plural: el mapa
    // guarda base y base-sin-última-letra, pero el plural de 2+ letras en la raíz necesita
    // ambas formas listadas. NO se añaden participios-ambiguos ("dorada", "picada": son
    // también adjetivos de los pasos → falsos positivos).
    const ING = [
      "huevo","huevos","pollo","pavo","cerdo","ternera","carne","bacalao","salmón","sardina","sardinas","atún","gambas","gamba","camarón","camarones","langosta","tocino","salchicha",
      "lentejas","garbanzos","judías","frijoles","tofu","quinoa","soja",
      "leche","yogur","queso","nata","crema","mantequilla","ghee","kefir","cottage",
      "pan","arroz","pasta","macarrones","espagueti","avena","trigo","tortilla","tostada","galletas","maíz","cereal",
      "manzana","manzanas","pera","peras","plátano","plátanos","fresa","fresas","frambuesa","sandía","melón","kiwi","naranja","mandarina","limón","limones","lima","uva","uvas","higo","higos","melocotón","albaricoque","ciruela","piña","coco","arándanos","granada","cereza","cerezas",
      "tomate","tomates","cebolla","cebollas","zanahoria","zanahorias","pimiento","pimientos","berenjena","lechuga","espinaca","brócoli","coliflor","calabaza","calabacín","espárragos","espárrago","puerro","puerros","apio","remolacha","acelga","acelgas","pepino","ajo","ajos","chalota","aceituna","aceitunas","oliva","repollo","col","patata","patatas",
      "guisante","guisantes","alubia","alubias",
      "sal","pimienta","pimentón","cúrcuma","comino","canela","laurel","orégano","cilantro","perejil","tomillo","romero","menta","aceite","miel","azúcar","vinagre","jengibre","azafrán","chocolate","salsa","mostaza","curry",
      // básicos de despensa y proteína blanca que antes se perdían al escribirlos a mano:
      "agua","harina","levadura","maizena","caldo","vino","cerveza","sidra","zumo","zumos",
      "chorizo","chorizos","morcilla","jamón","jamones","lomo","lomos","chuleta","chuletas","costilla","costillas","solomillo","filete","filetes","alita","alitas","muslo","muslos","pechuga","pechugas",
      "merluza","boquerón","boquerones","anchoa","anchoas","chirla","chirlas","almeja","almejas","mejillón","mejillones","pulpo","calamar","calamares","sepia","caballa","lubina",
      "champiñón","champiñones","seta","setas","almendra","almendras","avellana","avellanas","nuez","nueces","piñón","piñones","pipas","semilla","semillas","cacahuete","cacahuetes",
      "cuscus","couscous","fideos"
    ];
    // Llave normalizada (sin acentos, y su raíz sin "-s") → nombre a mostrar (con acento).
    // Primera forma gana: el singular listado antes que el plural fija la raíz ("cebolla" →
    // "Cebolla"), y el plural no la pisa (antes "media cebolla" mostraba "Cebollas").
    const byRoot = new Map();
    const addForm = disp => {
      const base = strip(disp.toLowerCase());
      if (!byRoot.has(base)) byRoot.set(base, cap(disp));
      if (base.length > 3 && !byRoot.has(base.slice(0, -1))) byRoot.set(base.slice(0, -1), cap(disp));
    };
    ING.forEach(addForm);
    for (const raw of pantry) { // también lo que ya tienes en tu inventario (nombres pasados como parámetro de contexto)
      const name = String(raw);
      const base = strip(name.toLowerCase());
      byRoot.set(base, name);
      if (base.length > 3) byRoot.set(base.slice(0, -1), name);
    }

    // ---- PARTIDO EN PIEZAS (se hace PRIMERO: ingredientes y pasos leen del mismo troceo) ----
    // Líneas → puntos → comas → conectores. Con las comas se gana 1:1 entre acción y paso;
    // el recorte fino decide después qué piezas son paso, cola o introducción.
    const CONN = new Set(["y","o","e","luego","ahora","entonces","finalmente","primero","y luego","por último"]);
    const pieces = low
      .split(/\n+/)
      .flatMap(p => p.split(/\.\s+|;\s+/))
      .flatMap(p => p.split(/\s*,\s*/))
      .flatMap(p => p.split(/(\s(?:y luego|y|luego|después|ahora|finalmente|por último)\s)/i))
      .map(s => s.trim())
      .filter(Boolean);

    // OJO: el split es sobre [^a-z0-9]+ — hay que MINUSCULAR antes (strip solo quita acentos);
    // si no, toda palabra inicial en mayúscula perdía su primera letra ("Tortilla" → "ortilla").
    // Captura por PIEZA con origen (para subsumir el nombre compuesto capturado en el mismo
    // fragmento al que lo añadió el diccionario): se busca en el texto de la pieza en el orden
    // en el que aparecen los pedazos. Con "una cucharada de pimentón dulce" el token-scan añade
    // "Pimentón" y justo después el fallback de cantidades lo SUBSUME en "Pimentón dulce".
    const ingredients = [];
    const ingSeen = new Set();
    const origenDe = new Map();      // nombre → índice de la pieza donde se vio por primera vez
    pieces.forEach((p, pi) => {
      const toks = strip(p.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
      for (const raw of toks) {
        const root = raw.length > 3 ? raw.slice(0, -1) : raw;
        const disp = byRoot.get(raw) || byRoot.get(root);
        if (disp && !ingSeen.has(disp)) { ingSeen.add(disp); origenDe.set(disp, pi); ingredients.push(disp); }
      }
    });

    // ---- FALLBACK DE CANTIDADES: no perder nombres que el usuario no escribió "solos" ----
    // "200 gramos de harina", "un puñado de chirlas", "media cucharada de pimentón dulce": si el
    // nombre no está en el diccionario ni en la despensa, el token-scan no lo ve NUNCA. Estos
    // fragmentos con INDICIO DE CANTIDAD (dígitos o palabra de medida) se leen igual: se les
    // quita el paquete de medida y queda el nombre. Guardas anti-basura:
    //  · La pieza NO puede ARRANCAR con verbo (es una acción → pertenece al método, no aquí).
    //  · Palabras de radical/tiempo/recipientes ("durante", "minutos", "bol", "sartén"…) no son
    //    ingredientes ni sirven de nombre, y se filtran.
    // OJO con los signos: `palabras` ya viene STRIP (la Ñ es "n"+"marca combinante" al normalizar
    // NFD y la marca se quita → "puñado" es exactamente "puado"). Estos patrones deben escribirse
    // en GRAFÍA STRIP, no en la del diccionario castizo.
    const esCifra = tk => /^\d/.test(tk) || /^(un|una|unos|unas|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|medio|media|cuarto|tercio|mitad)$/.test(tk);
    const esMedida = tk => /^(g|gr|grs|gramo|gramos|kg|kilo|kilos|kgs|ml|cl|dl|litro|litros|vaso|vasos|taza|tazas|cucharada|cucharadas|cucharadita|cucharaditas|sopera|soperas|punado|punados|pizca|pizcas|chorrito|chorro|chorros|lata|latas|paquete|paquetes|bote|botes|botella|botellas|sobre|sobres|loncha|lonchas|rodaja|rodajas|filetes?|cachas?|copa|copas)$/.test(tk);
    const esRuido = tk => /^(de|del|la|el|los|las|un|una|unos|unas|y|o|e|a|al|en|con|para|por|mas|muy|si|que|como|hasta|durante|mientras|antes|despues|minuto|minutos|segundo|segundos|seg|hora|horas|grados|fuego|cuando|poco|menos|mucho|muchos|mucha|muchas|tipo|manera|forma|calor|frio|bol|cuenco|cazo|cazuela|cacerola|sarten|ol|plato|bandeja|fuente|opcional|peso|gusto|precio|dia|día|vez|mejor|docena|decena|doble|algo|bastante|ración|racion|porción|porcion)$/.test(tk);
    const empiezaPorVerbo = p => {
      const tk0 = strip(p.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean)[0];
      if (!tk0) return false;
      return VERBOS_EXACTOS.has(tk0) || (tk0.length >= ROOT_MIN && vroots.some(r => tk0.startsWith(r)));
    };
    const addNombreCapturado = (disp, pi) => {
      const key = strip(disp.toLowerCase());
      if (!key || key.length < 3) return;
      if (ingSeen.has(disp)) return;
      // SUBSUMO en la misma pieza: si un nombre sencillo capturado en ESTE fragmento es la cabeza
      // del compuesto ("Pimentón" → "Pimentón dulce"), el compuesto lo representa mejor: se
      // sustituye EN SU MISMO SITIO (el orden del texto es el orden de la lista, y el 1º pone título).
      // Piezas distintas no se tocan: "200 g de tomate" y "una lata de tomate triturado" son 2 cosas.
      const subsumibles = ingredients.filter(n =>
        origenDe.get(n) === pi && strip(n.toLowerCase()) !== key && key.startsWith(strip(n.toLowerCase())));
      if (subsumibles.length) {
        const sitio = Math.min(...subsumibles.map(n => ingredients.indexOf(n)));
        subsumibles.forEach(n => {
          ingSeen.delete(n);
          ingredients.splice(ingredients.indexOf(n), 1);
        });
        ingSeen.add(disp);
        origenDe.set(disp, pi);
        ingredients.splice(Math.min(sitio, ingredients.length), 0, disp);
        return;
      }
      ingSeen.add(disp);
      origenDe.set(disp, pi);
      ingredients.push(disp);
    };
    pieces.forEach((p, pi) => {
      const pStrip = strip(p.toLowerCase());
      if (!pStrip || empiezaPorVerbo(p)) return;
      // cláusula de paso (temporal/condicional) → pertenece al método, no a los ingredientes
      if (/^cuando |^hasta |^mientras |^antes de |^durante /.test(pStrip)) return;
      const palabras = pStrip.split(/[^a-z0-9]+/).filter(Boolean);
      if (!palabras.some(tk => esCifra(tk) || esMedida(tk))) return;
      // contenido: la primera tanda de palabras que no son cifra/medida/ruido
      let i0 = 0;
      while (i0 < palabras.length && (esCifra(palabras[i0]) || esMedida(palabras[i0]) || esRuido(palabras[i0]))) i0++;
      const brutos = palabras.slice(i0, i0 + 3);
      let k0 = 0;                                    // sin ruido INICIAL ("de", "la"…)
      while (k0 < brutos.length && esRuido(brutos[k0])) k0++;
      while (brutos.length && esRuido(brutos[brutos.length - 1])) brutos.pop(); // ni FINAL
      // dentro del nombre el "de" forma parte ("Pesto de albahaca"): sólo caen el resto de ruidos
      const nombre = brutos.slice(k0).filter(w => w === "de" || !esRuido(w)).join(" ");
      if (!nombre) return;
      addNombreCapturado(cap(origDe(p, nombre)), pi);
    });

    // La variante con case original se recupera de la pieza (con acentos): se localiza la secuencia
    // de palabras del nombre normalizado DENTRO de las palabras de la pieza y se usan tal cual
    // (preserva "Pimentón dulce" y quita la puntuación que arrastre, "harina," → "Harina").
    function origDe(pieza, nombreNorm) {
      const parte = nombreNorm.split(" ");
      const words = pieza.split(/\s+/).filter(Boolean);
      const normed = words.map(w => strip(w.toLowerCase()).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""));
      for (let i = 0; i + parte.length <= normed.length; i++) {
        let ok = true;
        for (let j = 0; j < parte.length; j++) {
          if (normed[i + j] !== parte[j]) { ok = false; break; }
        }
        if (ok) return words.slice(i, i + parte.length).join(" ").replace(/[;:,.]+$/, "");
      }
      return nombreNorm;
    }

    // ---- PASOS: las acciones que el usuario describe (nunca pasos inventados) ----
    const FILLER = /^(ya|entonces|después|ahora|finalmente|por último|luego|primero|empezamos|seguimos|para terminar|al final|una vez)\s+/i;
    const cleanStep = s => {
      let out = s.trim().replace(/^[-–—]\s*/, "").replace(FILLER, "").replace(/\s+/g, " ").trim();
      if (out.length < 3 || !hasVerb(out)) return "";
      out = cap(out);
      if (!/[.!?…]$/.test(out)) out += ".";
      return out;
    };
    // Frases SIN verbo que ordenan el paso: cola (tiempo/fuego tras una acción) e
    // introducción (condición previa a la acción). Hoy mismo se DESCARTABAN → perdías
    // "durante 10 minutos", "a fuego lento" y "Cuando la cebolla esté dorada, …".
    const TAIL = /^(hasta |durante |por menos |mientras |antes de |a fuego |al fuego |al horno |al bano |en horno |en el horno |en frio |caliente|sin dejar |removiendo|moviendo|con cuidado)/;
    const INTRO = /^(cuando |antes de que |despues de que |en cuanto |al terminar |al acabar |una vez |si )/;
    const method = [];
    const stepSeen = new Set();
    let pendiente = "";                          // introducción sin verbo esperando su paso
    for (const p of pieces) {
      const pStrip = strip(p.toLowerCase());
      if (!pStrip || CONN.has(pStrip)) continue;       // descarta puros conectores ("y", "y luego"…)
      // La INTRO se comprueba ANTES del verbo: "Cuando la cebolla esté dorada" contiene el
      // participio "dorada" (raíz de dorar) y daba pasos sueltos sin acción. La condición es
      // intro aunque lleve verbo dentro; se une al paso que venga después.
      if (INTRO.test(pStrip)) {
        pendiente = pendiente ? `${pendiente}, ${cap(p)}` : cap(p);
        continue;
      }
      if (!hasVerb(p)) {
        if (TAIL.test(pStrip) && method.length) {      // "durante 10 minutos" → al paso ANTERIOR
          const prev = method[method.length - 1];
          const sinPunto = prev.endsWith(".") ? prev.slice(0, -1) : prev;
          const cola = p;                              // caja original: es continuación de la frase
          method[method.length - 1] = `${sinPunto}, ${cola}` + (/[.!?…]$/.test(cola) ? "" : ".");
        }
        continue;                                      // el resto sin verbo se descarta como siempre
      }
      const c = cleanStep(p);
      if (!c) continue;
      const texto = pendiente
        ? `${pendiente}, ${lowerFirst(c.endsWith(".") ? c.slice(0, -1) : c)}` + "."
        : c;
      pendiente = "";
      const key = strip(texto.toLowerCase());
      if (stepSeen.has(key)) continue;
      stepSeen.add(key);
      method.push(`${method.length + 1}. ${texto}`);
      if (method.length >= 16) break;                  // tope 3ª gen.: 16 (antes 10: se perdían colas de recetas largas)
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

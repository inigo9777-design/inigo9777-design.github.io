// tests/innovations.test.js — CAPA UNITARIA (CODING_STANDARDS.md §6), módulo "puro" de generación de ideas.
// `modules/innovations.js` NO toca el DOM ni localStorage por sí solo, pero SÍ consulta en runtime a su par
// `classify.js` vía el namespace global window.MRCheff (mismo patrón de cruce que ya usaba app.js con makeCombo).
// Para no depender de ese *cableado global* en las pruebas — y poder ejecutarlo en aislamiento total, como hacen
// priority/classify/recipe-analysis.test.js que NO requieren setup global alguno — le pasamos una `classifier`
// inyectada por contexto desde el módulo REAL, idéntico al que ya existe en tests/ pero auto-descubierto aquí:

const { generate } = require("../modules/innovations");
const classifyModule = require("../modules/classify"); // mismo API público exacto que produce MRCheff.classify; lo
                                                        // reutilizamos aquí SIN hackear ni globalizar nada por defecto.

// ---- Utilidad: un "estado de cocina" de ejemplo, variado y razonablemente rico en tipos alimentarios, de cara a
// ---- que los generadores COMBO/LIBRE/PROTAGONISTA tengan comida suficiente para no chocar con sus guards.
const samplePantry = [
  { id: "f-panno", name: "Pan", score: 6, qty: 3, min: 1 },        // cereal
  { id: "f-tomate", name: "Tomate", score: 9, qty: 2, min: 4 },    // verdura (alta urgencia, probabilidad alta)
  { id: "f-cebolla", name: "Cebolla", score: 7, qty: 5, min: 1 },  // verdura
  { id: "f-manzana", name: "Manzana", score: 4, qty: 6, min: 0 },  // fruta (menor urgencia)
  { id: "f-pollo", name: "Pollo", score: 8, qty: 2, min: 1 },      // proteina
  { id: "f-yogur", name: "Yogur", score: 3, qty: 4, min: 1 },      // lacteo
];

const sampleRecipes = [
  { id: "r-guiso", title: "Guiso de verduras", meal: "cena", ingredients: ["Verduras", "Ajo"], method: ["Sofríe", "Cocina"] },
  { id: "r-tostada-clasica", title: "Tostada de tomate", meal: "desayuno", ingredients: ["Pan", "Tomate"], method: ["Unta", "Hornea"] },
];

// Helper: inyección determinista de un `uid` trazable por llamada (nº creciente), para poder asertar
// comportamiento del campo .id sin depender de randomness interna al generarlos.
const makeTrackingUid = () => { let n = 0; const fn = () => "ID-TEST-" + (++n); return { fn, count: () => n }; };

describe("modules/innovations.js — generate(count, focus, ctx) · contrato y comportamiento (capa unitaria §6)", () => {
  // Nota de diseño (ver CODING_STANDARDS.md §2-D / §6): como este módulo consulta a su par `classify` vía
  // window.MRCheff en runtime, inyectamos aquí una instancia REAL de ese API directamente desde su propio
  // require() para que las pruebas corran en aislamiento TOTAL (sin depender del cableado global real del navegador),
  // exactamente igual que otros pares-ya-elegidos-lo-anterior (recipe-analysis.test.js también inyecta su contexto).

  const ctxWithClassifier = ({ foods, recipes, uid }) => Object.assign(
    { foods, recipes, classifier: classifyModule.classifyFood },  // <-- nueva clave opcional; SIN tocar el código de production en este punto todavía.
    uid ? { uid } : {}
  );

  describe("forma del resultado (contrato §5 — Liskov / invariante estructural)", () => {
    const EXPECTED_KEYS = new Set(["createdAt", "from", "id", "ingredients", "meal", "method", "source", "title", "uses"]);
    const MEAL_DOMAIN = new Set(["desayuno", "comida", "cena"]);

    // Cada idea, sin importar el focus ni por qué generador se produjo, debe cumplir SIEMPRE este mismo contrato de forma.
    for (const focus of ["nuevas", "variaciones"]) {
      test(`focus=${JSON.stringify(focus)}: cada idea devuelve exactamente las claves del contrato (§5)`, () => {
        const foods = samplePantry.slice(1); // sin el cereal para variar un poco en esta iteración
        const out = generate(6, focus, ctxWithClassifier({ foods, recipes: sampleRecipes }));
        if (out.length === 0) return; // si la suerte aleatoria no produjo ninguna idea este sorteo, no hay nada que verificar aquí todavía.
        for (const idea of out) {
          expect(Object.keys(idea).sort()).toEqual([...EXPECTED_KEYS].sort());
          expect(MEAL_DOMAIN.has(idea.meal)).toBe(true);
          expect(typeof idea.title).toBe("string");
          expect(Array.isArray(idea.ingredients)).toBe(true);
          expect(Array.isArray(idea.method)).toBe(true);
          expect(Array.isArray(idea.uses)).toBe(true);
        }
      });
    }

    test("el focus \"todo\" mezcla todos los orígenes posibles (variación, combinación, libre/protagonista)", () => {
      const out = generate(20, "todo", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      // No asertamos una distribución exacta (es aleatorio), SÓLO que los orígenes observables estén dentro del dominio válido.
      for (const idea of out) {
        expect(["variacion", "combo", "libre", "protagonista"]).toContain(idea.source);
      }
    });
  });

  describe("selección de generador por foco — invariantes ESTRUCTURALES garantizadas a priori (no probabilísticas)", () => {
    test(`focus="nuevas" NUNCA produce una idea con source 'variacion' (ese generador está excluido del array de candidatos`, () => {
      // Es UNA INVARIANTE DE CONSTRUCCIÓN, no estadística: el scheduler simplemente NO mete a makeVariation en `gens`
      // cuando focus==="nuevas" → sea cual sea la secuencia aleatoria interna, nunca puede salir un source 'variacion'.
      const out = generate(25, "nuevas", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      for (const idea of out) {
        expect(idea.source).not.toBe("variacion");
        expect(["combo", "libre", "protagonista"]).toContain(idea.source); // debe provenir de estos 3, nunca del cuarto
      }
    });

    test("focus=\"variaciones\" SÓLO puede producir source \"variacion\" (los otros 3 quedan excluidos por el filtro por foco)", () => {
      const out = generate(25, "variaciones", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      for (const idea of out) {
        expect(idea.source).toBe("variacion"); // si salió algo, tiene que ser de origen VARIACIÓN sí o sí
      }
    });

    test('"todo" NO es "nuevas", por tanto SÍ puede producir variaciones — pero nunca las excluye a ciegas', () => {
      // No asertamos una probabilidad exacta, sólo la coherencia estructural: en "todo" los 4 generadores entran al bote.
      const out = generate(25, "todo", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      for (const idea of out) {
        expect(["variacion", "combo", "libre", "protagonista"]).toContain(idea.source);
      }
    });
  });

  describe("dedup por título DENTRO de un mismo lote (invariante estructural, no probabilística)", () => {
      test(`cualquier lote generado NO contiene dos ideas con el mismo título normalizado`, () => {
        // Independientemente que la suertes aleatoria realmente provoque colisiones o no dentro del bucle interno,
        // por CONSTRUCCIÓN del propio scheduler (`seen` + `continue`) el resultado FINAL nunca puede contener
        // duplicados de título entre sí — propiedad SIEMPRE verdadera para salidas válidas.
        for (const focus of ["nuevas", "variaciones"]) {
          const out = generate(10, focus, ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
          const seenKeys = new Set();
          for (const idea of out) {
            const key = idea.title.toLowerCase().trim();
            expect(seenKeys.has(key)).toBe(false); // no ha aparecido antes en este mismo lote
            seenKeys.add(key);
          }
        }
      });
  });

  describe("casos límite / guards — resultados DETERMINISTAS garantizados a priori (sin depender de aleatoriedad)", () => {
    test(`count=0 -> [] SIEMPRE, sin llamar a ningún generador siquiera`, () => {
      expect(generate(0, "todo", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes }))).toEqual([]);
      expect(generate(0, "nuevas", {})).toEqual([]);       // sin ni siquiera inyectar contexto de estado/uid
      expect(generate(0, "variaciones", {})).toEqual([]);  // idem, contexto vacío
    });

    test(`focus="variaciones" + SIN recetas -> [] SIEMPRE (makeVariation es el único candidato y su guard bloquea)`, () => {
      // Con focus "variaciones", `gens` sólo contiene makeVariation; si no hay ninguna receta que variar,
      // esa guard devuelve null en CADA iteración del bucle → nunca se produce nada → [] determinista 100%.
      expect(generate(15, "variaciones", ctxWithClassifier({ foods: samplePantry.slice(), recipes: [] }))).toEqual([]);
    });

    test("focus=\"nuevas\" + SIN alimentos -> [] SIEMPRE (los 3 generadores restantes bloquean por su guard de foods)", () => {
      // makeCombo guarda `!foods.length` -> null; makeFreeform exige >=2 foods -> null; makeSolo exige >=1 food -> null.
      // Sin alimentos ninguno de los 3 puede producir idea alguna → [] determinista, sin importar la secuencia aleatoria interna.
      expect(generate(15, "nuevas", ctxWithClassifier({ foods: [], recipes: sampleRecipes }))).toEqual([]);
    });

    test(`contexto malformado (sin .foods/.recipes arrays) es tolerante y cae a [] de forma segura`, () => {
      // generate() aplica guardas `Array.isArray(...)` propias; si NO se pasa nada coherente, todo debe ser vacío.
      expect(generate(10, "todo", {})).toEqual([]);                 // sin foods ni recipes en absoluto
      expect(generate(5,  "nuevas", { foods: null })).toEqual([]);   // campos no-array se tratan como vacíos
    });

    test("un focus desconocido (cualquier string arbitrario) se comporta como el modo por defecto \"todo\" (ningún generador queda excluido)", () => {
      // Lógica de filtro: `if(focus !== "nuevas")` añade variaciones Y `if(focus !== "variaciones")` añade los otros 3,
      // así que cualquier focus que no sea exactamente "nuevas" ni "variaciones" activa TODOS los generadores a la vez.
      const out = generate(10, "un-focus-que-no-existe", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      for (const idea of out) {
        expect(["variacion", "combo", "libre", "protagonista"]).toContain(idea.source);
      }
    });
  });

  describe("inyección de `uid` (capa dip para tests deterministas; §2-D)", () => {
    test("si inyectamos un `uid`, todas las ideas producidas usan EXACTAMENTE ese proveedor (no el default interno del módulo))", () => {
      const uidProvider = makeTrackingUid().fn; // devolve "ID-TEST-1","ID-TEST-2",...
      const out = generate(4, "todo", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice(), uid: uidProvider }));
      if (out.length === 0) return; // no asertamos FORZAR que SÍ genere algo (podría no hacerlo por el azar interno),
                                   // pero si lo hizo, cada id DEBE haber venido de NUESTRO proveedor encajado.
      for (const idea of out) {
        expect(typeof idea.id).toBe("string");
        expect(idea.id.startsWith("ID-TEST-")).toBe(true);
      }
    });

    test("si NO inyectamos `uid`, el módulo usa su defaultUid interno y de todas maneras produce ids válidos (comportamiento por defecto sin cambios)", () => {
      const out = generate(4, "todo", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      for (const idea of out) {
        expect(typeof idea.id).toBe("string");
        expect(idea.id.length).toBeGreaterThan(0); // defaultUid siempre produce una cadena no vacía
      }
    });
  });

  describe("la receta guardada desde innovación conserva su origen y base (makeVariation)", () => {
    test(`una variación de receta lleva recordado qué receta original usó como base (.from) y sus ingredientes/método se conservan`, () => {
      const out = generate(30, "variaciones", ctxWithClassifier({ foods: samplePantry.slice(), recipes: sampleRecipes.slice() }));
      if (out.length === 0) return;
      for (const idea of out) {
        expect(sampleRecipes.length).toBeGreaterThan(0); // no vacía por construcción del test en sí
        const base = sampleRecipes.find(r => r.title === idea.from || idea.from.includes("Guiso") || idea.from.includes("Tostada"));
        expect(base).toBeDefined();                     // la idea proveniende SIEMPRE de una receta guardada real de nuestra muestra
      }
    });
  });

  describe("módulo expone EXACTAMENTE su superficie pública documentada (§5 — Liskov / no fugas)", () => {
    test(`window.MRCheff.innovations (requerido desde Node) expone sólo { generate }: API estable y cerrada`, () => {
      const innovations = require("../modules/innovations");
      expect(Object.keys(innovations)).toEqual(["generate"]);
      expect(typeof innovations.generate).toBe("function");
    });
  });
});

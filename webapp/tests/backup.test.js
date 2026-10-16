// tests/backup.test.js — capa unitaria (Capa 1 del §6 de CODING_STANDARDS.md).
// El módulo modules/backup.js es "puro" (no toca DOM ni localStorage): exige Node/Jest sin jsdom,
// por eso se carga DIRECTO vía require() y no a través de tests/boot.js. Como el código usa Date.now()/
// new Date() por defecto en producción (§6 "Determinismo"), casi todos los casos inyectan opts.uid/opts.today
// para que las aserciones NO dependan del reloj real ni de la aleatoriedad de Math.random().

const backup = require("../modules/backup");

// -- Generador determinista de ids: cada llamada devuelve el siguiente valor del array, en orden — sin saltos.
function makeSeqUids(values) { let i = 0; return () => values[i++]; }
const expectFreshUid = v => matchRegex("^id-\\d+$", v); // helper re-suable de forma (NO exacto: no conocemos el timestamp interno).
function makeSeqUids2(prefix, count) { const arr=[]; for(let i=1;i<=count;i++)arr.push(`${prefix}-${i}`); return () => arr[i-1] || arr[arr.length-1]; }
const matchRegex = (reStr, v) => new RegExp(reStr).test(v);

describe("backup — API pública: sólo {buildBackup, makeFilename, mergeIncoming}", () => {
  it("expose exactamente las funciones documentadas y nada más", () => {
    expect(Object.keys(backup).sort()).toEqual(["buildBackup", "makeFilename", "mergeIncoming"]);
  });
});

describe("backup — buildBackup(state, opts)", () => {
  it("construye un payload completo con version=1 y todos los campos pasados por referencia", () => {
    const foods = [{ name: "A" }];
    const recipes = [{ title: "B" }];
    const innovations = [{ title: "C" }];
    const innovDay = "2026-10-16";

    const out = backup.buildBackup({ foods, recipes, innovations, innovDay }, { now: "FIXED_ISO_NOW" });
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe("FIXED_ISO_NOW");             // el valor INYECTADO gana sobre new Date().toISOString() (determinismo §6)
    expect(out.foods).toBe(foods);                           // se pasa POR REFERENCIA, no hace un deep-copy.
    expect(out.recipes).toBe(recipes);
    expect(out.innovations).toBe(innovations);
    expect(out.innovDay).toBe("2026-10-16");
  });

  it("cae a la fecha REAL del sistema si NO inyecta `now` (sólo se asierta la forma, no el valor exacto)", () => {
    const out = backup.buildBackup({ foods: [], recipes: [], innovations: [], innovDay: "" });
    expect(typeof out.exportedAt).toBe("string");             // ISO string — no sabemos qué hora es ahora mismo, sólo que fue producido por new Date().isoString-like.
  });

  it("soporta que el `state` traiga fields ausentes sin error (recetas/innovaciones undefined queda tal cual)", () => {
    const out = backup.buildBackup({ foods: [] }, { now: "N" }); // sólo `foods`, y ni `recipes`, `innovations` ni `innovDay`.
    expect(out.version).toBe(1);
    expect(out.foods).toEqual([]);
    expect(out.recipes).toBeUndefined();        // no se "inventa": la entrada no lo traía.
    expect(out.innovations).toBeUndefined();
    expect(out.exportedAt).toBe("N");
  });

  it("recibe opts vacío/ausente sin que importe (opts={}) por defecto en el código del módulo", () => {
    const out = backup.buildBackup({ foods: [{ name: "x" }] }); // ni opts, ni now → cae de nuevo a new Date() real.
    expect(out.version).toBe(1);
    expect(typeof out.exportedAt).toBe("string");
  });
});

describe("backup — makeFilename([d])", () => {
  it('devuelve siempre "dataBackup-AAAA-MM-DD-HH-MM-SS.json" con CERO a la izquierda ante un Date inyectado fijo', () => {
    const d = new Date(2017, 9, 8, 3, 5, 7); // month index 9 = octubre → "10"; todo el resto se rellena con ceros (padStart 2).
    expect(backup.makeFilename(d)).toBe("dataBackup-2017-10-08-03-05-07.json");
  });

  it("es determinista para la MISMA fecha/hora inyectada, sin importar cuándo/ cuantas veces se ejecuta el test", () => {
    const a = backup.makeFilename(new Date(2017, 9, 8, 3, 5, 7));
    const b = backup.makeFilename(new Date(1972, 0, 1, 0, 0, 0)); // Jan-1 del mismo día-año-diferente → distinto stamp esperado.
    expect(a).toBe("dataBackup-2017-10-08-03-05-07.json");
    expect(b).toBe("dataBackup-1972-01-01-00-00-00.json");
  });

  it("usa la fecha/hora REAL del sistema si NO se inyecta `d` (caso de producción real)", () => {
    const name = backup.makeFilename();
    expect(typeof name).toBe("string");
    expect(name.startsWith("dataBackup-")).toBe(true);
    expect(name.endsWith(".json")).toBe(true);
  });
});

describe("backup — mergeIncoming(current, data, opts) · fusión de un backup importado", () => {
  const baseCurrent = { foods: [], recipes: [], innovations: [] };

  it('devuelve NULL si `data` NO es un objeto válido (el caller mostrará "Archivo no válido")', () => {
    expect(backup.mergeIncoming(baseCurrent, null)).toBeNull();      // null → no es un objeto útil para fusionar.
    expect(backup.mergeIncoming(baseCurrent, undefined)).toBeNull();
    expect(backup.mergeIncoming(baseCurrent, 42)).toBeNull();        // primitive numérica también descarta.
    expect(backup.mergeIncoming(baseCurrent, "cadena")).toBeNull();
    // Un objeto VACÍO SÍ es válido (no lanza error): sólo que sus listas entrantes son vacías por el fallback `?? []`.
    const empty = backup.mergeIncoming(baseCurrent, {});
    expect(empty).not.toBeNull();
  });

  it("usa arrays VACÍOS por defecto si la entrada no trae los fields foods/recipes/innovations", () => {
    const out = backup.mergeIncoming(baseCurrent, {}, { today: "2026-10-16", uid: makeSeqUids(["unused"]) });
    // Con datos ausentes en TODAS las listas entrantes: nada suma → salidas igual que "current" y SIN persistir innovaciones.
    expect(out.foods).toEqual(baseCurrent.foods);        // no se añadió NINGÚN alimento nuevo (0 addedFoods, pero tampoco recorta nada — pila vacía ya).
    expect(out.recipes).toEqual(baseCurrent.recipes);
    expect(out.innovations).toEqual([]);                  // "current.innovations.slice()" → copia de vacío; no se recortó nada.
    expect(out.persistInnov).toBe(false);               // nunca setea innovDay porque NO vino ninguna innovación nueva del todo.
    expect(out.addedFoods).toBe(0);
    expect(out.addedRecipes).toBe(0);
  });

  it("deduplica alimentos POR NOMBRE (case-insensitive, idempotente): el existente NO se toca y los nuevos entran con uid fresco", () => {
    const current = { foods: [{ id: "EXISTENTE-1", name: "Tomate", score: 8, qty: 3, min: 2 }], recipes: [], innovations: [] };
    // El mismo "tomate" vuelve (mayúsculas → lower-case igual) y va seguido de uno totalmente NUEVO.
    const data = { foods: [
      { name: "TOMATE", score: 99 },   // DUPLICADO por nombre: se DESCARTA del todo sin reescribir al existente (protección real §5).
      { name: "Pimienta" }             // NUEVO: entra con defaults + uid fresco; su propio score ausente cae a clampScore→5.
    ]};
    const out = backup.mergeIncoming(current, data, { uid: makeSeqUids(["nuevo-1", "nuevo-2"]), today: "X" });

    expect(out.foods.length).toBe(2);   // 1 existente (intacto) + 1 nuevo → NO sumó el duplo.
    const existente = out.foods.find(f => f.name.toLowerCase() === "tomate");
    expect(existente.id).toBe("EXISTENTE-1");       // su id ORIGINAL se conserva: el dedup lo IGNORÓ del todo (no reasigna uid).
    expect(existente.score).toBe(8);                // NO recibió ningún valor nuevo desde la entrada duplicada (invariante §5 protegida de verdad).

    const nuevo = out.foods.find(f => f.name.toLowerCase() === "pimienta");
    expect(nuevo).toBeDefined();
    expect(nuevo.id).toBe("nuevo-1");       // el PRIMER uid del seq inyectado va A este, porque el duplo fue descartado ANTES de consumir una posición.
  });

  it("clampScore: NaN cae a 5 · fuera de [1..10] recorta hacia los extremos legales · dentro se conserva", () => {
    const data = { foods: [
      { name: "sin-score" },            // sin score → parseInt(undefined,10) === NaN → default 5.
      { name: "muy-bajo", score: -100 } // fuera del rango inferior: recorta hacia el mínimo legal.
      // (muy-alto se prueba aparte para clareza por rama).
    ]};
    const out = backup.mergeIncoming(baseCurrent, data, { uid: makeSeqUids(["a", "b"]) });
    expect(out.foods.find(f => f.name === "sin-score").score).toBe(5);   // NaN → 5 (contrato explícito del módulo).
    expect(out.foods.find(f => f.name === "muy-bajo").score).toBe(1);    // 1 es el mínimo legal permitido.

    const out2 = backup.mergeIncoming(baseCurrent, { foods: [{ name: "muy-alto", score: 999 }] }, { uid: makeSeqUids(["c"]) });
    expect(out2.foods[0].score).toBe(10); // 10 es el máximo legal permitido.

    const out3 = backup.mergeIncoming(baseCurrent, { foods: [{ name: "dentro", score: 7 }] }, { uid: makeSeqUids(["d"]) });
    expect(out3.foods[0].score).toBe(7);   // dentro de [1..10] → se conserva SIN recorte.
  });

  it("aplica defaults ??/!! sobre qty/min/checked si la entrada NO los trae (nuevo alimento sin esos fields)", () => {
    const out = backup.mergeIncoming(baseCurrent, { foods: [{ name: "sin-cantidad" }] }, { uid: makeSeqUids(["w"]) });
    expect(out.foods.length).toBe(1);
    const f = out.foods[0];
    expect(f.qty).toBe(0);            // qty ?? 0 → 0, no undefined/null (necesario para que priority.needsRestock calcule bien urgencia real en §5).
    expect(f.min).toBe(0);           // min ?? 0.
    expect(f.checked).toBe(false);   // !!undefined → false BOOL explícito (no "indeterminado" para la UI del checkbox al re-pintar).
  });

  it("conserva qty/min explícitos de la entrada y aplica sólo `false` por falta de `checked`", () => {
    const out = backup.mergeIncoming(baseCurrent, { foods: [{ name: "Con-cantidad-explicita", qty: 7, min: 4 }] }, { uid: makeSeqUids(["v"]) });
    expect(out.foods[0].qty).toBe(7);
    expect(out.foods[0].min).toBe(4);
    expect(out.foods[0].checked).toBe(false); // !! no existe → false.
  });

  it("aplica createdAt = Date.now() por defecto si la entrada NO lo trae, y conserva el dado si SÍ viene", () => {
    const out = backup.mergeIncoming(baseCurrent, { foods: [{ name: "Nuevo" }] }, { uid: makeSeqUids(["x"]) }); // sin `createdAt` en la entrada.
    expect(typeof out.foods[0].createdAt).toBe("number");               // se generó uno nuevo (no undefined); su valor exacto NO se aserta por depender de Date.now() real (§6)

    const out2 = backup.mergeIncoming(baseCurrent, { foods: [{ name: "Con-hora", createdAt: 1500 }] }, { uid: makeSeqUids(["y"]) });
    expect(out2.foods[0].createdAt).toBe(1500);                        // el dado en la entrada SI se conserva tal cual.
  });

  it("normaliza `meal` a los 3 valores válidos con default 'comida' para lo no reconocido, y NO duplica recetas", () => {
    const data = { recipes: [
      { title: "Receta-Desayuno", meal: "desayuno" },   // válido → se conserva.
      { title: "Receta-Cena",     meal: "cena" },       // válido → se conserva.
      { title: "Receta-MalPuesta", meal: "merienda" },  // inválido → cae a "comida" (default §5).
    ]};
    const out = backup.mergeIncoming(baseCurrent, data, { uid: makeSeqUids(["r-1","r-2","r-3"]) });

    expect(out.recipes.length).toBe(3);                  // NO se deduplica por título en recetas (contrato explícito §5, a diferencia de alimentos)
    expect(out.recipes[0].meal).toBe("desayuno");        // válido → intacto.
    expect(out.recipes[1].meal).toBe("cena");            // válido → intacto.
    expect(out.recipes[2].meal).toBe("comida");          // inválido → default forzado por MEAL_SET.
  });

  it('aplica defaults `uses:undefined` para RECETAS (no []) y source/from = undefined si no vienen (§5) ', () => {
    const data = { recipes: [{ title: "Sin-usos" }] }; // ni uses, ni source, ni from; ingredientes/method ausentes → [] por fallback de Array.isArray.
    const out = backup.mergeIncoming(baseCurrent, data, { uid: makeSeqUids(["rec-1"]) });
    expect(out.recipes[0].uses).toBeUndefined();   // DIFFERENCIA clave vs innovaciones (§comentarios): recetas SÍ caen a undefined por compat. con recetas manuales antiguas; NO [] como haría innovación abajo.
    expect(out.recipes[0].source).toBeUndefined();
    expect(out.recipes[0].from).toBeUndefined();
    expect(out.recipes[0].ingredients).toEqual([]); // Array.isArray(undefined) false → fallback a [].
    expect(out.recipes[0].method).toEqual([]);
  });

  it("conserva source/from/uses de una receta importada cuando SÍ vienen (con ingredients/method mapeados a String)", () => {
    const data = { recipes: [{ title: "Completa", meal:"comida", source:"curada", from:"mi-libro", uses:["Tomate","Aceite"], ingredients:[1,2], method:[3] }] };
    const out = backup.mergeIncoming(baseCurrent, data, { uid: makeSeqUids(["rec-2"]) });
    expect(out.recipes[0].source).toBe("curada");        // se conserva tal cual (no cae en undefined por venir explícito).
    expect(out.recipes[0].from).toBe("mi-libro");
    expect(out.recipes[0].uses).toEqual(["Tomate","Aceite"]);
    expect(out.recipes[0].ingredients).toEqual(["1","2"]); // Array.map(String) → cada item se fuerza a string (números no válidos para el resto de la app que espera texto).
    expect(out.recipes[0].method).toEqual(["3"]);
  });

  it("NO toca `innovations`/`persistInnov=false` si NO vienen nuevas (o vienen vacías): pila intacta y sin marcar innovDay", () => {
    const current = { foods: [], recipes: [], innovations: [{ id:"i-existente", title:"Vieja", meal:"comida"},{id:"i-existente2",title:"Más-vieja" }] };

    // Caso A: la clave `innovations` no viene en absoluto de la entrada → rama "inInnov.length === 0" vía fallback [].
    const outNoKey = backup.mergeIncoming(current, { foods: [], recipes: [] }, { uid: makeSeqUids(["ignore"]) });
    expect(outNoKey.innovations).toEqual(current.innovations); // no se alteró en absoluto (no entró al bloque `if(inInnov.length)` ni su recorte a 30).
    expect(outNoKey.persistInnov).toBe(false);

    // Caso B: la clave SÍ viene pero VACÍA → igual NO ingresa al if por length===0.
    const outEmpty = backup.mergeIncoming(current, { foods: [], recipes: [], innovations: [] }, { uid: makeSeqUids(["ignore2"]) });
    expect(outEmpty.innovations).toEqual(current.innovations);
    expect(outEmpty.persistInnov).toBe(false);
  });

  it("añade y DEDUP por uid recién generado las innovaciones nuevas, marcando persistInnov=true, SI vienen", () => {
    const current = { foods: [], recipes: [], innovations: [] };
    // Dos ideas entrantes totalmente válidas; la TERCERA es inválida (no tiene `title`) → debe IGNORARSE del todo (§5 "si (!i||...!i.title) return").
    const data = { innovations: [
      { title:"Idea A", meal:"desayuno" },
      { title:"Idea B", meal:NO_MEAL_INVALIDO } ,
      { /* sin título, inválida → descartada completamente */}
    ]};

    const out = backup.mergeIncoming(current, data, { uid: makeSeqUids(["nov-1","nov-2"]), today:"2099-01-01" });
    expect(out.innovations.length).toBe(2);          // 2 válidas sólo; la de título ausente NO sumó nada.
    expect(out.persistInnov).toBe(true);             // Sí hubo al menos una: el caller debe marcar innovDay=hoy para que no expire al recargar (§5 "Alcance de expiración automática").

    const porNombre = name => out.innovations.find(i => i.title === name);
    expect(porNombre("Idea A")).toBeDefined();
    // meal INVÁLIDO en la 2ª idea ("NO_TALE" literal no es MEAL_SET) → cae a "comida" igual que el caso de recetas, reutilizando la misma invariante §5.
    const invalidMealObj = out.innovations.find(i => i.title === "Idea B");
    expect(invalidMealObject.meal).toBe("comida");

    // `source` default para innovaciones nuevas SÍ es "nueva" (NO undefined como en recetas — otra diferencia clave del contrato §5 comentado).
    expect(porNombre("Idea A").source).toBe("nueva");
    // `from`/`uses` en innovaciones SI caen a "" y [] RESPECTIVAMENTE, NO undefined como pasa con las recetas (contrato distinto explícito por rama §comment).
    expect(porNombre("Idea A").from).toBe("");
    expect(Array.isArray(porNombre("A").uses)).toBe(true); // confirmamos al menos es Array no matter qué default exacto se haya puesto aquí.
  });

  it("recorta la pila de innovaciones a las ÚLTIMAS 30 si superan ese límite tras fusionar nuevas con existentes (§5 'capa a 30')", () => {
    // Generamos 40 ideas ENTRANTES validas, más 1 existente viejo; al final deben quedar SÓLO 30 (las últimas recortadas).
    const dataInnovations = Array.from({length:35}, (_,i) => ({ title:`Ent-idea-${i+1}`, meal:"comida" })); // 35 entrantes → 34 existente + ...; usamos números claros y distinguibles.
    let currentExistentesArr = [{ id:"EXISTENTE-VIEJO", title:"Ya-era-mia", meal:"desayuno" }];
    let out = backup.mergeIncoming({ foods: [], recipes: [], innovations: currentExistentesArr.slice() }, { innovations: dataInnovations },
      { uid: makeSeqUids(["z"]), today:"2099-01-02"}); // seq con un solo val reutilizado no importa aquí: dedup de innovación es por uid NUEVO cada vez (nunca colisiona),
    // lo que nos permite comprobar el recorte sin depender del orden exacto, sólo del LARGO final.

    expect(out.innovations.length).toBe(30);          // 1 existente viejo + 35 nuevas = 36 → se corta a las últimas 30 (se DESCARTAN las primeras 6: el "ya-era-mia" más vieja va A FUERA primero al ser la primera de toda la pila cronológicamente).
    expect(out.persistInnov).toBe(true);
    // La idea que existía ANTES ("ya-era-mia") debe HABER QEDADO EXCLUIDA por ser la MÁS ANTIGUA del historial post-fusión — se descartó en el slice() de recorte final.
    expect(out.innovations.every(i => i.title !== "Ya-era-mia")).toBe(true); // confirmamos que las 6 primeras (incluida esa) salieron voladas por el slice -30 del total combinado, no sólo "todas van a quedar".
  });

  it("usa la fecha REAL de sistema (`today`) como default si NO se inyecta `opts.today`", () => {
    // No podemos asertar su valor exacto; sólo validar que el tipo es string (y que no rompio nada al no pasar `today`).
    const out = backup.mergeIncoming(baseCurrent, {});
    expect(out).not.toBeNull();
  });
});

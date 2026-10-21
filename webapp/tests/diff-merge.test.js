// tests/diff-merge.test.js — Capa 1 (unitaria §6 CODING_STANDARDS.md) para modules/diff-merge.js.
// Talla de los casos del plan-sync-buzon.md (§8 FASE 4): sólo-A / sólo-B, ortogonales (pasos 2 y 6),
// MISMA-LÍNEA-editada-distinta (el caso de la sesión), inserción+edición en zonas distintas,
// reordenación, listas de longitud distinta, UTF-8/tildes, LWW del primer sync y el resolver.
// Módulo puro (sin DOM ni red): require() directo.

const dmerge = require("../modules/diff-merge");

// fixtures mínimos
const recetaBase = () => ({
  id: "rec-1", title: "Tortilla", meal: "comida",
  ingredients: ["Huevos", "Patata", "Cebolla"],
  method: ["Batir huevos", "Sofreír patata", "Mezclar todo", "Cuajar a fuego bajo"],
  createdAt: 1000
});

describe("diff-merge — listDiff3: listas de strings (ingredients/method)", () => {
  it("ZONAS ORTOGONALES se auto-fusionan: A edita el paso 2 y B edita el paso 6 de la misma receta", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { method: ["Batir huevos", "Sofreír patata CUBIERTA", "Mezclar todo", "Cuajar a fuego bajo"] })] };
    const suyo = { recipes: [Object.assign({}, recetaBase(), { method: ["Batir huevos", "Sofreír patata", "Mezclar todo", "Cuajar a fuego MUY bajo"] })] };
    const r = dmerge.merge3(base, mio, suyo);

    // ambos cambios SIN CONFLICTO: cada uno editó una zona distinta
    expect(r.conflictos.length).toBe(0);
    expect(r.estado.recipes[0].method).toEqual([
      "Batir huevos", "Sofreír patata CUBIERTA", "Mezclar todo", "Cuajar a fuego MUY bajo"
    ]);
  });

  it("SÓLO-A / SÓLO-B: un lado que no tocó la lista no afecta (gana el que cambió)", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [recetaBase()] };                              // no cambió nada
    const suyo = { recipes: [Object.assign({}, recetaBase(), { ingredients: ["Huevos", "Patata", "Cebolla", "Puerro"] })] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(0);
    expect(r.estado.recipes[0].ingredients).toEqual(["Huevos", "Patata", "Cebolla", "Puerro"]);
  });

  it("MISMA-LÍNEA-editada-distinta (el caso de la sesión): conflicto declarado con las DOS versiones", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { method: ["Batir huevos CON sal", "Sofreír patata", "Mezclar todo", "Cuajar a fuego bajo"] })] };
    const suyo = { recipes: [Object.assign({}, recetaBase(), { method: ["Batir huevos SIN sal", "Sofreír patata", "Mezclar todo", "Cuajar a fuego bajo"] })] };
    const r = dmerge.merge3(base, mio, suyo);

    // el conflicto ES de lista sobre method y conserva TEXTO: local y remota (nada se descarta)
    expect(r.conflictos.length).toBe(1);
    expect(r.conflictos[0].tipo).toBe("lista");
    expect(r.conflictos[0].campo).toBe("method");
    expect(r.conflictos[0].recetaId).toBe("rec-1");
    expect(r.conflictos[0].local).toEqual(["Batir huevos CON sal"]);
    expect(r.conflictos[0].remota).toEqual(["Batir huevos SIN sal"]);
    // el texto de ninguna parte ha desaparecido
    expect(JSON.stringify(r.conflictos)).toContain("CON sal");
    expect(JSON.stringify(r.conflictos)).toContain("SIN sal");
  });

  it("inserción + edición en zonas DISTINTAS se auto-fusionan", () => {
    const base = { recipes: [recetaBase()] };
    // A añade un paso al principio; B añade un ingrediente al final
    const mio = { recipes: [Object.assign({}, recetaBase(), { method: ["Bater Asado", "Batir huevos", "Sofreír patata", "Mezclar todo", "Cuajar a fuego bajo"] })] };
    const suyo = { recipes: [Object.assign({}, recetaBase(), { ingredients: ["Huevos", "Patata", "Cebolla", "Jamón"] })] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(0);
    const receta = r.estado.recipes[0];
    expect(receta.method[0]).toBe("Bater Asado");
    expect(receta.ingredients).toEqual(["Huevos", "Patata", "Cebolla", "Jamón"]);
  });

  it("REORDENACIÓN de la lista de un lado solo: el reordenado gana (sin conflictos)", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { method: ["Cuajar a fuego bajo", "Mezclar todo", "Sofreír patata", "Batir huevos"] })] };
    const suyo = { recipes: [recetaBase()] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(0);
    expect(r.estado.recipes[0].method).toEqual([
      "Cuajar a fuego bajo", "Mezclar todo", "Sofreír patata", "Batir huevos"
    ]);
  });

  it("listas de LONGITUD DISTINTA sin conflictos (inserción/borrado por una parte) incluyendo listas vacías", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { ingredients: [] })] };       // borrado del todo
    const suyo = { recipes: [recetaBase()] };                                              // no tocó ingredients
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(0);
    expect(r.estado.recipes[0].ingredients).toEqual([]);   // el borrado de A gana (sin base-tombstone, §4 caso borde)
  });

  it("UTF-8 y tildes: la fusión funciona con texto acentuado completo en las listas (sin mangles)", () => {
    const base = { recipes: [Object.assign({}, recetaBase(),
      { method: ["Bate con ñapa", "Fríe el pimiento bravo", "Sazona la chirla"] })] };
    const mio = { recipes: [Object.assign({}, base.recipes[0], { method: ["Bate con ñapa", "Fríe el pimiento bravo", "Sazona la chirla TRES VESES?"] })] };
    const suyo = { recipes: [Object.assign({}, base.recipes[0], { method: ["Bate con ñapa", "Fríe el pimiento bravo", "Sazona la chirla TRES VECES"] })] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(1);              // la misma línea (3ª) con texto distinto: conflicto
    expect(r.estado.recipes[0].method[2]).toBe("Sazona la chirla TRES VESES?");   // provisional LOCAL sin cambios
  });
});

describe("diff-merge — escalares de receta", () => {
  it("CON base: sólo un lado cambió el título → ese valor gana; ambos al mismo → indiferente", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { title: "Tortilla gallega" })] };
    const suyo = { recipes: [recetaBase()] };
    expect(dmerge.merge3(base, mio, suyo).estado.recipes[0].title).toBe("Tortilla gallega");

    const simetricos = dmerge.merge3({ recipes: [recetaBase()] },
      { recipes: [Object.assign({}, recetaBase(), { title: "Tortilla de ambos" })] },
      { recipes: [Object.assign({}, recetaBase(), { title: "Tortilla de ambos" })] });
    expect(simetricos.estado.recipes[0].title).toBe("Tortilla de ambos");
  });

  it("CON base: ambos cambiaron el MISMO campo distinto → conflicto BLOQUEANTE que para el protocolo", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { title: "Tortilla movil" })] };
    const suyo = { recipes: [Object.assign({}, recetaBase(), { title: "Tortilla pc" })] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(1);
    expect(r.conflictos[0].tipo).toBe("campo");
    expect(r.conflictos[0].campo).toBe("title");
    expect(r.conflictos[0].local).toBe("Tortilla movil");
    expect(r.conflictos[0].remota).toBe("Tortilla pc");
    expect(r.estado.recipes[0].title).toBe("Tortilla movil");          // provisional, resuelve el usuario
  });

  it("uid PRESERVADO en la receta fusionada (identidad estable, FASE 1)", () => {
    const base = { recipes: [recetaBase()] };
    const mio = { recipes: [Object.assign({}, recetaBase(), { title: "Edited en movil" })] };
    const suyo = { recipes: [Object.assign({}, recetaBase(), { title: "Edited en pc" })] };
    // conflicto de title… pero el ID no se duplica ni se re-emi: la receta única conserva "rec-1"
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.estado.recipes.length).toBe(1);
    expect(r.estado.recipes[0].id).toBe("rec-1");
  });
});

describe("diff-merge — recetas LEGACY sin id fiable (fingerprint de ingredientes, FASE 1)", () => {
  it("mismos ingredientes (acentos/orden distintos) = MISMA identidad aunque los uids difieran", () => {
    const local = { id: "local-legacy", title: "Tortilla", ingredients: ["Huevos", "Patata"], method: ["Batir"] };
    const entrada = { id: "otro-uid-navegador", title: "Tortilla", ingredients: ["patata", "huevos"], method: ["Batir"] };
    const r = dmerge.merge3(null, { recipes: [local] }, { recipes: [entrada] });
    // sin base: la única receta se fusiona por fingerprint (NO entra duplicada); el id LOCAL es el canónico
    expect(r.estado.recipes.length).toBe(1);
    expect(r.estado.recipes[0].id).toBe("local-legacy");
  });

  it("dos recetas de hecho diferentes (ingrediente distinto) NO comparten identidad", () => {
    const r = dmerge.merge3(null,
      { recipes: [{ id: "a", title: "A", ingredients: ["Arroz"] }] },
      { recipes: [{ id: "b", title: "B", ingredients: ["Pimentón"] }] });
    expect(r.estado.recipes.length).toBe(2);
  });
});

describe("diff-merge — primer sync SIN base (fallback honesto del plan §4)", () => {
  it("escalares en conflicto: LWW por editedAt con AVISO no bloqueante (la perdedora no se descarta)", () => {
    const adelantado = Object.assign({}, recetaBase(), { title: "Edición más nueva", editedAt: "2026-10-19T12:00:00.000Z" });
    const atrasado = Object.assign({}, recetaBase(), { title: "Edición más vieja", editedAt: "2026-10-19T10:00:00.000Z" });
    const r = dmerge.merge3(null, { recipes: [adelantado] }, { recipes: [atrasado] });
    expect(r.conflictos.length).toBe(0);                 // NO bloquea el protocolo del primer sync
    expect(r.avisos.length).toBe(1);
    expect(r.avisos[0].autoResuelto).toBe(true);
    expect(r.avisos[0].elegida).toBe("local");
    expect(r.avisos[0].remota).toBe("Edición más vieja");           // la perdedora viaja al resolver
    expect(r.estado.recipes[0].title).toBe("Edición más nueva");
  });

  it("LWW al revés: gana la REMOTA si su editedAt es más nuevo (y el aviso lo dice)", () => {
    const vieja = Object.assign({}, recetaBase(), { title: "Vieja", editedAt: "2026-10-19T08:00:00.000Z" });
    const nueva = Object.assign({}, recetaBase(), { title: "Nueva", editedAt: "2026-10-19T14:00:00.000Z" });
    const r = dmerge.merge3(null, { recipes: [vieja] }, { recipes: [nueva] });
    expect(r.estado.recipes[0].title).toBe("Nueva");
    expect(r.avisos[0].elegida).toBe("remota");
  });

  it("escalares en conflicto SIN editedAt en ningún lado: conflicto bloqueante (no se puede LWW honesto)", () => {
    const r = dmerge.merge3(null,
      { recipes: [{ id: "x", title: "Pruebas A" }] },
      { recipes: [{ id: "x", title: "Pruebas B" }] });
    expect(r.conflictos.length).toBe(1);
    expect(r.estado.recipes[0].title).toBe("Pruebas A");          // provisional
  });

  it("listas SIN base en conflicto: UNION honesta (nada se pierde) + aviso no bloqueante", () => {
    const base = null;
    const mio = { recipes: [{ id: "x", title: "Receta", ingredients: ["Pan", "Tomate"], method: ["Al fuego"] }] };
    const suyo = { recipes: [{ id: "x", title: "Receta", ingredients: ["Pan", "Aceite"], method: ["En salteado"] }] };
    const r = dmerge.merge3(base, mio, suyo);
    expect(r.conflictos.length).toBe(0);                 // no bloquea
    expect(r.avisos.some(a => a.tipo === "lista-union" && a.campo === "ingredients")).toBe(true);
    expect(JSON.stringify(r.avisos)).toContain("Tomate");
    expect(JSON.stringify(r.avisos)).toContain("Aceite");
    // la lista fusionada contiene texto de ambos lados (unión)
    const lista = r.estado.recipes[0].ingredients;
    expect(lista.filter(t => t === "Pan").length).toBe(2);   // el "Pan" de cada lado coexiste (unión literal)
  });
});

describe("diff-merge — foods / cooked / innovations / weekmenu (unión por identidad)", () => {
  it("foods: se fusionan por nombre; el LOCAL tiene prioridad si ambos cambiaron", () => {
    const r = dmerge.merge3(
      { foods: [{ name: "Tomate", score: 5, qty: 2 }] },
      { foods: [{ name: "Tomate", score: 8, qty: 4 }, { name: "Cebolla", score: 3, qty: 1 }] },
      { foods: [{ name: "Tomate", score: 6, qty: 7 }] }
    );
    const tomate = r.estado.foods.find(f => f.name === "Tomate");
    expect(tomate.qty).toBe(4);       // el LOCAL gana cuando ambos cambiaron (fuente de verdad local)
    expect(r.estado.foods.some(f => f.name === "Cebolla")).toBe(true);   // nueva en mio: entra
  });

  it("cooked: el MISMO plato cocinado el MISMO día no se duplica; el otro día entra", () => {
    const r = dmerge.merge3(
      { cooked: [{ id: "c1", title: "T", keyFingerprint: "fp", on: "2026-10-19" }] },
      { cooked: [{ id: "c1", title: "T", keyFingerprint: "fp", on: "2026-10-19" }] },
      { cooked: [{ id: "c2", title: "T", keyFingerprint: "fp", on: "2026-10-25" }] }
    );
    expect(r.estado.cooked.length).toBe(2);
  });

  it("weekmenu: LWW por generatedOn cuando ambos tienen plan distinto sin base", () => {
    const local = { approved: true, generatedOn: "2026-10-20", plan: [1] };
    const remota = { approved: true, generatedOn: "2026-10-21", plan: [2] };
    expect(dmerge.merge3(null, { weekmenu: local }, { weekmenu: remota }).estado.weekmenu).toBe(remota);
    expect(dmerge.merge3(null, { weekmenu: remota }, { weekmenu: local }).estado.weekmenu).toBe(remota);   // más nuevo SIEMPRE
  });

  it("weekmenu REGLA del transporte (2026-10-21): el preview no aprobado NO participa del merge (se trata como ausencia)", () => {
    const aprobada = { approved: true, generatedOn: "2026-10-21", plan: [1], needyFoods: [{ name: "Leche" }] };
    const preview = { approved: false, generatedOn: "2026-10-21", plan: [2] };

    // el plan aprobado de UNO solo impone aunque el otro traiga un preview más "nuevo"
    expect(dmerge.merge3(null, { weekmenu: aprobada }, { weekmenu: preview }).estado.weekmenu).toBe(aprobada);
    expect(dmerge.merge3(null, { weekmenu: preview }, { weekmenu: aprobada }).estado.weekmenu).toBe(aprobada);

    // una BASE antigua que hubiese guardado un preview no lo resucita
    expect(dmerge.merge3({ weekmenu: preview }, { weekmenu: null }, { weekmenu: null }).estado.weekmenu).toBeNull();
    expect(dmerge.merge3({ weekmenu: preview }, { weekmenu: {} }, { weekmenu: undefined }).estado.weekmenu).toBeNull();
  });

  it("receta borrada en AMBOS lados desaparece; borrada en UNO solo se RESUCITA (caso borde §4 documentado)", () => {
    const base = { recipes: [recetaBase()] };
    const ambosBorrados = dmerge.merge3(base, { recipes: [] }, { recipes: [] });
    expect(ambosBorrados.estado.recipes.length).toBe(0);

    const soloUno = dmerge.merge3(base, { recipes: [] }, { recipes: [recetaBase()] });
    expect(soloUno.estado.recipes.length).toBe(1);        // la copia viva gana (resucita)
  });
});

describe("diff-merge — aplicarResoluciones (el modal §5)", () => {
  const estadoProvisional = {
    recipes: [{ id: "rec-1", title: "Tortilla movil", ingredients: ["Huevos"], method: ["Paso movil"], createdAt: 1000 }]
  };
  const estadoSuyo = {
    recipes: [{ id: "rec-1", title: "Tortilla pc", ingredients: ["Huevos", "Cebolla"], method: ["Paso pc"], createdAt: 1000 }]
  };

  it("decision LOCAL: el provisional ya lleva la versión local → nada que mover", () => {
    const r = dmerge.aplicarResoluciones(estadoProvisional, estadoSuyo, [{ recetaId: "rec-1", decision: "local" }]);
    expect(r.recipes[0].title).toBe("Tortilla movil");
    expect(r.recipes.length).toBe(1);
  });

  it("decision REMOTA: el PC adopta la versión del otro dispositivo INTEGRO", () => {
    const r = dmerge.aplicarResoluciones(estadoProvisional, estadoSuyo, [{ recetaId: "rec-1", decision: "remota" }]);
    expect(r.recipes[0].title).toBe("Tortilla pc");
    expect(r.recipes[0].method).toEqual(["Paso pc"]);
    expect(r.recipes[0].id).toBe("rec-1");
    expect(r.recipes.length).toBe(1);
  });

  it("decision AMBAS: la copia del otro entra con uid NUEVO + marca 'duplicada' (limpieza manual, §5)", () => {
    const r = dmerge.aplicarResoluciones(estadoProvisional, estadoSuyo,
      [{ recetaId: "rec-1", decision: "ambas" }], { uid: () => "uid-copia-9" });
    expect(r.recipes.length).toBe(2);
    expect(r.recipes[0].title).toBe("Tortilla movil");        // la local sigue
    expect(r.recipes[1].title).toBe("Tortilla pc");
    expect(r.recipes[1].id).toBe("uid-copia-9");              // id NUEVO (nada re-emite el de la local)
    expect(r.recipes[1].duplicada).toBe(true);
  });

  it("elección de una receta NO tocada en el resolver no rompe nada (defensa, identidad no encontrada)", () => {
    const r = dmerge.aplicarResoluciones(estadoProvisional, estadoSuyo, [{ recetaId: "no-existe", decision: "remota" }]);
    expect(r.recipes.length).toBe(1);
    expect(r.recipes[0].title).toBe("Tortilla movil");
  });
});

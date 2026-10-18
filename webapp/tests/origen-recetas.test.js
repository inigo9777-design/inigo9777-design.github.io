// tests/origen-recetas.test.js — modules/origen-recetas.js: etiqueta de ORIGEN (Española/Italiana) para
// el catálogo curado (feature 2026-10-18). La UI la pinta en TODAS las vistas de recetas (Recetas,
// Innovación, Sugerencias, Menú, modal); aquí se testea la DECISIÓN pura, no el molde HTML.
const dataset = require("../data/recetas-espanolas-data.js");
const origen = require("../modules/origen-recetas.js");

// Contexto inyectado (§3.7/§8: mismo patrón de inyección que el resto de módulos puros — nada de window en Jest).
const ctx = { catalog: dataset, ids: dataset.idsItalianas };

describe("(1) Contrato del módulo y de los datos de origen", () => {
  it("exporta exactamente 2 funciones públicas: esItaliana y etiquetaOrigen", () => {
    expect(Object.keys(origen).sort()).toEqual(["esItaliana", "etiquetaOrigen"]);
  });

  it("dataset.idsItalianas: 20 ids curados, TODAS presentes en el catálogo y sin duplicados", () => {
    const ids = dataset.idsItalianas || [];
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    const idsCatalogo = new Set(dataset.map(r => r.id));
    ids.forEach(id => expect(idsCatalogo.has(id)).toBe(true));
  });
});

describe("(2) Detección por id directo (registros del catálogo)", () => {
  it("una receta italiana del catálogo → true / 'Receta italiana'", () => {
    const it = dataset.find(r => r.id === "tiramisu-casero");
    expect(origen.esItaliana(it, ctx)).toBe(true);
    expect(origen.etiquetaOrigen(it, ctx)).toBe("Receta italiana");
  });

  it("una receta española del catálogo → false / 'Receta española'", () => {
    const es = dataset.find(r => r.id === "tostada-tomate-ajo");
    expect(origen.esItaliana(es, ctx)).toBe(false);
    expect(origen.etiquetaOrigen(es, ctx)).toBe("Receta española");
  });
});

describe("(3) Detección por título normalizado (ideas/sugerencias: el id es un uid NUEVO, NO el del catálogo)", () => {
  it("idea de Innovación con uid propio y título italiano → 'Receta italiana'", () => {
    const idea = { id: "uid-generado-123", title: "Tiramisú casero", meal: "cena", ingredients: [], method: [], source: "curada" };
    expect(origen.esItaliana(idea, ctx)).toBe(true);
    expect(origen.etiquetaOrigen(idea, ctx)).toBe("Receta italiana");
  });

  it("sugerencia del planner con uid propio y título español → 'Receta española'", () => {
    const idea = { id: "uid-generado-456", title: "Tostada de tomate y ajo", meal: "desayuno", ingredients: [], method: [], source: "receta_sugerida" };
    expect(origen.esItaliana(idea, ctx)).toBe(false);
    expect(origen.etiquetaOrigen(idea, ctx)).toBe("Receta española");
  });

  it("INVARIANZA a acentos/mayúsculas/espacios: ni 'ñoquis' ni mayúsculas ni espacios dobles rompen la detección", () => {
    expect(origen.esItaliana({ id: "x", title: "ñoquis con tomate y albahaca" }, ctx)).toBe(true);   // Ñ + sin acento
    expect(origen.esItaliana({ id: "x", title: "OSSO BUCO A LA MILANESA" }, ctx)).toBe(true);        // mayúsculas
    expect(origen.esItaliana({ id: "x", title: "  Risotto   de setas  " }, ctx)).toBe(true);          // espacios
    // y el espejo español sigue detectándose con acentos en sentido contrario:
    expect(origen.esItaliana({ id: "x", title: "bacalao a la vizcaina" }, ctx)).toBe(false);
  });
});

describe("(4) Ruta de los platos guardados del usuario (Mis Recetas)", () => {
  it("receta guardada desde la estrella (uid propio, título italiano) → italiana", () => {
    const guardada = { id: "uid-778", title: "Pasta alla norma", meal: "comida", ingredients: ["Pasta"], method: [], createdAt: Date.now() };
    expect(origen.etiquetaOrigen(guardada, ctx)).toBe("Receta italiana");
  });

  it("receta de usuario manual/desconocida → española (comportamiento previo intacto)", () => {
    const manual = { id: "uid-779", title: "Mi guiso casero", meal: "cena", ingredients: [], method: [] };
    expect(origen.etiquetaOrigen(manual, ctx)).toBe("Receta española");
  });
});

describe("(4b) SELLO del origen al guardar (feature editor 2026-10-18): el campo `origen` persistido GANA", () => {
  it("copia RENOMBRADA desde una idea italiana guarda origen:'italiana' → sigue italiana aunque el título ya no matchee", () => {
    const renombrada = { id: "uid-900", title: "Pizza jamón y queso casera", meal: "cena", origen: "italiana" };
    expect(origen.esItaliana(renombrada, ctx)).toBe(true);
    expect(origen.etiquetaOrigen(renombrada, ctx)).toBe("Receta italiana");
  });

  it("el sello español ('espanola' o 'española') mantiene española aunque el TÍTULO parezca italiano", () => {
    expect(origen.etiquetaOrigen({ title: "Pasta alla norma", origen: "espanola" }, ctx)).toBe("Receta española");
    expect(origen.etiquetaOrigen({ title: "Tiramisú casero", origen: "española" }, ctx)).toBe("Receta española");
  });

  it("el sello gana SIEMPRE, incluso sobre un registro del catálogo (defensa contra sello contradictorio a mano)", () => {
    // registro del dataset cuya copia en Mis Recetas quedó sellada distinto: el sello manda (señal más explícita)
    const it = dataset.find(r => r.id === "tiramisu-casero");
    expect(origen.etiquetaOrigen({ ...it, origen: "espanola" }, ctx)).toBe("Receta española");
    // …y sellado correcto sobre receta de título español → italiana
    expect(origen.etiquetaOrigen({ title: "Tostada de tomate y ajo", origen: "italiana" }, ctx)).toBe("Receta italiana");
  });
});

describe("(5) Degradación / resolución global (la vía de PRODUCCIÓN es window.MRCheff, misma que el navegador)", () => {
  it("sin ctx → resuelve del namespace global cargado por el harness (window.MRCheff.recetasEspanolas) → italiana", () => {
    // En el navegador real el orden de index.html (data → origen-recetas.js) deja el ns lleno ANTES de pintar;
    // en este harness ocurre lo mismo, así que sin ctx la decisión sale del global — es la vía de producción.
    expect(origen.esItaliana({ id: "tiramisu-casero", title: "Tiramisú casero" }, undefined)).toBe(true);
    expect(origen.etiquetaOrigen({ id: "tiramisu-casero", title: "Tiramisú casero" }, undefined)).toBe("Receta italiana");
  });

  it("ctx vacío COMPLETO (catalog/ids arrays vacíos) → española sin lanzar; receta rota → española", () => {
    expect(origen.etiquetaOrigen({ title: "Tiramisú casero" }, { catalog: [], ids: [] })).toBe("Receta española");
    expect(origen.etiquetaOrigen(null, ctx)).toBe("Receta española");     // receta rota/recibida a medias
    expect(origen.etiquetaOrigen({ title: "Tiramisú casero" }, { catalog: dataset, ids: [] })).toBe("Receta española"); // catalog pero ids vacíos
  });
});

// Specs del módulo puro modules/fotos-recetas.js (feature imagenes-recetas-cards, 2026-10-22):
// foto REAL de la card por id del catálogo o por TÍTULO normalizado (copias con uid); fuera de
// ahí, null = placeholder del diseño. Ctx inyectado (§3.7): { fotos, catalogo, rutaBase }.
const CAT = [
  { id: "croquetas-jamon", title: "Croquetas de jamón ibérico", meal: "comida" },
  { id: "tiramisu-casero", title: "Tiramisú casero", meal: "cena" },
  { id: "arroz-leche", title: "Arroz con leche clásico", meal: "desayuno" },
];
const FOTOS = ["croquetas-jamon", "tiramisu-casero"];          // arroz-leche SIN foto en el repo

const fr = require("../modules/fotos-recetas.js");
const ctx = { fotos: FOTOS, catalogo: CAT };

describe("fotoDe: la receta que CONSERVA el id del catálogo", () => {
  test("id con foto → la ruta del jpg con la base inyectada", () => {
    expect(fr.fotoDe({ id: "croquetas-jamon", title: "Croquetas de jamón ibérico" }, ctx))
      .toBe("img/recetas/croquetas-jamon.jpg");
  });

  test("id del catálogo SIN foto en el repo → null (placeholder)", () => {
    expect(fr.fotoDe({ id: "arroz-leche", title: "Arroz con leche clásico" }, ctx)).toBeNull();
  });

  test("un id PROPIO (uid de Mis Recetas/idea) NO puede hacerse pasar por foto", () => {
    // id que suena a dato pero no está en el catálogo → ni caso: el id sólo manda si es del catálogo.
    expect(fr.fotoDe({ id: "croquetas-jamon-copia", title: "Otra cosa" }, ctx)).toBeNull();
  });
});

describe("fotoDe: la COPIA con uid se resuelve por TÍTULO normalizado", () => {
  test("título con acentos/sigue la pauta del normTitulo de origen-recetas (NFD, sin combining marks)", () => {
    // La copia guardada de Innovación lleva su uid; el título decía "Tiramisú casero" con acento.
    expect(fr.fotoDe({ id: "idea-9", title: "Tiramisú casero" }, ctx))
      .toBe("img/recetas/tiramisu-casero.jpg");
    // Y sin acento igual: el normalizador se lleva las variantes a la misma llave.
    expect(fr.fotoDe({ id: "idea-7", title: "tiramiSU caseRO" }, ctx))
      .toBe("img/recetas/tiramisu-casero.jpg");
  });

  test("título bautizado a mano pero RECONOCIBLE («Mis croquetas de la abuela») hereda la foto del primo", () => {
    // Peticición del usuario: si no hay foto exacta, una PARECIDA manda — un token propio
    // del plato («croquetas», 9 letras) casa la copia renombrada con su primo visual.
    expect(fr.fotoDe({ id: "r-1", title: "Mis croquetas de la abuela" }, ctx))
      .toBe("img/recetas/croquetas-jamon.jpg");
  });

  test("copia renombrada CON el turno de comida pegado («· Comida») casa igual con el catálogo", () => {
    // Copia de Mis Recetas guardada con el turno pegado al título: se recorta antes de comparar.
    expect(fr.fotoDe({ id: "copia-1", title: "Croquetas de jamón ibérico · Comida" }, ctx))
      .toBe("img/recetas/croquetas-jamon.jpg");
  });
});

describe("fotoDe: renombre del usuario que NO calca el título (candidata por tokens)", () => {
  const CAT2 = [
    { id: "pulpo-gallaecia", title: "Pulpo à la gallega" },
    { id: "arroz-a-banda", title: "Arroz a banda" },
  ];
  const FOTOS2 = ["pulpo-gallaecia", "arroz-a-banda"];

  test("un token compartido PROPIO del plato (5+ letras) basta para casar el primo visual", () => {
    // "Pulpo á feira" no calca "Pulpo à la gallega", pero sí comparte "pulpo".
    expect(fr.fotoDe({ id: "uid-p", title: "Pulpo á feira" }, { fotos: FOTOS2, catalogo: CAT2 }))
      .toBe("img/recetas/pulpo-gallaecia.jpg");
  });

  test("dos o más tokens compartidos mandan (p. ej. costilla renombrada «…antigua»)", () => {
    const cat3 = [
      { id: "costilla-miel-mostaza", title: "Costilla de cerdo con miel y mostaza antigua" },
      { id: "croquetas-jamon", title: "Croquetas de jamón ibérico" },
    ];
    expect(fr.fotoDe({ id: "uid-c", title: "Costilla de cerdo con Miel y mostaza · Comida" },
      { fotos: ["costilla-miel-mostaza"], catalogo: cat3 }))
      .toBe("img/recetas/costilla-miel-mostaza.jpg");
  });

  test("empate de tokens entre dos candidatos → null (se no se atina a una distorsionada)", () => {
    const empate = [
      { id: "arroz-negro", title: "Arroz negro" },
      { id: "arroz-banda", title: "Arroz a banda" },
    ];
    expect(fr.fotoDe({ id: "uid-a", title: "Arroz de la abuela" },
      { fotos: ["arroz-negro", "arroz-banda"], catalogo: empate }))
      .toBeNull();
  });

  test("sin tokens de 3+ letras no se intenta el fuzzy", () => {
    expect(fr.fotoDe({ id: "uid-x", title: "De la abuela" }, { fotos: FOTOS2, catalogo: CAT2 })).toBeNull();
  });
});

describe("edge cases de ctx y de receta", () => {
  test("sin módulo de fotos en el índice (fotos: []) todo va a placeholder", () => {
    expect(fr.fotoDe({ id: "croquetas-jamon", title: "Croquetas de jamón ibérico" }, { fotos: [], catalogo: CAT })).toBeNull();
  });

  test("sin catálogo NO casan ids ni títulos (candidatura vacía)", () => {
    expect(fr.fotoDe({ id: "croquetas-jamon", title: "Croquetas de jamón ibérico" }, { fotos: FOTOS, catalogo: [] })).toBeNull();
  });

  test("receta ausente / rara → null, nunca lanza", () => {
    expect(fr.fotoDe(null, ctx)).toBeNull();
    expect(fr.fotoDe({}, ctx)).toBeNull();
  });

  test("rutaBase inyectable (otra carpeta servida)", () => {
    expect(fr.fotoDe({ id: "tiramisu-casero", title: "Tiramisú casero" }, { ...ctx, rutaBase: "otro-rumbo/" }))
      .toBe("otro-rumbo/tiramisu-casero.jpg");
  });
});

describe("ctx por defecto: el namespace window.MRCheff (la app llana sin inyección)", () => {
  // Con require fresco (jest.resetModules) para que la factory relea el namespace CORRIENTE.
  test("sin ctx procura fotos Y catálogo del namespace y usa la base por defecto", () => {
    jest.resetModules();
    window.MRCheff = { recetasEspanolas: CAT, fotosRecetas: FOTOS };
    const frNs = require("../modules/fotos-recetas.js");
    expect(frNs.fotoDe({ id: "croquetas-jamon", title: "Croquetas de jamón ibérico" }))
      .toBe("img/recetas/croquetas-jamon.jpg");
  });

  test("inyección PARCIAL: catálogo a mano, fotos del namespace", () => {
    jest.resetModules();
    window.MRCheff = { fotosRecetas: FOTOS };
    const frNs = require("../modules/fotos-recetas.js");
    expect(frNs.fotoDe({ id: "idea-3", title: "Tiramisú casero" }, { catalogo: CAT }))
      .toBe("img/recetas/tiramisu-casero.jpg");
  });
});

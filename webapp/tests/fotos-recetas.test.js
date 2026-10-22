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

  test("título renombrado por el usuario → null (no hay foto para un plato bautizado a mano)", () => {
    expect(fr.fotoDe({ id: "r-1", title: "Mis croquetas de la abuela" }, ctx)).toBeNull();
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

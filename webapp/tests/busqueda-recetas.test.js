// tests/busqueda-recetas.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para
// modules/busqueda-recetas.js. Lógica PURe del buscador del catálogo curado: en Node directo (sin
// DOM ni jsdom). Acentos/plural/stopwords se resuelven vía el matcher compartido ingredient-matching.js,
// tal cual lo hace producción (prueba de wiring: los tests "sin contexto" esperan resolución por global).
// Feature 2026-10-18: tab RECETAS, card "🔎 Buscador del catálogo" entre crear receta y Mis Recetas.

const catalogo = require("../data/recetas-espanolas-data.js");
const { buscar } = require("../modules/busqueda-recetas.js");

// nº de receta del catálogo para localizar resultados por título con posición garantizada.
function idxDe(titulo) {
  const i = catalogo.findIndex(r => r.title === titulo);
  if (i < 0) throw new Error("el catálogo de test ya no contiene '" + titulo + "' — actualiza el título");
  return i;
}

describe("(1) Contrato del módulo y degradación", () => {
  it("exporta exactamente 1 función pública: buscar", () => {
    expect(Object.keys(require("../modules/busqueda-recetas.js"))).toEqual(["buscar"]);
  });

  it("consulta vacía / sólo espacios / null → sin resultados, sin lanzar", () => {
    expect(buscar("", catalogo).resultados).toEqual([]);
    expect(buscar("   ", catalogo).resultados).toEqual([]);
    expect(buscar(null, catalogo).resultados).toEqual([]);
    expect(buscar("ab", catalogo).resultados).toEqual([]);   // < longitud mínima de token del matcher
  });

  it("catálogo no-array / recetas rotas filtradas → resultados [] o vacío, nunca devuelve basura", () => {
    expect(buscar("tortilla", null).resultados).toEqual([]);
    expect(buscar("tortilla", undefined).resultados).toEqual([]);
    const sucio = [null, { id: "x", title: "Tortilla de patatas española", ingredients: ["Patatas"], method: [] }, 42];
    const res = buscar("tortilla", sucio);
    expect(res.resultados).toHaveLength(1);
    expect(res.resultados[0].receta.title).toBe("Tortilla de patatas española");
  });
});

describe("(2) Búsqueda por TÍTULO (normalización compartida: acentos/plural)", () => {
  it("encuentra por título SIN acentos y en plural ('tortilla de patatas' → la española 1ª)", () => {
    const res = buscar("tortilla de patatas", catalogo);
    expect(res.tokens).toContain("tortilla");
    expect(res.tokens).toContain("patata");          // quitarPluralToken: patatas→patata
    expect(res.resultados[0].receta.title).toBe("Tortilla de patatas española");
    expect(res.resultados[0].hitsTitulo).toContain("tortilla");
    expect(res.resultados[0].hitsTitulo).toContain("patata");
  });

  it("resuelve acentos en la consulta y en el título ('tiramisu' → Tiramisú casero)", () => {
    const res = buscar("tiramisu", catalogo);
    expect(res.resultados.some(r => r.receta.title === "Tiramisú casero")).toBe(true);
  });

  it("el TÍTULO pesa x3: 'queso' ranquea antes las recetas con queso EN EL TÍTULO", () => {
    const res = buscar("queso", catalogo);
    expect(res.resultados.length).toBeGreaterThan(1);
    const primerasPorTitulo = res.resultados.slice(0, 2).filter(r => r.hitsTitulo.length > 0).length;
    expect(primerasPorTitulo).toBe(2);   // las 2 primeras tienen hit de título (3 pts) por encima de las de sólo-ingrediente
  });
});

describe("(3) Búsqueda por INGREDIENTE (el token no está en el título)", () => {
  it("'mascarpone' encuentra Tiramisú casero vía ingredientes (motivo = hit de ingrediente)", () => {
    const res = buscar("mascarpone", catalogo);
    const hit = res.resultados.find(r => r.receta.title === "Tiramisú casero");
    expect(hit).toBeDefined();
    expect(hit.hitsIngredientes).toContain("mascarpone");
    expect(hit.hitsTitulo).toHaveLength(0);
  });

  it("multi-token AND-implícito: 'tortilla patatas' puntúa MÁS la tortilla completa (6) que las de patatas solas (3)", () => {
    const res = buscar("tortilla patatas", catalogo);
    expect(res.resultados[0].score).toBe(6);
    expect(res.resultados[0].receta.title).toBe("Tortilla de patatas española");
    expect(res.resultados[1].score).toBeLessThan(6);
  });
});

describe("(4) Orden determinista y límite", () => {
  it("empate de score → conserva el ORDEN DEL CATÁLOGO (estable, reproducible §6)", () => {
    const res = buscar("patatas", catalogo);
    for (let i = 1; i < res.resultados.length; i++) {
      if (res.resultados[i - 1].score === res.resultados[i].score) {
        expect(idxDe(res.resultados[i - 1].receta.title)).toBeLessThan(idxDe(res.resultados[i].receta.title));
      }
    }
  });

  it("ctx.limite recorta el ranking (default 8; pedir 3 devuelve 3 si hay suficientes)", () => {
    const resDefecto = buscar("patata", catalogo, {});
    expect(resDefecto.resultados.length).toBeLessThanOrEqual(8);
    const res3 = buscar("patata", catalogo, { limite: 3 });
    expect(res3.resultados.length).toBe(3);
  });
});

// tests/recipe-analysis.test.js - CAPA UNITARIA (CODING_STANDARDS.md seccion 6): logica PURA, sin jsdom.
// require() directo del modulo, segun patron DIP previsto por la doc para que los unit-tests no necesiten jsdom.

const analyzeRecipe = require("../modules/recipe-analysis").analyzeRecipe;


describe("forma de respuesta", () => {
  test("siempre devuelve exactamente las cuatro claves del contrato publico (seccion 5 Liskov)", () => {
    const out = analyzeRecipe("", {});
    expect(Object.keys(out).sort()).toEqual(["ingredients", "method", "possible", "title"].sort());
  });

  test("con texto vacio: todas las listas y el titulo caen en sus valores por defecto ('Receta')", () => {
    expect(analyzeRecipe("", { meal: "comida" })).toEqual({ title: "Receta", ingredients: [], method: [], possible: [] });
  });
});


describe("ingredients: orden de aparicion en el texto y dedup por nombre ya visto", () => {
  const desc1 = "Batir dos huevos con sal. Luego freír en aceite caliente hasta que estén dorados.";

  test("extrae los ingredientes en ORDEN DE ATRAVES Y SIN duplicar", () => {
    const out = analyzeRecipe(desc1, { meal: "comida" });
    // Orden observado empíricamente (probe): primero 'Huevos', luego 'Sal'. 'Aceite' sigue después.
    expect(out.ingredients).toEqual(["Huevos", "Sal", "Aceite"]);
  });

  test("los pasos se numeran progresivamente y se cortan en el primer par de dos frases con verbos", () => {
    const out = analyzeRecipe(desc1, { meal: "comida" });
    expect(out.method).toHaveLength(2);
    // Prefijo 'N.' incremental (sin fijar la literal accéntuada exact a para no ser fr a g il); basta probar la
    // numeracion progresiva y que NO salga ningun paso '1' repetido ni salto en el orden.
    expect(out.method[0]).toMatch(/^1\.\s/);
    expect(out.method[1]).toMatch(/^2\.\s/);
  });

  test("la MISMA frase repetida con distinto caso colapsa a un ÚNICO paso por dedup de clave normalizada", () => {
    const desc = "Bat ir los huev os\nBAT IR LOS HUEVOS.";
    const out = analyzeRecipe(desc, { meal: "comida" });
    expect(out.method).toHaveLength(1);
    expect(out.method[0]).toMatch(/^1\./);
    // Y los ingredientes también dedupan por nombre (una sola 'Huevos', no dos):
    expect(out.ingredients.filter((i) => /^h uevos$/i.test(i))).toHaveLength(1);
  });
});


describe("pasos: tope máximo del módulo es 10, con numeración incremental hasta ese límite", () => {
  test("con 14 frases distintas y verbosas el resultado se cap en 10 pasos máximos, sin saltar números mayores a 10", () => {
    const verbs = [
      "Cortar","Hervir","Pelar","Picar","Mezclar","Remover","Untar","Asar","Dorar","Exprimir",
    ];
    // 14 líneas con verbos diferentes para que, SIN cap, podrían ser hasta 14; verificamos el tope del módulo (break a 10).
    const desc = Array.from({ length: 14 }, (_, i) => `${verbs[i % verbs.length]} el paso numero ${i + 1}`).join("\n");

    const out = analyzeRecipe(desc, { meal: "comida" });
    expect(out.method).toHaveLength(10);                 // nunca supera 10
    expect(out.method[0]).toMatch(/^1\./);              // numeracion desde 1
    expect(out.method[out.method.length - 1]).toMatch(/^10\./); // último visible es "10."
    const mayoresANueve = out.method.filter((s) => /^1[1-9]\.\s/.test(s));
    expect(mayoresANueve).toEqual([]);                  // nada de numeracion mas alla del maximo (probaría cap real, no solo recorte de lista final)
  });

  test("sin verbo reconocible en el texto el método sale VACIO aunque haya pantry presente", () => {
    const out = analyzeRecipe("Poner el plato en la mesa y dejar que repose un poco", { meal: "comida", pantry: ["queso","vino"] });
    expect(out.method).toEqual([]);
  });
});

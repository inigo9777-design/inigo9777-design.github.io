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
    const desc = "Batir los huevos\nBATIR LOS HUEVOS.";
    const out = analyzeRecipe(desc, { meal: "comida" });
    expect(out.method).toHaveLength(1);
    expect(out.method[0]).toMatch(/^1\./);
    // Y los ingredientes también dedupan por nombre (una sola 'Huevos', no dos):
    expect(out.ingredients.filter((i) => /^huevos$/i.test(i))).toHaveLength(1);
  });
});


describe("pasos: tope máximo del módulo es 16, con numeración incremental hasta ese límite", () => {
  test("con 18 frases distintas y verbosas el resultado se cap en 16 pasos máximos, sin saltar números mayores a 16", () => {
    const verbs = [
      "Cortar","Hervir","Pelar","Picar","Mezclar","Remover","Untar","Asar","Dorar","Exprimir",
    ];
    // 18 líneas con verbos diferentes para que, SIN cap, podrían ser hasta 18; verificamos el tope del módulo (break a 16).
    const desc = Array.from({ length: 18 }, (_, i) => `${verbs[i % verbs.length]} el paso numero ${i + 1}`).join("\n");

    const out = analyzeRecipe(desc, { meal: "comida" });
    expect(out.method).toHaveLength(16);                 // nunca supera 16
    expect(out.method[0]).toMatch(/^1\./);              // numeracion desde 1
    expect(out.method[out.method.length - 1]).toMatch(/^16\./); // último visible es "16."
    const mayoresAQuince = out.method.filter((s) => /^1[7-9]\.\s/.test(s));
    expect(mayoresAQuince).toEqual([]);                  // nada de numeracion mas alla del maximo
  });

  test("sin verbo reconocible en el texto el método sale VACIO aunque haya pantry presente", () => {
    const out = analyzeRecipe("el plato en la mesa y que un poco", { meal: "comida", pantry: ["queso","vino"] });
    expect(out.method).toEqual([]);
  });
});


describe("3ª gen — ingredientes con cantidad aunque NO estén en el diccionario ni en la despensa", () => {
  test("'50 g de pesto' (palabra fuera de diccionario) se captura como ingrediente", () => {
    const out = analyzeRecipe("50 g de pesto y dos huevos", { meal: "cena" });
    expect(out.ingredients).toContain("Pesto");
    expect(out.ingredients).toContain("Huevos");
  });

  test("nombre compuesto tras medida se captura con su calificativo ('pimentón dulce', 'queso rallado')", () => {
    const out = analyzeRecipe("una cucharada de pesto de albahaca", { meal: "comida", pantry: [] });
    expect(out.ingredients).toContain("Pesto de albahaca");
  });

  test("lista escrita a mano con comas: cada alimento sale UNA vez (los fuera-de-diccionario se añaden al final)", () => {
    const out = analyzeRecipe("2 huevos, 200 gramos de wakame y media cebolla", { meal: "comida" });
    expect(out.ingredients).toHaveLength(3);
    expect(out.ingredients).toEqual(expect.arrayContaining(["Huevos", "Wakame", "Cebolla"]));
  });

  test("NO recoge palabras de tiempo ni recipientes como ingredientes ('10 minutos en un bol')", () => {
    const out = analyzeRecipe("deja reposar la masa 10 minutos en un bol y sirve", { meal: "comida" });
    const unidos = out.ingredients.join(" ");
    expect(unidos).not.toMatch(/minuto/i);
    expect(unidos).not.toMatch(/\bbol\b/i);
  });

  test("una pieza que ARRANCA con verbo nunca se cuela por el fallback de cantidades", () => {
    const out = analyzeRecipe("Cortar el paso numero 3", { meal: "comida" });
    expect(out.ingredients).toEqual([]);   // 'paso'/'numero' no son alimentos
  });
});


describe("3ª gen — nada del método se pierde: colas temporales e intros se ANCLAN", () => {
  test("cola sin verbo ('a fuego medio durante 3 minutos') se une al paso ANTERIOR", () => {
    const out = analyzeRecipe("Añade el arroz, a fuego medio durante 3 minutos", { meal: "comida" });
    expect(out.method).toHaveLength(1);
    expect(out.method[0]).toContain("a fuego medio durante 3 minutos");
  });

  test("cláusula introductoria sin verbo se une al paso SIGUIENTE", () => {
    const out = analyzeRecipe("Cuando la cebolla esté dorada, añade la sal", { meal: "comida" });
    expect(out.method).toHaveLength(1);
    expect(out.method[0]).toBe("1. Cuando la cebolla esté dorada, añade la sal.");
  });

  test("el participio dentro de la intro no la convierte en paso suelto", () => {
    const out = analyzeRecipe("Cuando la cebolla esté dorada, añade las chirlas", { meal: "comida" });
    expect(out.method).toHaveLength(1);
    expect(out.method[0]).toContain("Cuando la cebolla esté dorada, añade las chirlas");
  });
});


describe("3ª gen — imperativos irregulares que la raíz de 4 letras no reconocía", () => {
  test("'Bate', 'Fríe' y 'Cuece' arrancan pasos (antes se perdían: 'bate' ≠ raíz 'bati')", () => {
    const out = analyzeRecipe("Bate los huevos. Fríe el ajo. Cuece la pasta.", { meal: "comida" });
    expect(out.method).toHaveLength(3);
    expect(out.method[0]).toMatch(/^1\. Bate los huevos\.$/);
    expect(out.method[1]).toMatch(/^2\. Fríe el ajo\.$/);
    expect(out.method[2]).toMatch(/^3\. Cuece la pasta\.$/);
  });

  test("'Vierte' y 'Deja' también cuentan como acción", () => {
    const out = analyzeRecipe("Vierte la leche. Deja reposar.", { meal: "comida" });
    expect(out.method).toHaveLength(2);
  });
});


describe("3ª gen — básicos que faltaban en el diccionario ('tortilla de patatas' perdía la patata)", () => {
  test("patata, agua, harina, vino y perejil se reconocen", () => {
    const out = analyzeRecipe("Fríe patatas con agua, harina, vino y perejil", { meal: "comida" });
    expect(out.ingredients).toEqual(expect.arrayContaining(["Patatas", "Agua", "Harina", "Vino", "Perejil"]));
  });

  test("prosa realista completa: receta escrita a mano sale entera (oro)", () => {
    const desc = `Tortilla de camarones para 2 personas

2 huevos, 200 gramos de harina, un puñado de chirlas y media cebolla.

Bate los huevos con sal hasta que espume.
Cuando la cebolla esté dorada, añade las chirlas y vierte la masa.
Fríe a fuego medio durante 3 minutos por cada lado.`;
    const out = analyzeRecipe(desc, { meal: "cena" });
    expect(out.title).toBe("Tortilla de camarones · Cena");
    expect(out.ingredients).toEqual(["Tortilla de camarones", "Camarones", "Huevos", "Harina", "Chirlas", "Cebolla", "Sal"]);
    expect(out.method).toEqual([
      "1. Bate los huevos con sal hasta que espume.",
      "2. Cuando la cebolla esté dorada, añade las chirlas.",
      "3. Vierte la masa.",
      "4. Fríe a fuego medio durante 3 minutos por cada lado.",
    ]);
  });
});

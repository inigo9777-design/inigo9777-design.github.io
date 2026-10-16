// tests/util.test.js — capa unitaria (Capa 1 del §6 de CODING_STANDARDS.md).
// El módulo modules/util.js es "puro" (no toca DOM ni localStorage): exige Node/Jest
// sin jsdom, por eso se carga DIRECTO vía require() y no a través de tests/boot.js,
// con el patrón idéntico al que usan priority/classify/recipe-analysis.

const util = require("../modules/util");

describe("util — escapeHTML(val)  (regla anti-XSS del repo, §4)", () => {
  // Cada una de las 5 entidades peligrosas debe codificarse con su escape correspondiente;
  // cualquier otro carácter se deja tal cual, SIN tocarse.
  it.each([
    ["&",        "&amp;"],   // el ampersand va PRIMERO en la lista del módulo para no doblar escapes de los demás.
    ["<",        "&lt;"],
    [">",        "&gt;"],
    ['"',        "&quot;"],
    ["'",        "&#39;"],
  ])("'%s' → '%s'", (entrada, esperada) => {
    expect(util.escapeHTML(entrada)).toBe(esperada);
  });

  it("escapa las 5 entidades A LA VEZ en una misma cadena sin colisionar", () => {
    // El orden del objeto interno de util.js garantiza que & se resuelva antes que el resto.
    expect(util.escapeHTML(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("deja intacto cualquier carácter NO peligroso (no altera texto normal)", () => {
    // No se toca nada que no sea &,"<",">","",' — importante para mantener acentos/emoji legibles en nombres de alimentos.
    expect(util.escapeHTML("Tomate y Cítricos 🍋")).toBe("Tomate y Cítricos 🍋");
  });

  it("convierte cualquier entrada no-cadena vía String() sin lanzar error", () => {
    // Números, booleans o null/undefined deben pasar por String(s) antes del replace (§ "String(s).replace...").
    expect(util.escapeHTML(42)).toBe("42");
    expect(util.escapeHTML(true)).toBe("true");
    expect(util.escapeHTML(null)).toBe("null");
  });

  it("es idempotente para cadenas que no contienen entidades (aplicar dos veces = aplicar una)", () => {
    const limpio = "Pasta de tomate con cilantro fresco";
    expect(util.escapeHTML(limpio)).toBe(limpio); // ya limpio: sin cambios posibles.
  });
});

describe("util — uid()  (id único para alimentos/recetas/ideas nuevas)", () => {
  // Formato heredado de app.js original (sin cambiar semántica): timestamp en base-36 + sufijo aleatorio corto.
  const UID_SHAPE = /^[0-9a-z]+$/;

  it("devuelve SIEMPRE un string no vacío", () => {
    for (let i = 0; i < 10; i++) {
      expect(typeof util.uid()).toBe("string");
      expect(util.uid().length).toBeGreaterThanOrEqual(2);
    }
  });

  it("responde al patrón esperado de caracteres [sin caracteres fuera de a-z/0-9]", () => {
    for (let i = 0; i < 10; i++) {
      expect(util.uid()).toMatch(UID_SHAPE);
    }
  });

  it("produce valores (prácticamente) distintos en llamadas consecutivas", () => {
    const ids = Array.from({ length: 5 }, () => util.uid());
    // Escribimos distinto para el caso de que por chance coincida sufijo+timestamp exacto entre dos, lo cual
    // sería extremadamente improbable con 36^5 posibilidades; no asertamos igualdad exacta ni dependemos del reloj.
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("no depende de un provider inyectado (default producción = reloj real + random)", () => {
    // Ver §3.7/§6 "Determinismo": util.uid() en sí mismo NO acepta opts; la inyección solo existe donde el módulo
    // decide usarla (innovations/backup aceptan ctx.uid). Aquí confirmamos que util.uid() funciona sin argumento extra.
    expect(typeof util.uid()).toBe("string");
  });

  it("tiene exactamente la API documentada: sólo {escapeHTML, uid}", () => {
    expect(Object.keys(util).sort()).toEqual(["escapeHTML", "uid"]);
  });
});

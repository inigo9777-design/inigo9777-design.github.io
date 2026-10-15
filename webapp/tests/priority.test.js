// tests/priority.test.js — capa unitaria (Capa 1 del §6 de CODING_STANDARDS.md).
// El módulo modules/priority.js es "puro" (no toca DOM ni localStorage): exige Node/Jest sin jsdom,
// por eso se carga DIRECTO vía require() y no a través de tests/boot.js.
const priority = require("../modules/priority");

describe("priority — urgencyLevel(score)", () => {
  // Contrato del color visual: rojo [8–10] · naranja [6–7] · verde [1–5].
  it.each([
    [10, "red"],
    [8, "red"],      // borde inferior de la franja roja (inclusivo)
    [7.9, "orange"],
    [7, "orange"],
    [6, "orange"],   // borde superior de la franja naranja
    [5.9, "green"],
    [5, "green"],    // borde inferior de naranja / superior de verde
    [1, "green"],
    [0, "green"],
  ])("score %p → '%s'", (score, esperado) => {
    expect(priority.urgencyLevel(score)).toBe(esperado);
  });

  it("usa comparación numérica (>), no igualdad textual", () => {
    expect(priority.urgencyLevel(9)).toBe("red");
    expect(priority.urgencyLevel(4)).toBe("green");
  });
});

describe("priority — needsRestock(food)", () => {
  // Invariante del §5 (Food): qty <= min ⇒ necesita reponer. El comparador es INCLUSIVO:
  // si qty === min, el alimento SÍ entra en la alerta de reposición.
  it.each([
    [{ qty: 3, min: 5 }, true],   // por debajo del mínimo
    [{ qty: 5, min: 5 }, true],   // igual al mínimo (borde inclusivo)
    [{ qty: 6, min: 5 }, false],  // encima del mínimo
  ])("food %o → %s", (food, esperado) => {
    expect(priority.needsRestock(food)).toBe(esperado);
  });

  it("aplica el fallback ?? 0 ante qty/min ausentes (null o undefined)", () => {
    // Ninguno de los campos: q=0,m=0 ⇒ 0 <= 0 → true (conserva la alerta por defecto).
    expect(priority.needsRestock({})).toBe(true);
    // Sólo falta qty: q=0, m=3 ⇒ 0 <= 3 → true (reposición por defecto si no se conoce la cantidad).
    expect(priority.needsRestock({ min: 3 })).toBe(true);
    // Sólo qty, sin mínimo conocido: m=0, q=4 ⇒ 4 <= 0 → false.
    expect(priority.needsRestock({ qty: 4 })).toBe(false);
    // null también cae en el ?? (nótese que `||` no habría bastado para el caso "min:0" real):
    expect(priority.needsRestock({ qty: null, min: 2 })).toBe(true);
  });
});

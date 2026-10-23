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

describe("priority — buildWeeklyAlert(foods): lista COMPLETA sin cap (rediseño 2026-10-19)", () => {
  const mk = (name, score, qty = 0, min = 1, checked = false) => ({ name, score, qty, min, checked });

  it("sin pendientes no muestra la alerta", () => {
    expect(priority.buildWeeklyAlert([])).toEqual({ show: false });
    // todo suficiente: nada que avisar
    expect(priority.buildWeeklyAlert([mk("arroz", 5, 4, 1)])).toEqual({ show: false });
  });

  it("el antiguo check 'hoy está en casa' ya NO saca nada de la alerta (la cuenta pendiente la manda qty vs min)", () => {
    const m = priority.buildWeeklyAlert([mk("leche", 9, 0, 1, true)]);
    expect(m.show).toBe(true);
    expect(m.items.map(x => x.name)).toEqual(["leche"]);
  });

  it("devuelve TODOS los pendientes (antes el slice(0, 8) escondía del 9º en adelante)", () => {
    const diez = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((n, i) => mk(n, 9 - i));
    const m = priority.buildWeeklyAlert(diez);
    expect(m.show).toBe(true);
    expect(m.items).toHaveLength(10);
    expect(m.items.map(x => x.name)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  });

  it("ordena desc por score (el más urgente manda color y título, el resto le sigue de cerca)", () => {
    const m = priority.buildWeeklyAlert([mk("bajo", 2), mk("alto", 9), mk("medio", 6)]);
    expect(m.items.map(x => x.name)).toEqual(["alto", "medio", "bajo"]);
  });

  it("el nivel/icono/título lo marca el MÁS URGENTE de TODA la lista (también del 9º en adelante)", () => {
    // el más urgente está FUERA del antiguo cap de 8: con el slice viejo el nivel saldría green
    const m = priority.buildWeeklyAlert(
      ["a", "b", "c", "d", "e", "f", "g", "h", "critico"].map(n => mk(n, n === "critico" ? 10 : 4))
    );
    expect(m.level).toBe("red");
    expect(m.icon).toBe("🚨");
    expect(m.title).toBe("Repuestos urgentes esta semana");
  });

  it("incluye TODO lo pendiente — marcados y no — y deja fuera sólo lo suficiente", () => {
    // los que SÍ necesitan reponer (marcados o no — el check fue retirado de la UI, 2026-10-23)
    const m = priority.buildWeeklyAlert([mk("ok", 5, 5, 1), mk("marcado", 5, 0, 1, true), mk("falta", 5, 0, 1)]);
    expect(m.items.map(x => x.name)).toEqual(["marcado", "falta"]);
  });
});

// tests/tutorial.test.js — CAPA UNITARIA (Capa 1, CODING_STANDARDS.md §6) para
// modules/tutorial.js: el guion de la visita guiada y su sesión. Lógica PURe en Node directo
// (sin DOM ni jsdom). Feature 2026-10-20: tutorial interactivo de entrada de la PWA.

const tut = require("../modules/tutorial.js");

describe("tutorial — contrato del módulo", () => {
  it("exporta exactamente la API cerrada", () => {
    expect(Object.keys(tut).sort()).toEqual(
      ["PASOS", "avanzar", "numero", "pasoActual", "pasosDeVista", "pasoValido", "sesionNueva", "totalPasos"].sort()
    );
  });

  it("todo paso del guion pasa el contrato (sin pasos rotos en producción)", () => {
    expect(tut.PASOS.length).toBe(tut.totalPasos());
    for (const paso of tut.PASOS) {
      expect(tut.pasoValido(paso)).toBe(true);
      expect(typeof paso.titulo).toBe("string");
      expect(paso.accionable ? paso.selector : true).toBeTruthy();
    }
  });

  it("el guion arranca y cierra SIN vista (tarjeta centrada, sin señal)", () => {
    const primero = tut.PASOS[0];
    const ultimo = tut.PASOS[tut.PASOS.length - 1];
    expect(primero.vista).toBeNull();
    expect(primero.selector).toBeNull();
    expect(ultimo.vista).toBeNull();
    expect(ultimo.cta).toBe("Terminar");
  });

  it("pasoValido rechaza la basura: sin título, sin texto, accionable sin selector, selector no-string", () => {
    expect(tut.pasoValido(null)).toBe(false);
    expect(tut.pasoValido({})).toBe(false);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: null, selector: null, accionable: false })).toBe(true);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: null, selector: null, accionable: true })).toBe(false);   // actionable sin objetivo
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#a", accionable: true })).toBe(true);
    expect(tut.pasoValido({ titulo: "", texto: "y", vista: null, selector: null, accionable: false })).toBe(false);
    expect(tut.pasoValido({ titulo: "x", texto: "   ", vista: null, selector: null, accionable: false })).toBe(false);
  });
});

describe("tutorial — máquina de sesión", () => {
  it("sesión nueva arranca en el primer paso (bienvenida), numeración 1 de N", () => {
    const s = tut.sesionNueva();
    expect(tut.pasoActual(s).id).toBe("bienvenida");
    expect(tut.numero(s)).toBe(1);
    expect(tut.sesionNueva().hecho).toBeUndefined();
  });

  it("avanzar recorre los pasos en orden y el ÚLTIMO marca hecho y devuelve null", () => {
    const s = tut.sesionNueva();
    expect(tut.totalPasos()).toBeGreaterThanOrEqual(3);   // bienvenida+cabecera+listo al menos
    const ids = [];
    while (tut.pasoActual(s)) {
      ids.push(tut.pasoActual(s).id);
      tut.avanzar(s);
    }
    expect(ids[0]).toBe("bienvenida");
    expect(ids[ids.length - 1]).toBe("listo");
    expect(new Set(ids).size).toBe(ids.length);           // sin repetidos en el guion
    expect(tut.totalPasos()).toBe(ids.length);
    expect(s.hecho).toBe(true);
    expect(tut.numero(s)).toBe(tut.totalPasos());         // nunca se pasa de N
    expect(tut.avanzar(s)).toBe(s);                        // avanzar más allá: sesion estable, sin throw
    expect(tut.numero(s)).toBe(tut.totalPasos());
  });

  it("sesiones inválidas: sin throw y sin paso", () => {
    expect(tut.pasoActual(null)).toBeNull();
    expect(tut.pasoActual("x")).toBeNull();
    expect(tut.numero(undefined)).toBe(0);
    expect(() => tut.avanzar(null)).not.toThrow();
  });

  it("pasosDeVista devuelve sólo los de esa vista; null = intro/cierre", () => {
    for (const p of tut.pasosDeVista(null)) expect(p.vista).toBeNull();
  });
});

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

describe("tutorial — bloque ALIMENTOS (épica tutorial-interactivo)", () => {
  it("la vista foods trae 3 pasos consecutivos dentro del guion", () => {
    const porVista = tut.pasosDeVista("foods");
    expect(porVista.length).toBe(3);
    expect(porVista.every(p => p.vista === "foods")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    const inicio = ids.indexOf("alimentos-anotar");
    expect(inicio).toBeGreaterThan(0);                            // tras la intro
    expect(ids.slice(inicio, inicio + 3).join(",")).toBe("alimentos-anotar,alimentos-importancia,alimentos-inventario");
  });

  it("los accionables apuntan a elementos que existen SIN datos, y el último es informativo", () => {
    const [p1, p2, p3] = tut.pasosDeVista("foods");
    expect(p1.selector).toBe("#food-name");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#food-score");
    expect(p2.accionable).toBe(true);
    expect(p3.accionable).toBe(false);
    expect(p3.cta).toBe("Siguiente");
  });
});

describe("tutorial — bloque RECETAS (épica tutorial-interactivo)", () => {
  it("la vista recipes trae 3 pasos consecutivos y tras los de Alimentos", () => {
    const porVista = tut.pasosDeVista("recipes");
    expect(porVista.length).toBe(3);
    expect(porVista.every(p => p.vista === "recipes")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    expect(ids.indexOf("recetas-crear")).toBe(ids.indexOf("alimentos-inventario") + 1);   // sigue al de Alimentos
    expect(ids.slice(ids.indexOf("recetas-crear"), ids.indexOf("recetas-crear") + 3).join(","))
      .toBe("recetas-crear,recetas-catalogo,recetas-mis-recetas");
  });

  it("contrato de objetivos: creación y buscador accionables, Mis Recetas informativo", () => {
    const [p1, p2, p3] = tut.pasosDeVista("recipes");
    expect(p1.selector).toBe("#recipe-desc");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#recipe-catalog-search");
    expect(p2.accionable).toBe(true);
    expect(p3.selector).toBe("#recipe-list");
    expect(p3.accionable).toBe(false);
  });
});

describe("tutorial — bloque INNOVACIÓN (épica tutorial-interactivo)", () => {
  it("la vista innovation trae 2 pasos consecutivos y tras los de Recetas", () => {
    const porVista = tut.pasosDeVista("innovation");
    expect(porVista.length).toBe(2);
    expect(porVista.every(p => p.vista === "innovation")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    expect(ids.indexOf("innovacion-generador")).toBe(ids.indexOf("recetas-mis-recetas") + 1);   // sigue a Recetas
    expect(ids.slice(ids.indexOf("innovacion-generador"), ids.indexOf("innovacion-generador") + 2).join(","))
      .toBe("innovacion-generador,innovacion-lote");
  });

  it("contrato: el generador es accionable; el lote es informativo", () => {
    const [p1, p2] = tut.pasosDeVista("innovation");
    expect(p1.selector).toBe("#btn-generate-innov");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#innovation-list");
    expect(p2.accionable).toBe(false);
    expect(p2.cta).toBe("Siguiente");
  });
});

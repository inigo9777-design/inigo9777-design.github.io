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

  it("tarjeta opcional (petición 2026-10-21): sólo \"arriba\" es válida; un modo desconocido invalida el paso", () => {
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "recipes", selector: "#a", accionable: false, tarjeta: "arriba" })).toBe(true);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: null, selector: null, accionable: false, tarjeta: null })).toBe(true);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: null, selector: null, accionable: false, tarjeta: "al lado" })).toBe(false);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: null, selector: null, accionable: false, tarjeta: 1 })).toBe(false);
  });

  it("pasoValido: la demo del escáner (opcional, 2026-10-22) sólo admite el pase 'escaner'", () => {
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#btn-ocr-foto", accionable: true, demo: "escaner" })).toBe(true);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#a", accionable: true, demo: null })).toBe(true);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#a", accionable: true })).toBe(true);   // sin demo = paso normal
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#a", accionable: true, demo: "otra-cosa" })).toBe(false);
    expect(tut.pasoValido({ titulo: "x", texto: "y", vista: "foods", selector: "#a", accionable: true, demo: 1 })).toBe(false);
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
  it("la vista foods trae 4 pasos consecutivos dentro del guion (contiene la DEMO del escáner)", () => {
    const porVista = tut.pasosDeVista("foods");
    expect(porVista.length).toBe(4);
    expect(porVista.every(p => p.vista === "foods")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    const inicio = ids.indexOf("alimentos-anotar");
    expect(inicio).toBeGreaterThan(0);                            // tras la intro
    expect(ids.slice(inicio, inicio + 4).join(",")).toBe("alimentos-anotar,alimentos-importancia,alimentos-inventario,alimentos-escaner-demo");
  });

  it("los accionables apuntan a elementos que existen SIN datos; el inventario es informativo con tarjeta ARRIBA; el escáner es DEMO", () => {
    const [p1, p2, p3, p4] = tut.pasosDeVista("foods");
    expect(p1.selector).toBe("#food-name");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#food-score");
    expect(p2.accionable).toBe(true);
    expect(p3.selector).toBe("#food-list");
    expect(p3.accionable).toBe(false);
    expect(p3.tarjeta).toBe("arriba");   // el inventario es objetivo ALTO (petición 2026-10-21): la tarjeta no lo tapa
    expect(p3.cta).toBe("Siguiente");
    // El paso DEMO del escáner (petición 2026-10-22): accionable sobre el botón de foto,
    // en ambos entornos, y marcado con demo "escaner" — el wiring lanza los diálogos de
    // ejemplo; NADA se escribe en el inventario (es sólo explicativo).
    expect(p4.selector).toBe("#btn-ocr-foto");
    expect(p4.accionable).toBe(true);
    expect(p4.demo).toBe("escaner");
    expect(p4.tarjeta).toBeUndefined();
    expect(p4.titulo.toLowerCase()).toContain("escanea");
  });
});

describe("tutorial — bloque RECETAS (épica tutorial-interactivo)", () => {
  it("la vista recipes trae 3 pasos consecutivos y tras los de Alimentos", () => {
    const porVista = tut.pasosDeVista("recipes");
    expect(porVista.length).toBe(3);
    expect(porVista.every(p => p.vista === "recipes")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    expect(ids.indexOf("recetas-crear")).toBe(ids.indexOf("alimentos-escaner-demo") + 1);   // sigue al de Alimentos (con su demo)
    expect(ids.slice(ids.indexOf("recetas-crear"), ids.indexOf("recetas-crear") + 3).join(","))
      .toBe("recetas-crear,recetas-catalogo,recetas-mis-recetas");
  });

  it("contrato de objetivos: creación y buscador accionables, Mis Recetas informativo con tarjeta ARRIBA", () => {
    const [p1, p2, p3] = tut.pasosDeVista("recipes");
    expect(p1.selector).toBe("#recipe-desc");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#recipe-catalog-search");
    expect(p2.accionable).toBe(true);
    expect(p3.selector).toBe("#recipe-list");
    expect(p3.accionable).toBe(false);
    expect(p3.tarjeta).toBe("arriba");   // objetivo ALTO (petición 2026-10-21): la tarjeta no tapa la lista
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

  it("contrato: el generador es accionable; el lote es informativo con tarjeta ARRIBA", () => {
    const [p1, p2] = tut.pasosDeVista("innovation");
    expect(p1.selector).toBe("#btn-generate-innov");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#innovation-list");
    expect(p2.accionable).toBe(false);
    expect(p2.tarjeta).toBe("arriba");   // el lote es objetivo ALTO (petición 2026-10-21): la tarjeta no lo tapa
    expect(p2.cta).toBe("Siguiente");
  });
});

describe("tutorial — bloque SUGERENCIAS Y MENÚ (épica tutorial-interactivo)", () => {
  it("la vista suggest trae 4 pasos consecutivos y tras los de Innovación", () => {
    const porVista = tut.pasosDeVista("suggest");
    expect(porVista.length).toBe(4);
    expect(porVista.every(p => p.vista === "suggest")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    expect(ids.indexOf("menu-hoy")).toBe(ids.indexOf("innovacion-lote") + 1);   // sigue a Innovación
    expect(ids.slice(ids.indexOf("menu-hoy"), ids.indexOf("menu-hoy") + 4).join(","))
      .toBe("menu-hoy,menu-semana,menu-aprobar,menu-compra");
  });

  it("contrato: sugerir y menú accionables; aprobar y la LISTA DE LA COMPRA informativos", () => {
    const [p1, p2, p3, p4] = tut.pasosDeVista("suggest");
    expect(p1.selector).toBe("#btn-suggest-generate");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#btn-menu-generate");
    expect(p2.accionable).toBe(true);
    expect(p3.selector).toBe("#btn-menu-approve");
    expect(p3.accionable).toBe(false);
    // Paso nuevo (2026-10-24): la Card 3 en su momento — informativo, apunta a la lista y
    // con tarjeta ARRIBA: es un objetivo ALTO (la lista nace bajo la semana, su arranque
    // se asienta al 60% de la ventana). La lista no existe (sin plan aprobado) ⇒ el wiring
    // la trata de objetivo invisible: velo completo + tarjeta centrada.
    expect(p4.id).toBe("menu-compra");
    expect(p4.selector).toBe("#shopping-list");
    expect(p4.accionable).toBe(false);
    expect(p4.tarjeta).toBe("arriba");
    expect(p4.texto).not.toContain("semáforo");   // sin tecnicismos en la explicación
  });
});

describe("tutorial — bloque TEMPORADA (épica tutorial-interactivo)", () => {
  it("la vista seasonal trae 2 pasos consecutivos y cierra el guion antes del cierre", () => {
    const porVista = tut.pasosDeVista("seasonal");
    expect(porVista.length).toBe(2);
    expect(porVista.every(p => p.vista === "seasonal")).toBe(true);
    const ids = tut.PASOS.map(p => p.id);
    expect(ids.indexOf("temporada-mes")).toBe(ids.indexOf("menu-compra") + 1);   // última pantalla del tour
    expect(ids.slice(ids.indexOf("temporada-mes"), ids.indexOf("temporada-mes") + 2).join(","))
      .toBe("temporada-mes,temporada-grid");
  });

  it("contrato: selector de mes accionable; la cuadrícula informativa con tarjeta ARRIBA", () => {
    const [p1, p2] = tut.pasosDeVista("seasonal");
    expect(p1.selector).toBe("#season-month");
    expect(p1.accionable).toBe(true);
    expect(p2.selector).toBe("#season-grid");
    expect(p2.accionable).toBe(false);
    expect(p2.tarjeta).toBe("arriba");   // objetivo ALTO (petición 2026-10-21): la tarjeta no tapa la cuadrícula
    expect(p2.cta).toBe("Siguiente");
  });
});

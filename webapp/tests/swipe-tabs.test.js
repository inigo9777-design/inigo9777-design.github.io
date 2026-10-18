// tests/swipe-tabs.test.js — Spec del módulo puro del gesto "deslizar para cambiar de vista"
// (viewpager móvil 2026-10-18). Sin DOM ni usuario: cubre la decisión de dirección (con sus
// umbral-exclusiones: corto, vertical, diagonal) y la selección de la vista vecina con wrap.
const swipeTabs = require("../modules/swipe-tabs.js");

const VISTAS = ["foods", "recipes", "innovation", "suggest", "seasonal"];

describe("swipeTabs.dirDeGesto", () => {
  it("deslizar a la IZQUIERDA con aventaja y fuera de umbral → avanza (1, viewpager)", () => {
    expect(swipeTabs.dirDeGesto(-160, 6)).toBe(1);
  });

  it("deslizar a la DERECHA → retrocede (-1)", () => {
    expect(swipeTabs.dirDeGesto(160, 6)).toBe(-1);
  });

  it("desplazamiento por debajo del umbral horizontal → NO es swipe (toque torpe)", () => {
    expect(swipeTabs.dirDeGesto(-swipeTabs.UMBRAL_DX + 1, 0)).toBe(0);
    expect(swipeTabs.dirDeGesto(-10, 0)).toBe(0);
    expect(swipeTabs.dirDeGesto(0, 0)).toBe(0);
  });

  it("justo en el umbral horizontal sí cuenta (>= UMBRAL_DX)", () => {
    expect(swipeTabs.dirDeGesto(-swipeTabs.UMBRAL_DX, 0)).toBe(1);
    expect(swipeTabs.dirDeGesto(swipeTabs.UMBRAL_DX, 0)).toBe(-1);
  });

  it("deriva vertical >= UMBRAL_DY → es un SCROLL vertical, no un swipe", () => {
    expect(swipeTabs.dirDeGesto(-160, swipeTabs.UMBRAL_DY)).toBe(0);
    expect(swipeTabs.dirDeGesto(-160, -40)).toBe(1);          // deriva pequeña tolerada
    expect(swipeTabs.dirDeGesto(-160, 60)).toBe(0);
  });

  it("diagonal ladrón (vertical casi igual al horizontal) → se descarta sin saltos raros", () => {
    expect(swipeTabs.dirDeGesto(-70, -50)).toBe(0);           // ady=50, adx=70: 1.5*50 >= 70
    expect(swipeTabs.dirDeGesto(-90, -40)).toBe(1);           // ady=40 < 60: horizontal manda
  });
});

describe("swipeTabs.vecina", () => {
  it("avanza por el orden del topbar (foods → recipes)", () => {
    expect(swipeTabs.vecina(VISTAS, "foods", 1)).toBe("recipes");
  });

  it("retrocede en el orden del topbar (suggest → innovation)", () => {
    expect(swipeTabs.vecina(VISTAS, "suggest", -1)).toBe("innovation");
  });

  it("WRAP: la última avanza a la primera y la primera retrocede a la última", () => {
    expect(swipeTabs.vecina(VISTAS, "seasonal", 1)).toBe("foods");
    expect(swipeTabs.vecina(VISTAS, "foods", -1)).toBe("seasonal");
  });

  it("vista desconocida, dir 0 u orden inválido → null (sin salto a ciegas)", () => {
    expect(swipeTabs.vecina(VISTAS, "backup", 1)).toBeNull();
    expect(swipeTabs.vecina(VISTAS, "foods", 0)).toBeNull();
    expect(swipeTabs.vecina([], "foods", 1)).toBeNull();
    expect(swipeTabs.vecina(null, "foods", 1)).toBeNull();
  });

  it("lista de una sola vista → se queda en ella misma (ídem, sin excepción)", () => {
    expect(swipeTabs.vecina(["foods"], "foods", 1)).toBe("foods");
  });
});

// Header que sigue al viewpager (bug 2026-10-19: el tab activo quedaba fuera de la
// ventana visible del scroller-x invisible del nav). Caso REAL medido en móvil 390px:
// clientWidth 358 × scrollWidth 638, tab temporada 122px → visible 0px con scrollLeft=0.
describe("swipeTabs.scrollIzquierdaParaTab", () => {
  const HEADER = { anchoVisible: 358, anchoContenido: 638, anchoTab: 122 };

  it("centra al tab activo en la ventana del scroller", () => {
    // dentro=300 → objetivo = 300 − (358−122)/2 = 182 (sin choque con el máximo de 280)
    expect(swipeTabs.scrollIzquierdaParaTab({ ...HEADER, dentro: 300 })).toBe(182);
  });

  it("tabs del principio → remata a 0 (no hay nada a la izquierda por ver)", () => {
    expect(swipeTabs.scrollIzquierdaParaTab({ ...HEADER, dentro: 0 })).toBe(0);
    expect(swipeTabs.scrollIzquierdaParaTab({ ...HEADER, dentro: 60 })).toBe(0);
  });

  it("el ÚLTIMO tab (el caso del bug) → remata al máximo posible: pasa a ser visible", () => {
    // máximo = 638 − 358 = 280; el último tab (dentro=516) pedía 398 → clamp 280
    expect(swipeTabs.scrollIzquierdaParaTab({ ...HEADER, dentro: 516 })).toBe(280);
  });

  it("si todo cabe no hay movimiento (máximo 0)", () => {
    expect(swipeTabs.scrollIzquierdaParaTab({ dentro: 400, anchoVisible: 500, anchoContenido: 480, anchoTab: 122 })).toBe(0);
  });

  it("métricas raras (0/NaN/null) se normalizan: nunca NaN ni scroll suicida", () => {
    expect(swipeTabs.scrollIzquierdaParaTab({ dentro: NaN, anchoVisible: 358, anchoContenido: 638, anchoTab: 122 })).toBe(0);
    expect(swipeTabs.scrollIzquierdaParaTab({ dentro: 400, anchoVisible: 100, anchoContenido: 638, anchoTab: 122 })).toBe(411);
    expect(swipeTabs.scrollIzquierdaParaTab(null)).toBe(0);
  });
});

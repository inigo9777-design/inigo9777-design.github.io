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

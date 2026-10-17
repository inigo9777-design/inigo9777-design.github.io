// tests/app.integration.test.js — capa de integrción (Capa 2, §6).
// Contrario a las specs Capa-1 (cada una requere un módulo ../modules/<n> aislado), ESTA arranca la app REAL:
// ./boot.js carga index.html + data/data.js + TODOS los módulos en el orden exacto del navegador y dispara DOMContentLoaded.
//
// Razón de existir este guard-rail: si algún refactor nuevo vuelve a mover o extraer un módulo SIN actualizar boot.js
// (como ocurrió con commit a558d47: se extrajeron util+backup pero no se tocaró esta ayuda), el callback de app.js estampa
// al disparar ese evento y la aserción principal — jsdomErrors vacío — vuelve a roja, antes de que ningún test Capa-1 lo note.

const { bootApp } = require("./boot"); // .helper en la misma carpeta webapp/tests/ (misma ruta relativa que las specs Capa-1)

describe("boot.js — arranque completo de la app en jsdom (Capa 2)", () => {
  it("no produce excepciones uncaught durante DOMContentLoaded tras cargar TODOS los módulos", () => {
    // A partir del fix: cada window.MRCheff.* que desestructura app.js estó sincronamente dentro de su closure ya existe,
    // así que no hay "Cannot read properties of undefined" al disparar el evento.
    expect(bootApp().jsdomErrors).toEqual([]);
  });

  it("deja renderizado el nav con las pestañas (el DOM no queda vacío tras el arranque)", () => {
    // index.html define 5 botones .tab con data-view=… : foods, recipes, innovacion, temporada, backup (+ un botón de tema).
    expect(bootApp().window.document.querySelectorAll("[data-view]").length).toBeGreaterThanOrEqual(5);
  });
});

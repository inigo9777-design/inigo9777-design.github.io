// tests/app.integration.test.js — capa de integrción (Capa 2, §6).
// Contrario a las specs Capa-1 (cada una requere un módulo ../modules/<n> aislado), ESTA arranca la app REAL:
// ./boot.js carga index.html + data/data.js + TODOS los módulos en el orden exacto del navegador y dispara DOMContentLoaded.
//
// Razón de existir este guard-rail: si algún refactor nuevo vuelve a mover o extraer un módulo SIN actualizar boot.js
// (como ocurrió con commit a558d47: se extrajeron util+backup pero no se tocaró esta ayuda), el callback de app.js estampa
// al disparar ese evento y la aserción principal — jsdomErrors vacío — vuelve a roja, antes de que ningún test Capa-1 lo note.

const fs = require("fs");
const path = require("path");
const { bootApp } = require("./boot"); // helper en la misma carpeta webapp/tests/ (misma ruta relativa que las specs Capa-1)

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

  it("GUARD anti-drift CI↔prod: index.html declara TODOS los <script> que la app necesita (bug 2026-10-18: faltaba menu-semanal.js y Limpiar/Aprobar rompían SÓLO en producción)", () => {
    // boot.js ya PARSEA esta lista del propio index.html (fuente única de verdad), así que este guard defiende
    // la OTRA mitad del contrato: que el HTML declare los módulos que app.js consume en runtime, y que cada
    // fichero listado exista de verdad (un <script src> con path mal escrito también es prod roto / CI verde).
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const srcs = [...html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)].map(m => m[1]);

    expect(srcs.length).toBeGreaterThan(0);
    ["data/data.js", "app.js", "modules/util.js", "modules/priority.js", "modules/classify.js",
     "modules/recipe-analysis.js", "modules/innovations.js", "modules/backup.js",
     "data/recetas-espanolas-data.js", "modules/planner.js", "modules/menu-semanal.js", "modules/recipe-missing.js"
    ].forEach(src => expect(srcs).toContain(src));

    srcs.forEach(src => expect(fs.existsSync(path.join(__dirname, "..", src))).toBe(true));
  });
});

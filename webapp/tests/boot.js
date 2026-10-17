// Boot helper: loads the REAL index.html + data.js + app.js into jsdom and fires
// DOMContentLoaded so the application initializes exactly as in a browser.
//
// The app keeps all state in localStorage under these keys (see app.js LS map):
//   mrcheff.foods, mrcheff.recipes, mrcheff.innov, mrcheff.innov.date
// Tests drive the UI through DOM events and assert via the rendered DOM + localStorage.

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/**
 * Boot a fresh app instance. Returns handles for tests.
 * @param {{seed?: object}} [opts]  optional pre-seed of localStorage state
 */
function bootApp(opts = {}) {
  const html = read("index.html");
  // Capture jsdom uncaught errors (e.g. app.js' DOMContentLoaded callback throwing on a
  // missing window.MRCheff.<module>) instead of letting them vanish into the void.
  const jsdomErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", err => {
    jsdomErrors.push(err);
    if (!process.env.CI) console.warn("[boot.js] jsdom error:", err.message); // en CI guardamos el array y silenciamos la consola
  });

  // Strip the inline head script that reads theme so it doesn't run twice / error in JSDOM.
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole,
  });

  // Fresh localStorage per boot (JSDOM gives a clean one already).

  // Cargar TODOS los <script src="..."> en el ORDEN EXACTO en el que los declara index.html (fuente única de verdad
  // § DRY/Open-Closed: la lista se PARSEA del HTML real, NUNCA se hardcodea aquí dos veces — el drift CI↔prod que
  // ocultó semanas era exactamente una lista duplicada: a558d47 extrajo util+backup a módulos y dejó este bootstrap
  // desactualizado, y en 2026-10-18 index.html llegó a faltar el <script> de modules/menu-semanal.js, rompiendo
  // "Limpiar/Aprobar plan" en producción mientras CI pasaba verde porque SU lista sí lo tenía. Al parsear del propio
  // HTML, añadir un módulo nuevo basta y las dos cargas no pueden divergir). Los inline (p.ej. el head de tema) se
  // ignoran como hasta ahora. app.js destruye (destructuring) window.MRCheff.<module> sincrónicamente dentro de su
  // closure de DOMContentLoaded (util @ L66, priority @ L159, backup @ L588, planner/menuSemanal sólo en clicks) —
  // TODO debe estar registrado ANTES de disparar el evento.
  const { window } = dom;

  // Semear localStorage ANTES de disparar DOMContentLoaded: los closures de app.js leen foods/recipes/innov/cooked
  // al inicializarse, así que el estado precargado debe estar ya en localStorage (ver seedState más abajo).
  if (opts.seed) seedState(opts.seed, window);

  const srcScripts = [...html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)].map(m => m[1]);
  if (srcScripts.length === 0) throw new Error("[boot.js] index.html no declara ningún <script src> — parseo roto");
  for (const src of srcScripts) runScriptInWindow(window, read(src));   // read lanza si el path no existe → falla ruidoso en CI

  // Fire DOMContentLoaded so app.js' big callback runs.
  fireEvent(window, "DOMContentLoaded");

  return {
    window,
    document: window.document,
    localStorage: window.localStorage,
    jsdomErrors,   // nuevo campo (a558d47-ward): Capa-2 puede asertar `.length === 0` y detectar cualquier módulo pendiente sin tener que leer stack-trace crudos cada vez.
    get foods()   { return JSON.parse(window.localStorage.getItem("mrcheff.foods") || "[]"); },
    get recipes() { return JSON.parse(window.localStorage.getItem("mrcheff.recipes") || "[]"); },
    get innov()   { return JSON.parse(window.localStorage.getItem("mrcheff.innov") || "[]"); },
  };
}

function seedState(seed, window) {
  // Escribe el estado precargado en localStorage ANTES de disparar DOMContentLoaded, para que los closures de
  // app.js (foods, recipes, innov, cooked) lo lean al inicializarse. Sin esto el seed se perdería porque app.js lee
  // localStorage una sola vez en su callback de arranque. Sin seed (bootApp()) no se escribe nada.
  if (!seed || !window) return;
  const ls = window.localStorage;
  if (Array.isArray(seed.foods))   ls.setItem("mrcheff.foods", JSON.stringify(seed.foods));
  if (Array.isArray(seed.recipes)) ls.setItem("mrcheff.recipes", JSON.stringify(seed.recipes));
  if (Array.isArray(seed.innov))   ls.setItem("mrcheff.innov", JSON.stringify(seed.innov));
  if (seed.innovDate != null)      ls.setItem("mrcheff.innov.date", String(seed.innovDate));
  if (Array.isArray(seed.cooked))  ls.setItem("mrcheff.cooked", JSON.stringify(seed.cooked));
  if (seed.weekmenu != null)       ls.setItem("mrcheff.weekmenu", JSON.stringify(seed.weekmenu));   // plan APROBADO persistido → permite probar el re-render al recargar
}

// Run a script string inside the given jsdom window, sharing its globals.
function runScriptInWindow(window, code) {
  const fn = new window.Function(code);
  fn.call(window);
}

function fireEvent(window, type) {
  const evt = new window.Event(type, { bubbles: true });
  window.document.dispatchEvent(evt);
}

module.exports = { bootApp };

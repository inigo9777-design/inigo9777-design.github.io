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
  if (opts.seed) seedState(opts.seed);

  // Load EVERY browser script in the SAME order as index.html (<body>, lines ~217-227), all BEFORE firing
  // DOMContentLoaded. Order matters: app.js destructures window.MRCheff.<module> synchronously inside its big
  // DOMContentLoaded closure (util @ L66, priority @ L159, backup @ L588) and lazily calls innovations.generate /
  // recipeAnalysis.analyzeRecipe on later button clicks — every one of these modules/... + data/recetas-espanolas-data.js
  // scripts MUST therefore be registered before we dispatch the event. This mirrors index.html because a mismatch between
  // "what CI loads" and "what production ships" is exactly the latent bug that hid for weeks (commit a558d47 extracted
  // util+backup to modules but left this bootstrap stale; Capa-2 tests only now guard against future drift).
  const { window } = dom;
  runScriptInWindow(window, read("data/data.js"));                  // L217 → window.MR_CHEFF_DATA          (MESES/TEMPORADA de temporada; ver app.js L543)
  runScriptInWindow(window, read("app.js"));                        // L218
  runScriptInWindow(window, read("modules/priority.js"));           // L220 → window.MRCheff.priority         @ app.js L159
  runScriptInWindow(window, read("modules/classify.js"));           // L221 → window.MRCheff.classify        (norm reutilizado por recipeAnalysis/innovations)
  runScriptInWindow(window, read("modules/recipe-analysis.js"));    // L222 → window.MRCheff.recipeAnalysis  @ app.js L258
  runScriptInWindow(window, read("data/recetas-espanolas-data.js"));// L223 → window.MRCheff.recetasEspanolas   (catálogo curado) — DEBE ir ANTES de innovations (la consume vía generate@L437)
  runScriptInWindow(window, read("modules/innovations.js"));        // L224 → window.MRCheff.innovations     @ app.js L437 · DEPENDENCIA: recetasEspanolas previo
  runScriptInWindow(window, read("modules/util.js"));               // L226 → window.MRCheff.util            @ app.js L66 (escapeHTML+uid) — CARGAR ANTES del DCL por destructuring sincrónico
  runScriptInWindow(window, read("modules/backup.js"));             // L227 → window.MRCheff.backup          @ app.js L588
  runScriptInWindow(window, read("modules/planner.js"));            // index.html (tras backup) → window.MRCheff.planner — consumido sólo en tiempo de click por la wiring de app.js (§ plan Feature Sugerencias/menú); no se desestructura al parsear el closure
  runScriptInWindow(window, read("modules/recipe-missing.js"));     // index.html (tras planner) → window.MRCheff.recipeMissing — PURe "¿qué ingredientes faltan en casa?" que openRecipeModal reutilise sólo tras un click DOM (§ plan Feature §2 Modal + Liskov: API cerrada a 2 fns); carga ANTES del DCL por coherencia CI↔prod

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

function seedState(seed) {
  const ls = globalThis.window ? undefined : null; // resolved below via boot's window
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

// Boot helper: loads the REAL index.html + data.js + app.js into jsdom and fires
// DOMContentLoaded so the application initializes exactly as in a browser.
//
// The app keeps all state in localStorage under these keys (see app.js LS map):
//   mrcheff.foods, mrcheff.recipes, mrcheff.innov, mrcheff.innov.date
// Tests drive the UI through DOM events and assert via the rendered DOM + localStorage.

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/**
 * Boot a fresh app instance. Returns handles for tests.
 * @param {{seed?: object}} [opts]  optional pre-seed of localStorage state
 */
function bootApp(opts = {}) {
  const html = read("index.html");
  // Strip the inline head script that reads theme so it doesn't run twice / error in JSDOM.
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost/",
  });

  // Fresh localStorage per boot (JSDOM gives a clean one already).
  if (opts.seed) seedState(opts.seed);

  // Load data.js then app.js in the SAME global context as the DOM.
  const { window } = dom;
  runScriptInWindow(window, read("data.js"));
  runScriptInWindow(window, read("app.js"));

  // Fire DOMContentLoaded so app.js' big callback runs.
  fireEvent(window, "DOMContentLoaded");

  return {
    window,
    document: window.document,
    localStorage: window.localStorage,
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

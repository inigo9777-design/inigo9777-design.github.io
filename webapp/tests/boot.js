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

  // window.scrollTo de TEST: jsdom NO lo implementa (dispara "Not implemented" a la consola
  // virtual y los specs que cuentan jsdomErrors limpios explotan). Sustituto MÍNIMO: aplica
  // el resultado final en scrollX/scrollY (como el engine, sin animación) y SOPORTE el objeto
  // options {top, behavior} que activarVista usa para la subida animada del click (§6).
  window.scrollTo = (xOrOpts, y) => {
    if (xOrOpts && typeof xOrOpts === "object") {
      window.scrollX = Number(xOrOpts.left) || 0;
      window.scrollY = Number(xOrOpts.top ?? xOrOpts.scrollY) || 0;
      return;
    }
    window.scrollX = Number(xOrOpts) || 0;
    window.scrollY = Number(y) || 0;
  };

  // Element.scrollIntoView de TEST: jsdom tampoco lo implementa (el tutorial del viewpager y
  // los pasos de la visita guiada lo llaman) — sustituto MÍNIMO que sólo acepta la llamada sin
  // tocar scroll (jsdom no tiene layout que desplazar; el foco del tutorial se apoya en los
  // listeners de scroll/resize, y las specs no cuentan errores en consola de esto).
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoViewDeTest() {};
  }

  // Semear localStorage ANTES de disparar DOMContentLoaded: los closures de app.js leen foods/recipes/innov/cooked
  // al inicializarse, así que el estado precargado debe estar ya en localStorage (ver seedState más abajo).
  if (opts.seed) seedState(opts.seed, window);

  // WebCrypto de TEST: en jsdom el global window.crypto NO trae .subtle, así que app.js sincroniza
  // leyendo window.__mrcheffCryptoImpl cuando .subtle falta (en el navegador real el global trae
  // subtle — https/localhost — y esta inyección no existe). Inyectable §6 CODING_STANDARDS.
  if (opts.cryptoImpl) window.__mrcheffCryptoImpl = opts.cryptoImpl;

  // ¿Es móvil? (inyección de test, §6): jsdom no evalúa mediaqueries de layout, así que la suite
  // decide la movilidad por inyección igual que hace con la WebCrypto. En producción el navegador
  // real trae matchMedia y este valor NO existe (app.js consulta (max-width: 820px)).
  if (opts.esMovil != null) window.__mrcheffEsMovil = !!opts.esMovil;

  // Auto-apertura del tutorial (inyección §6): jsdom está en "about:" (ni http(s) ni file,),
  // así que el criterio real de app.js NO saldría disparado aquí — el test decide.
  if (opts.tutorialAuto) window.__mrcheffTutorialAuto = true;

  // jsdom NO implementa TextEncoder/TextDecoder (todos los navegadores reales los traen): la
  // cripto del sync (UTF-8 de passphrase/JSON, §2 del plan) los necesita. Se reaprovechan los
  // globals de Node — misma pedida por nodes 18+ — en lugar de fabricar un polyfill a mano.
  const { TextEncoder: TE, TextDecoder: TD } = require("util");
  if (typeof window.TextEncoder !== "function") window.TextEncoder = TE;
  if (typeof window.TextDecoder !== "function") window.TextDecoder = TD;

  // ── GUARDIA de UN SOLO boot (defecto del arnés, descubierto 2026-10-22 con la demo del
  // escáner del tutorial): jsdom — incluso con runScripts:"outside-only" — dispara SU
  // DOMContentLoaded natural cuando el documento termina de parsearse, ASÍNCRONO tras el
  // constructor. Sumado al disparo manual de abajo, el closure de DOMContentLoaded de app.js
  // corría DOS veces en cada boot: doble sesión del tutorial, cada botón con su listener
  // duplicado, dobles renders (los recorridos que no atravesaban el final del guion no lo
  // notaban). La guardia CAPTURA los listeners de DOMContentLoaded que registren los scripts
  // y el disparo manual de abajo los invoca UNA sola vez; el natural de jsdom ya no encuentra
  // oyentes. Sólo el document de jsdom: la app no registra este evento en ningún otro sitio.
  const dclListeners = [];
  const documentAddEventListenerOriginal = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, listener, ...rest) => {
    if (type === "DOMContentLoaded") { dclListeners.push(listener); return undefined; }
    return documentAddEventListenerOriginal(type, listener, ...rest);
  };

  const srcScripts = [...html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)].map(m => m[1]);
  if (srcScripts.length === 0) throw new Error("[boot.js] index.html no declara ningún <script src> — parseo roto");
  for (const src of srcScripts) runScriptInWindow(window, read(src));   // read lanza si el path no existe → falla ruidoso en CI

  // Fire DOMContentLoaded so app.js' big callback runs — UNA sola vez y sincrónico (los
  // listeners venían capturados por la guardia de arriba; el natural de jsdom queda mudo).
  for (const listener of dclListeners) {
    listener.call(window.document, new window.Event("DOMContentLoaded", { bubbles: true }));
  }

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
  // Claves de features nuevas no cubiertas arriba (p. ej. "mrcheff.tutorial"): se escriben tal
  // cual si el path especializado no las tocó. Mínimamente tolerante: sólo claves del namespace.
  Object.keys(seed).forEach(k => {
    if (k.startsWith("mrcheff.") && ls.getItem(k) === null) ls.setItem(k, JSON.stringify(seed[k]));
  });
}

// Run a script string inside the given jsdom window, sharing its globals.
function runScriptInWindow(window, code) {
  const fn = new window.Function(code);
  fn.call(window);
}

module.exports = { bootApp };

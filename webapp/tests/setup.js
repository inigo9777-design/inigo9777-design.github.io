// Global setup: polyfills that jsdom lacks but app.js / real browsers have.

// TextEncoder / TextDecoder — whatwg-url (dependencia de jsdom) los necesita al cargarse y este entorno
// Jest+Node no los expone por defecto, aunque un navegador real sí. Polyfill estándar con el módulo 'util'
// de Node. Debe correr ANTES que cualquier require("jsdom") → se coloca a lo alto del setup por eso.
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// requestAnimationFrame (used by toast()) — jsdom doesn't provide it.
if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = id => clearTimeout(id);
}

// scrollIntoView is not implemented in jsdom and app.js calls it on generate.
window.HTMLElement.prototype.scrollIntoView = function () {};

// URL.createObjectURL / revokeObjectURL are used by the export button.
if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  URL.createObjectURL = () => `blob:mock/${++n}`;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

// Clipboard API mock with controllable success/failure.
class MockClipboard {
  constructor() { this.writeText = jest.fn().mockResolvedValue(undefined); }
}
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  get() { return global.__clipboardMock || (global.__clipboardMock = new MockClipboard()); },
  set(v) { global.__clipboardMock = v; }
});

// FileReader is present in jsdom but ensure readAsText works synchronously-ish.
if (!window.FileReader) {
  window.FileReader = class {
    readAsText(file) { this.result = file.__text || ""; setTimeout(() => this.onload && this.onload(), 0); }
    abort() {}
  };
}

// Matcher mínimo toHaveSize (Jest core no lo incluye y no hay jest-extended en deps):
// comprueba el tamaño de un array/Set/Map/objeto con propiedad length o size.
expect.extend({
  toHaveSize(received, expected) {
    const pass = received != null &&
      (typeof received.length === "number" || typeof received.size === "number") &&
      ((received.size ?? received.length) === expected);
    return {
      pass,
      message: () => `expected ${this.utils.printReceived(received)} to have size ${expected}`,
    };
  },
});

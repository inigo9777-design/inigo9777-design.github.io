// Global setup: polyfills that jsdom lacks but app.js / real browsers have.

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

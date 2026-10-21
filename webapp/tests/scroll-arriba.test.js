// tests/scroll-arriba.test.js — CAPA UNITARIA (CODING_STANDARDS.md §6 Capa 1).
// modules/scroll-arriba.js es puro (el window va inyectado): regla de visibilidad del botón
// flotante "subir encima", ejecución del salto y detección de reduce-motion.
const scrollArriba = require("../modules/scroll-arriba.js");

describe("scrollArriba — botón flotante 'subir encima' (feature 2026-10-21)", () => {

  describe("debeMostrarseBoton(subida, umbral) — aparece tras subir, se oculta arriba del todo", () => {
    it("arriba del todo (0) → oculto; tras pasar el umbral → visible", () => {
      expect(scrollArriba.debeMostrarseBoton(0, 800)).toBe(false);
      expect(scrollArriba.debeMostrarseBoton(800, 800)).toBe(false);   // empate: sigue oculto (estricto)
      expect(scrollArriba.debeMostrarseBoton(801, 800)).toBe(true);
      expect(scrollArriba.debeMostrarseBoton(1, 0)).toBe(true);
    });

    it("valores raros (NaN, Infinity, negativos) se acampan a 0: nunca queda pegado", () => {
      expect(scrollArriba.debeMostrarseBoton(NaN, 800)).toBe(false);
      expect(scrollArriba.debeMostrarseBoton(-50, 800)).toBe(false);
      expect(scrollArriba.debeMostrarseBoton(Infinity, 800)).toBe(false);   // non-finite ⇒ 0 (contrato del módulo)
    });

    it("umbral ausente/roto ⇒ 0: con cualquier subida > 0 se muestra", () => {
      expect(scrollArriba.debeMostrarseBoton(1, undefined)).toBe(true);
      expect(scrollArriba.debeMostrarseBoton(1, NaN)).toBe(true);
      expect(scrollArriba.debeMostrarseBoton(0, undefined)).toBe(false);
    });
  });

  describe("subirEncima(win, opts) — animación, reduce-motion y fallback de WebView viejo", () => {
    const espiaWin = (queFalla) => {
      const llamadas = [];
      return {
        llamadas,
        scrollTo: (o, y) => {
          llamadas.push(o && typeof o === "object" ? { top: o.top, behavior: o.behavior } : [o, y]);
          if (queFalla && o && typeof o === "object") throw new TypeError("options no soportado");
        }
      };
    };

    it("normal: options object animado (behavior smooth, top 0) — la animación pedida", () => {
      const w = espiaWin(false);
      scrollArriba.subirEncima(w);
      expect(w.llamadas).toEqual([{ top: 0, behavior: "smooth" }]);
    });

    it("reduce-motion: mismo salto pero 'auto' (sin empujar a quien pidió calmado)", () => {
      const w = espiaWin(false);
      scrollArriba.subirEncima(w, { reducido: true });
      expect(w.llamadas).toEqual([{ top: 0, behavior: "auto" }]);
    });

    it("WebView viejo: si el options object falla, el salto legacy sin animación lo salva", () => {
      const w = espiaWin(true);        // options object siempre rechazado (WebView viejo)
      scrollArriba.subirEncima(w);
      expect(w.llamadas).toEqual([{ top: 0, behavior: "smooth" }, [0, 0]]);
    });
  });

  describe("movimientoReducido(win) — prefers-reduced-motion tolerante", () => {
    it("true con matchMedia activo, false si el entorno no lo soporta", () => {
      expect(scrollArriba.movimientoReducido({
        matchMedia: (q) => ({ matches: q === "(prefers-reduced-motion: reduce)" })
      })).toBe(true);
      expect(scrollArriba.movimientoReducido({ matchMedia: () => ({ matches: false }) })).toBe(false);
      expect(scrollArriba.movimientoReducido({})).toBe(false);
      expect(scrollArriba.movimientoReducido(null)).toBe(false);
    });
  });
});

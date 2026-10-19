// tests/viewpager-scroll.integration.test.js — integración (Capa 2, CODING_STANDARDS.md §6).
// Memoria de scroll POR VISTA del viewpager (petición 2026-10-20): en móvil las listas son
// largas y cada tab debe recuperar SU posición al llegar por swipe; el click directo en la
// categoría del topbar es el gesto "empezar de nuevo" — sube a arriba CON animación (y el
// capture-at-leave ya resetea la posición de esa vista: sale de una vista que está en top).
//  - el wiring vive en app.js·activarVista(view, origen): la vista SALIENTE se capta ANTES
//    de tocar las clases (el alto del documento cambia al ocultarse) y el destino se aplica
//    después; la memoria/defaults son puros (modules/swipe-tabs.js).
//  - jsdom no calcula métricas de layout: scrollY/innerHeight/scrollHeight quedan INYECTADAS
//    por el test (como hace boot.js con esMovil/crypto, §6) y window.scrollTo es un espía
//    que recoge los parámetros de cada llamada: la ANIMACIÓN no puede probarse aquí — el
//    real browser va en e2e/scroll-vistas.mjs; aquí se prueba A QUIÉN se llama y con qué.
const { bootApp } = require("./boot");

function arrancar() {
  const app = bootApp();
  let scrollY = 0;
  Object.defineProperty(app.window, "scrollY", { configurable: true, get: () => scrollY });
  Object.defineProperty(app.window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(app.document.documentElement, "scrollHeight", { configurable: true, get: () => 2000 });
  const scrollTo = jest.fn();
  app.window.scrollTo = scrollTo;
  return { app, scrollTo, ponerScroll: (y) => { scrollY = y; } };
}

// Gesto sintético sobre .content (el wiring excluye inputs/botones y scroller-x internos:
// jsdom no trae Touch, así que el visitor lleva las listas de puntos como propiedades del Event).
function swipe(app, deX, aX) {
  const zona = app.document.querySelector(".content");
  const inicio = new app.window.Event("touchstart", { bubbles: true });
  inicio.touches = [{ clientX: deX, clientY: 300 }];
  zona.dispatchEvent(inicio);
  const fin = new app.window.Event("touchend", { bubbles: true });
  fin.changedTouches = [{ clientX: aX, clientY: 295 }];
  zona.dispatchEvent(fin);
}

const vistaActiva = (app) => app.document.querySelector(".view.active").id;

describe("viewpager: memoria de scroll por vista (integración app.js·activarVista)", () => {
  it("click en OTRA categoría sube arriba con animación (smooth) y capta la posición saliente", () => {
    const { app, scrollTo, ponerScroll } = arrancar();
    ponerScroll(900);
    app.document.querySelector('[data-view="seasonal"]').click();
    expect(vistaActiva(app)).toBe("view-seasonal");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("swipe restaura SIN animación la posición que la vista dejó (scrollTo(0, y), sin objeto)", () => {
    const { app, scrollTo, ponerScroll } = arrancar();
    ponerScroll(900);
    app.document.querySelector('[data-view="seasonal"]').click();          // sale de foods: captura foods=900
    scrollTo.mockClear();
    swipe(app, 360, 140);                                                  // swipe IZQUIERDA (=+1): wrap seasonal → foods
    expect(vistaActiva(app)).toBe("view-foods");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 900);
  });

  it("la posición guardada se sujeta al alto scrolleable real del documento", () => {
    const { app, scrollTo, ponerScroll } = arrancar();
    ponerScroll(5000);                                                     // guardado imposible (alto real: 2000-800=1200)
    app.document.querySelector('[data-view="seasonal"]').click();          // captura foods=5000
    scrollTo.mockClear();
    swipe(app, 360, 140);                                                  // izquierda → foods (wrap)
    expect(scrollTo).toHaveBeenCalledWith(0, 1200);
  });

  it("vistas sin posición guardada al llegar por swipe → arriba (default del módulo)", () => {
    const { app, scrollTo } = arrancar();
    swipe(app, 360, 140);                                                  // foods → recipes (swipe directa sin click antes)
    expect(vistaActiva(app)).toBe("view-recipes");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("ir y volver por swipe: la posición de CADA vista es independiente", () => {
    const { app, scrollTo, ponerScroll } = arrancar();
    swipe(app, 360, 140);                                                  // foods → recipes (touchend capta foods=0)
    ponerScroll(400);                                                      // la persona baja en recipes
    swipe(app, 360, 140);                                                  // recipes → innovation (touchend capta recipes=400)
    scrollTo.mockClear();
    swipe(app, 140, 360);                                                  // atrás: recipes → RESTAURA 400
    expect(vistaActiva(app)).toBe("view-recipes");
    expect(scrollTo).toHaveBeenCalledWith(0, 400);
  });

  it("click en el tab YA activo también vale arriba (empezar de nuevo en el mismo tab)", () => {
    const { app, scrollTo } = arrancar();
    app.document.querySelector('[data-view="foods"]').click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

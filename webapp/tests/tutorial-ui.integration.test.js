// tests/tutorial-ui.integration.test.js — CAPA DE INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// Wiring REAL de app.js del TUTORIAL interactivo (feature 2026-10-20): boot de index.html +
// data.js + app.js en jsdom, eventos DOM de verdad, persistencia en localStorage.
//  - jsdom no soporta layout: los rects valen 0 — sólo se aserciona el ESTADO del molde
//    (clases/textos/estilos inline), no la geometría del foco; esa verificación vive en el
//    e2e de Brave (e2e/tutorial.mjs).
//  - jsdom está en "about:" así que el criterio real de auto-arranque (http/https) no sale
//    disparado aquí: bootApp({ tutorialAuto: true }) lo inyecta (licencia §6 de boot.js).
//  - El reposicionado va por rAF (jsdom·pretendToBeVisual dispara frames con timers reales):
//    tras cada avance se espera ~40ms antes de asercionar el posicionado del molde.
//  - Segunda visita y cierre persistente via LS "mrcheff.tutorial".
const { bootApp } = require("./boot");

const raiz = (app) => app.document.getElementById("tutorial");
const abierto = (app) => !raiz(app).classList.contains("hidden");
const esperarFrames = () => new Promise(r => setTimeout(r, 40));   // rAF de jsdom son timers reales

describe("tutorial interactivo — wiring app.js", () => {
  it("PRIMERA visita (auto inyectado): se abre solo tras el retardo inicial (500ms)", async () => {
    const app = bootApp({ tutorialAuto: true });
    expect(abierto(app)).toBe(false);
    await new Promise(r => setTimeout(r, 700));
    expect(abierto(app)).toBe(true);
    expect(raiz(app).getAttribute("role")).toBe("dialog");
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Bienvenido");
    // paso sin foco: botón avanzar visible, pista oculta, tarjeta centrada
    expect(app.document.getElementById("tutorial-avanzar").classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("tutorial-pista").classList.contains("hidden")).toBe(true);
    expect(app.document.getElementById("tutorial-tarjeta").classList.contains("tutorial-centrado")).toBe(true);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 1");
  });

  it("visita CON el visto guardado: NO se abre solo (el cierre del usuario se respeta)", async () => {
    const app = bootApp({ tutorialAuto: true, seed: { "mrcheff.tutorial": { visto: true } } });
    await new Promise(r => setTimeout(r, 700));
    expect(abierto(app)).toBe(false);
  });

  it("SIN auto (file://): nunca se abre por sí mismo", async () => {
    const app = bootApp({});
    await new Promise(r => setTimeout(r, 700));
    expect(abierto(app)).toBe(false);
  });

  it("recorrido completo con guion inyectado: Siguiente → foco en cabecera → Terminar cierra y guarda", async () => {
    const app = bootApp({ tutorialAuto: true });
    await new Promise(r => setTimeout(r, 700));
    // Guion de 3 pasos inyectado en el módulo de la ventana (el wiring lee el guion VIVO en
    // cada paso): desacopla el test del contenido real mientras crecen las pantallas de la épica.
    const tut = app.window.MRCheff.tutorial;
    tut.PASOS.splice(0, tut.PASOS.length,
      { id: "bienvenida", vista: null, selector: null, accionable: false, titulo: "Bienvenido", texto: "Prueba.", cta: "Adelante" },
      { id: "cabecera", vista: null, selector: ".topbar-actions", accionable: false, titulo: "La cabecera", texto: "Prueba.", cta: "Empecemos" },
      { id: "listo", vista: null, selector: null, accionable: false, titulo: "Listo", texto: "Prueba.", cta: "Terminar" }
    );
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Bienvenido");   // pintó el paso 1 real antes del splice
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();                                            // → cabecera (con foco en .topbar-actions)
    await esperarFrames();
    expect(abierto(app)).toBe(true);
    expect(app.document.getElementById("tutorial-titulo").textContent).toBe("La cabecera");
    expect(app.document.getElementById("tutorial-foco").style.width).not.toBe("");   // el foco se dimensionó
    expect(app.document.getElementById("tutorial-tarjeta").classList.contains("tutorial-centrado")).toBe(false);
    expect(raiz(app).querySelectorAll("#tutorial-puntos span").length).toBe(3);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 2");
    avanzar.click();                                            // → listo (Terminar)
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                            // Terminar → cierra + LS
    expect(abierto(app)).toBe(false);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });

  it("la X cierra YA (avance o no) y también marca visto", async () => {
    const app = bootApp({ tutorialAuto: true });
    await new Promise(r => setTimeout(r, 700));
    app.document.getElementById("tutorial-cerrar").click();
    expect(abierto(app)).toBe(false);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });

  it("Escape cierra la visita (accesibilidad) igual que la X", async () => {
    const app = bootApp({ tutorialAuto: true });
    await new Promise(r => setTimeout(r, 700));
    app.document.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(abierto(app)).toBe(false);
  });

  it("el botón 🎓 de la cabecera REABRE el tutorial desde cero (aunque ya esté visto)", async () => {
    const app = bootApp({ seed: { "mrcheff.tutorial": { visto: true } } });
    app.document.getElementById("btn-tutorial").click();
    expect(abierto(app)).toBe(true);
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Bienvenido");
    await esperarFrames();
    // la ✕ de esta segunda vuelta registra de nuevo el visto (queda true: nada cambia)
    app.document.getElementById("tutorial-cerrar").click();
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });

  it("arranca sin romper y deja la app viva (si el módulo faltara, el guard lo aguanta)", () => {
    const app = bootApp({ tutorialAuto: true });
    expect(app.document.querySelector(".topbar .tab")).toBeTruthy();
    expect(app.window.MRCheff.tutorial).toBeTruthy();
    expect(app.document.getElementById("btn-tutorial")).toBeTruthy();
  });
});

describe("tutorial interactivo — pantalla ALIMENTOS (pasos accionables)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  const conGuionDeAlimentos = (tut) => {
    // Guion corto con el BLOQUE REAL de Alimentos (objetos vivos del módulo): bienvenida +
    // los 3 pasos de la vista + cierre — lo que la persona viviría en sus primeros pasos.
    const bienvenida = tut.PASOS[0];
    const alimentos = tut.pasosDeVista("foods");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...alimentos, listo);
  };

  it("paso accionable: pista visible y SIN botón; el click en el target AVANZA y ejecuta su función real", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    conGuionDeAlimentos(app.window.MRCheff.tutorial);
    app.document.getElementById("tutorial-avanzar").click();     // bienvenida → alimento #1 (#food-name, accionable)
    await dormir(60);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 2 de 5");
    expect(app.document.getElementById("tutorial-pista").classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("tutorial-avanzar").classList.contains("hidden")).toBe(true);
    app.document.getElementById("food-name").click();            // el toque REAL + avance del paso (el foco real lo mira el e2e de Brave; jsdom no enfoca al hacer click)
    await dormir(60);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 3 de 5");
  });

  it("tercer paso informativo: botón Siguiente vuelve; 'Terminar' graba la visita", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    conGuionDeAlimentos(app.window.MRCheff.tutorial);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();                                             // → alimento #1 accionable
    app.document.getElementById("food-name").click();            // → alimento #2 accionable (#food-score)
    app.document.getElementById("food-score").click();           // el slider también acepta su click real (su efecto visual lo mira el e2e)
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Inventario");
    expect(app.document.getElementById("tutorial-pista").classList.contains("hidden")).toBe(true);
    expect(avanzar.classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 4 de 5");
    avanzar.click();                                             // → listo
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                             // cierre + visto
    expect(app.document.getElementById("tutorial").classList.contains("hidden")).toBe(true);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });
});

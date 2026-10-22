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
    // velo COMPLETO en pasos sin foco: el "arriba" cubre todo el alto de la ventana
    expect(app.document.querySelector(".tutorial-arriba").style.height).toBe(String(app.window.innerHeight) + "px");
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
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 2 de 6");
    expect(app.document.getElementById("tutorial-pista").classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("tutorial-avanzar").classList.contains("hidden")).toBe(true);
    app.document.getElementById("food-name").click();            // el toque REAL + avance del paso (la visita silencia el foco: el campo no enfoca — lo fija el test de silencio y el e2e de Brave)
    await dormir(60);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 3 de 6");
  });

  it("la visita SILENCIA los campos del guion: pointerdown en el target no puede enfocar (teclado del PWA fuera)", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    conGuionDeAlimentos(app.window.MRCheff.tutorial);
    app.document.getElementById("tutorial-avanzar").click();     // bienvenida → #food-name (accionable)
    await dormir(60);
    const campo = app.document.getElementById("food-name");
    const pd = new app.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    campo.dispatchEvent(pd);
    expect(pd.defaultPrevented).toBe(true);                      // el focus se cancela: sin teclado en el PWA instalable
    // el pointerdown por sí SOLO no avanza (el paso continúa con su click)
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 2 de 6");
    // fuera de la visita la app queda tal cual: el mismo gesto SIN tutorial no se cancela
    app.document.getElementById("tutorial-cerrar").click();
    const pdFuera = new app.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    campo.dispatchEvent(pdFuera);
    expect(pdFuera.defaultPrevented).toBe(false);
  });

  it("tercer paso informativo y cuarto DEMO: avanzar llega al escáner; confirmado el pase, Terminar graba la visita", async () => {
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
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 4 de 6");
    avanzar.click();                                             // inventario → DEMO del escáner (paso 5, accionable)
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Escanea el ticket");
    // La demo se recorre con SUS diálogos: nada se escribe (aserto fino en el describe propio de abajo)
    app.document.getElementById("btn-ocr-foto").click();
    await dormir(60);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(false);
    app.document.querySelector("[data-confirmar-exactos]").click();   // diálogo 1 → diálogo 2
    app.document.querySelector("[data-revision-guardar]").click();    // fin de la demo: cierra y avanza
    await dormir(60);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 6 de 6");
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                             // cierre + visto
    expect(app.document.getElementById("tutorial").classList.contains("hidden")).toBe(true);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });

  it("el paso DEMO del escáner detiene el gesto real: NO se abre el file-picker y sus diálogos salen con banner", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    conGuionDeAlimentos(app.window.MRCheff.tutorial);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();
    app.document.getElementById("food-name").click();
    app.document.getElementById("food-score").click();
    avanzar.click();                                             // inventario → demo del escáner
    await dormir(40);
    // Espía del open del file input: si el click REAL llegara al botón, lo abriría (regresión del stopPropagation)
    let abrirFichero = 0;
    const fileInput = app.document.getElementById("ocr-file");
    const nativoAbrir = fileInput.click.bind(fileInput);
    fileInput.click = () => { abrirFichero += 1; nativoAbrir(); };
    app.document.getElementById("btn-ocr-foto").click();
    await dormir(60);
    expect(abrirFichero).toBe(0);                                // el gesture no llega al botón real
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(false);
    expect(app.document.querySelector(".ocr-demo-banner").textContent).toContain("nada se guarda");
    expect(app.document.querySelector(".exact-qty")).toBeTruthy();      // el diálogo 1 (filas exactas)
  });
});

describe("tutorial interactivo — pantalla RECETAS (dos accionables + mis recetas)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  const saltarARecetas = (tut) => {
    // bienvenida + [bloque recipes real] + cierre: patrón de guion corto, siempre presente en la épica
    const bienvenida = tut.PASOS[0];
    const recetas = tut.pasosDeVista("recipes");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...recetas, listo);
    return recetas.length;
  };

  it("cambiar de vista al entrar en un paso y avanzar por sus dos targets accionables", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    const nRecetas = saltarARecetas(app.window.MRCheff.tutorial);
    expect(nRecetas).toBe(3);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();                                             // bienvenida → receta#1 (#recipe-desc): SALTA a recipes
    await dormir(60);
    expect(app.document.getElementById("view-recipes").classList.contains("active")).toBe(true);
    expect(app.document.getElementById("view-foods").classList.contains("active")).toBe(false);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 2 de 5");
    app.document.getElementById("recipe-desc").click();          // → #2 buscador
    app.document.getElementById("recipe-catalog-search").click(); // → #3 mis recetas (informativo)
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Mis recetas");
    expect(avanzar.textContent).toBe("Siguiente");
    avanzar.click();                                             // → listo
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });
});

describe("tutorial interactivo — pantalla INNOVACIÓN (generar ideas de verdad)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  it("con despensa sembrada: el click real del generador produce el lote y el paso avanza", async () => {
    const app = bootApp({
      tutorialAuto: true,
      seed: { foods: [{ id: "f1", name: "Huevos", score: 8, qty: 6, min: 2, checked: false }] },
    });
    await dormir(700);
    const tut = app.window.MRCheff.tutorial;
    const bienvenida = tut.PASOS[0];
    const innovacion = tut.pasosDeVista("innovation");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...innovacion, listo);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();                                             // bienvenida → innovación#1 (SALTA a la vista)
    await dormir(60);
    expect(app.document.getElementById("view-innovation").classList.contains("active")).toBe(true);
    app.document.getElementById("btn-generate-innov").click();   // el botón REAL genera (lote del catálogo)
    await dormir(60);
    expect(app.document.getElementById("innovation-list").children.length).toBeGreaterThan(0);  // lote real en pantalla
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Un lote");
    avanzar.click();                                             // → listo
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                             // cierre + visto
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });

  it("con la despensa vacía el generador avisa (toque honesto) y el tutorial sigue igual", async () => {
    const app = bootApp({ tutorialAuto: true });                 // primera visita REAL: sin nada
    await dormir(700);
    const tut = app.window.MRCheff.tutorial;
    const bienvenida = tut.PASOS[0];
    const innovacion = tut.pasosDeVista("innovation");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...innovacion, listo);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();
    await dormir(60);
    app.document.getElementById("btn-generate-innov").click();   // genera con despensa vacía → toast
    await dormir(60);
    expect(app.document.getElementById("toast").textContent).toContain("Añade alimentos");
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Un lote");   // avanzó sin atascarse
  });
});

describe("tutorial interactivo — pantalla SUGERENCIAS Y MENÚ (plan real de la semana)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  it("sugerencias + menú con despensa sembrada: ambos clicks generan contenido real y avanzan", async () => {
    const app = bootApp({
      tutorialAuto: true,
      seed: {
        foods: [
          { name: "Pan", qty: 5, min: 1, score: 5 },
          { name: "Tomate", qty: 5, min: 1, score: 5 },
          { name: "Ajo", qty: 5, min: 1, score: 5 },
          { name: "Aceite de oliva", qty: 5, min: 1, score: 5 },
          { name: "Sal", qty: 5, min: 1, score: 5 },
        ],
      },
    });
    await dormir(700);
    const tut = app.window.MRCheff.tutorial;
    const bienvenida = tut.PASOS[0];
    const menu = tut.pasosDeVista("suggest");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...menu, listo);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    avanzar.click();                                             // bienvenida → sugerencias#1 (SALTA a suggest)
    await dormir(60);
    expect(app.document.getElementById("view-suggest").classList.contains("active")).toBe(true);
    app.document.getElementById("btn-suggest-generate").click(); // sugerencias REALES
    await dormir(60);
    expect(app.document.getElementById("suggest-list").children.length).toBeGreaterThan(0);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 3 de 5");
    app.document.getElementById("btn-menu-generate").click();    // el plan 7×3 real
    await dormir(60);
    expect(app.document.getElementById("menu-plan-list").classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("menu-plan-list").children.length).toBeGreaterThan(0);
    expect(app.document.getElementById("menu-status").classList.contains("hidden")).toBe(false);
    expect(app.document.getElementById("tutorial-pista").classList.contains("hidden")).toBe(true);  // último informativo
    avanzar.click();                                             // → listo
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                             // cierre + visto
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });
});

describe("tutorial interactivo — pantalla TEMPORADA (cierre del tour por 5 vistas)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  it("el select de Temporada se SILENCIA: tocar #season-month avanza sin abrir la lista de meses", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    const tut = app.window.MRCheff.tutorial;
    const bienvenida = tut.PASOS[0];
    const temporada = tut.pasosDeVista("seasonal");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...temporada, listo);
    app.document.getElementById("tutorial-avanzar").click();     // bienvenida → temporada-mes (select, accionable)
    await dormir(60);
    expect(app.document.getElementById("view-seasonal").classList.contains("active")).toBe(true);
    const selector = app.document.getElementById("season-month");
    const pd = new app.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    selector.dispatchEvent(pd);
    expect(pd.defaultPrevented).toBe(true);                      // sin focus nativo → el picker de meses no llega a abrirse encima del paso siguiente
    selector.click();                                            // el click REAL avanza el paso igual
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Buena fruta");
  });

  it("RECORRIDO COMPLETO del guion real: 5 pantallas, salta de vista en vista y termina", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    const avanzar = app.document.getElementById("tutorial-avanzar");
    // El guion real ya está completo: bienvenida → cabecera → Alimentos×4 (anotar, importancia,
    // inventario y la DEMO del escáner) → Recetas×3 → Innovación×2 → Menú×3 → Temporada×2 →
    // listo (Terminar) = 17 pasos.
    expect(app.window.MRCheff.tutorial.totalPasos()).toBe(17);
    // bienvenida: tarjeta centrada sin foco (estado del molde por defecto)
    expect(app.document.getElementById("tutorial-tarjeta").classList.contains("tutorial-centrado")).toBe(true);
    // Cabecera
    avanzar.click();                                             // bienvenida → cabecera
    await dormir(70);
    avanzar.click();                                             // cabecera → Alimentos#1 (Empecemos)
    await dormir(70);
    // Alimentos: los dos accionables avanzan por su target
    app.document.getElementById("food-name").click();
    app.document.getElementById("food-score").click();
    avanzar.click();                                             // inventario (informativo)
    await dormir(70);
    // Alimentos#4 — la DEMO del escáner: se abre con sus dos diálogos y SIN escribir nada;
    // confirmados ambos, el paso sigue su curso (asertos finos en el describe propio).
    app.document.getElementById("btn-ocr-foto").click();
    await dormir(70);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(false);
    app.document.querySelector("[data-confirmar-exactos]").click();   // diálogo 1 → diálogo 2
    app.document.querySelector("[data-revision-guardar]").click();    // fin del pase: cierra y avanza
    await dormir(70);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(true);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.foods") || "[]")).toEqual([]);   // la demo NADA escribió
    // Recetas×3 (2 accionables): al cerrarse la demo ya avanzó al paso de Recetas (la vista cambió
    // con el paso; el click en el textarea sigue aquí para completar el recorrido).
    app.document.getElementById("recipe-desc").click();
    await dormir(70);
    expect(app.document.getElementById("view-recipes").classList.contains("active")).toBe(true);
    app.document.getElementById("recipe-catalog-search").click();
    avanzar.click();                                             // mis recetas
    await dormir(70);
    // Innovación×2: generador accionable (con la despensa vacía avisa por toast, pero el paso avanza igual)
    app.document.getElementById("btn-generate-innov").click();
    await dormir(70);
    expect(app.document.getElementById("view-innovation").classList.contains("active")).toBe(true);
    avanzar.click();                                             // lote
    await dormir(70);
    // Menú×3: sugerir + menú accionables
    app.document.getElementById("btn-suggest-generate").click();
    await dormir(70);
    expect(app.document.getElementById("view-suggest").classList.contains("active")).toBe(true);
    app.document.getElementById("btn-menu-generate").click();
    avanzar.click();                                             // aprobar (informativo)
    await dormir(70);
    // Temporada: último salto de vista
    app.document.getElementById("season-month").click();
    expect(app.document.getElementById("view-seasonal").classList.contains("active")).toBe(true);
    avanzar.click();                                             // cuadrícula informativa
    avanzar.click();                                             // → listo (Terminar)
    expect(avanzar.textContent).toBe("Terminar");
    avanzar.click();                                             // cierre + visto
    expect(app.document.getElementById("tutorial").classList.contains("hidden")).toBe(true);
    expect(JSON.parse(app.window.localStorage.getItem("mrcheff.tutorial")).visto).toBe(true);
  });
});

describe("tutorial — la DEMO del escáner (dos diálogos reales, datos de prueba, nada escrito)", () => {
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  const irAlPasoDemo = async (app) => {
    // Guion corto: bienvenida + el BLOQUE REAL de Alimentos (4 pasos, con la demo) + cierre.
    const tut = app.window.MRCheff.tutorial;
    const bienvenida = tut.PASOS[0];
    const alimentos = tut.pasosDeVista("foods");
    const listo = tut.PASOS[tut.PASOS.length - 1];
    tut.PASOS.splice(0, tut.PASOS.length, bienvenida, ...alimentos, listo);
    app.document.getElementById("tutorial-avanzar").click();     // → #food-name (accionable)
    app.document.getElementById("food-name").click();            // → #food-score (accionable)
    app.document.getElementById("food-score").click();           // → inventario (informativo)
    app.document.getElementById("tutorial-avanzar").click();     // → DEMO del escáner
    await dormir(60);
    return alimentos.find(p => p.demo === "escaner");
  };
  const despensaGuardada = (app) => JSON.parse(app.window.localStorage.getItem("mrcheff.foods") || "[]");

  it("el pase muestra el diálogo 1 con el alimento EXACTO de la despensa de juguete y el banner de demo; nada se escribe", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    await irAlPasoDemo(app);
    // Diálogo 1: banner + fila exacta LECHE ENTERA — "Ya tienes 1 en el inventario" LEÍDO de la despensa de juguete
    app.document.getElementById("btn-ocr-foto").click();          // el click lanza los diálogos de ejemplo
    await dormir(60);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(false);
    expect(app.document.querySelector(".ocr-demo-banner").textContent).toContain("Demo del tutorial");
    expect(app.document.querySelector(".ocr-demo-banner").textContent).toContain("nada se guarda");
    const filaExacta = app.document.querySelector(".ocr-item .ocr-nombre");
    expect(filaExacta.textContent).toContain("LECHE ENTERA");
    expect(filaExacta.textContent).toContain("Ya tienes 1 en el inventario");
    expect(despensaGuardada(app)).toEqual([]);                   // el flujo demo no toca la persistencia
    // Confirmar exactos → conduce a la revisión SIN tocar la despensa
    expect(app.document.querySelector("#modal-content .muted").textContent).toContain("toca Confirmar y revisar el resto");   // guía del paso en el intro
    expect(app.document.querySelector(".btn-demo-senal")).toBeTruthy();        // el botón del pase lleva la señal visual
    app.document.querySelector("[data-confirmar-exactos]").click();
    await dormir(60);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(false);
    expect(app.document.querySelector(".rev-seccion h3").textContent).toContain("Nuevos");
    const secciones = [...app.document.querySelectorAll(".rev-seccion h3")].map(h => h.textContent);
    expect(secciones).toEqual(["Nuevos", "Dudas"]);              // los dos apartados del diálogo 2
    // El nombre de cada fila vive en el VALUE del input (no es texto del nodo): el nuevo sale
    // del ticket literal y la duda trae su desplegable con la variante de la despensa de juguete.
    expect(app.document.querySelector(".rev-fila-nueva .rev-campo-nombre").value).toContain("GEL HIGIENE");
    // GEL HIGIENE es producto de HOGAR: el conmutador nace preseleccionado en 🏠 (diccionario).
    const filaNueva = app.document.querySelector(".rev-fila-nueva");
    expect(filaNueva.querySelector(".rev-cat-btn[data-cat='hogar']").getAttribute("aria-pressed")).toBe("true");
    expect(filaNueva.querySelector(".rev-cat-btn[data-cat='alimento']").getAttribute("aria-pressed")).toBe("false");
    const duda = app.document.querySelector(".rev-fila-duda");
    expect(duda.querySelector(".rev-campo-nombre").value).toContain("YOGUR");
    expect([...duda.querySelectorAll(".rev-campo-variante option")].some(o => o.textContent.includes("Yogur natural · tienes 2"))).toBe(true);
    // Guía de cierre del pase: texto en el intro y señal pulsante en el botón final.
    const introsRevisar = [...app.document.querySelectorAll("#modal-content > p.muted")].map(p => p.textContent).join(" ");
    expect(introsRevisar).toContain("toca Añadir a la despensa");
    expect(app.document.querySelector("[data-revision-guardar]").classList.contains("btn-demo-senal")).toBe(true);
    expect(despensaGuardada(app)).toEqual([]);
  });

  it("confirmada la revisión de la demo: modal cerrado, inventario intacto y el paso del tutorial avanza", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    await irAlPasoDemo(app);
    app.document.getElementById("btn-ocr-foto").click();
    await dormir(60);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 5 de 6");
    app.document.querySelector("[data-confirmar-exactos]").click();   // → revisión (demo)
    app.document.querySelector("[data-revision-guardar]").click();    // fin del pase
    await dormir(60);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(true);
    expect(despensaGuardada(app)).toEqual([]);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 6 de 6");   // avanzó al cierre
    expect(app.document.getElementById("tutorial-titulo").textContent).toContain("Ya sabes moverte");   // el paso listo
  });

  it("Cancelado el pase del diálogo 2: mismo desenlace — cierra, no escribe y avanza el paso", async () => {
    const app = bootApp({ tutorialAuto: true });
    await dormir(700);
    await irAlPasoDemo(app);
    app.document.getElementById("btn-ocr-foto").click();
    await dormir(60);
    app.document.querySelector("[data-confirmar-exactos]").click();   // → revisión (demo)
    const cancelar = [...app.document.querySelectorAll("[data-close]")].find(b => b.textContent.trim() === "Cancelar");
    cancelar.click();
    await dormir(60);
    expect(app.document.getElementById("modal").classList.contains("hidden")).toBe(true);
    expect(despensaGuardada(app)).toEqual([]);
    expect(app.document.getElementById("tutorial-anuncio").textContent).toContain("Paso 6 de 6");
  });
});

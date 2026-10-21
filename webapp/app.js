/* app.js · Mr Cheff — lógica de la aplicación
   Se ejecuta cuando el DOM está listo.
   Persiste en localStorage: mrcheff.foods, mrcheff.recipes, mrcheff.innov
*/

document.addEventListener("DOMContentLoaded", () => {
   // ===== TEMA (claro / oscuro) =====
  const LS_THEME = "mrcheff.theme";
  const root = document.documentElement;
  const themeBtn = document.getElementById("theme-toggle");

  function applyTheme(t) {
    root.dataset.theme = t;
    // El theme-color (franja del sistema / status bar del PWA) sigue al tema: en claro
    // quedaba el #17150f oscuro fijado en el <head> y arriba "flotaba" un negro ajeno.
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute("content", t === "dark" ? "#1b1913" : "#ffffff");
    if (themeBtn) {
      themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
      themeBtn.title = t === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    }
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  }

  // Sincroniza el icono con el tema ya aplicado por el <script> del <head>
  applyTheme(root.dataset.theme || "dark");

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }
  
  // ===== ESTADO Y PERSISTENCIA =====
  const LS = {
    foods: "mrcheff.foods",
    recipes: "mrcheff.recipes",
    innov: "mrcheff.innov",
    innovDate: "mrcheff.innov.date",
    cooked: "mrcheff.cooked",
    weekmenu: "mrcheff.weekmenu",
    // Sync por buzón GitHub (plan-sync-buzon §6): config + estado del protocolo. NUNCA passphrase.
    tutorial: "mrcheff.tutorial",
    syncConfig: "mrcheff.sync.config",
    syncDeviceId: "mrcheff.sync.deviceId",
    syncBase: "mrcheff.sync.base",
    syncPendiente: "mrcheff.sync.pendiente",
    syncConsumida: "mrcheff.sync.consumida"
    // (2026-10-21) Fuera `mrcheff.compraTicket`: el escáner del ticket ya no deja pendientes en la
    // lista de la compra — su revisión ocurre en los diálogos del propio escáner, en Alimentos.
  };

  const load = (key, def) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
    catch { return def; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  let foods = load(LS.foods, []);
  let recipes = load(LS.recipes, []);
  let innovations = load(LS.innov, []);
  let innovDay = load(LS.innovDate, "");

  // Limpiar innovaciones de días anteriores
  const today = new Date().toISOString().slice(0, 10);
  if (innovDay && innovDay !== today) {
    innovations = [];
    save(LS.innov, []);
    innovDay = today;
    save(LS.innovDate, innovDay);
  }


  // "Vista Recetas sucia": true si ha entrado una receta nueva DESDE FUERA de esta vista (hoy: el boton estrella en
  // Innovacion) y aun no la hemos repintado. Evita un re-render innecesario en cada cambio de tab; solo se pinta
  // cuando efectivamente hay algo nuevo que mostrar. Precedente identico al 'innovDay !== today' mas arriba (ver DIP, sec 2-D).
  let recetasDirty = false;
  // ===== HELPERS =====
  // uid() y escapeHTML() viven en modules/util.js, lógica PURa (sin DOM ni localStorage) anti-XSS e id-generación; ver
  // CODING_STANDARDS.md §3 option A / DIP y el patrón idéntico de priority.classify.recipeAnalysis.innovations bajo window.MRCheff.*.
  const { escapeHTML, uid, limpiarPaso, formatoFechaCorta } = window.MRCheff.util;
  const recipeEditor = window.MRCheff.recipeEditor;   // módulo puro del editor de recetas (modules/recipe-editor.js)

  // $/$$ son helpers DE VISTA (manipulan el DOM) → NO lógica de decisión: quedan en este closure como antes.
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Toast
  const toastEl = $("#toast");
  function toast(msg, type = "success") {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    toastEl.classList.add(type);
    requestAnimationFrame(() => toastEl.classList.add("show"));
    setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.classList.add("hidden"), 250);
    }, 2200);
  }

  // ===== NAVEGACIÓN DE VISTAS =====
  // El cambio de vista vive en UNA función: la llaman los clicks del topbar y el gesto
  // swipe (viewpager móvil, sección siguiente) — un solo lugar decide el estado activo.
  const tabs = $$(".tab");
  // El header sigue al contenido (el pill activo siempre a la vista): .tabs es un scroller-x
  // interno con scrollbar invisible en móvil y, llegando por swipe a las vistas de la derecha
  // (p. ej. "Temporada"), el activo quedaba FUERA de la ventana visible — el usuario seguía
  // viendo "Alimentos y Recetas" en el header tras 4 swipes (bug 2026-10-19, captura 28).
  // La decisión (centrar + fijar a [0, máximo]) vive en el módulo puro
  // (scrollIzquierdaParaTab); aquí sólo el metro de DOM y el scroll del scroller.
  function centrarTabActivo() {
    const pestaña = tabs.find(t => t.classList.contains("active"));
    if (!pestaña || pestaña.classList.contains("tab-side")) return;   // el side de backup no vive en .tabs
    const barra = pestaña.parentElement;
    if (!barra || barra.clientWidth <= 0) return;
    const rBarra = barra.getBoundingClientRect();
    const rTab = pestaña.getBoundingClientRect();
    const dominio = window.MRCheff && window.MRCheff.swipeTabs;
    const izquierda = dominio
      ? dominio.scrollIzquierdaParaTab({
          dentro: rTab.left - rBarra.left + barra.scrollLeft,
          anchoVisible: barra.clientWidth,
          anchoContenido: barra.scrollWidth,
          anchoTab: rTab.width,
        })
      : rTab.left - rBarra.left + barra.scrollLeft - (barra.clientWidth - rTab.width) / 2;
    if (Math.abs(barra.scrollLeft - izquierda) < 1) return;           // ya está a la vista
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    barra.scrollTo({ left: izquierda, behavior: reduce ? "auto" : "smooth" });
  }
  // Memoria de posición vertical POR VISTA del viewpager (petición 2026-10-20): cada tab
  // recuerda dónde se quedó y el swipe RECUPERA esa posición sin animación; el click
  // directo en la categoría del topbar es el gesto "empezar de cero" y sube a la parte
  // superior CON animación — y al salir de esa vista la captura de 0 la resetea por sí
  // sola (nada de memoria fantasma del click). La memoria (objeto puro) y el default
  // viven en modules/swipe-tabs.js; aquí sólo el metro del DOM y el punto de captura.
  const scrollVistas = window.MRCheff && window.MRCheff.swipeTabs.crearMemoriaScroll
    ? window.MRCheff.swipeTabs : null;
  const memoriaScroll = scrollVistas ? scrollVistas.crearMemoriaScroll() : {};

  function activarVista(view, origen) {
    soltarCandadoAlerta();                             // el candado vive sólo dentro de la vista de Alimentos
    // Captura de la vista SALIENTE antes de tocar las clases: el gesto que cambia de vista
    // (swipe en touchend / tab click) marca "cómo estaba" el scroll del documento — cuando
    // activa otra vista cambia el alto del documento (el alto oculto desaparece del canvas).
    const vistaSaliente = tabs.find(t => t.classList.contains("active"));
    const idSaliente = vistaSaliente && vistaSaliente.dataset.view;
    if (scrollVistas && idSaliente && idSaliente !== view) {
      scrollVistas.recordarScroll(memoriaScroll, idSaliente, window.scrollY);
    }
    tabs.forEach(t => {
      const es = t.dataset.view === view;
      t.classList.toggle("active", es);
      if (es) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
    });
    $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
    // Volver al tab de Recetas sin nada nuevo no debe re-pintar la lista (ineficiente y a ciegas, tal como pide el
    //que piden los usuarios); solo lo hacemos si ha entrado una receta nueva desde fuera: entonces 'recipes' ya esta sincronizado en
    // memoria y basta con re-pintar. Ver el origen del flag en el boton estrella de Innovacion (arriba) y la
    // invariante final que lo limpia, dentro de renderRecipes().
    if (view === "recipes" && recetasDirty) {
      renderRecipes();
    }
    // Posición vertical según ORIGEN del cambio: swipe restaura la posición de la vista
    // (instantáneo: el viewpager no "llega rodando"); click del nav (y cualquier atajo)
    // sube arriba de forma animada. Reduce-motion: sin animación.
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (origen === "swipe" && scrollVistas) {
      const altoScrolleable = document.documentElement.scrollHeight - window.innerHeight;
      const yGuardada = scrollVistas.scrollParaVista(memoriaScroll, view);
      window.scrollTo(0, Math.max(0, Math.min(yGuardada, Math.max(0, altoScrolleable))));   // RESTAURA: instantáneo
    } else {
      try {
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });                // CLICK: arriba animado
      } catch (e) {
        window.scrollTo(0, 0);                           // WebView viejo sin options object
      }
    }
    centrarTabActivo();
  }
  tabs.forEach(tab => {
    tab.addEventListener("click", () => activarVista(tab.dataset.view));
  });

  // ===== TUTORIAL INTERACTIVO (feature 2026-10-20) =====
  // Visita guiada por la app para la primera visita (PWA instalable, sin datos): velo
  // semitransparente con un "foco" libre sobre el elemento del paso, tarjeta explicativa y,
  // según el paso, avance tocando el elemento real (accionable) o botón Siguiente. El guion y
  // su máquina viven en el módulo puro modules/tutorial.js; aquí sólo el metro del DOM.
  // Sale sólo la primera vez (LS mrcheff.tutorial.visto); se reabre con el 🎓 de la cabecera
  // (idéntico círculo a sus vecinos 🗄️/🌙 y entre ellos, petición explícita).
  const tut = window.MRCheff && window.MRCheff.tutorial ? window.MRCheff.tutorial : null;
  const tutorialRaiz = $("#tutorial");
  const btnTutorial = $("#btn-tutorial");
  let tutorialActivo = false;
  let sesionTutorial = null;
  let pasoEnPantalla = null;            // el paso pintado: a quién atiende el listener global de click
  const tutorialVelos = tutorialRaiz ? {
    arriba: $(".tutorial-arriba", tutorialRaiz),
    izquierda: $(".tutorial-izquierda", tutorialRaiz),
    derecha: $(".tutorial-derecha", tutorialRaiz),
    abajo: $(".tutorial-abajo", tutorialRaiz),
    foco: $("#tutorial-foco"),
    tarjeta: $("#tutorial-tarjeta"),
    titulo: $("#tutorial-titulo"),
    texto: $("#tutorial-texto"),
    puntos: $("#tutorial-puntos"),
    pista: $("#tutorial-pista"),
    avanzar: $("#tutorial-avanzar"),
    anuncio: $("#tutorial-anuncio"),
  } : null;

  function tutorialReposicionar() {
    if (!tutorialActivo || !tutorialVelos || !pasoEnPantalla) return;
    const paso = pasoEnPantalla;
    const objetivo = paso.selector ? document.querySelector(paso.selector) : null;
    const anchoVP = window.innerWidth || document.documentElement.clientWidth;
    const altoVP = window.innerHeight || document.documentElement.clientHeight;
    const MARGEN = 8;                     // aire del aro alrededor del elemento señalado
    if (!objetivo) {                      // sin objetivo: VELO COMPLETO (toda la ventana atenuada) + tarjeta centrada
      Object.assign(tutorialVelos.arriba.style, { top: "0px", height: altoVP + "px" });   // left/right son 0 por CSS: cubre el ancho entero
      Object.assign(tutorialVelos.izquierda.style, { width: "0px" });
      Object.assign(tutorialVelos.derecha.style, { left: anchoVP + "px", width: "0px" });
      Object.assign(tutorialVelos.abajo.style, { top: altoVP + "px", height: "0px" });
      Object.assign(tutorialVelos.foco.style, { top: "0px", left: "0px", width: "0px", height: "0px" });
      tutorialVelos.tarjeta.classList.add("tutorial-centrado");
      return;
    }
    tutorialVelos.tarjeta.classList.remove("tutorial-centrado");
    const r = objetivo.getBoundingClientRect();
    const x0 = Math.max(0, r.left - MARGEN), y0 = Math.max(0, r.top - MARGEN);
    const x1 = Math.min(anchoVP, r.right + MARGEN), y1 = Math.min(altoVP, r.bottom + MARGEN);
    tutorialVelos.arriba.style.top = "0px";
    tutorialVelos.arriba.style.height = y0 + "px";
    tutorialVelos.abajo.style.top = y1 + "px";
    tutorialVelos.abajo.style.height = Math.max(0, altoVP - y1) + "px";
    tutorialVelos.izquierda.style.width = x0 + "px";
    tutorialVelos.izquierda.style.top = y0 + "px";
    tutorialVelos.izquierda.style.height = (y1 - y0) + "px";
    tutorialVelos.derecha.style.left = x1 + "px";
    tutorialVelos.derecha.style.width = Math.max(0, anchoVP - x1) + "px";
    tutorialVelos.derecha.style.top = y0 + "px";
    tutorialVelos.derecha.style.height = (y1 - y0) + "px";
    Object.assign(tutorialVelos.foco.style, { top: y0 + "px", left: x0 + "px", width: (x1 - x0) + "px", height: (y1 - y0) + "px" });

    // Tarjeta: debajo del foco si hay sitio; si no, encima. Clamp a los márgenes del viewport.
    const altoTarjeta = tutorialVelos.tarjeta.offsetHeight || 150;
    const anchoTarjeta = Math.min(tutorialVelos.tarjeta.offsetWidth || 300, 320);
    let cardY = r.bottom + 12;
    if (cardY + altoTarjeta > altoVP - 12) cardY = Math.max(12, r.top - 12 - altoTarjeta);
    if (cardY + altoTarjeta > altoVP - 12) cardY = Math.max(12, altoVP - 12 - altoTarjeta);
    let cardX = Math.max(12, Math.min(r.left + r.width / 2 - anchoTarjeta / 2, anchoVP - anchoTarjeta - 12));
    Object.assign(tutorialVelos.tarjeta.style, { top: cardY + "px", left: cardX + "px" });
  }

  function pintarPasoTutorial() {
    if (!tut || !tutorialVelos || !sesionTutorial) return;
    const paso = tut.pasoActual(sesionTutorial);
    if (!paso) { cerrarTutorial(true); return; }
    pasoEnPantalla = paso;
    if (paso.vista) {                                  // la vista del paso salta si toca cambiar (sin scroll-top si ya está aquí)
      const activa = document.querySelector(".view.active");
      if (!activa || activa.id !== "view-" + paso.vista) activarVista(paso.vista);
    }
    tutorialVelos.titulo.textContent = paso.titulo;
    tutorialVelos.texto.textContent = paso.texto;
    const objetivo = paso.selector ? document.querySelector(paso.selector) : null;
    const accionable = !!(paso.accionable && objetivo);   // contrato del módulo (vista/selector/accionable)
    tutorialVelos.pista.classList.toggle("hidden", !accionable);
    const total = tut.totalPasos();
    const esUltimo = tut.numero(sesionTutorial) >= total;
    tutorialVelos.avanzar.classList.toggle("hidden", accionable);
    tutorialVelos.avanzar.textContent = paso.cta || (esUltimo ? "Terminar" : "Siguiente");
    // Puntos de progreso: uno por paso, el activo en pill de marca (dimensiones por CSS).
    tutorialVelos.puntos.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const punto = document.createElement("span");
      if (i === tut.numero(sesionTutorial) - 1) punto.className = "activo";
      tutorialVelos.puntos.appendChild(punto);
    }
    if (tutorialVelos.anuncio) {
      tutorialVelos.anuncio.textContent = `Paso ${tut.numero(sesionTutorial)} de ${total}: ${paso.titulo}`;
    }
    // Colocar el objetivo en la ventana y medir con el layout YA hecho (el scrollIntoView puede
    // animar: el listener de scroll reposiciona el foco durante el vuelo).
    if (objetivo) {
      try {
        const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        objetivo.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      } catch (e) {
        try { objetivo.scrollIntoView(); }              // WebView viejo sin options object
        catch (e2) { /* sin scrollIntoView (entorno de prueba): el paso sigue igual */ }
      }
    }
    // El frame inicial del reposicionado (el listener de scroll ya cubre el vuelo del
    // scrollIntoView animado). Fallback a setTimeout para WebViews sin requestAnimationFrame.
    const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame : (fn) => setTimeout(fn, 16);
    raf(tutorialReposicionar);
  }

  function abrirTutorial() {
    if (!tut || !tutorialRaiz || !tutorialVelos) return;
    sesionTutorial = tut.sesionNueva();
    tutorialActivo = true;
    tutorialRaiz.classList.remove("hidden");
    window.addEventListener("scroll", tutorialReposicionar, { passive: true, capture: true });
    window.addEventListener("resize", tutorialReposicionar, { passive: true });
    document.addEventListener("keydown", tutorialTecla);
    pintarPasoTutorial();
  }

  function tutorialTecla(e) {
    if (e.key === "Escape") cerrarTutorial(true);
  }

  // El click que avanza es un listener GLOBAL de captura: el toque sigue su curso natural
  // (el botón o input REAL ejecuta su función) y el tutorial sólo cuenta el paso. No se usa
  // stopPropagation: no hay objetivos del tutorial que abran modales. Guard extra: un selector
  // del guion mal escrito ·closest lanza SyntaxError· no puede romper el click de la app.
  document.addEventListener("click", (e) => {
    if (!tutorialActivo || !pasoEnPantalla || !pasoEnPantalla.accionable || !e.target.closest) return;
    if (e.target.closest("#tutorial-tarjeta")) return;   // la tarjeta es salida, no "el objetivo del paso"
    let objetivo = null;
    try { objetivo = e.target.closest(pasoEnPantalla.selector); } catch (err) { return; }
    if (!objetivo) return;
    avanzarPasoTutorial();
  }, true);

  function avanzarPasoTutorial() {
    if (!tut || !sesionTutorial) return;
    tut.avanzar(sesionTutorial);
    pintarPasoTutorial();
  }

  function cerrarTutorial(marcarVisto) {
    if (!tutorialRaiz) return;
    window.removeEventListener("scroll", tutorialReposicionar, { capture: true });
    window.removeEventListener("resize", tutorialReposicionar);
    document.removeEventListener("keydown", tutorialTecla);
    tutorialActivo = false;
    pasoEnPantalla = null;
    sesionTutorial = null;
    tutorialRaiz.classList.add("hidden");
    if (marcarVisto) save(LS.tutorial, { visto: true });
  }

  if (tutorialVelos) {
    $("#tutorial-cerrar", tutorialRaiz).addEventListener("click", () => cerrarTutorial(true));
    $("#tutorial-avanzar", tutorialRaiz).addEventListener("click", avanzarPasoTutorial);
  }
  if (btnTutorial) btnTutorial.addEventListener("click", abrirTutorial);

  // ===== GESTOS DEL NAVEGADOR (bloqueo de ZOOM en el PWA móvil) =====
  // El viewport meta (maximum-scale=1, user-scalable=no) bloquea el pinch en Chromium.
  // iOS ignora user-scalable=no desde iOS 10: se remata con los eventos privados
  // gesturestart/gesturechange — preventDefault impide el pinch del standalone.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());

  // ===== GESTO SWIPE ENTRE VISTAS (viewpager móvil) =====
  // En el móvil la página entera se desplazaba horizontalmente al arrastrar el dedo.
  // Ahora (feature 2026-10-18): deslizar de lado DENTRO del contenido cambia a la vista
  // vecina, estilo viewpager de Android. La DECISIÓN (umbral/dirección/vecina con wrap)
  // vive en el módulo puro modules/swipe-tabs.js (tests en tests/swipe-tabs.test.js);
  // aquí sólo el wiring touch y las exclusiones: nada de swipes por encima de inputs,
  // botones, enlaces, textareas o de cualquier scroller-x interno que haya en la vista.
  // A11y: el swipe cambia de vista SIN foco — el cambio se anuncia por la región viva
  // #aviso-vista (sr-only) para que el lector de pantalla siga al usuario (#2 task zoom/a11y).
  const swipeApi = window.MRCheff && window.MRCheff.swipeTabs;
  const zonaSwipe = $(".content");
  if (swipeApi && zonaSwipe) {
    // El carrusel del viewpager son las 5 pestañas del nav: el tab LATERAL de Copia de
    // respaldo (backup, icono compacto del clúster derecho) NO entra — no es una parada
    // horizontal, es un atajo lateral (desde él el swipe simplemente no cambia de vista).
    const ORDEN_VISTAS = tabs.filter(t => !t.classList.contains("tab-side")).map(t => t.dataset.view);
    let swipeX = 0, swipeY = 0, swipeVivo = false;

    zonaSwipe.addEventListener("touchstart", (e) => {
      swipeVivo = false;
      if (tutorialActivo) return;                              // visita guiada: carrusel en pausa (el velo se traga los toques fuera del foco)
      if (e.touches.length !== 1) return;                       // multi-dedo: no es un swipe
      const objetivo = e.target;
      if (objetivo.closest && objetivo.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
      let el = objetivo;                                        // el gesto NO se apodera de un scroller-x interno
      while (el && el !== zonaSwipe) {
        const st = getComputedStyle(el);
        if (st.overflowX === "auto" || st.overflowX === "scroll") return;
        el = el.parentElement;
      }
      swipeX = e.touches[0].clientX;
      swipeY = e.touches[0].clientY;
      swipeVivo = true;
    }, { passive: true });

    zonaSwipe.addEventListener("touchend", (e) => {
      if (!swipeVivo) return;
      swipeVivo = false;
      const dir = swipeApi.dirDeGesto(
        e.changedTouches[0].clientX - swipeX,
        e.changedTouches[0].clientY - swipeY
      );
      if (!dir) return;
      const actual = tabs.find(t => t.classList.contains("active"));
      const destino = swipeApi.vecina(ORDEN_VISTAS, actual && actual.dataset.view, dir);
      if (destino) {
        activarVista(destino, "swipe");          // la captura de la vista saliente vive DENTRO de activarVista
        // El gesto no mueve el foco: anuncio silencioso del cambio para lectores de pantalla.
        const aviso = document.getElementById("aviso-vista");
        if (aviso) {
          const pestaña = tabs.find(t => t.dataset.view === destino);
          const etiqueta = pestaña ? pestaña.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim() : destino;
          aviso.textContent = `Vista: ${etiqueta}`;
        }
      }
    }, { passive: true });
  }

  // ===== BOTÓN FLOTANTE "SUBIR AL PRINCIPIO" (feature 2026-10-21) =====
  // Con listas verticales muy largas, al bajar por la pestaña aparece (animado) abajo a la
  // derecha un círculo con flecha que VUELVE AL PRINCIPIO de la pestaña ACTUAL, también con
  // animación; se oculta otra vez al estar arriba. En TODAS las pestañas (van de un mismo
  // scroll de documento). La regla (umbral = una pantallita, ocultarse en lo alto) y el salto
  // (smooth / auto con reduce-motion / fallback WebView viejo) viven en modules/scroll-arriba.js;
  // aquí el listener de scroll (rAF-throttled, patrón del tutorial) y el molde.
  const scrollArriba = (window.MRCheff && window.MRCheff.scrollArriba) || null;
  const fabSubir = $("#btn-subir-encima");
  if (fabSubir && scrollArriba) {
    let fabRaf = null;
    const pintaFabSubir = () => {
      fabRaf = null;
      fabSubir.classList.toggle("visible", scrollArriba.debeMostrarseBoton(window.scrollY, window.innerHeight || 320));
    };
    // Un único rAF por ráfaga de scroll/resize: el evento scroll dispara decenas de veces/frame.
    window.addEventListener("scroll", () => {
      if (fabRaf == null) fabRaf = requestAnimationFrame(pintaFabSubir);
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (fabRaf == null) fabRaf = requestAnimationFrame(pintaFabSubir);   // el umbral INNER cambia al girar
    });
    fabSubir.addEventListener("click", () => {
      scrollArriba.subirEncima(window, { reducido: scrollArriba.movimientoReducido(window) });
    });
  }

  // ===== ALIMENTOS =====
  const foodForm = $("#food-form");
  const foodName = $("#food-name");
  const foodScore = $("#food-score");
  const foodScoreVal = $("#food-score-val");
  const foodQty = $("#food-qty");
  const foodQtyVal = $("#food-qty-val");
  const foodMin = $("#food-min");
  const foodMinVal = $("#food-min-val");
  const foodList = $("#food-list");
  const foodEmpty = $("#food-empty");
  const foodFilter = $("#food-filter");
  const toggleCheck = $("#toggle-check");
  const weeklyAlert = $("#weekly-alert");

  foodScore.addEventListener("input", () => foodScoreVal.textContent = foodScore.value);
  foodQty.addEventListener("input", () => foodQtyVal.textContent = foodQty.value || 0);
  foodMin.addEventListener("input", () => foodMinVal.textContent = foodMin.value || 0);

  foodForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = foodName.value.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    const exists = foods.find(f => f.name.toLowerCase() === lower);
    if (exists) {
      toast("Ese alimento ya está en tu lista", "error");
      return;
    }
    const qty = Math.max(0, parseInt(foodQty.value, 10) || 0);
    const min = Math.max(0, parseInt(foodMin.value, 10) || 0);
    foods.push({ id: uid(), name, score: parseInt(foodScore.value, 10), qty, min, checked: false, createdAt: Date.now() });
    save(LS.foods, foods);
    foodName.value = "";
    foodScore.value = 5;
    foodScoreVal.textContent = "5";
    foodQty.value = 0;
    foodQtyVal.textContent = "0";
    foodMin.value = 1;
    foodMinVal.textContent = "1";
    renderFoods();
    renderWeeklyAlert();
    renderShoppingListTrasDespensa();
    toast("Alimento añadido");
  });

  foodFilter.addEventListener("input", renderFoods);
  toggleCheck.addEventListener("click", () => {
    const all = foods.every(f => f.checked);
    foods.forEach(f => f.checked = !all);
    save(LS.foods, foods);
    renderFoods();
    renderWeeklyAlert();
  });

  // Lógica de urgencia/reposición extraída al módulo puro modules/priority.js (sin DOM ni localStorage). Se consume para que el
  // resto de la app se comporte idénticamente. Ver CODING_STANDARDS.md §3 option A / DIP y §5 "alimentos/alerta semanal":
  // urgencyLevel = color por item; buildWeeklyAlert = decide qué entra/presenta (icono/título/orden/CAPA-A-8) — lógica PURe, testeable sin DOM.
  const { urgencyLevel, buildWeeklyAlert } = window.MRCheff.priority;

  function renderFoods() {
    const q = foodFilter.value.trim().toLowerCase();
    const filtered = foods.filter(f => !q || f.name.toLowerCase().includes(q));
    foodList.innerHTML = "";
    if (filtered.length === 0) {
      foodEmpty.classList.toggle("hidden", foods.length > 0);
      return;
    }
    foodEmpty.classList.add("hidden");
     filtered.forEach(f => {
      const qty = f.qty ?? 0;
      const min = f.min ?? 0;
      const low = qty <= min;
      const level = urgencyLevel(f.score);
      const li = document.createElement("li");
      li.className = "food-item" + (f.checked ? " checked" : "") + " urg-" + level + (low ? " low" : "");
      li.innerHTML = `
        <input type="checkbox" data-id="${f.id}" ${f.checked ? "checked" : ""} aria-label="Hoy está en casa: ${escapeHTML(f.name)}">
        <span class="food-name">${escapeHTML(f.name)}</span>
        <span class="food-qty" title="En casa / mínimo para avisar">${qty} / ${min}</span>
        <span class="food-score urg-${level}" title="Importancia">${f.score}</span>
        <span class="food-actions">
          <button class="btn ghost small" data-inc="${f.id}" title="Sumar 1" data-step="1" aria-label="Sumar 1 a ${escapeHTML(f.name)}">➕</button>
          <button class="btn ghost small" data-inc="${f.id}" title="Restar 1" data-step="-1" aria-label="Restar 1 a ${escapeHTML(f.name)}">➖</button>
          <button class="btn ghost small" data-del="${f.id}" title="Eliminar" aria-label="Eliminar ${escapeHTML(f.name)}">🗑</button>
        </span>`;
      foodList.appendChild(li);
    });
    foodList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        const f = foods.find(x => x.id === cb.dataset.id);
        if (f) { f.checked = cb.checked; save(LS.foods, foods); renderFoods(); renderWeeklyAlert(); }
      });
    });
    foodList.querySelectorAll("[data-inc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const f = foods.find(x => x.id === btn.dataset.inc);
        if (f) {
          f.qty = Math.max(0, (f.qty ?? 0) + parseInt(btn.dataset.step, 10));
          save(LS.foods, foods);
          renderFoods();
          renderWeeklyAlert();
          renderShoppingListTrasDespensa();
        }
      });
    });
    foodList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        foods = foods.filter(x => x.id !== btn.dataset.del);
        save(LS.foods, foods);
        renderFoods();
        renderWeeklyAlert();
        renderShoppingListTrasDespensa();
        toast("Alimento eliminado");
      });
    });
  }

  // ---- Rediseño 2026-10-19 de la alerta semanal: cap FÍSICO a 8 filas + candado de scroll ----
  // buildWeeklyAlert ya recorta en el módulo (antes escondía el 9º pendiente en adelante): ahora el límite
  // es de ALTO — con 8+ pendientes la lista se cap a 8 filas y scrollea DENTRO de sí. El candado (arriba a
  // la derecha) congela el scroll del DOCUMENTO mientras está activo (clase `scroll-candado` SOLO en <html>:
  // el overflow del html se propaga al viewport sin romper el sticky del topbar; en body rompería el header,
  // ver el fix del overflow-x del 2026-10-19). Ni candado ni scroll salen con menos de 8 items.
  // El candado es SÓLO MÓVIL: en escritorio la rueda recorre la lista sin ayuda y no hace falta
  // congelar la página — en desktop la UI ni lo pinta (afinación de 2026-10-19 tras probarlo).
  let candadoAlertaActivo = false;

  // ¿Es la versión móvil? Corte +≤820px, el mismo que usa el header al volver a flex.
  // `window.__mrcheffEsMovil` es inyección de TEST (igual que `__mrcheffCryptoImpl`, §6): jsdom no
  // evalúa mediaqueries de layout, así que la suite decide movilidad por inyección.
  function esMovil() {
    if (typeof window.__mrcheffEsMovil === "boolean") return window.__mrcheffEsMovil;
    try {
      if (typeof window.matchMedia !== "function") return false;    // entorno sin layout (jsdom p. ej.)
      return window.matchMedia("(max-width: 820px)").matches;
    } catch { return false; }
  }

  function soltarCandadoAlerta() {
    candadoAlertaActivo = false;
    document.documentElement.classList.remove("scroll-candado");
  }

  // Pero al cruzar el corte móvil↔desktop (rotar tablet, estirar la ventana) ni candado rancio
  // ni página congelada: se suelta y se repinta para que la UI viva de verdad.
  // (entornos sin matchMedia — jsdom p. ej. —: sin listener y sin romper el arranque)
  const mqMovil = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 820px)") : null;
  const alCruzarMovil = () => { soltarCandadoAlerta(); renderWeeklyAlert(); };
  if (mqMovil) {
    if (typeof mqMovil.addEventListener === "function") mqMovil.addEventListener("change", alCruzarMovil);
    else if (typeof mqMovil.addListener === "function") mqMovil.addListener(alCruzarMovil);   // Safari viejo
  }

  function renderWeeklyAlert() {
    // La DECISIÓN de qué entra la alerta y cómo se presenta (nivel/icono/título/orden — lista COMPLETA ya sin
    // recortar) es lógica pura extraída a modules/priority.js → buildWeeklyAlert. Aquí sólo pintamos el HTML
    // resultante y el cap físico de alto (§2-D DIP: separar decidir del render).
    const m = buildWeeklyAlert(foods);
    if (!m.show) {
      soltarCandadoAlerta();
      weeklyAlert.className = "card alert-card hidden";
      weeklyAlert.innerHTML = "";
      return;
    }

    // El color de la alerta lo marca la importancia del alimento MÁS URGENTE → ya resuelto por `m.level`/icon/título, pero el
    // per-fila todavía consulta urgencyLevel(f.score) para su propio badge, idéntico al código heredado.
    weeklyAlert.className = `card alert-card alert-${m.level}`;
    const conScroll = m.items.length >= 8;    // a partir de 8: cap de alto + scroll interno (desktop y móvil)
    const hayCandado = conScroll && esMovil(); // candado: SOLO móvil (en desktop ni se pinta)
    weeklyAlert.innerHTML = `
      <div class="alert-cabecera">
        <h3>${m.icon} ${m.title}</h3>
        ${hayCandado ? `<button id="candado-alerta" class="btn ghost small" aria-pressed="false" aria-label="Candado del scroll de la página" title="Congelar el scroll de la página y recorrer esta lista con el dedo">🔓</button>` : ""}
      </div>
      <div class="alert-scroll">
        <ul class="alert-list-${m.level}">
          ${m.items.map(f => `
            <li class="alert-row urg-${urgencyLevel(f.score)}">
              <span class="alert-name"><strong>${escapeHTML(f.name)}</strong></span>
              <span class="alert-meta">tienes <b>${f.qty ?? 0}</b> · mínimo <b>${f.min ?? 0}</b> · importancia <b>${f.score}/10</b></span>
            </li>`).join("")}
        </ul>
      </div>`;

    // SUELTA el candado antes que nada (menos de 8 items en móvil, o desktop: candado sólo móvil).
    if (!hayCandado) soltarCandadoAlerta();
    // Cap EXACTO a 8 filas medido del DOM — INDEPENDIENTE del candado (también en desktop): las
    // filas varían de alto (envoltura del texto), no hay valor CSS fijo que dé siempre 8. Si el
    // render llega con la vista OCULTA (display:none al cambiar de tab, p. ej. importar en backup)
    // las medidas salen a 0: se queda el retén del CSS.
    const ulAlerta = weeklyAlert.querySelector(".alert-scroll ul");
    const fila8 = ulAlerta.children[7];
    if (fila8) {
      const fila1 = ulAlerta.children[0].getBoundingClientRect();
      const fila8b = fila8.getBoundingClientRect();
      if (fila1.height > 0 && fila8b.height > 0) {
        weeklyAlert.querySelector(".alert-scroll").style.maxHeight = Math.ceil(fila8b.bottom - fila1.top) + "px";
      }
    }
    const btnCandado = weeklyAlert.querySelector("#candado-alerta");
    if (!btnCandado) {
      return;                                           // sin candado (desktop o <8): nada más que engarzar
    }
    // El candado SOBREVIVE a los re-renders mientras la lista siga con 8+: tocar ➕/➖/✅ dentro
    // de la lista no debe dejar la página desatada. Se suelta por botón, por cambio de vista o
    // si la lista cae bajo 8.
    if (candadoAlertaActivo) {
      document.documentElement.classList.add("scroll-candado");
      btnCandado.textContent = "🔒";
      btnCandado.setAttribute("aria-pressed", "true");
    }
    btnCandado.addEventListener("click", () => {
      candadoAlertaActivo = document.documentElement.classList.toggle("scroll-candado");
      btnCandado.textContent = candadoAlertaActivo ? "🔒" : "🔓";
      btnCandado.setAttribute("aria-pressed", String(candadoAlertaActivo));
      btnCandado.title = candadoAlertaActivo
        ? "Suelta el candado para volver a scrollear la página"
        : "Congelar el scroll de la página y recorrer esta lista con el dedo";
    });
  }

  // ===== ESCÁNER DEL TICKET DE LA COMPRA (OCR EN EL NAVEGADOR) =====
  // #epic-ocr-despensa-camara: fotografiar el TICKET del super (o la foto del frigorífico, misma
  // vía) y que Mr Cheff reconozca lo comprado con sus CANTIDADES. Las DECISIONES viven en módulos
  // puros (specs tests/ocr-despensa.test.js y tests/ocr-foto.test.js):
  //   · modules/ocr-despensa.js — esMovil / extraerCandidatos+qty / guardarCandidatos (reparto
  //     exactos/dudosos/nuevos) / pasosDeConfirmacion / confirmarRevision;
  //   · modules/ocr-foto.js — la MÁQUINA DE LA FOTO: si necesita conversión HEIC, la geometría
  //     del giro por cara y el ciclo de caras hasta que una lee alimentos.
  // Aquí sólo la INFRA de vista: activar la cámara SÓLO en móvil, cargar Tesseract.js y el
  // conversor heic2any por CDN la primera vez que se usan, los lienzos (createElement + contexto
  // 2d) y el molde del modal. El OCR corre ENTERO en el navegador: la foto nunca sale del terminal.
  const ocr = window.MRCheff.ocrDespensa;
  const ocrFoto = window.MRCheff.ocrFoto;
  const ocrVocabulario = (window.MRCheff.classify && window.MRCheff.classify.FOOD_TYPES) || {};
  const ocrBtnCamara = $("#btn-ocr-camara");
  const ocrBtnFoto = $("#btn-ocr-foto");
  const ocrFile = $("#ocr-file");
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let tesseractPromesa = null;

  // Motor del OCR con carga PEREZOSA: cero coste mientras no se use la función (un <script> del CDN
  // inyectado al vuelo la primera vez); el propio navegador lo cachea después. Si falla (sin
  // conexión) la promesa se limpia para darle otra oportunidad en el siguiente intento.
  function cargarTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tesseractPromesa) {
      tesseractPromesa = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = TESSERACT_CDN;
        s.async = true;
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => {
          tesseractPromesa = null;
          reject(new Error("El motor del OCR no ha cargado: la primera vez necesita conexión a internet"));
        };
        document.head.appendChild(s);
      });
    }
    return tesseractPromesa;
  }

  // La FOTO puede llegar en HEIC/HEIF (el formato por defecto del iPhone; y hay tickets ".png" mal
  // etiquetados que en realidad son HEIF). Los navegadores de base Chromium no decodifican HEIC: ni
  // el canvas, ni el motor del OCR, ni createImageBitmap la leen — síntoma: "No se ha podido escanear
  // la foto". Salida: convertir a JPEG EN EL PROPIO NAVEGADOR (heic2any@0.0.4, libheif en wasm por
  // CDN — última versión real del paquete, NADA que ver con "0.4.x" que no existe — misma carga
  // perezosa que Tesseract y SÓLO si la foto lo necesita) y dar al OCR el resultado. La conversión
  // también es local: la foto sigue sin salir del dispositivo.
  const HEIC_CDN = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
  const HEIC_CargaMaxima = 90000;              // un CDN caído debe FALLAR con su toast, no congelar el modal
  let heicPromesa = null;

  // El UMD del paquete puede llegar como función directa o envuelta (namespace con .default): da
  // igual — aquí sólo importa devolver la FUNCIÓN convertidora.
  function funcionHeic2any() {
    const h = window.heic2any;
    if (typeof h === "function") return h;
    if (h && typeof h.default === "function") return h.default;
    if (h && typeof h.heic2any === "function") return h.heic2any;
    return null;
  }

  function cargarHeic2any() {
    const lista = funcionHeic2any();
    if (lista) return Promise.resolve(lista);
    if (!heicPromesa) {
      heicPromesa = new Promise((resolve, reject) => {
        let listo = false;
        const guardar = window.setTimeout(() => {               // sin este guardia, un CDN 404 colgaba la conversión para siempre (ORB no dispara onerror)
          if (listo) return;
          listo = true;
          heicPromesa = null;
          reject(new Error("El conversor de fotos HEIC no ha cargado (muy lento o sin conexión)"));
        }, HEIC_CargaMaxima);
        const s = document.createElement("script");
        s.src = HEIC_CDN;
        s.async = true;
        s.onload = () => {
          const fn = funcionHeic2any();
          if (!fn) return;               // roto: cae el guardia y falla con su aviso
          listo = true;
          window.clearTimeout(guardar);
          resolve(fn);
        };
        s.onerror = () => {
          if (listo) return;
          listo = true;
          window.clearTimeout(guardar);
          heicPromesa = null;
          reject(new Error("El conversor de fotos HEIC no ha cargado: la primera vez necesita conexión a internet"));
        };
        document.head.appendChild(s);
      });
    }
    return heicPromesa;
  }

  function convertirHeic(archivo, progreso) {
    if (progreso && progreso.isConnected) progreso.textContent = "Convirtiendo la foto (HEIC del iPhone → JPEG)…";
    const conversor = window.__mrcheffHeicConvertir                    // gancho §6: jsdom/e2e sin wasm real
      ? Promise.resolve(window.__mrcheffHeicConvertir)
      : cargarHeic2any();
    return conversor
      .then(convertir => convertir({ blob: archivo, toType: "image/jpeg", quality: 0.95 }))
      .then(res => (Array.isArray(res) ? res[0] : res));               // un HEIC puede traer varias imágenes: la 1ª
  }

  // Lienzo de una cara para el OCR: la GEOMETRÍA la decide el módulo puro (ocr-foto.geometriaDeLienzo);
  // aquí sólo el DOM — createElement, contexto 2d y la pintura trasladada/escalada/girada. Un entorno
  // de test sin contexto 2d real devuelve null (la máquina del módulo degrada sin morir).
  function lienzoDeBitmap(bitmap, grados) {
    const geo = ocrFoto.geometriaDeLienzo(bitmap, grados);
    if (!geo) return null;
    const lienzo = document.createElement("canvas");
    lienzo.width = geo.ancho;
    lienzo.height = geo.alto;
    const cx = lienzo.getContext("2d");
    if (!cx || !cx.translate || !cx.scale) return null;
    cx.translate(lienzo.width / 2, lienzo.height / 2);
    cx.scale(geo.escala, geo.escala);
    cx.rotate((grados % 360) * Math.PI / 180);
    cx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2, bitmap.width, bitmap.height);
    return lienzo;
  }

  // Escanea la foto ENTERA delegando en el módulo puro (ocr-foto): (1) prepara — HEIC del iPhone a
  // JPEG por el conversor de aquí, con sondeo del decodificador real para el HEIC camuflado de
  // ".png" —, (2) recorre las CARAS (de frente → girada 90° → girada 270°) hasta que una lee
  // alimentos y (3) entrega el texto a procesarTextoOcr (que abre la confirmación o el aviso).
  async function escanearFoto(archivo, progreso) {
    // El usuario puede cerrar el modal EN MEDIO del escaneo (o porque canceló, o por Escape):
    // closeModal OCULTA el modal (no vacía el DOM), así que la vida del escaneo se lee del estado
    // del modal mismo; el `progreso` suelto quedaría "conectado" aunque nadie lo vea.
    const abierto = () => !modal.classList.contains("hidden");
    const Tesseract = await cargarTesseract();
    const { foto } = await ocrFoto.prepararFoto(archivo, {
      esHeic: ocr.esHeic,
      decodificar: (typeof createImageBitmap === "function") ? b => createImageBitmap(b) : null,   // sin decodificador real (jsdom): la foto pasa sin conversión
      convertir: a => convertirHeic(a, progreso)
    });
    if (!abierto()) return;                              // canceló durante la carga/conversión
    const bitmap = await createImageBitmap(foto);        // decodificación real: HEIC sin convertir moriría aquí (lo avisa el catch del change)
    const resultado = await ocrFoto.escanearCaras({
      abierta: abierto,
      hayAlimentos: texto => ocr.extraerCandidatos(texto, ocrVocabulario).length > 0,
      lienzoDe: grados => lienzoDeBitmap(bitmap, grados),
      reconocer: async (lienzo, grados) => {
        const girada = grados !== 0;
        progreso.textContent = girada
          ? "Reconociendo texto… (girando la foto para leerla boca arriba)"
          : "Reconociendo texto…";
        const { data } = await Tesseract.recognize(lienzo, "spa", {
          logger: m => {
            if (m && m.status === "recognizing text" && abierto()) {
              progreso.textContent = `Reconociendo texto… ${Math.round((m.progress || 0) * 100)}%${girada ? " (foto girada)" : ""}`;
            }
          }
        });
        return (data && data.text) || "";
      }
    });
    if (resultado.texto !== null) procesarTextoOcr(resultado.texto);   // cancelado → nada que procesar
  }

  // La cámara SÓLO se ofrece en vista móvil (ocr.esMovil decide contra el user agent): el input file
  // con el atributo `capture` abre la app de la cámara del sistema (Android/iOS), SIN permisos
  // getUserMedia y SIN exigir https. En escritorio, la vía es elegir una foto del frigorífico/armario
  // desde el disco — misma lectura, mismo modal de confirmación.
  const ocrEsMovil = ocr.esMovil(navigator.userAgent);
  if (ocrBtnCamara && ocrBtnFoto && ocrFile) {
    ocrBtnCamara.classList.toggle("hidden", !ocrEsMovil);
    ocrBtnFoto.classList.remove("hidden");        // la vía "elegir foto" se ofrece también en móvil (galería)
    ocrBtnCamara.addEventListener("click", () => {
      ocrFile.setAttribute("capture", "environment");
      ocrFile.click();
    });
    ocrBtnFoto.addEventListener("click", () => {
      ocrFile.removeAttribute("capture");
      ocrFile.click();
    });
    ocrFile.addEventListener("change", () => {
      const archivo = ocrFile.files && ocrFile.files[0];
      ocrFile.value = "";                         // limpiar ya: permite re-escanear la misma foto después
      if (!archivo) return;
      modalContent.innerHTML = `
        <h2>📷 Reconociendo alimentos…</h2>
        <p class="muted" id="ocr-progreso">Cargando el motor de OCR (la primera vez descarga unos megas; la foto no sale de tu navegador)…</p>
        <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button></div>`;
      abrirModal("Escáner del ticket");
      $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
      const progreso = $("#ocr-progreso", modalContent);
      escanearFoto(archivo, progreso).catch(err => {
        if (modal.classList.contains("hidden")) return;   // cerrado por el usuario: nada que contar
        closeModal();
        toast((err && err.message) || "No se ha podido escanear la foto", "error");
      });
    });
  }

  // Del texto que el OCR ha leído se ocupa la MISMA función en producción y en pruebas: el motor
  // Tesseract es lo único que depende de la foto, así que `window.__mrcheffProcesarTextoOcr` queda
  // solo como inyección de test (§6, patrón __mrcheffEsMovil/__mrcheffCryptoImpl) — jsdom y Playwright
  // ejercitan el flujo del ticket sin cámara ni CDN.
  function procesarTextoOcr(texto) {
    const candidatos = ocr.extraerCandidatos(texto, ocrVocabulario);
    if (!candidatos.length) {
      modalContent.innerHTML = `
        <h2>📷 No he detectado alimentos</h2>
        <p class="muted">Prueba con una foto más cercana, de frente y con buena luz al papel (ticket
            del super). Las etiquetas con letra pequeña engañan al OCR.</p>
        <div class="modal-footer"><button class="btn ghost" data-close>Cerrar</button></div>`;
      $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
      return;
    }
    abrirConfirmarOcr(candidatos);
  }
  window.__mrcheffProcesarTextoOcr = procesarTextoOcr;

  // ===== CONFIRMACIÓN DEL TICKET EN LA DESPENSA (2 DIÁLOGOS) =====
  // La compra ya está hecha: el escáner sólo mete lo comprado en el "Inventario actual" y NUNCA
  // SALE de la pestaña de Alimentos (sin pendientes en la lista de la compra: esa implementación
  // se retiró junto con el paso intermedio que mezclaba las cosas). Dos diálogos seguidos, con el
  // reparto decidido por el módulo puro (ocr.guardarCandidatos sin persistir + pasosDeConfirmacion):
  //   1º) Ya lo tienes en el inventario: los nombres exactos del ticket con la CANTIDAD comprada
  //       de cada uno, editable al pelo — al confirmar se SUMA en-situ (su alerta queda como estaba).
  //   2º) Revisión con dos secciones — Nuevos (alta directa definiendo EN la fila su nombre,
  //       cantidad, IMPORTANCIA y MÍNIMO) y Dudas (el casador de variantes: elegir "es ESE alimento
  //       de casa" para sumarle la compra, o "es nuevo" para darlo de alta con lo que se haya
  //       escrito en la misma fila).
  // Cada diálogo comparte SU confirmación al guardar; Cancelar no deshace lo ya confirmado. Sin
  // toasts de éxito: el resultado destella sobre la propia lista del inventario.
  const REDUZ_MOTION = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function desplazarSuaveHasta(el) {
    // Descontar el topbar sticky: medido a cero, el destino queda escondido debajo de la cabecera.
    const barra = document.querySelector(".topbar");
    const margen = barra ? barra.offsetHeight + 8 : 8;
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - margen);
    try {
      window.scrollTo({ top: y, behavior: REDUZ_MOTION() ? "auto" : "smooth" });
    } catch (e) {
      window.scrollTo(0, y);                                  // WebView viejo sin options object
    }
  }

  function destellarDestino(el) {
    el.classList.remove("destello-suave");
    void el.offsetWidth;                                      // reinicia la animación (re-escaneo → re-destello)
    el.classList.add("destello-suave");
    window.setTimeout(() => el.classList.remove("destello-suave"), 2200);
  }

  // La vista de destino es la MISMA en la que vive el escáner (Alimentos): se sube arriba y el
  // resultado destella una vez sobre el inventario — sin saltos de pestaña ni toasts.
  function señalarResultadoEnDespensa() {
    const lista = $("#food-list");
    if (!lista) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      desplazarSuaveHasta(lista);
      destellarDestino(lista);
    }));
  }

  function abrirConfirmarOcr(candidatos) {
    const etqTipo = { proteina: "Proteína", lacteo: "Lácteo", cereal: "Cereal", fruta: "Fruta", verdura: "Verdura", especia: "Especia" };

    // Estado del flujo: la decisión de cada fila arranca del ticket — la cantidad es la leída (o
    // 1 si la línea no traía cifra) y el criterio de alerta por defecto es el del alta manual
    // (5/1). El reparto PREVIEW de diálogos corre sobre ESTOS mismos datos: el módulo filtra qty
    // no numérica al guardar, así que lo que se decide es lo que la persona verá en las filas.
    const decision = candidatos.map(c => ({
      incluir: true,
      nombre: c.nombre,
      qty: Number.isFinite(c.qty) && c.qty >= 1 ? c.qty : 1,
      score: 5,
      min: 1,
      varianteId: "",                                         // dudas: "" = "es nuevo", otro valor = id de despensa
      tipo: c.tipo || null
    }));
    const previo = ocr.guardarCandidatos(foods, decision.map(d => ({ nombre: d.nombre, qty: d.qty, tipo: d.tipo })), {
      uid, ahora: Date.now(),
      // La DUDA se decide con el MISMO casador de variantes del "🛒 Despensa?" de la lista:
      // "¿es el mismo que uno de mi despensa?" (menu-semanal.candidatosDespensa inyectada, §3).
      candidatosDespensa: menuSemanal && menuSemanal.candidatosDespensa ? menuSemanal.candidatosDespensa : null
    });
    const pasos = ocr.pasosDeConfirmacion(previo);
    if (!pasos.length) { closeModal(); return; }               // sin nada confirmable: nada que asistir
    let faseActual = 0;                        // 0 = exactos del inventario · 1 = revisión (nuevos + dudas)

    const nombreDePago = c => ocr.norm(c.nombre);              // la agrupación del preview manda sobre el índice
    const filasDelPaso = nombrePaso => {
      const claves = new Set((nombrePaso === "despensa" ? previo.directos : previo.dudosos.concat(previo.nuevos)).map(x => nombreDePago(x)));
      return candidatos.filter(c => claves.has(nombreDePago(c)));
    };

    // ── Diálogo 1 (exactos): el nombre va FIJO — ya es un alimento real del inventario y lo que
    // se confirma aquí es cuánto se compró de él.
    function filaExactaHTML(c) {
      const o = candidatos.indexOf(c);
      const d = decision[o];
      const enCasa = foods.find(f => String(f.name || "").toLowerCase() === String(c.nombre || "").toLowerCase());
      return `
        <div class="ocr-item" data-o="${o}">
          <div class="ocr-nombre">
            <span class="rev-nombre-fijo"><strong>${escapeHTML(c.nombre)}</strong><span class="ocr-tipo">${etqTipo[c.tipo] || "Otro"}</span></span>
            <span class="ocr-linea">Ya tienes ${Number.isFinite(enCasa && enCasa.qty) ? enCasa.qty : 0} en el inventario</span>
          </div>
          <input type="number" class="exact-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${escapeHTML(c.nombre)}">
          <input type="checkbox" class="ocr-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${escapeHTML(c.nombre)}">
        </div>`;
    }

    // ── Diálogo 2 (secciones NUEVOS y DUDAS): cada fila se define COMPLETA ahí mismo. En las
    // dudas, la variante de despensa va en un desplegable: resuelta con casa → su alerta no se
    // toca (los campos de importancia/mínimo se deshabilitan); resuelta como nueva → se define.
    function filaRevisionHTML(c, esDuda) {
      const o = candidatos.indexOf(c);
      const d = decision[o];
      const lineaContexto = `<span class="ocr-linea" title="Primera línea que ha leído el OCR (sólo contexto)">“${escapeHTML(String(c.linea || "").trim().slice(0, 60))}”${c.veces > 1 ? ` · aparece ×${c.veces}` : ""}</span>`;
      if (!esDuda) {
        return `
        <div class="ocr-item rev-fila-nueva" data-o="${o}">
          <input type="text" id="rev-nombre-${o}" class="rev-campo-nombre" value="${escapeHTML(d.nombre)}" aria-label="Nombre del alimento (editable)">
          <div class="rev-sub"><span class="ocr-tipo">${etqTipo[d.tipo] || "Otro"}</span>${lineaContexto}</div>
          <input type="number" id="rev-qty-${o}" class="rev-campo-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${escapeHTML(d.nombre)}">
          <input type="number" id="rev-score-${o}" class="rev-num rev-campo-score" min="1" max="10" step="1" value="${d.score}" aria-label="Importancia de ${escapeHTML(d.nombre)}, del 1 al 10">
          <input type="number" id="rev-min-${o}" class="rev-num rev-campo-min" min="0" step="1" value="${d.min}" aria-label="Cantidad mínima para avisarte de ${escapeHTML(d.nombre)}">
          <input type="checkbox" class="ocr-include rev-campo-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${escapeHTML(d.nombre)}">
        </div>`;
      }
      const opciones = menuSemanal.candidatosDespensa(c.nombre, foods) || [];
      return `
        <div class="ocr-item rev-fila-duda" data-o="${o}">
          <input type="text" id="rev-nombre-${o}" class="rev-campo-nombre" value="${escapeHTML(d.nombre)}" aria-label="Nombre del alimento (editable)">
          <div class="rev-sub"><span class="ocr-tipo">${etqTipo[d.tipo] || "Otro"}</span>${lineaContexto}</div>
          <select id="rev-variante-${o}" class="rev-campo-variante" aria-label="¿Es este alimento que ya tienes en casa?">
            <option value="">es nuevo: se define aquí</option>
            ${opciones.map(v => `<option value="${escapeHTML(String(v.id))}">${escapeHTML(v.name)} · tienes ${Number.isFinite(v.qty) ? v.qty : 0}</option>`).join("")}
          </select>
          <input type="number" id="rev-qty-${o}" class="rev-campo-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${escapeHTML(d.nombre)}">
          <input type="number" id="rev-score-${o}" class="rev-num rev-campo-score" min="1" max="10" step="1" value="${d.score}" aria-label="Importancia de ${escapeHTML(d.nombre)}, del 1 al 10">
          <input type="number" id="rev-min-${o}" class="rev-num rev-campo-min" min="0" step="1" value="${d.min}" aria-label="Cantidad mínima para avisarte de ${escapeHTML(d.nombre)}">
          <input type="checkbox" class="ocr-include rev-campo-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${escapeHTML(d.nombre)}">
        </div>`;
    }

    // Resuelta "es ESE alimento de casa", la pantalla DEBE decir la verdad: los campos de la fila
    // pasan a mostrar LA ALERTA REAL del alimento elegido (su importancia y su mínimo) y se
    // deshabilitan — la alerta de un alimento ya vivido no se redefine desde el ticket; sólo la
    // CANTIDAD sigue siendo de la persona. Antes de resolver, los campos propios (por defecto
    // 5/1) salen y se editan; al volver a "es nuevo" se restauran los valores que hubiera
    // escrito (snapshot al primer cambio de variante).
    function conectaVariante(fila) {
      const selector = $("select", fila);
      if (!selector) return;
      const camposAlerta = [`#rev-score-${fila.dataset.o}`, `#rev-min-${fila.dataset.o}`].map(sel => $(sel, modalContent));
      let propio = null;                                    // lo suyo, para restaurar si deshace la variante
      const aplicaAlerta = () => {
        const enCasa = selector.value ? foods.find(f => String(f.id) === selector.value) : null;
        camposAlerta.forEach(campo => { if (campo) campo.disabled = !!enCasa; });
        if (enCasa) {
          if (!propio) propio = {
            score: camposAlerta[0] ? camposAlerta[0].value : "",
            min: camposAlerta[1] ? camposAlerta[1].value : ""
          };
          if (camposAlerta[0]) camposAlerta[0].value = Number.isFinite(enCasa.score) ? String(enCasa.score) : "5";
          if (camposAlerta[1]) camposAlerta[1].value = Number.isFinite(enCasa.min) ? String(enCasa.min) : "0";
        } else if (propio) {
          if (camposAlerta[0] && propio.score !== "") camposAlerta[0].value = propio.score;
          if (camposAlerta[1] && propio.min !== "") camposAlerta[1].value = propio.min;
        }
      };
      aplicaAlerta();
      selector.addEventListener("change", aplicaAlerta);
    }

    function renderDialogo() {
      const pasoNombre = pasos[faseActual];
      let cuerpo = "";
      if (pasoNombre === "despensa") {
        cuerpo = `
          <h2>🎫 ${pasos.length > 1 ? "1 de 2 · " : ""}Ya lo tienes en el inventario</h2>
          <p class="muted">Del ticket, estos ya estaban en tu Inventario actual. La cantidad es la que
              leí del ticket: ajústala si hace falta y confirma — la compra <strong>suma</strong> a lo
              que había y la alerta de cada alimento queda como estaba.</p>
          <div class="ocr-cabecera" aria-hidden="true">
            <span>Alimento</span><span>Cantidad</span><span>Incluir</span>
          </div>
          ${filasDelPaso("despensa").map(filaExactaHTML).join("")}`;
      } else {
        const seccionNuevos = previo.nuevos.length
          ? `<div class="rev-seccion">
              <h3>Nuevos</h3>
              <p class="muted">Nada de esto está en tu Inventario actual: define en cada fila su IMPORTANCIA
                  (prioridad para avisarte) y su MÍNIMO, junto al nombre y la cantidad — al confirmar
                  entran en la despensa con esa alerta.</p>
              <div class="rev-cab-nueva" aria-hidden="true">
                <span class="rev-col-alimento">Alimento</span>
                <span>Cantidad</span><span>Importancia</span>
                <span>Mínimo</span><span>Incluir</span>
              </div>
              ${filasDelPaso("revisar").filter(c => previo.nuevos.some(n => nombreDePago(n) === nombreDePago(c))).map(c => filaRevisionHTML(c, false)).join("")}
            </div>`
          : "";
        const seccionDudas = previo.dudosos.length
          ? `<div class="rev-seccion">
              <h3>Dudas</h3>
              <p class="muted">¿Es la misma cosa que ya tienes con otro nombre? Elige de tu despensa el
                  alimento al que pertenece esta compra (se suma a él y su alerta no se toca) o
                  quédate la opción "es nuevo" para darlo de alta con lo escrito en la misma fila.</p>
              <div class="rev-cab-duda" aria-hidden="true">
                <span class="rev-col-alimento">Alimento</span>
                <span>De tu despensa</span>
                <span>Cantidad</span><span>Importancia</span>
                <span>Mínimo</span><span>Incluir</span>
              </div>
              ${filasDelPaso("revisar").filter(c => previo.dudosos.some(n => nombreDePago(n) === nombreDePago(c))).map(c => filaRevisionHTML(c, true)).join("")}
            </div>`
          : "";
        cuerpo = `
          <h2>🎫 ${pasos.length > 1 ? "2 de 2 · " : ""}Añade lo nuevo y resuelve las dudas</h2>
          <p class="muted">Todo lo confirmado aquí acaba en tu Inventario actual (sin pasar por la lista de la compra).</p>
          ${seccionNuevos}${seccionDudas}`;
      }
      const esFaseExactos = pasoNombre === "despensa";
      modalContent.innerHTML = `
        ${cuerpo}
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar</button>
          ${esFaseExactos
            ? `<button class="btn primary" data-confirmar-exactos>${pasos.length === 2 ? "Confirmar y revisar el resto →" : "Añadir a la despensa"}</button>`
            : `<button class="btn primary" data-revision-guardar>Añadir a la despensa</button>`}
        </div>`;
      abrirModal(esFaseExactos ? "Confirmar la compra de los alimentos ya en casa" : "Añade lo nuevo y resuelve las dudas de la foto");
      const primero = esFaseExactos ? $(".exact-qty", modalContent) : ($(".ocr-nombre input, .rev-campo-nombre", modalContent));
      if (primero) primero.select();
      $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
      $$(".ocr-item", modalContent).forEach(fila => conectaVariante(fila));
      const botonExactos = $("[data-confirmar-exactos]", modalContent);
      if (botonExactos) botonExactos.addEventListener("click", confirmarExactos);
      const botonRevision = $("[data-revision-guardar]", modalContent);
      if (botonRevision) botonRevision.addEventListener("click", confirmarRevision);
    }

    function confirmarExactos() {
      // Cosecha del diálogo 1: nombres fijos, sólo viajan cantidad e incluir.
      $$(".ocr-item", modalContent).forEach(fila => {
        const d = decision[Number(fila.dataset.o)];
        d.incluir = $(".ocr-include", fila).checked;
        const qty = parseInt($(".exact-qty", fila).value, 10);
        if (Number.isFinite(qty) && qty >= 0) d.qty = qty;      // cantidad rara → se queda la del ticket
      });
      // SÓLO las filas de ESTE diálogo (los exactos): el resto se resuelve en la revisión.
      const seleccion = $$(".ocr-item", modalContent)
        .map(fila => decision[Number(fila.dataset.o)])
        .filter(d => d.incluir)
        .map(d => ({ nombre: d.nombre, qty: d.qty, tipo: d.tipo }));
      if (!seleccion.length) { toast("No hay alimentos marcados para guardar", "error"); return; }
      const result = ocr.guardarCandidatos(foods, seleccion, { uid, ahora: Date.now(), candidatosDespensa: null });
      foods = result.foods;
      save(LS.foods, foods);
      renderFoods();
      renderWeeklyAlert();
      renderShoppingListTrasDespensa();
      if (pasos.length === 2) {
        faseActual = 1;                         // confirmados los exactos: ahora sí, la revisión
        renderDialogo();
      } else {
        closeModal();
        señalarResultadoEnDespensa();
      }
    }

    function confirmarRevision() {
      // Cosecha del diálogo 2: nombre/cantidad/importancia/mínimo/variante — con variante elegida
      // esos campos no mandan (la alerta es la del alimento ya en casa) y el módulo los ignora.
      $$(".ocr-item", modalContent).forEach(fila => {
        const o = Number(fila.dataset.o);
        const d = decision[o];
        d.incluir = $(".ocr-include", fila).checked;
        if (!d.incluir) return;
        d.nombre = $("#rev-nombre-" + o, fila).value.trim();
        const qty = parseInt($("#rev-qty-" + o, fila).value, 10);
        if (Number.isFinite(qty) && qty >= 0) d.qty = qty;
        const score = parseInt($("#rev-score-" + o, fila).value, 10);
        if (Number.isFinite(score) && score >= 1 && score <= 10) d.score = score;
        const min = parseInt($("#rev-min-" + o, fila).value, 10);
        if (Number.isFinite(min) && min >= 0) d.min = min;
        const variante = $("#rev-variante-" + o, fila);
        if (variante) d.varianteId = variante.value;
      });
      // SÓLO las filas de ESTE diálogo de revisión: los exactos ya sumaron en el diálogo 1 y NO
      // vuelven a escribirse aquí (si se colasen, la compra iría doble — lo cazó el sondeo e2e).
      const osDeRevision = new Set($$(".ocr-item", modalContent).map(fila => Number(fila.dataset.o)));
      let mensajeError = "";
      decision.forEach((d, o) => {
        if (!osDeRevision.has(o) || !d.incluir || mensajeError) return;
        if (!d.varianteId && !d.nombre) { mensajeError = "Hay un alimento sin nombre: escribe uno o desmarca su casilla."; return; }
      });
      if (mensajeError) { toast(mensajeError, "error"); return; }
      // El destino lo decidió la persona fila a fila: con variante la compra entra ESE id; sin
      // ella es alta (el módulo evita duplicados casando nombre exacto con lo ya en casa).
      const conVariante = [], deAltaDirecta = [];
      decision.forEach((d, o) => {
        if (!osDeRevision.has(o) || !d.incluir) return;
        const fila = { nombre: d.nombre, qty: d.qty, score: d.score, min: d.min };
        if (d.varianteId) { fila.varianteId = d.varianteId; conVariante.push(fila); }
        else deAltaDirecta.push(fila);
      });
      if (!conVariante.length && !deAltaDirecta.length) { toast("No hay alimentos marcados para guardar", "error"); return; }
      const resultado = ocr.confirmarRevision(foods, deAltaDirecta, conVariante, { uid, ahora: Date.now() });
      foods = resultado.foods;
      save(LS.foods, foods);
      renderFoods();
      renderWeeklyAlert();
      renderShoppingListTrasDespensa();
      closeModal();
      señalarResultadoEnDespensa();
    }

    renderDialogo();
  }

  // ===== RECETAS =====
  const recipeDesc = $("#recipe-desc");
  const recipeMeal = $("#recipe-meal");
  const btnGenerate = $("#btn-generate");
  const recipePreview = $("#recipe-preview");
  const pvTitle = $("#pv-title");
  const pvIngredients = $("#pv-ingredients");
  const pvMethod = $("#pv-method");
  const recipePossible = $("#recipe-possible");
  const btnSaveRecipe = $("#btn-save-recipe");
  const btnDiscard = $("#btn-discard");
  const recipeList = $("#recipe-list");
  const recipeEmpty = $("#recipe-empty");
  const recipeFilter = $("#recipe-filter");
  const recipeMealFilter = $("#recipe-meal-filter");
  const recipeCatalogSearch = $("#recipe-catalog-search");
  const recipeCatalogResults = $("#recipe-catalog-results");
  const recipeCatalogEmpty = $("#recipe-catalog-empty");
  const mealLabels = { desayuno: "🌅 Desayuno", comida: "🍽️ Comida", cena: "🌙 Cena" };

  // ===== BUSCADOR DEL CATÁLOGO (feature 2026-10-18, card entre crear receta y Mis Recetas) =====
  // TODA la decisión (normalizar consulta vía el matcher compartido, match de TÍTULO SÓLO —
  // exacto x3 / prefijo x2, fix 2026-10-20: los ingredientes ya no puntúan —, orden estable,
  // límite) vive en el módulo puro modules/busqueda-recetas.js;
  // aquí sólo el molde de tarjetas (igual que las de Mis Recetas) y el click → modal de detalle.
  function renderBusquedaCatalogo() {
    const q = recipeCatalogSearch.value;
    const busqueda = (window.MRCheff.busquedaRecetas)
      ? window.MRCheff.busquedaRecetas.buscar(q, catalogoEspanol, { limite: 8 })
      : { tokens: [], resultados: [] };
    const hits = busqueda.resultados;
    recipeCatalogResults.innerHTML = "";
    recipeCatalogEmpty.classList.toggle("hidden", !(busqueda.tokens.length && hits.length === 0));
    hits.forEach(hit => {
      const r = hit.receta;
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        <h3>${escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
          ${badgeOrigenHTML(r)}
          ${badgeSyncHTML(r)}
        </div>`;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Ver detalles de " + r.title);
      card.addEventListener("click", () => openRecipeModal(r));
      activablePorTeclado(card, () => openRecipeModal(r));
      recipeCatalogResults.appendChild(card);
    });
  }
  recipeCatalogSearch.addEventListener("input", renderBusquedaCatalogo);

  btnGenerate.addEventListener("click", () => {
    const desc = recipeDesc.value.trim();
    if (!desc) { toast("Escribe primero la descripción", "error"); return; }
    const meal = recipeMeal.value;
    const { title, ingredients, method, possible } = window.MRCheff.recipeAnalysis.analyzeRecipe(desc, { meal, pantry: foods.map(f => f.name) });
    pvTitle.value = title;
    pvIngredients.value = ingredients.join("\n");
    pvMethod.value = method.join("\n");
    renderPossible(possible);
    recipePreview.classList.remove("hidden");
    recipePreview.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Análisis del texto libre "describe tu cocinado" -> receta estructurada. Extraído al módulo puro
  // modules/recipe-analysis.js (sin DOM ni localStorage, recibe { meal, pantry } por contexto para que sea
  // testeable de forma aislada). El punto de uso real está en el manejador del botón "Generar" arriba,
  // que llama directamente a window.MRCheff.recipeAnalysis. Ver CODING_STANDARDS.md §3 option A / DIP.

  // Renderiza la fila de ingredientes "posibles" (chips). Tocar un chip lo añade a la
  // lista de ingredientes sin duplicar. Si no hay posibles, oculta la fila.
  function renderPossible(possible) {
    const box = recipePossible;
    const list = Array.isArray(possible) ? possible : [];
    if (!list.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.innerHTML =
      `<div class="possible-label">💡 También tienes en casa — toca para añadir:</div>` +
      list.map(n => `<button type="button" class="chip" data-ing="${escapeHTML(n)}">+ ${escapeHTML(n)}</button>`).join("");
    box.classList.remove("hidden");
    box.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const ing = chip.dataset.ing;
        const lines = pvIngredients.value.split("\n").map(s => s.trim());
        const same = lines.some(l => l.toLowerCase() === ing.toLowerCase());
        if (!same) pvIngredients.value = (pvIngredients.value.trim() ? pvIngredients.value.trim() + "\n" : "") + ing;
        chip.remove();
        if (!box.querySelector(".chip")) { box.classList.add("hidden"); box.innerHTML = ""; }
      });
    });
  }

  btnDiscard.addEventListener("click", () => {
    recipePreview.classList.add("hidden");
    pvTitle.value = ""; pvIngredients.value = ""; pvMethod.value = "";
    renderPossible([]);
  });

  btnSaveRecipe.addEventListener("click", () => {
    const title = pvTitle.value.trim();
    const ingredients = pvIngredients.value.split("\n").map(s => s.trim()).filter(Boolean);
    const method = pvMethod.value.split("\n").map(s => s.trim()).filter(Boolean);
    if (!title || ingredients.length === 0 || method.length === 0) {
      toast("Completa título, ingredientes y método", "error");
      return;
    }
    recipes.push({
      id: uid(),
      title,
      meal: recipeMeal.value,
      ingredients,
      method,
      createdAt: Date.now()
    });
    save(LS.recipes, recipes);
    recipePreview.classList.add("hidden");
    recipeDesc.value = "";
    pvTitle.value = ""; pvIngredients.value = ""; pvMethod.value = "";
    renderRecipes();
    toast("Receta guardada");
  });

  recipeFilter.addEventListener("input", renderRecipes);
  recipeMealFilter.addEventListener("change", renderRecipes);

  // Registra "se cocinó hoy" para CUALQUIER vista que lo ofrezca (Sugerencias, tarjetas de Recetas y
  // modal de detalle): la lógica inmutable vive en menuSemanal.cookEntry (fabrica la entrada de
  // mrcheff.cooked con su keyFingerprint); aquí sólo persistencia + aviso. Devuelve { cooked } nuevo
  // por si la vista llamante quiere re-render fino (p.ej. Sugerencias re-sugiere con el cooldown aplicado).
  function registrarCocinado(rec) {
    const result = menuSemanal.cookEntry(rec, load(LS.cooked, []), today, planner.cookEntryFor, uid);
    save(LS.cooked, result.cooked);
    toast("Registrado: se cocinó hoy");
    return result;
  }

  function renderRecipes() {
    const q = recipeFilter.value.trim().toLowerCase();
    const meal = recipeMealFilter.value;
    const filtered = recipes
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(r => (meal === "all" || r.meal === meal) &&
        (!q || r.title.toLowerCase().includes(q)));

    recipeList.innerHTML = "";
    recipeEmpty.classList.toggle("hidden", recipes.length > 0);
    if (filtered.length === 0 && recipes.length > 0) {
      recipeEmpty.textContent = "No hay recetas con ese filtro.";
    }

    filtered.forEach(r => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = r.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${r.id}" title="Editar título, ingredientes o pasos" aria-label="Editar receta">✏️</button>
          <button data-cook="${r.id}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳</button>
          <button data-del="${r.id}" title="Eliminar" aria-label="Eliminar receta">🗑</button>
        </div>
        <h3>${escapeHTML(r.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
          ${badgeOrigenHTML(r)}
          ${badgeSyncHTML(r)}
          <span class="muted" style="font-size:.8rem">${r.ingredients.length} ingr.</span>
        </div>`;
      // Abrir detalle al hacer click en la tarjeta (el lápiz abre el EDITOR directamente: para eso está;
      // el 🍳 registra "cocinado hoy" sin abrir el modal — ni edita ni borra)
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-edit], [data-cook]")) return;
        openRecipeModal(r);
      });
      activablePorTeclado(card, () => openRecipeModal(r));
      recipeList.appendChild(card);
    });

    recipeList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recipes = recipes.filter(x => x.id !== btn.dataset.del);
        save(LS.recipes, recipes);
        renderRecipes();
        toast("Receta eliminada");
      });
    });
    // Lápiz de la tarjeta: abre el editor directamente (sin pasar por el modal de detalle)
    recipeList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = recipes.find(x => x.id === btn.dataset.edit);
        if (receta) openRecipeEditor(receta);
      });
    });
    // 🍳 de la tarjeta (solo icono): registra "cocinado hoy" con la MISMA lógica que Sugerencias y Menú
    // (menuSemanal.cookEntry → mrcheff.cooked con fingerprint → cooldown de 7 días). No abre el modal.
    recipeList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const receta = recipes.find(x => x.id === btn.dataset.cook);
        if (receta) registrarCocinado(receta);
      });
    });
    // Invariante: cada vez que la vista Recetas se pinta (cualquier camino -- nav-gate, filtros o borrado de una
    // tarjeta), dejamos el flag limpio por aqui, de cara a que solo volvra a marcarse cuando entre real otra receta
    //nueva desde fuera; evita un repintado redundante en el siguiente cambio de tab si no paso nada nuevo.
    recetasDirty = false;
  }

  // ===== MODAL DETALLE =====
  const modal = $("#modal");
  const modalContent = $("#modal-content");
  const modalBox = $(".modal-box", modal);

  // ---------- Consejero del botón (explicación breve desktop + táctil) ----------
  // Desktop: se ve con ENVESAR el botón (o al llegarle el foco) y se VA al salir; móvil:
  // LONG-PRESS de 450 ms — se lee el consejo mientras se mantiene el dedo, al SOLTAR se
  // va y ese toque largo NO acaba accionando el botón (se consultó, no se usó). Todo
  // delegado en #modal-content: cada botón nuevo con data-tip lo hereda sin wiring.
  let tipChefEl = null;
  function tipChef() {
    if (!tipChefEl) {
      tipChefEl = document.createElement("div");
      tipChefEl.id = "tip-chef";
      tipChefEl.className = "tip-chef";
      tipChefEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipChefEl);
    }
    return tipChefEl;
  }
  function mostrarTip(btn) {
    if (!btn || !btn.dataset || !btn.dataset.tip) return;
    const tip = tipChef();
    tip.textContent = btn.dataset.tip;                       // textos propios, nunca dato del usuario
    const r = btn.getBoundingClientRect();
    const cabeArriba = r.top > 48;                           // píldora ~36px + huelgo
    tip.style.left = "0px";                                  // fuera de pantalla para medir sin parpadeo
    tip.style.top = "0px";
    tip.style.visibility = "hidden";
    tip.classList.add("show");
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    x = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - tr.width - 8));
    tip.style.left = Math.round(x) + "px";
    tip.style.top = Math.round(cabeArriba ? r.top - tr.height - 8 : r.bottom + 8) + "px";
    tip.style.visibility = "";
  }
  function ocultarTip() {
    if (tipChefEl) tipChefEl.classList.remove("show");
  }

  let suprimirTrasToqueLargo = false;
  (function consejosDeBotones(raiz) {
    if (!raiz || typeof raiz.addEventListener !== "function") return;
    raiz.addEventListener("mouseover", (e) => {              // desktop: envesar
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) mostrarTip(b);
    });
    raiz.addEventListener("mouseout", (e) => {               // desktop: quitar el ratón
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) ocultarTip();
    });
    raiz.addEventListener("focusin", (e) => {                // teclado: el consejo llega con el foco
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (b) mostrarTip(b);
    });
    raiz.addEventListener("focusout", ocultarTip);
    let toque = null;                                        // táctil: long-press
    raiz.addEventListener("touchstart", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!b) return;
      suprimirTrasToqueLargo = false;                        // contacto NUEVO: se confía en él de nuevo
      toque = { btn: b, largo: false };
      toque.timer = setTimeout(() => {
        toque.largo = true;
        mostrarTip(b);
        if (navigator.vibrate) navigator.vibrate(10);
      }, 450);
    }, { passive: true });
    const finToque = () => {
      if (!toque) return;
      clearTimeout(toque.timer);
      if (toque.largo) {
        ocultarTip();
        suprimirTrasToqueLargo = true;                       // el click que sigue a leer NO acciona
      }
      toque = null;
    };
    raiz.addEventListener("touchend", finToque);
    raiz.addEventListener("touchcancel", finToque);
    // captura: se interviene ANTES de que cualquier listener del botón vea el click
    raiz.addEventListener("click", (e) => {
      if (!suprimirTrasToqueLargo) return;
      suprimirTrasToqueLargo = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    // el consejo es fijo: si algo scrollea, el botón se mueve — mejor retirarlo
    document.addEventListener("scroll", ocultarTip, true);
  })(modalContent);

  // Accesibilidad del modal: al abrir se recuerda el control que lo llamó (para devolverle el
  // foco al cerrar) y se anuncia un nombre por aria-label; al cerrar el foco vuelve a su sitio.
  // Sólo glue de vista: la decisión de qué se muestra sigue viniendo de cada aceptor.
  let focoAntesDeModal = null;
  function abrirModal(tituloAccesible) {
    const activo = document.activeElement;
    focoAntesDeModal = (activo && typeof activo.focus === "function") ? activo : null;
    // En móvil, scrollear DENTRO del modal no debe arrastrar a la lista de debajo
    // (scroll chaining): el modal-box lleva overscroll-behavior:contain en CSS y, además,
    // congelamos el scroll del documento mientras el modal está abierto. La clase va al
    // documentElement TAMBIÉN: en Android el scroller del documento es <html>, no <body>.
    document.documentElement.classList.add("modal-abierto");
    document.body.classList.add("modal-abierto");
    if (tituloAccesible) modalBox.setAttribute("aria-label", tituloAccesible);
    modal.classList.remove("hidden");
  }

  // Puntos de acceso por teclado: tarjetas y filas que abren detalle con un click ganan también
  // Tab (el foco las alcanza) + Enter/Espacio para abrirlas. Si el foco está en un botón interno
  // (✏️, 🗑, …) la tecla les pertenece a esos botones, no a la tarjeta.
  function activablePorTeclado(el, abrir) {
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", (e) => {
      if (e.target !== el) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
  }
  // Modal de detalle. Se extiende para el flujo Sugerencias/Menú (§ plan Feature §2): la 2ª arg opcional { highlightMissing:true }
  // hace que los ingredientes NO disponibles en aforo (stock qty=0 o ausente) se marquen visualmente con .meal-missing + "⚠️ No lo tienes".
  // SIN esa bandera el render del modal queda IDENTICO al de siempre: Recetas/Innovación no la pasan → no se rompe ninguna vista ya probada.
  function openRecipeModal(r, opts) {
    const resaltarFaltantes = !!(opts && opts.highlightMissing);           // guard estricto § plan §2 "no activa sin que la UI lo pida".
    // Etiqueta "Sugerencia de hoy" oculta cuando el modal se abre desde el PLAN semanal (petición
    // 2026-10-21); Card 1 y el resto de vistas la siguen mostrando (tests de Card-1 la fijan).
    const ocultarSugerencia = !!(opts && opts.ocultarEtiquetaSugerencia);
    let faltantesPorIndice = null;                                          // boolean[] paralelo a r.ingredients, sólo calculado SI la vista lo pide (sin bandera → nulo → idéntico).
    if (resaltarFaltantes && window.MRCheff.recipeMissing) {               // el match estricto vive en un PURe módulo testable (DIP §6), no se reinventa aquí (§ "un solo lugar calcula bien").
      const moduloFaltantes = window.MRCheff.recipeMissing;
      faltantesPorIndice = typeof moduloFaltantes.marcarFaltantes === "function" ? moduloFaltantes.marcarFaltantes(r, foods) : null; // fallback débil: si el módulo se perdiera NO romperíamos nada.
    }
    // ¿Editable? Si la receta ya vive en Mis Recetas → se edita IN-SITU; si no (plato del catálogo curado o del
    // menú generado), la edición guarda una COPIA editable en Mis Recetas sin tocar el original, que es de sólo lectura.
    const enMisRecetas = recipeEditor.estaGuardada(recipes, r);
    modalContent.innerHTML = `
      <h2>${escapeHTML(r.title)}</h2>
      <div class="receta-linea" aria-hidden="true"></div>
      <div class="recipe-meta">
        <span class="tag meal-${r.meal}">${mealLabels[r.meal]}</span>
        ${badgeOrigenHTML(r)}
        ${badgeSyncHTML(r)}
        ${ocultarSugerencia ? tagMenuSlotHTML(r) : tagClasicoHTML(r, "Idea")}
      </div>
      ${r.from ? `<p class="muted">Base: ${escapeHTML(r.from)}</p>` : ""}
      ${r.uses && r.uses.length ? `<p class="muted">🥣 Usa de tu casa: ${r.uses.map(escapeHTML).join(", ")}</p>` : ""}
      <h4>🧾 Ingredientes</h4>
      <ul>${Array.isArray(r.ingredients) ? r.ingredients.map((i, idx) => {
        // Cada ingrediente se evalúa con su índice para NO reordenar ni dedup la lista original del plato (§ Liskov: form/shape idéntico al de hoy SIN flag).
        const ausente = Array.isArray(faltantesPorIndice) && faltantesPorIndice[idx] === true; // sólo marca si la vista lo pidió (§ guard estricto § plan §2 "sin bandera → sin clase, sin badge").
        return ausente
          ? `<li class="meal-missing">${escapeHTML(i)} <span class="missing-badge">⚠️ No lo tienes</span></li>`   // UI coherente con CSS .meal-missing/.missing-badge ya existente (§ plan Feature §2 modal).
          : `<li>${escapeHTML(i)}</li>`;   // IDÉNTICO al render actual SIN la bandera → Recetas/Innovación no se ROMPEN en sus vistas ya probadas (§ guard total de regresión, § "no romper vistas ya probadas").
      }).join("") : ""}</ul>
      <h4>👨‍🍳 Método</h4>
      <ol>${r.method.map(m => `<li>${escapeHTML(limpiarPaso(m))}</li>`).join("")}</ol>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn ghost" data-edit>${enMisRecetas ? "✏️ Editar" : "✏️ Editar y guardar"}</button>
        <button class="btn ghost" data-cook data-tip="Anota que la has cocinado hoy: 7 días sin volverse a sugerir">🍳 Cocinar hoy</button>
        <button class="btn primary" data-copy>📋 Copiar</button>
      </div>`;
    abrirModal("Detalle de receta: " + r.title);
    const btnCerrarModal = $(".modal-close", modal);
    if (btnCerrarModal) btnCerrarModal.focus();
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    const btnEdit = $("[data-edit]", modalContent);
    if (btnEdit) btnEdit.addEventListener("click", () => openRecipeEditor(r));
    // "🍳 Cocinar hoy" del modal (icono + texto): MISMA lógica compartida que la tarjeta de Recetas y
    // que Sugerencias y Menú — una entrada nueva en mrcheff.cooked anclada a HOY (cooldown de 7 días).
    const btnCook = $("[data-cook]", modalContent);
    if (btnCook) btnCook.addEventListener("click", () => registrarCocinado(r));
    $("[data-copy]", modalContent).addEventListener("click", () => {
      const text = `${r.title}\n\nIngredientes:\n${r.ingredients.map(i => "- " + i).join("\n")}\n\nMétodo:\n${r.method.map(m => limpiarPaso(m)).join("\n")}`;
      navigator.clipboard?.writeText(text).then(
        () => toast("Copiado al portapapeles"),
        () => toast("No se pudo copiar", "error")
      );
    });
  }

  // Editor de receta: reutiliza el MISMO modal (#modal-content) para no añadir una capa nueva.
  // La lógica de decisión/dominio (borrador, validación, in-situ vs copia, parche del plan) vive en
  // el módulo puro modules/recipe-editor.js (§3 CODING_STANDARDS.md) — aquí sólo DOM y persistencia.
  function openRecipeEditor(r) {
    const enMisRecetas = recipeEditor.estaGuardada(recipes, r);
    modalContent.innerHTML = `
      <h2>${enMisRecetas ? "✏️ Editar receta" : "✏️ Editar y guardar en Mis Recetas"}</h2>
      <p class="muted">Toca lo que quieras: nombre, momento del día, ingredientes o pasos. Se guarda como está escrito, con una línea por ingrediente y una por paso.</p>
      <div class="recipe-edit">
        <label for="edit-title">Nombre del plato
          <input type="text" id="edit-title" value="${escapeHTML(r.title)}" maxlength="120">
        </label>
        <label for="edit-meal">Momento del día
          <select id="edit-meal">
            <option value="desayuno" ${r.meal === "desayuno" ? "selected" : ""}>${mealLabels.desayuno}</option>
            <option value="comida" ${r.meal === "comida" ? "selected" : ""}>${mealLabels.comida}</option>
            <option value="cena" ${r.meal === "cena" ? "selected" : ""}>${mealLabels.cena}</option>
          </select>
        </label>
        <label for="edit-ingredients">Ingredientes (uno por línea)
          <textarea id="edit-ingredients" rows="7">${escapeHTML((r.ingredients || []).join("\n"))}</textarea>
        </label>
        <label for="edit-method">Pasos (uno por paso)
          <textarea id="edit-method" rows="8">${escapeHTML((r.method || []).join("\n"))}</textarea>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn primary" data-save-edit>Guardar cambios</button>
      </div>`;
    abrirModal("Editar receta");
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    $("#edit-title", modalContent).focus();
    $("[data-save-edit]", modalContent).addEventListener("click", () => {
      const draft = recipeEditor.buildDraft(
        $("#edit-title", modalContent).value,
        $("#edit-meal", modalContent).value,
        $("#edit-ingredients", modalContent).value,
        // Cada paso se guarda YA normalizado: sin numeración incrustada ni puntuación suelta,
        // para que el dato de Mis Recetas nazca limpio (limpiarPaso es puro e idempotente).
        $("#edit-method", modalContent).value.split("\n").map(limpiarPaso).join("\n")
      );
      const check = recipeEditor.validateDraft(draft);
      if (!check.ok) {
        toast("Completa nombre, ingredientes y pasos", "error");
        return;
      }
      const resultado = recipeEditor.applyEdit(recipes, r, draft, { uid, now: () => Date.now(), origen: origenAlGuardar(r).origen });
      recipes = resultado.recipes;
      save(LS.recipes, recipes);
      if (recipeEditor.patchPlan(weeklyMenu && weeklyMenu.plan, resultado.guardada, resultado.modo === "in-situ" ? null : r.id)) {
        save(LS.weekmenu, weeklyMenu);
        renderWeeklyMenu(weeklyMenu.plan);
      }
      renderRecipes();
      toast(resultado.modo === "in-situ" ? "Receta actualizada" : "Receta guardada en Mis Recetas");
      closeModal();
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.documentElement.classList.remove("modal-abierto");
    document.body.classList.remove("modal-abierto");
    if (focoAntesDeModal) { focoAntesDeModal.focus(); focoAntesDeModal = null; }
    // El botón con consejero desaparece (además el foco salta al DOM): sin mouseout/focusout,
    // la píldora se quedaría ahí por encima de lo que abra después (2026-10-20).
    const tipChef = document.getElementById("tip-chef");
    if (tipChef) tipChef.classList.remove("show");
  }
  $$("[data-close]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ===== INNOVACIÓN =====
  const btnGenerateInnov = $("#btn-generate-innov");
  const btnClearInnov = $("#btn-clear-innov");
  const innovationList = $("#innovation-list");
  const innovationEmpty = $("#innovation-empty");
  const innovDayNote = $("#innov-day-note");
  const innovCount = $("#innov-count");
  const innovCountVal = $("#innov-count-val");
  const innovFocus = $("#innov-focus");
  const innovSummary = $("#innov-summary");

  innovCount.addEventListener("input", () => innovCountVal.textContent = innovCount.value);
  // SOURCE_LABEL — etiqueta visible por `idea.source`. Nota: planner.js (Paso 1, contrato cerrado y testeado a parte)
  // emite el token interno "receta_sugerida" para las ideas de "Sugerencia de hoy"; ese mismo token se refleja aquí para
  // que SOURCE_LABEL[i.source] resuelva la etiqueta. Se conserva también la clave "sugerenciaHoy" que nombra el plan de
  // feature; ambas apuntan a la misma etiqueta visible.
  const SOURCE_LABEL = { curada: "Receta española", variacion: "Variación", combo: "Combinación", libre: "Creada", protagonista: "Enfocado", nueva: "Nueva", sugerenciaHoy: "Sugerencia de hoy", receta_sugerida: "Sugerencia de hoy" };

  // Etiqueta de ORIGEN del catálogo curado (2026-10-18): "Receta española" / "Receta italiana" en TODAS las vistas
  // de recetas. TODA la decisión vive en el módulo puro modules/origen-recetas.js (detección por id/título/sello,
  // sello al guardar, clase CSS y si el tag clásico de fuente es redundante); aquí sólo quedan los MOLDES <span>
  // con el fallback visible si el módulo no cargara (§ guard débil, mismo espíritu que recipeMissing).
  function etiquetaOrigenSegura(rec) {
    const m = window.MRCheff.origenRecetas;
    return (m && m.etiquetaOrigen) ? m.etiquetaOrigen(rec) : "Receta española";
  }
  function claseOrigenSegura(rec) {
    const m = window.MRCheff.origenRecetas;
    return (m && m.claseOrigen) ? m.claseOrigen(rec) : "tag-origen-espanola";
  }
  function badgeOrigenHTML(rec) {
    return `<span class="tag ${claseOrigenSegura(rec)}">${etiquetaOrigenSegura(rec)}</span>`;
  }
  // Tag clásico de FUENTE ("%Variación", "Sugerencia de hoy"…): el módulo decide si se pinta (null ⇒ no).
  function tagClasicoHTML(rec, fallback) {
    const m = window.MRCheff.origenRecetas;
    const texto = (m && m.etiquetaClasicaVisible) ? m.etiquetaClasicaVisible(rec, SOURCE_LABEL, { fallback }) : (rec && rec.source ? (SOURCE_LABEL[rec.source] || fallback) : null);
    return texto ? `<span class="tag tag-${String(rec.source)}">${texto.toString()}</span>` : "";
  }
  // Tag clásico del PLAN semanal (2026-10-21, petición del usuario): en la semana cada hueco YA es
  // una sugerencia del lote — la etiqueta "Sugerencia de hoy" no aporta nada y repetida en las 21
  // filas es ruido. Se suprime SÓLO ese token (fusiona con el tag si el texto coincidiera): los
  // demás tags de fuente ("Nueva", "Variación"…) siguen decidiendo por el módulo puro sin cambio.
  function tagMenuSlotHTML(rec) {
    const html = tagClasicoHTML(rec);
    if (!html || html.includes(SOURCE_LABEL.sugerenciaHoy)) return "";
    return html;
  }
  // Sello de ORIGEN al guardar una copia (⭐ de Innovación / ✏️ editor): el módulo calculó id/título del plato
  // ORIGINAL en el MOMENTO del guardado para que la etiqueta persista aunque el usuario renombre después.
  // El campo queda persistido en la receta (origen:"italiana"|"espanola") y el módulo le da precedencia.
  function origenAlGuardar(rec) {
    const m = window.MRCheff.origenRecetas;
    if (!m || !m.origenAlGuardar) return {};
    const sello = m.origenAlGuardar(rec);          // string 'italiana'|'espanola' (o null sin datos)
    return sello ? { origen: sello } : {};
  }

  const innovApi = window.MRCheff.innovations;   // módulo puro del generador + conciliación (modules/innovations.js)

  btnGenerateInnov.addEventListener("click", () => {
    if (foods.length === 0 && recipes.length === 0) {
      toast("Añade alimentos o guarda una receta para inventar", "error");
      return;
    }
    const count = parseInt(innovCount.value, 10) || 8;
    // Generación de ideas (variaciones + combinaciones arquetípicas, y platos "libres"/"protagonistas"): ahora lógica PURA
    // extraída a modules/innovations.js. Aquí sólo consumimos su lote (`batch`) y orquestamos la conciliación con lo ya guardado
    // más persistencia. Ver CODING_STANDARDS.md §3 option A / DIP, al igual que priority/classify/recipe-analysis.
    const batch = window.MRCheff.innovations.generate(count, innovFocus.value, {
      foods, recipes,
      // Recentes = títulos de la pila actual de sugerencias: el generador los aparta de su pool para que cada
      // click de "Sugerir ahora" traiga platos NUEVOS (misma lógica de scoring y exclusiones de siempre §8).
      recientes: innovations.map(i => i.title)
    });
    if (batch.length === 0) {
      toast("No hay combinaciones suficientes con lo que tienes", "error");
      return;
    }
    // Interpolación del lote en la pila (dedup por título + techo 30): la regla vive en el módulo
    // puro `innovations.conciliarLote` (2026-10-21); aquí sólo persistencia y toast.
    const { pila: nuevaPila, added } = innovApi.conciliarLote(innovations, batch, 30);
    innovations = nuevaPila;
    save(LS.innov, innovations);
    innovDay = today;
    save(LS.innovDate, innovDay);
    innovDayNote.classList.remove("hidden");
    renderInnovations();
    toast(added ? `¡${added} idea(s) nueva(s)!` : "Ya tenías esas ideas en la lista");
  });

  btnClearInnov.addEventListener("click", () => {
    innovations = [];
    save(LS.innov, []);
    innovDayNote.classList.add("hidden");
    renderInnovations();
    toast("Ideas limpiadas");
  });

  // --- Generadores de innovación y utilidades aleatorias extraídos al módulo puro modules/innovations.js ---
  // (pick/chance/randInt/shuffle/sample/byScore/joinNames + STYLES/TWISTS/FINISH/SEASONINGS/PREFIXES/ADJ/ARCHETYPES
  //  + makeVariation/makeCombo/makeFreeform/makeSolo/generateInnovations). Ahora se consume vía
  //  window.MRCheff.innovations.generate(count, focus, { foods, recipes }) — ver el comentario del handler de "btnGenerateInnov".

  function updateInnovSummary() {
    if (!innovations.length) { innovSummary.classList.add("hidden"); return; }
    innovSummary.classList.remove("hidden");
    // El agrupado por fuente visible es del módulo (innovations.resumenPorFuente, 2026-10-21):
    // el resolver da YA el texto final (origen para las curadas, etiqueta de fuente para el resto)
    // y aquí queda sólo la frase de vista.
    const resumen = innovApi.resumenPorFuente(innovations, claveDeGrupoFuente);
    innovSummary.textContent = `${resumen.total} idea(s) en la lista (${resumen.partes.join(" · ")}). Guarda las que te gusten con ⭐.`;
  }

  // Resumen del generador: agrupa por FUENTE, pero para las curadas agrupa por ORIGEN visible
  // ("x Receta española · y Receta italiana") — la etiqueta es la MISMA que pintan las tarjetas.
  function claveDeGrupoFuente(i) {
    return i.source === "curada" ? etiquetaOrigenSegura(i) : (SOURCE_LABEL[i.source] || "nuevas");
  }

  function renderInnovations() {
    innovationList.innerHTML = "";
    innovationEmpty.classList.toggle("hidden", innovations.length > 0);
    updateInnovSummary();
    innovations.forEach(i => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = i.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${i.id}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-save="${i.id}" title="Guardar en Mis Recetas" aria-label="Guardar en Mis Recetas">⭐</button>
          <button data-del="${i.id}" title="Eliminar" aria-label="Eliminar idea">🗑</button>
        </div>
        <h3>${escapeHTML(i.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${i.meal}">${mealLabels[i.meal]}</span>
          ${badgeOrigenHTML(i)}
          ${badgeSyncHTML(i)}
          ${i.source === "curada" ? "" : `<span class="tag tag-${i.source}">${SOURCE_LABEL[i.source] || "Nueva"}</span>`}
        </div>
        ${i.uses && i.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${i.uses.map(escapeHTML).join(" · ")}</div>` : ""}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del], [data-save], [data-edit]")) return;
        openRecipeModal(i);
      });
      activablePorTeclado(card, () => openRecipeModal(i));
      innovationList.appendChild(card);
    });

    // Lápiz de la idea: abre el editor en modo "copia" (la idea no está aún en Mis Recetas)
    innovationList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = innovations.find(x => x.id === btn.dataset.edit);
        if (idea) openRecipeEditor(idea);
      });
    });

    innovationList.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = innovations.find(x => x.id === btn.dataset.save);
        if (!idea) return;
        // editedAt ISO (sync-buzon §1): toda ruta que CREA/EDITA una receta guarda su marca de edición estable.
        recipes.push({ id: uid(), title: idea.title, meal: idea.meal, ingredients: idea.ingredients.slice(), method: idea.method.slice(), createdAt: Date.now(), editedAt: new Date().toISOString(), ...(origenAlGuardar(idea)) });
        save(LS.recipes, recipes);
        // No repintamos la vista "Recetas" a ciegas aqui (probablemente estamos mirando Innovacion ahora y su lista
        // iria oculta/innecesaria de pintar): solo marcamos la vista como sucia. El propio cambio de tab al volver a
        // Recetas decidira si hay que re-pintarla; ver el nav handler / 'recetasDirty' en renderRecipes(), abajo.
        recetasDirty = true;
        innovations = innovations.filter(x => x.id !== idea.id);
        save(LS.innov, innovations);
        renderInnovations();
        toast("Guardada en Mis Recetas");
      });
    });

    innovationList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        innovations = innovations.filter(x => x.id !== btn.dataset.del);
        save(LS.innov, innovations);
        renderInnovations();
      });
    });
  }

  // ===== SUGERENCIAS Y MENÚ — CARD 1: "Sugerencia de hoy" =====
  // Recetas del catálogo curado que SÍ se pueden cocinar ahora (todos sus ingredientes con qty>0 en aforo),
  // ordenadas por aprovechamiento de casa. "🍳 Cocinar hoy" anota en mrcheff.cooked (sin tocar recipes[] / Mis Recetas).
  const btnSuggestGenerate = $("#btn-suggest-generate");
  const btnSuggestClear = $("#btn-suggest-clear");
  const suggestList = $("#suggest-list");
  const suggestEmpty = $("#suggest-empty");
  const catalogoEspanol = window.MRCheff.recetasEspanolas || [];
  const planner = window.MRCheff.planner;
  const menuSemanal = window.MRCheff.menuSemanal;

  function renderSuggestCards(ideas) {
    suggestList.innerHTML = "";
    if (!Array.isArray(ideas) || ideas.length === 0) {
      suggestEmpty.classList.remove("hidden");
      return;
    }
    suggestEmpty.classList.add("hidden");
    ideas.forEach(idea => {
      const card = document.createElement("div");
      card.className = "recipe-card";
      card.dataset.id = idea.id;
      card.innerHTML = `
        <div class="recipe-actions">
          <button data-edit="${idea.id}" title="Editar y guardar en Mis Recetas" aria-label="Editar y guardar en Mis Recetas">✏️</button>
          <button data-cook="${idea.id}" title="Cocinar hoy" aria-label="Cocinar hoy">🍳 Cocinar hoy</button>
        </div>
        <h3>${escapeHTML(idea.title)}</h3>
        <div class="recipe-meta">
          <span class="tag meal-${idea.meal}">${mealLabels[idea.meal] || ""}</span>
          ${badgeOrigenHTML(idea)}
          ${badgeSyncHTML(idea)}
        ${tagClasicoHTML(idea, SOURCE_LABEL.sugerenciaHoy)}
        </div>
        ${idea.uses && idea.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${idea.uses.map(escapeHTML).join(" · ")}</div>` : ""}`;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-cook], [data-edit]")) return;
        openRecipeModal(idea, { highlightMissing: true });
      });
      activablePorTeclado(card, () => openRecipeModal(idea, { highlightMissing: true }));
      suggestList.appendChild(card);
    });

    // Lápiz de la sugerencia: abre el editor en modo "copia" (guarda en Mis Recetas sin tocar el catálogo)
    suggestList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.edit);
        if (idea) openRecipeEditor(idea);
      });
    });

    suggestList.querySelectorAll("[data-cook]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idea = ideas.find(x => x.id === btn.dataset.cook);
        if (!idea) return;
        // Misma vía compartida que Recetas/modal (helper registrarCocinado); aquí además re-sugerimos:
        // el plato recién cocinado entra en cooldown de 7 días y deja de aparecer.
        const { cooked } = registrarCocinado(idea);
        const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
        renderSuggestCards(planner.suggestToday(pool, foods));
      });
    });
  }

  // Rotación de "↻ Sugerir ahora" (Card 1): la COMPOSICIÓN del lote (máx 4, con 1 desayuno + 1 comida
  // + 1 cena + una 4ª que rota de tipo) vive como función PURA `planner.loteRotado` (7ª API pública,
  // §8 log + unit tests en tests/planner.test.js) sobre el ranking completo de suggestToday — toda la
  // lógica de siempre (aforo qty>0, cooldown de cooked, ranking) intacta. Aquí sólo la MEMORIA de la
  // vista: los cursores de rotación (se reinician al recargar la página o al pulsar "Limpiar").
  //
  // RODILLO DEL COOLDOWN (bug 2026-10-21): el filtro de cocinadas-esta-semana vive en el pool común
  // (buildCandidatePool); cocinando en raña —aprobar el plan ancla hasta 21 entradas en mrcheff.cooked—
  // el cooldown podía AGOTAR todas las recetas cocinables y dejar la Card a cero para siempre (repro
  // real: 5 cocinables del aforo del usuario, las 5 con entrada cooked en la ventana ⇒ 0 tarjetas;
  // por eso "ya no sacaba recetas"). Regla: si el ranking estricto trae menos de 4, se rellena con el
  // pool SIN filtro de cooked (las ya cocinadas quedan al final, ordenadas por aprovechamiento; los
  // platos NO cocinados siguen mandando). Así la Card devuelve SIEMPRE hasta 4 recetas "cocinables
  // hoy con lo de casa" y la rotación de cursores sigue cambiando el lote en cada click.
  let cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };
  let clicksSugerencia = 0;

  btnSuggestGenerate.addEventListener("click", () => {
    const cooked = load(LS.cooked, []);
    const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
    let todas = planner.suggestToday(pool, foods);   // ranking completo de SIEMPRE (contrato cerrado del módulo)
    if (todas.length < 4) {
      // Rodillo del cooldown: sin historial cocinado para el 2º corte; dedupe por TÍTULO para no
      // pintar dos tarjetas gemelas (copia propia editada + original del catálogo viven en el pool
      // con fingerprints distintos — el pool los conserva y aquí la Card pinta una sola vez cada plato).
      const poolEntero = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked: [], today });
      const yaEnCard = new Set(todas.map(t => t.title));
      const extras = planner.suggestToday(poolEntero, foods).filter(i => {
        if (yaEnCard.has(i.title)) return false;
        yaEnCard.add(i.title);
        return true;
      });
      todas = todas.concat(extras);
    }
    const out = planner.loteRotado(todas, { cursores: cursoresSugerencia, clicks: clicksSugerencia });
    cursoresSugerencia = out.cursores;                 // el módulo es puro: devuelve cursores NUEVOS
    clicksSugerencia += 1;
    renderSuggestCards(out.lote);
  });

  btnSuggestClear.addEventListener("click", () => {
    suggestList.innerHTML = "";
    cursoresSugerencia = { desayuno: 0, comida: 0, cena: 0 };   // la rotación también empieza de cero
    clicksSugerencia = 0;
    suggestEmpty.classList.remove("hidden");
    toast("Sugerencia limpiada");
  });

  // ===== SUGERENCIAS Y MENÚ — CARD 2: menú semanal (7 días) + CARD 3: lista de la compra =====
  // Previsualiza un plan de 7 días (Lunes..Domingo) respetando el cooldown. "Aprobar plan" guarda
  // mrcheff.weekmenu (aprobado=true, ancla de fecha=HOY real) y registra en mrcheff.cooked cada
  // receta del plan ANCLADA a la fecha de su día de la semana (próxima ocurrencia desde HOY).
  // Card 3 aparece sólo si el plan aprobado trae ingredientes ausentes (needyFoods); marcar un ítem como
  // comprado PREGUNTA primero cuánto se ha comprado y su importancia (modal, feature 2026-10-18) y NO lo
  // cuela con qty 0/score 5: el módulo puro menuSemanal.markItemBought añade o actualiza con esos datos.
  // No toca recipes[] / Mis Recetas.
  const btnMenuGenerate = $("#btn-menu-generate");
  const btnMenuApprove = $("#btn-menu-approve");
  const btnMenuClear = $("#btn-menu-clear");
  const menuInclude = $("#menu-include-unavailable");
  const menuStatus = $("#menu-status");
  const menuPlanList = $("#menu-plan-list");
  const menuEmpty = $("#menu-empty");
  const shoppingListEl = $("#shopping-list");
  // Barra del plan APROBADO: resumen "N platos" + botón plegar/desplegar (petición 2026-10-21).
  const menuPlanBar = $("#menu-plan-bar");
  const menuPlanTitle = $("#menu-plan-title");
  const btnMenuColapsar = $("#btn-menu-colapsar");

  // Estado del menú semanal cargado de localStorage (persistencia entre pestañas / recargas).
  let weeklyMenu = load(LS.weekmenu, null);

  // Render del preview / plan aprobado: 7 días × 3 comidas (desayuno, comida, cena — feature 2026-10-18).
  // Cada comida se pinta como fila con su etiqueta, botones "🍳 Cocinar" (anota cocinado + renueva SOLO
  // ese hueco) y "🔄 Cambiar" (otra receta para ese día+comida, sin tocar el resto). La fila es clickeable
  // para abrir el detalle. Siempre se pintan los 7 días con sus 3 comidas, aunque alguna quede vacía.
  // NOTA: la etiqueta (mealLabels) YA incluye su icono (🌅/🍽️/🌙) — no se añade otro delante
  // (era el duplicado "🌅 🌅 Desayuno" que se veía en la franja del menú).

  function pintarSlotComida(comida, dayIdx, mealIdx) {
    const meal = comida && comida.meal ? comida.meal : "";
    const etiqueta = (mealLabels[meal] || meal || "");
    const rec = comida && comida.recipe;
    if (!rec) {
      return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${escapeHTML(meal)}" data-meal-idx="${mealIdx}">
        <span class="menu-meal-tag">${escapeHTML(etiqueta)}</span>
        <div class="menu-meal-body muted">sin plato asignado</div>
      </div>`;
    }
    const missing = Array.isArray(comida.missing) ? comida.missing : [];
    // Decisión de visibilidad SIEMPRE del módulo puro (regla de negocio, no de vista).
    const acciones = menuSemanal.accionesMenuSlot(weeklyMenu);
    return `<div class="menu-meal-row" data-day="${dayIdx}" data-meal="${escapeHTML(meal)}" data-meal-idx="${mealIdx}">
      <span class="menu-meal-tag">${escapeHTML(etiqueta)}</span>
      <div class="menu-meal-body">
        <h4 class="menu-meal-title">${escapeHTML(rec.title)}</h4>
        <div class="recipe-meta">
          ${badgeOrigenHTML(rec)}
          ${badgeSyncHTML(rec)}
          ${tagMenuSlotHTML(rec)}
          <span class="muted" style="font-size:.8rem">${rec.ingredients.length} ingr.</span>
        </div>
        ${rec.uses && rec.uses.length ? `<div class="innov-uses">🥣 Usa de tu casa: ${rec.uses.map(escapeHTML).join(" · ")}</div>` : ""}
        ${missing.length ? `<div class="innov-uses" style="color:var(--danger);">⚠️ Falta: ${missing.map(escapeHTML).join(", ")}</div>` : `<div class="innov-uses" style="color:var(--accent);">✅ Todos los ingredientes en casa</div>`}
      </div>
      <div class="recipe-actions">
        <button data-edit title="Editar esta receta a tu gusto (guarda en Mis Recetas)">✏️</button>
        ${acciones.cocinar ? `<button data-cook title="Cocinar hoy y renovar este hueco">🍳 Cocinar</button>` : ""}
        ${acciones.cambiar ? `<button data-swap title="Otra receta para este día y comida">🔄 Cambiar</button>` : ""}
      </div>
    </div>`;
  }

  // FEATURE 2026-10-21 (petición del usuario): una vez APROBADO, el plan semanal se puede PLEGAR
  // para que no ocupe pantalla — queda la barra de resumen y SIEMPRE se puede volver a mostrar.
  // La regla vive en el módulo puro (menuSemanal.alternarColapso, sólo aprobado, inmutable) y el
  // estado persiste como `colapsado` en mrcheff.weekmenu; aquí sólo molde + persistencia. PUNTO
  // ÚNICO de la BARRA y del plegado de la lista 7×3 (el PREVIEW la sigue mostrando vía
  // renderWeeklyMenu: un preview no aprobado no se pliega).
  function pintaBarraPlan() {
    const aprobado = !!(weeklyMenu && weeklyMenu.approved === true);
    const hayDias = aprobado && Array.isArray(weeklyMenu.plan) && weeklyMenu.plan.length > 0;
    menuPlanBar.classList.toggle("hidden", !hayDias);
    if (hayDias) menuPlanList.classList.toggle("hidden", weeklyMenu.colapsado === true);
    if (!hayDias) return;
    const n = menuSemanal.platosDelPlan(weeklyMenu.plan);
    menuPlanTitle.textContent = `📅 Tu semana — ${n} ${n === 1 ? "plato" : "platos"}`;
    const plegado = weeklyMenu.colapsado === true;
    btnMenuColapsar.setAttribute("aria-expanded", plegado ? "false" : "true");
    btnMenuColapsar.textContent = plegado ? "▸ Desplegar" : "▾ Plegar";
    btnMenuColapsar.title = plegado
      ? "Volver a mostrar la semana completa"
      : "Plegar la semana (quedan este resumen y la lista de la compra)";
  }

  btnMenuColapsar.addEventListener("click", () => {
    const cambio = menuSemanal.alternarColapso(weeklyMenu);
    if (!cambio.cambiado) return;      // sólo se pliega lo aprobado (guard del módulo)
    weeklyMenu = cambio.weekmenu;
    save(LS.weekmenu, weeklyMenu);
    pintaBarraPlan();
  });

  function renderWeeklyMenu(plan) {
    menuPlanList.innerHTML = "";
    if (!Array.isArray(plan) || plan.length === 0) {
      menuPlanList.classList.add("hidden");
      return;
    }
    menuPlanList.classList.remove("hidden");
    plan.forEach((dia, dayIdx) => {
      const dayLabel = dia && dia.dayLabel ? dia.dayLabel : `Día ${dayIdx + 1}`;
      const comidas = Array.isArray(dia && dia.meals) ? dia.meals : [];
      const li = document.createElement("li");
      li.className = "menu-day";
      li.innerHTML = `
        <div class="menu-day-header">${escapeHTML(dayLabel)}</div>
        ${comidas.length
          ? comidas.map((c, i) => pintarSlotComida(c, dayIdx, i)).join("")
          : `<div class="menu-meal-row"><div class="menu-meal-body muted">sin plato asignado</div></div>`}`;
      li.querySelectorAll(".menu-meal-row[data-meal-idx]").forEach(row => {
        const comida = comidas[Number(row.dataset.mealIdx)];
        if (!comida || !comida.recipe) return;
        row.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          openRecipeModal(comida.recipe, { highlightMissing: true, ocultarEtiquetaSugerencia: true });
        });
        activablePorTeclado(row, () => openRecipeModal(comida.recipe, { highlightMissing: true, ocultarEtiquetaSugerencia: true }));
        const btnCook = row.querySelector("[data-cook]");
        if (btnCook) btnCook.addEventListener("click", (e) => {
          e.stopPropagation();
          cocinarComidaDelPlan(Number(row.dataset.day), row.dataset.meal, comida.recipe);
        });
        const btnSwap = row.querySelector("[data-swap]");
        if (btnSwap) btnSwap.addEventListener("click", (e) => {
          e.stopPropagation();
          cambiarComidaDelPlan(Number(row.dataset.day), row.dataset.meal);
        });
        // Lápiz de la franja: abre el editor directamente sobre el plato de ese hueco
        const btnEditRow = row.querySelector("[data-edit]");
        if (btnEditRow) btnEditRow.addEventListener("click", (e) => {
          e.stopPropagation();
          openRecipeEditor(comida.recipe);
        });
      });
      menuPlanList.appendChild(li);
    });
  }

  // "🍳 Cocinar" DESDE el menú: anota la receta como cocinada HOY (cooldown) y renueva SÓLO ese
  // hueco vía swapSlotRecipe (el resto del plan aprobado queda intacto — decisión §8/feature).
  // Toda la decisión vive en menuSemanal; aquí sólo persistencia + render (Capa vista).
  function cocinarComidaDelPlan(dayIdx, meal, rec) {
    const cookedPrevio = load(LS.cooked, []);
    const cocina = menuSemanal.cookEntry(rec, cookedPrevio, today, planner.cookEntryFor, uid);
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: weeklyMenu, dayIndex: dayIdx, meal,
      foods, recipes, catalog: catalogoEspanol,
      cooked: cocina.cooked, today, planner, uid
    });
    save(LS.cooked, cocina.cooked);
    weeklyMenu = cambio.weekmenu;
    save(LS.weekmenu, weeklyMenu);
    renderWeeklyMenu(weeklyMenu.plan);
    pintaBarraPlan();
    if (weeklyMenu.approved) renderShoppingList();
    toast(`Registrado: "${rec.title}" se cocinó — nuevo plato para ese hueco`);
  }

  // "🔄 Cambiar": otra receta para UN día+comida (determinista, recorre el ranking). Si el pool
  // de esa comida ya está agotado, avisa SIN tocar el plan.
  function cambiarComidaDelPlan(dayIdx, meal) {
    const cambio = menuSemanal.swapSlotRecipe({
      weekmenu: weeklyMenu, dayIndex: dayIdx, meal,
      foods, recipes, catalog: catalogoEspanol,
      cooked: load(LS.cooked, []), today, planner, uid
    });
    if (!cambio.swapped) {
      toast(`No quedan más recetas de ${mealLabels[meal] || meal} — prueba a limpiar y regenerar el menú`, "error");
      return;
    }
    weeklyMenu = cambio.weekmenu;
    save(LS.weekmenu, weeklyMenu);
    renderWeeklyMenu(weeklyMenu.plan);
    pintaBarraPlan();
    if (weeklyMenu.approved) renderShoppingList();
  }

  // Render de Card 3 (lista de la compra derivada). Sólo se pinta si hay plan aprobado con ítems pendientes.
  // Con plan disponible, cada fila recibe su URGENCIA de compra (semaforo dinámico según lo cerca que está
  // la fecha de preparación: mañana/hoy=rojo, 2-3 días=naranja, ≥4=verde) y se ordena rojo→verde.
  // formatoFechaCorta vive en modules/util.js (§3, 2026-10-21) — llega por destructuring arriba;
  // filaCompra la consume tal cual para el metadato "se usa el 21 oct" de cada fila del semáforo.

  // Fila clásica de la lista de la compra (needyFoods del plan aprobado, con semáforo por fecha).
  function filaCompra(item) {
    const urg = item.urgency || "green";
    const cuando = item.onDay != null && item.daysUntil != null
      ? `· se usa el ${formatoFechaCorta(item.onDay)} (${item.daysUntil === 0 ? "hoy" : item.daysUntil === 1 ? "mañana" : `en ${item.daysUntil} días`})`
      : "";
    return `
      <li class="alert-row urg-${urg}">
        <span class="alert-name"><strong>${escapeHTML(item.name)}</strong></span>
        <span class="alert-meta">qty <b>${item.qty}</b> · mínimo <b>${item.min}</b> · importante <b>${item.score}/10</b> ${escapeHTML(cuando)}</span>
        <span class="alert-acciones">
          ${(menuSemanal.candidatosDespensa(item.name, foods)).length
            ? `<button class="btn ghost small" data-despensa="${escapeHTML(item.name)}" title="¿Ya lo tienes en la despensa con otro nombre?">🛒 Despensa?</button>`
            : ""}
          <button class="btn ghost small" data-buy="${escapeHTML(item.name)}" title="Marcar como comprada">✅ comprado</button>
        </span>
      </li>`;
  }

  // La lista de la compra ES derivada: se repinta tras CUALQUIER cambio de la despensa (petición
  // 2026-10-21 — venimos del ticket y ya compramos: unos ítems quedaron cubiertos y otros ni
  // estaban en la tienda). Qué significa "cubierta" lo decide el módulo puro
  // (shoppingListFor: alimento que case con qty > SU min); aquí sólo se cuenta TODOS los sucesos
  // que pueden moverla: alta OCR (los dos diálogos), alta manual del formulario, ➕➖/🗑 del
  // inventario y el import del backup — sin olvidar el ✅ comprado, que ya la repintaba.
  function renderShoppingListTrasDespensa() {
    if (weeklyMenu && weeklyMenu.approved) renderShoppingList();
  }

  function renderShoppingList() {
    shoppingListEl.innerHTML = "";
    const needy = weeklyMenu && weeklyMenu.approved ? weeklyMenu.needyFoods : [];
    const ctx = weeklyMenu && Array.isArray(weeklyMenu.plan)
      ? { plan: weeklyMenu.plan, generatedOn: weeklyMenu.generatedOn || String(today), today }
      : null;
    const list = menuSemanal.shoppingListFor(needy, foods, ctx);
    if (!list.length) {
      shoppingListEl.classList.add("hidden");
      return;
    }
    shoppingListEl.classList.remove("hidden");
    shoppingListEl.innerHTML = `
      <h3>🛒 Lista de la compra</h3>
      <ul class="alert-list-green">
        ${list.map(filaCompra).join("")}
      </ul>`;
    shoppingListEl.querySelectorAll("[data-buy]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirModalCompra(btn.dataset.buy);
      });
    });
    // FEATURE 2026-10-19 "🛒 Despensa?": variantes del mismo alimento que el casador de tokens
    // sóla une ("Jamón serrano" ↔ "Jamón ibérico", "Pan de pueblo" ↔ "Pan"). Los candidatos los
    // decide el módulo puro (menuSemanal.candidatosDespensa) — sin ellos el botón ni sale — y la
    // ÚLTIMA PALABRA la tiene la persona: el diálogo lista las opciones y confirma una a una.
    shoppingListEl.querySelectorAll("[data-despensa]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemName = btn.dataset.despensa;
        const candidatos = menuSemanal.candidatosDespensa(itemName, foods);
        if (!candidatos.length) return;
        modalContent.innerHTML = `
        <h2>🛒 ¿Despensa?</h2>
        <p class="muted">Posible alimento identificado en tu despensa — confirma si "<strong>${escapeHTML(itemName)}</strong>" es alguno de estos:</p>
        <div class="despensa-elegir">
          ${candidatos.map(c => `
            <button class="btn ghost" data-despensa-elegir="${escapeHTML(c.name)}">${escapeHTML(c.name)} <span class="muted">· tienes ${c.qty ?? 0}</span></button>`).join("")}
        </div>
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar (nada cambia)</button>
        </div>`;
        abrirModal("¿Ya está en tu despensa? " + itemName);
        $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
        $$("[data-despensa-elegir]", modalContent).forEach(b =>
          b.addEventListener("click", () => abrirModalCompra(itemName, b.dataset.despensaElegir)));
      });
    });

    // 2026-10-18: NO se cuela el alimento con qty 0 / score 5 — se PREGUNTA cuánto se ha comprado
    // y con qué importancia. La decisión de añadir/actualizar vive en el módulo puro
    // (menuSemanal.markItemBought / markItemBoughtComo); aquí sólo el molde del diálogo.
    // 2026-10-19: 2º parámetro `nombreDespensa` = el usuario confirmó en "🛒 Despensa?" que el
    // ítem es una variante de ESE alimento ya guardado: la compra va a él IN-SITU, sin alta nueva,
    // y el modal ABRE ya cargando el MÍNIMO y la IMPORTANCIA del alimento de despensa (afinación
    // del mismo día: la despensa ya tenía su criterio de alerta — no re-preguntar de cero).
    // (2026-10-21) Fuera el 3er parámetro de datos de la FILA DEL TICKET: el escáner ya no deja
    // pendientes en la lista, así que aquí sólo abren filas del plan semanal.
    function abrirModalCompra(name, nombreDespensa) {
        const objetivo = nombreDespensa ? foods.find(f => f.name === nombreDespensa) : null;
        // min/score CON los que abre el modal: si la compra va a un alimento de la despensa se conserva
        // SU criterio (no re-preguntar, 2026-10-19) — la regla vive en menuSemanal.valoresPreviosDeCompra.
        const { min: minPrevio, score: scorePrevio } = menuSemanal.valoresPreviosDeCompra(objetivo);
        modalContent.innerHTML = `
        <h2>✅ ¿Comprado?</h2>
        <p class="muted">"<strong>${escapeHTML(name)}</strong>"${nombreDespensa
          ? ` se anota en la que ya tienes: <strong>${escapeHTML(nombreDespensa)}</strong> — misma cosa con otra variante, sin crear un alimento nuevo, con estos datos:`
          : " se añadirá a la despensa con estos datos:"}</p>
        <div class="recipe-edit">
          <label for="compra-qty">Cantidad comprada
            <input type="number" id="compra-qty" min="1" step="1" value="1">
          </label>
          <label for="compra-min">Cantidad mínima para la alerta de reponer
            <input type="number" id="compra-min" min="0" step="1" value="${escapeHTML(String(minPrevio))}" title="Cuando baje de aquí te avisamos">
          </label>
          <label for="compra-score">Importancia (1–10)
            <input type="number" id="compra-score" min="1" max="10" step="1" value="${escapeHTML(String(scorePrevio))}">
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar</button>
          <button class="btn primary" data-buy-confirm>Añadir a la despensa</button>
        </div>`;
        abrirModal("Compra: " + name);
        $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
        $("#compra-qty", modalContent).focus();
        $("#compra-qty", modalContent).select();
        $("[data-buy-confirm]", modalContent).addEventListener("click", () => {
          const qty = parseInt($("#compra-qty", modalContent).value, 10);
          const score = parseInt($("#compra-score", modalContent).value, 10);
          const minRaw = $("#compra-min", modalContent).value.trim();
          const min = minRaw === "" ? null : parseInt(minRaw, 10);   // vacío → no se pide: el módulo lo ignora
          // Toda la regla (qty ≥1, min ≥0, score 1–10) decide el módulo; aquí sólo traducimos el
          // campo que falla a su mensaje (texto de vista, 2026-10-21).
          const chk = menuSemanal.validarCompraForm({ qty, score, min });
          if (!chk.ok) {
            toast(
              chk.campo === "qty" ? "Indica la cantidad comprada (1 o más)" :
              chk.campo === "min" ? "El mínimo para la alerta va de 0 en adelante" :
                                    "La importancia va de 1 a 10", "error");
            return;
          }
          const compra = chk.compra;
          const result = nombreDespensa
            ? menuSemanal.markItemBoughtComo(foods, weeklyMenu, name, nombreDespensa, compra)
            : menuSemanal.markItemBought(foods, weeklyMenu, name, uid, Date.now(), compra);
          if (nombreDespensa && !result) {           // guard del módulo: objetivo no hallado → NADA se escribe
            toast("No se encontró ese alimento en la despensa", "error");
            return;
          }
          if (result.actualizado) {
            toast(`"${escapeHTML(name)}" actualizado en la despensa (qty ${qty})`);
          } else if (!result.alreadyExists) {
            toast(`"${escapeHTML(name)}" añadido a la despensa (qty ${qty})`);
          } else {
            toast(`"${escapeHTML(name)}" ya está en tu despensa`, "error");
            closeModal();
            return;
          }
          foods = result.foods;
          weeklyMenu = result.weekmenu;
          save(LS.foods, foods);
          save(LS.weekmenu, weeklyMenu);
          renderFoods();
          renderWeeklyAlert();
          renderShoppingList();
          closeModal();
        });
    }
  }

  btnMenuGenerate.addEventListener("click", () => {
    const cooked = load(LS.cooked, []);
    const includeUnavailable = menuInclude.checked;
    const pool = planner.buildCandidatePool(foods, recipes, catalogoEspanol, { cooked, today });
    const menu = planner.buildWeeklyMenu(pool, foods, { includeUnavailable, today });
    const totalSlots = menuSemanal.platosDelPlan(menu.plan);
    menuStatus.textContent = includeUnavailable
      ? (totalSlots < 21
        ? `Se asignaron ${totalSlots} de 21 platos (7 días × desayuno/comida/cena): tu despensa + recetas guardadas no dan para más. Activa "Sugerencias" o añade más alimentos para ampliarlo.`
        : `Se asignaron los 21 platos. Lo que falte está anotado en la lista de la compra.`)
      : `Se asignaron ${totalSlots} de 21 platos (modo estricto: sólo platos con TODO disponible hoy). Marca la casilla de arriba para completar la semana.`;
    menuStatus.classList.remove("hidden");
    // El preview se asienta ANTES de renderizar: pintarSlotComida consulta menuSemanal.accionesMenuSlot(weeklyMenu)
    // para la visibilidad de los botones de fila (preview → sin "🍳 Cocinar", con "🔄 Cambiar").
    weeklyMenu = { ...menu, approved: false, includeUnavailable, generatedOn: today };
    renderWeeklyMenu(menu.plan);
    pintaBarraPlan();
    menuEmpty.classList.add("hidden");
    btnMenuApprove.disabled = totalSlots === 0;
    btnMenuApprove.title = totalSlots === 0 ? "Genera primero un menú con al menos un plato" : "Aprueba este plan";
  });

  btnMenuApprove.addEventListener("click", () => {
    if (!weeklyMenu || weeklyMenu.approved) return;
    const cookedIn = load(LS.cooked, []);
    // Toda la decisión vive en menuSemanal.approveMenu: una entrada en mrcheff.cooked por cada
    // receta del plan, ANCLADA a la fecha de calendario de su día de la semana (no todas a HOY).
    const result = menuSemanal.approveMenu(weeklyMenu, cookedIn, today, planner.cookEntryFor, uid);
    const cooked = result.cooked;
    weeklyMenu = result.weekmenu;
    save(LS.cooked, cooked);
    save(LS.weekmenu, weeklyMenu);
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuStatus.textContent = `Plan aprobado: ${menuSemanal.platosDelPlan(weeklyMenu.plan)} plato(s) anotados en su día de la semana (aprobado el ${today}).`;
    // Re-render de las filas: ahora SÍ llevan "🍳 Cocinar" (decisión de menuSemanal.accionesMenuSlot,
    // que ve approved=true) — el preview se pintó sin él y las filas no se refrescan solas.
    renderWeeklyMenu(weeklyMenu.plan);
    pintaBarraPlan();
    renderShoppingList();
    toast("Menú semanal aprobado");
  });

  // Persistencia al recargar: si ya había un plan APROBADO en mrcheff.weekmenu, re-pintamos el menú
  // de 7 días y Card 3 (con sus ítems pendientes) y dejamos el botón Aprobar en estado final.
  // Los previews NO aprobados NO se persisten (contrato §3 Card 2): tras recargar se regeneran con
  // "Generar menú".
  if (weeklyMenu && weeklyMenu.approved) {
    if (Array.isArray(weeklyMenu.plan) && weeklyMenu.plan.length) {
      renderWeeklyMenu(weeklyMenu.plan);
    }
    btnMenuApprove.disabled = true;
    btnMenuApprove.textContent = "✅ Plan aprobado";
    menuEmpty.classList.add("hidden");
    pintaBarraPlan();   // (re-honra el plegado persistido del plan aprobado — feature 2026-10-21)
    renderShoppingList();   // sólo pinta si hay needyFoods no comprados (el render filtra por sí, guard §2-A)
  }

  btnMenuClear.addEventListener("click", () => {
    // El estado limpio lo decide menuSemanal.clearMenu(); aquí sólo persistencia (vía helpers,
    // NUNCA localStorage crudo) + render. save(key,null)+load(key,def) round-tripea a null.
    weeklyMenu = menuSemanal.clearMenu().weekmenu;
    save(LS.weekmenu, weeklyMenu);
    menuPlanList.innerHTML = "";
    menuPlanList.classList.add("hidden");
    pintaBarraPlan();              // sin plan aprobado ⇒ barra fuera (punto único; la lista ya la tapa Limpiar)
    menuEmpty.classList.remove("hidden");
    menuStatus.classList.add("hidden");
    btnMenuApprove.disabled = true;
    btnMenuApprove.title = "Genera primero un menú con al menos un plato";
    btnMenuApprove.textContent = "Aprobar plan";
    shoppingListEl.innerHTML = "";
    shoppingListEl.classList.add("hidden");
    toast("Menú limpiado");
  });

  // ===== TEMPORADA =====
  const seasonFilter = $("#season-filter");
  const seasonMonth = $("#season-month");
  const seasonGrid = $("#season-grid");
  const seasonEmpty = $("#season-empty");
  const { MESES, TEMPORADA } = window.MR_CHEFF_DATA || { MESES: [], TEMPORADA: [] };

  // Poblamos el select de meses (1-12) y ponemos el actual por defecto
  MESES.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = idx + 1;
    opt.textContent = m;
    seasonMonth.appendChild(opt);
  });
  const currentMonth = new Date().getMonth() + 1;
  seasonMonth.value = currentMonth;

  function renderSeason() {
    const q = seasonFilter.value.trim().toLowerCase();
    const month = parseInt(seasonMonth.value, 10);
    const filtered = TEMPORADA.filter(item =>
      item.meses.includes(month) &&
      (!q || item.nombre.toLowerCase().includes(q))
    );
    seasonGrid.innerHTML = "";
    seasonEmpty.classList.toggle("hidden", filtered.length > 0);
    filtered.forEach(item => {
      const card = document.createElement("div");
      card.className = "season-card";
      card.innerHTML = `
        <span class="season-emoji">${item.emoji}</span>
        <div class="season-name">${escapeHTML(item.nombre)}</div>
        <span class="season-type ${item.tipo}">${item.tipo}</span>`;
      seasonGrid.appendChild(card);
    });
  }

  seasonFilter.addEventListener("input", renderSeason);
  seasonMonth.addEventListener("change", renderSeason);

  // ===== COPIA DE SEGURIDAD =====
  // Los datos viven en este navegador (localStorage). Como localStorage es privado de cada
  // navegador, para llevarlos a otro navegador o dispositivo se exportan a un .json y se
  // importan de vuelta. No hay ninguna base de datos local que comparta datos entre
  // navegadores por sí sola (IndexedDB/sql.js son privados de un solo navegador también).
  // === LÓGICA DECISIONAL DE COPIA DE SEGURIDAD EXTRAÍDA A modules/backup.js (función PURe) ===
  // buildBackApi = window.MRCheff.backup: construye el payload exportable, nombra "dataBackup-YYYY-MM-DD-HH-MM-SS.json" y fusiona un
  // backup importado sin destruir lo ya guardado — lógica PURA con inyección opcional de uid/hoy para tests (§5 / §2-D). En la app
  // sólo orquestamos: guardar (save) + re-renderizar + toast. Los dos "aliases" locales dejan intocados los call-sites existentes
  // ("buildBackup()" / "backupFilename()") delegando en el módulo — sin tocar ni una línea de esos handlers.
  const buildBackApi = window.MRCheff.backup;
  const buildBackup  = () => buildBackApi.buildBackup({ foods, recipes, innovations, innovDay, cooked: load(LS.cooked, []), weekmenu: load(LS.weekmenu, null) });
  const backupFilename = () => buildBackApi.makeFilename();   // hora REAL por defecto inyectable por el módulo (tests §6)

  const btnExport = $("#btn-export");
  const btnImport = $("#btn-import");
  const importFile = $("#import-file");
  const importNote = $("#import-note");

  // contenido en un cuadro para copiarlo a un archivo a mano.
  function showBackupFallback(filename, content) {
    modalContent.innerHTML = `
      <h2>Copia manual de seguridad</h2>
      <p class="muted">Tu navegador no ha podido guardar el archivo con el nombre
          <strong>${escapeHTML(filename)}</strong>. Copia este texto y pégalo en un archivo nuevo
          con ese mismo nombre, dentro de la carpeta <code>dataBackup/</code> (o en Descargas).</p>
      <textarea id="backup-text" style="width:100%;min-height:220px;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHTML(content)}</textarea>
      <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" id="backup-copy">📋 Copiar</button>
      </div>`;
    abrirModal("Copia manual de seguridad");
    $$("[data-close]", modalContent).forEach(b => b.addEventListener("click", closeModal));
    $("#backup-copy", modalContent).addEventListener("click", () => {
      const ta = $("#backup-text", modalContent);
      ta.focus();
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value)
          .then(() => toast("Copiado al portapapeles"))
          .catch(() => toast("Texto seleccionado: pulsa Cmd/Ctrl+C"));
      } else {
        toast("Texto seleccionado: pulsa Cmd/Ctrl+C");
      }
    });
  }

  const btnCopyJson = $("#btn-copy-json");

  // Guardar el archivo con nombre dataBackup + fecha/hora REALES del momento de la exportación:
  // descarga a Descargas con ese nombre (blob + <a download>).
  //
  // Nota: antes se intentaba primero la API de sistema de archivos (showSaveFilePicker) para
  // guardar directo en dataBackup/. Se quitó porque, abriendo index.html por file://, ese
  // diálogo solía dejar un archivo VACÍO y caía igualmente a la descarga, resultando en DOS
  // ventanas (diálogo + Descargas) y un JSON vacío. La descarga a Descargas es estable en
  // todos los navegadores; si el navegador no descarga nada, queda el botón "📋 Copiar" para
  // pegar el contenido a mano.
  btnExport.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Copia de seguridad descargada en Descargas");
  });

  // Vía garantizada: copia el JSON al portapapeles (o lo muestra para pegarlo a mano).
  btnCopyJson.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => toast("JSON copiado: pégalo en " + filename))
        .catch(() => showBackupFallback(filename, content));
    } else {
      showBackupFallback(filename, content);
    }
  });

  btnImport.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { commitImport(JSON.parse(String(reader.result))); }
      catch { toast("No se pudo leer el archivo", "error"); }
    };
    reader.onerror = () => toast("No se pudo leer el archivo", "error");
    reader.readAsText(file);
    e.target.value = ""; // permite volver a importar el mismo archivo
  });

  // Wrapper de CAPA VISTA sobre la fusión PURA del módulo: sólo decide CUÁNDO/CÓMO persistir/re-renderizar + toast; TODA la lógica
  // decisoria (dedup por nombre, normalización MEAL_SET/recorte a 30, uids frescos) vive en modules/backup.js. Ver CODING_STANDARDS.md §5 / DIp:
  function commitImport(data) {
    // (sync-buzon §1, payload v2): cooked/weekmenu participan del anexo al importar; versiones v1 sin
    // esas claves siguen funcionando — el módulo las trata como vacías/ausentes (§ regreso comprobado).
    const plan = buildBackApi.mergeIncoming({ foods, recipes, innovations, cooked: load(LS.cooked, []), weekmenu: load(LS.weekmenu, null) }, data, { today });
    if (!plan) { toast("Archivo no válido", "error"); return; }   // el módulo devuelve null si la entrada NO es un objeto
    foods = plan.foods;        // las referencias LOCALES se reasignan: son exactamente lo que luego pintan los renders de abajo.
    recipes = plan.recipes;
    innovations = plan.innovations;

    save(LS.foods, foods);
    save(LS.recipes, recipes);
    if (plan.addedCooked > 0) save(LS.cooked, plan.cooked);                      // anexo del historial cocinado (v2)
    if (plan.weekmenu != null && !load(LS.weekmenu, null)) save(LS.weekmenu, plan.weekmenu);   // se deja constancia de la adopción del plan entrante (v2)
    if (plan.persistInnov) {   // solo si la entrada trajo innovaciones nuevas: marca "hoy" para que el auto-expiry del cierre DOMContentLoaded no las borre en la próxima carga (§5 "Alcance de expiración automática")
      innovDay = today;
      save(LS.innov, innovations);
      save(LS.innovDate, innovDay);
    }

    renderFoods();
    renderWeeklyAlert();
    renderShoppingListTrasDespensa();
    renderRecipes();
    renderInnovations();
    importNote.textContent = `Se añadieron ${plan.addedFoods} alimento(s) y ${plan.addedRecipes} receta(s).`;
    importNote.classList.remove("hidden");
    toast(`Importados: ${plan.addedFoods} alimento(s), ${plan.addedRecipes} receta(s)`);
  }

  // ===== SYNC ENTRE DISPOSITIVOS (buzón GitHub cifrado — plan-sync-buzon §6, FASE 5) =====
  // SÓLO CAPA VISTA (CODING_STANDARDS §5): la máquina de estados vive en modules/sync.js (F3), el
  // diff3 en modules/diff-merge.js (F4) y la cripto en modules/sync-crypto.js (F2 — todo puro e
  // inyectable). Aquí: botón "🔄 Sync", modal de configuración (token/gist en LS, passphrase SOLO
  // en sessionStorage), modal resolver de conflictos (§5) y badges "⇄ conflicto"/"duplicada".
  const syncApi = window.MRCheff.sync;
  const syncCryptoApi = window.MRCheff.syncCrypto;
  const diffMergeApi = window.MRCheff.diffMerge;
  const SESS_PASS = "mrcheff.sync.pass";   // passphrase de SESIÓN: nunca localStorage (§2 del plan)

  const btnSync = $("#btn-sync");
  const btnSyncConfig = $("#btn-sync-config");
  const btnSyncVaciar = $("#btn-sync-vaciar");
  const syncNote = $("#sync-note");

  function notaSync(texto) {
    syncNote.textContent = texto || "";
    syncNote.classList.toggle("hidden", !texto);
  }

  // Estado del clúster según la configuración: sin token/gist el Sync queda deshabilitado (hint §6).
  function actualizarSyncUI() {
    const cfg = load(LS.syncConfig, null) || {};
    const listo = !!(cfg.token && cfg.gistId);
    btnSync.disabled = !listo;
    btnSyncVaciar.disabled = !listo;
    const passSesion = !!sessionStorage.getItem(SESS_PASS);
    if (!listo) notaSync("Sin configurar — pulsa ⚙️ Configurar para poner el token de GitHub, el gist y la passphrase.");
    else if (!passSesion) notaSync("Buzón y token listos — falta la passphrase de esta sesión (se pedirá al pulsar Sync).");
    else notaSync("🟢 Listo para sincronizar con el buzón configurado (passphrase en esta sesión).");
  }

  // Copia "duplicada" (elección "Conservar ambas" del resolver): badge junto a los de origen, §5.
  function badgeSyncHTML(rec) {
    return rec && rec.duplicada ? '<span class="tag tag-sync-duplicada" title="Copia conservada por una resolución del sync">⧉ duplicada</span>' : "";
  }

  // ---- snapshot local completo (payload v2 del §1: misma forma que merge3 consume) ----
  function estadoLocalCompleto() {
    return {
      foods, recipes, innovations,
      cooked: load(LS.cooked, []),
      weekmenu: load(LS.weekmenu, null)
    };
  }

  // Aplicar el estado fusionado que trae el protocolo: persistir TODO, re-asignar las variables en
  // memoria y re-pintar (misma cronología que commitImport del import manual).
  function aplicarEstadoSync(estado) {
    if (!estado || typeof estado !== "object") return;
    foods = Array.isArray(estado.foods) ? estado.foods : [];
    recipes = Array.isArray(estado.recipes) ? estado.recipes : [];
    innovations = Array.isArray(estado.innovations) ? estado.innovations : [];
    save(LS.foods, foods);
    save(LS.recipes, recipes);
    save(LS.innov, innovations);
    if (estado.cooked != null) save(LS.cooked, estado.cooked);
    if (estado.weekmenu != null) {
      weeklyMenu = estado.weekmenu;                     // la variable de Card 2 se reasigna también
      save(LS.weekmenu, weeklyMenu);
    }
    renderFoods();
    renderWeeklyAlert();
    renderRecipes();                                    // recetasDirty no cuenta: llega contenido nuevo de verdad
    renderInnovations();
    if (weeklyMenu && weeklyMenu.plan) renderWeeklyMenu(weeklyMenu.plan);
    if (weeklyMenu && weeklyMenu.approved) renderShoppingList();
  }

  // ---- ctx del protocolo: la ÚNICA unión de app.js con red/localStorage/sessionStorage/cripto ----
  function contextoSync(passphrase) {
    let deviceId = load(LS.syncDeviceId, null);
    if (!deviceId) { deviceId = uid(); save(LS.syncDeviceId, deviceId); }
    const cfg = load(LS.syncConfig, {}) || {};
    // Inyecciones de TEST (CODING_STANDARDS §6): `mrcheff.sync.iteraciones` baja el coste de
    // PBKDF2 en suite (viaja en el header de la envolvente, sin efecto en producción) y
    // `window.__mrcheffCryptoImpl` aporta la WebCrypto cruda donde el global no trae .subtle (jsdom).
    const iteracionesTest = parseInt(localStorage.getItem("mrcheff.sync.iteraciones") || "", 10);
    const claveLS = (k) => k === "base" ? LS.syncBase : k === "pendiente" ? LS.syncPendiente : LS.syncConsumida;
    return {
      dispositivo: cfg.nombre || deviceId,
      deviceId,
      token: cfg.token, gistId: cfg.gistId, passphrase,
      iteraciones: Number.isFinite(iteracionesTest) && iteracionesTest > 0 ? iteracionesTest : undefined,
      uid, ahora: () => new Date().toISOString(),
      fetcher: window.fetch.bind(window),
      crypto: syncCryptoApi,
      cryptoImpl: (typeof crypto !== "undefined" && crypto.subtle) ? undefined : window.__mrcheffCryptoImpl,
      snapshotLocal: estadoLocalCompleto,
      fusionar: (base, mio, suyo) => diffMergeApi.merge3(base, mio, suyo),
      almacen: {
        leer: (k) => load(claveLS(k), null),
        escribir: (k, v) => save(claveLS(k), v),
        guardarLocal: aplicarEstadoSync
      }
    };
  }

  // ---- Modal de configuración (token + gist + passphrase de sesión) ----
  function abrirModalSyncConfig() {
    const cfg = load(LS.syncConfig, null) || {};
    const passSesion = sessionStorage.getItem(SESS_PASS);
    modalContent.innerHTML = `
      <h2>⚙️ Sync entre dispositivos</h2>
      <p class="muted">Crea un PAT de GitHub con SOLO el scope <code>gist</code> (github.com/settings/tokens)
        y pégalo aquí junto al ID del gist que hace de buzón. El token y el gist se guardan en ESTE
        navegador; la passphrase se recuerda SOLO en esta sesión y debe ser la MISMA en los dos dispositivos.</p>
      <div class="recipe-edit">
        <label for="sync-token">Token (PAT, scope solo gist)
          <input type="password" id="sync-token" autocomplete="off" value="${escapeHTML(cfg.token || "")}">
        </label>
        <label for="sync-gist">ID del gist (buzón)
          <input type="text" id="sync-gist" autocomplete="off" placeholder="32 hex del gist" value="${escapeHTML(cfg.gistId || "")}">
        </label>
        <label for="sync-nombre">Nombre de este dispositivo (p. ej. «Móvil», «PC»)
          <input type="text" id="sync-nombre" maxlength="24" placeholder="opcional" value="${escapeHTML(cfg.nombre || "")}">
        </label>
        <label for="sync-pass">Passphrase compartida${passSesion ? " (ya memorizada en esta sesión)" : ""}
          <input type="password" id="sync-pass" autocomplete="new-password" placeholder="${passSesion ? "no escribir para conservarla" : "la misma en ambos dispositivos"}">
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" id="sync-guardar">Guardar configuración</button>
      </div>`;
    abrirModal("Configuración del sync entre dispositivos");
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", closeModal));
    $("#sync-token", modalContent).focus();
    $("#sync-guardar", modalContent).addEventListener("click", () => {
      const token = $("#sync-token", modalContent).value.trim();
      const gistId = $("#sync-gist", modalContent).value.trim();
      const nombre = $("#sync-nombre", modalContent).value.trim();
      const pass = $("#sync-pass", modalContent).value;
      if (!token || !gistId) { toast("Token e ID del gist son obligatorios", "error"); return; }
      save(LS.syncConfig, { token, gistId, nombre });
      if (pass) sessionStorage.setItem(SESS_PASS, pass);
      closeModal();
      actualizarSyncUI();
      toast("Configuración del sync guardada");
    });
  }
  btnSyncConfig.addEventListener("click", abrirModalSyncConfig);

  // ---- Botón Sync: un clic = una pasada de la máquina (nada de auto-sync en background, §6) ----
  btnSync.addEventListener("click", async () => {
    const cfg = load(LS.syncConfig, null) || {};
    if (!cfg.token || !cfg.gistId) { abrirModalSyncConfig(); return; }
    const pass = sessionStorage.getItem(SESS_PASS);
    if (!pass) { abrirModalSyncConfig(); toast("Escribe la passphrase de esta sesión para sincronizar", "error"); return; }
    btnSync.disabled = true;
    notaSync("⏳ Sincronizando con el buzón…");
    const ctx = contextoSync(pass);
    const resultado = await syncApi.ejecutar(ctx);
    btnSync.disabled = false;
    await encaminarResultado(resultado, ctx);
    // SIN actualizarSyncUI() aquí: pisaría el mensaje de la rama con el hint genérico —
    // la nota de resultado manda hasta el próximo clic/config.
  });

  async function encaminarResultado(resultado, ctx) {
    if (!resultado) {
      notaSync("No se pudo completar el sync — tus datos locales no han cambiado.");
      toast("El sync no se completó", "error");
      return;
    }
    notaSync(resultado.mensaje || "");
    if (resultado.rama === "conflictos") {
      abrirModalResolver(resultado, ctx);   // §5: nada queda escrito hasta resolver
      return;
    }
    toast(resultado.mensaje || "Sync completado", resultado.rama === "error" ? "error" : "success");
  }

  // "🧹 Vaciar buzón": PATCH con {"kind":"empty"} (nunca borrar el gist: el id es la config del otro).
  btnSyncVaciar.addEventListener("click", async () => {
    btnSyncVaciar.disabled = true;
    notaSync("⏳ Dejando el buzón vacío…");
    const resultado = await syncApi.crearBuzon(contextoSync(""));
    btnSyncVaciar.disabled = false;
    notaSync(resultado.mensaje || "");
    toast(resultado.mensaje, resultado.rama === "error" ? "error" : "success");
  });

  // ---- Modal RESOLVER de conflictos (§5): las dos versiones lado a lado; la decisión es por
  // RECETA (quedarse con este dispositivo / el otro / conservar ambas — la copia hereda "duplicada").
  function textoVersion(v) {
    if (Array.isArray(v)) return v.length ? v.join(" · ") : "(vacío)";
    if (v === undefined || v === null || v === "") return "(sin valor)";
    return String(v);
  }

  function abrirModalResolver(resultado, ctx) {
    const provisional = resultado.estadoProvisional || {};
    const suyo = (resultado.recibida && resultado.recibida.estadoSuyo) || {};
    const grupos = new Map();
    (resultado.conflictos || []).forEach((c) => {
      if (!grupos.has(c.recetaId)) grupos.set(c.recetaId, []);
      grupos.get(c.recetaId).push(c);
    });
    const tituloPorId = (id) => {
      const enProv = (provisional.recipes || []).find(r => r && r.id === id);
      const enSuyo = (suyo.recipes || []).find(r => r && r.id === id);
      return (enProv && enProv.title) || (enSuyo && enSuyo.title) || "Receta";
    };
    const elecciones = new Map();   // recetaId → "local" | "remota" | "ambas"

    modalContent.innerHTML = `
      <h2>⇄ Cambios en conflicto</h2>
      <p class="muted">${escapeHTML(resultado.mensaje || "")}</p>
      ${(resultado.avisos || []).length
        ? `<p class="muted">ℹ️ ${resultado.avisos.length} diferencia(s) menor(es) ya se resolvieron solas (gana la edición más nueva): revisa las recetas tras el sync.</p>`
        : ""}
      ${Array.from(grupos.entries()).map(([id, lista]) => `
        <div class="resolver-receta">
          <h4>${escapeHTML(tituloPorId(id))} <span class="tag tag-sync-conflicto">⇄ conflicto</span></h4>
          ${lista.map((c) => `
            <div class="resolver-campo">
              <div class="resolver-lado"><span class="resolver-rotulo">Este dispositivo · ${escapeHTML(c.campo || "campo")}:</span> ${escapeHTML(textoVersion(c.local))}</div>
              <div class="resolver-lado"><span class="resolver-rotulo">El otro dispositivo:</span> ${escapeHTML(textoVersion(c.remota))}</div>
            </div>`).join("")}
          <div class="resolver-decision">
            <button type="button" class="btn ghost small" data-decision="local" data-receta="${escapeHTML(id)}">Quedarme con este</button>
            <button type="button" class="btn ghost small" data-decision="remota" data-receta="${escapeHTML(id)}">Usar el del otro</button>
            <button type="button" class="btn ghost small" data-decision="ambas" data-receta="${escapeHTML(id)}">Conservar ambas</button>
          </div>
        </div>`).join("")}
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar (nada se escribe)</button>
        <button class="btn primary" id="resolver-aplicar" disabled title="Marca una decisión por cada receta">Aplicar resolución</button>
      </div>`;
    abrirModal("Resolver conflictos del sync");
    $$("[data-close]", modalContent).forEach(el => el.addEventListener("click", () => {
      toast("Sync cancelado: tus datos no han cambiado");
      closeModal();
    }));

    const btnAplicar = $("#resolver-aplicar", modalContent);
    $$(".resolver-decision [data-decision]", modalContent).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.receta;
        elecciones.set(id, btn.dataset.decision);
        $$(".resolver-decision [data-decision]", modalContent)
          .filter(b => b.dataset.receta === id)
          .forEach(b => b.classList.toggle("primary", b === btn));
        btnAplicar.disabled = elecciones.size !== grupos.size;
      });
    });

    btnAplicar.addEventListener("click", async () => {
      const lista = Array.from(elecciones.entries()).map(([recetaId, decision]) => ({ recetaId, decision }));
      const estadoResuelto = diffMergeApi.aplicarResoluciones(provisional, suyo, lista, { uid });
      closeModal();
      btnSync.disabled = true;
      notaSync("⏳ Aplicando la resolución y cerrando el sync…");
      const r2 = await syncApi.continuarTrasConflictos(ctx, estadoResuelto, resultado.recibida);
      btnSync.disabled = false;
      notaSync((r2 && r2.mensaje) || "");
      if (r2) toast(r2.mensaje, r2.rama === "error" ? "error" : "success");
    });
  }

  // ===== INICIALIZACIÓN =====

  renderFoods();
  renderWeeklyAlert();
  renderRecipes();
  renderInnovations();
  renderSeason();
  actualizarSyncUI();

  // El tutorial sale SOLO la primera visita desde una web instalable (http/https — en file://
  // no: localStorage es por origen y en disco no hay guía que mostrar). La sesión se marca
  // vista al cerrarla (✕ / "Terminar" / Escape).
  if (tut && tutorialRaiz && tutorialVelos) {
    const vistoAntes = load(LS.tutorial, {});
    if (!(vistoAntes && vistoAntes.visto)) {
      const esWeb = window.__mrcheffTutorialAuto === true ||
        ((typeof location === "object" && (location.protocol === "http:" || location.protocol === "https:")) &&
         typeof navigator === "object" && navigator.userAgent && navigator.userAgent.indexOf("jsdom") === -1);
      if (esWeb) setTimeout(abrirTutorial, 500);    // deja asentarse el primer layout antes de la visita
    }
  }
});

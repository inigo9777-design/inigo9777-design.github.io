/* app.js · Mr Cheff — lógica de la aplicación
   Se ejecuta cuando el DOM está listo.
   Persiste en localStorage: mrcheff.foods, mrcheff.recipes, mrcheff.innov
*/

document.addEventListener("DOMContentLoaded", () => {
  // ctx: contexto compartido de la refactor final — TODO el estado mutable y los helpers
  // que las vistas necesitan viaja por aquí (inyección de dependencias, §2-D de CODING_STANDARDS).
  const ctx = {};
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
  ctx.LS = LS;

  const load = (key, def) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
    catch { return def; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  ctx.load = load;
  ctx.save = save;

  // Estado mutable del app SIN closure propio: viaja en ctx (las 4 vistas leen/escriben en vivo).
  ctx.foods = load(LS.foods, []);
  ctx.recipes = load(LS.recipes, []);
  ctx.innovations = load(LS.innov, []);
  ctx.innovDay = load(LS.innovDate, "");

  // Limpiar innovaciones de días anteriores
  const today = new Date().toISOString().slice(0, 10);
  ctx.today = today;
  if (ctx.innovDay && ctx.innovDay !== today) {
    ctx.innovations = [];
    save(LS.innov, []);
    ctx.innovDay = today;
    save(LS.innovDate, ctx.innovDay);
  }


  // "Vista Recetas sucia": true si ha entrado una receta nueva DESDE FUERA de esta vista (hoy: el boton estrella en
  // Innovacion) y aun no la hemos repintado. Evita un re-render innecesario en cada cambio de tab; solo se pinta
  // cuando efectivamente hay algo nuevo que mostrar. Precedente identico al 'innovDay !== today' mas arriba (ver DIP, sec 2-D).
  ctx.recetasDirty = false;
  // ===== HELPERS =====
  // uid() y escapeHTML() viven en modules/util.js, lógica PURa (sin DOM ni localStorage) anti-XSS e id-generación; ver
  // CODING_STANDARDS.md §3 option A / DIP y el patrón idéntico de priority.classify.recipeAnalysis.innovations bajo window.MRCheff.*.
  const { escapeHTML, uid, limpiarPaso, formatoFechaCorta } = window.MRCheff.util;
  const recipeEditor = window.MRCheff.recipeEditor;   // módulo puro del editor de recetas (modules/recipe-editor.js)
  ctx.escapeHTML = escapeHTML;
  ctx.uid = uid;
  ctx.recipeEditor = recipeEditor;
  ctx.limpiarPaso = limpiarPaso;                      // ficha de receta y copiado (vistas)
  ctx.formatoFechaCorta = formatoFechaCorta;          // lista de la compra (vista innovación)

  // $/$$ son helpers DE VISTA (manipulan el DOM) → NO lógica de decisión: quedan en este closure como antes.
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  ctx.$ = $;
  ctx.$$ = $$;

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

  ctx.toast = toast;
  ctx.renderFoods = renderFoods;          // viven en el core pero las llaman las vistas
  ctx.renderWeeklyAlert = renderWeeklyAlert;
  ctx.esMovil = esMovil;
  ctx.avanzarPasoTutorial = avanzarPasoTutorial;

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
    if (view === "recipes" && ctx.recetasDirty) {
      ctx.renderRecipes();
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
  ctx.tutorialActivo = false;
  let sesionTutorial = null;
  ctx.pasoEnPantalla = null;            // el paso pintado: a quién atiende el listener global de click
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
    if (!ctx.tutorialActivo || !tutorialVelos || !ctx.pasoEnPantalla) return;
    const paso = ctx.pasoEnPantalla;
    const objetivo = paso.selector ? document.querySelector(paso.selector) : null;
    const anchoVP = window.innerWidth || document.documentElement.clientWidth;
    const altoVP = window.innerHeight || document.documentElement.clientHeight;
    const MARGEN = 8;                     // aire del aro alrededor del elemento señalado
    // Objetivo INVISIBLE (existe pero mide 0×0 — la lista de la compra #shopping-list no nace
    // hasta aprobar un plan, el paso menu-compra de 2026-10-24): mismo camino que sin objetivo,
    // velo completo + tarjeta centrada; un aro de 0×0 pegado a la esquina sería basura visual.
    // El mismo código pinta el aro sobre la lista REAL si la visita se reabre con 🎓 el día que
    // ya hay plan aprobado. Doble chequeo de "invisible": la clase `hidden` de la app (la
    // misma que jsdom resuelve sin layout) y, en navegador, la geometría real 0×0 de
    // offsetWidth — el falso "todo invisible" de jsdom (tiges a 0) lo evita hayLayout.
    const hayLayout = (document.documentElement.clientWidth || document.body.clientWidth) > 0;
    const objetivoInvisible = !!objetivo && (objetivo.classList.contains("hidden")
      || (hayLayout && objetivo.offsetWidth === 0 && objetivo.offsetHeight === 0));
    if (!objetivo || objetivoInvisible) {
      // sin objetivo: VELO COMPLETO (toda la ventana atenuada) + tarjeta centrada
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
    // Excepción (petición 2026-10-21): los objetivos ALTOS del guion ("Mis recetas" y la
    // cuadrícula de Temporada llevan tarjeta: "arriba" en modules/tutorial.js) mandan el
    // CONTENIDO — la tarjeta flota ENCIMA del aro sin tocarlo (borde inferior a 12 px del aro)
    // y el arranque del elemento se ve vivo debajo de ella; la cabecera de la app asoma
    // atenuada por el velo por encima. En ventanas diminutas, el clamp degrade al tope.
    const altoTarjeta = tutorialVelos.tarjeta.offsetHeight || 150;
    const anchoTarjeta = Math.min(tutorialVelos.tarjeta.offsetWidth || 300, 320);
    let cardY = r.bottom + 12;
    if (paso.tarjeta === "arriba") {
      cardY = Math.max(12, y0 - altoTarjeta - 12);
    } else if (cardY + altoTarjeta > altoVP - 12) {
      cardY = Math.max(12, r.top - 12 - altoTarjeta);
    }
    if (cardY + altoTarjeta > altoVP - 12) cardY = Math.max(12, altoVP - 12 - altoTarjeta);
    let cardX = Math.max(12, Math.min(r.left + r.width / 2 - anchoTarjeta / 2, anchoVP - anchoTarjeta - 12));
    Object.assign(tutorialVelos.tarjeta.style, { top: cardY + "px", left: cardX + "px" });
  }

  function pintarPasoTutorial() {
    if (!tut || !tutorialVelos || !sesionTutorial) return;
    const paso = tut.pasoActual(sesionTutorial);
    if (!paso) { cerrarTutorial(true); return; }
    ctx.pasoEnPantalla = paso;
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
    // animar: el listener de scroll reposiciona el foco durante el vuelo). Excepción
    // (petición 2026-10-21) para los objetivos ALTOS con tarjeta: "arriba" — "center" los
    // clava cubriendo la ventana y la tarjeta tapaba su contenido; ahora el ARRANQUE del
    // elemento se asienta al ~60% de la ventana: la tarjeta flota entre la cabecera y el aro,
    // y el contenido del paso se ve vivo debajo (el scroll por JS, window.scrollTo, porque
    // scrollIntoView no enseña "dónde debe quedar el tope").
    if (objetivo && (objetivo.offsetWidth || objetivo.offsetHeight)) {   // sube/salta sólo si el objetivo se ve (invisible ⇒ el reposicionado cae en tarjeta centrada)
      const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (paso.tarjeta === "arriba") {
        const altoVP = window.innerHeight || document.documentElement.clientHeight;
        const arranqueDeseado = Math.round(altoVP * 0.6);
        const ahora = objetivo.getBoundingClientRect().top;
        const delta = Math.round(ahora - arranqueDeseado);
        if (Math.abs(delta) > 1) {
          try {
            window.scrollTo({ top: Math.max(0, (window.scrollY || 0) + delta), behavior: reduce ? "auto" : "smooth" });
          } catch (eSin) {
            try { window.scrollTo(Math.max(0, (window.scrollY || 0) + delta), 0); }  // WebView viejo sin options object
            catch (e2) { /* sin scrollTo (entorno de prueba): el paso sigue igual */ }
          }
        }
      } else {
        try {
          objetivo.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        } catch (e) {
          try { objetivo.scrollIntoView(); }              // WebView viejo sin options object
          catch (e2) { /* sin scrollIntoView (entorno de prueba): el paso sigue igual */ }
        }
      }
    }
    // El frame inicial del reposicionado (el listener de scroll ya cubre el vuelo del
    // scrollIntoView animado). Fallback a setTimeout para WebViews sin requestAnimationFrame.
    const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame : (fn) => setTimeout(fn, 16);
    raf(tutorialReposicionar);
  }

  function abrirTutorial() {
    if (!tut || !tutorialRaiz || !tutorialVelos) return;
    // Limpiar el foco de la app (petición 2026-10-21): si la visita se reabre con el 🎓 con
    // un campo activo y el teclado del PWA en pantalla, el keyboard descuadraría los velos.
    if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();
    sesionTutorial = tut.sesionNueva();
    ctx.tutorialActivo = true;
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
  // EXCEPCIÓN (demo del escáner, 2026-10-22): en el paso con `demo` SÍ se detiene el gesto con
  // stopPropagation + preventDefault — tocando el botón real NO se abre el file-picker, se
  // lanzan los dos diálogos de ejemplo con datos de prueba (nada se escribe; el avance del
  // paso lo manda cerrarDemoEscaner al cerrarse el diálogo, no este listener).
  document.addEventListener("click", (e) => {
    if (!ctx.tutorialActivo || !ctx.pasoEnPantalla || !ctx.pasoEnPantalla.accionable || !e.target.closest) return;
    if (e.target.closest("#tutorial-tarjeta")) return;   // la tarjeta es salida, no "el objetivo del paso"
    let objetivo = null;
    try { objetivo = e.target.closest(ctx.pasoEnPantalla.selector); } catch (err) { return; }
    if (!objetivo) return;
    if (ctx.pasoEnPantalla.demo === "escaner") {
      e.stopPropagation();
      e.preventDefault();
      ctx.lanzarDemoEscaner();
      return;
    }
    avanzarPasoTutorial();
  }, true);

  // Silencio de TECLADO y LISTAS nativas durante la visita (petición 2026-10-21): al tocar el
  // campo real del paso, el teclado del PWA instalable se abría y descuadraba el paso
  // siguiente, y el select de Temporada (#season-month) dejaba su lista de meses abierta
  // encima del paso que venía. preventDefault en pointerdown/mousedown cancela el FOCUS —
  // y con él teclado y picker del select — pero NO el click: el paso sigue avanzando por su
  // listener global de arriba y la app no cambia de estado (la barra #food-score tampoco
  // arrastra valor durante el tour). Sólo protege el objetivo del paso ACTIVO (diana
  // accionable); el resto de la app ya duerme bajo el velo. Nota iOS: el picker del select
  // puede abrirse al soltar el dedo — la plataforma de la feature es el PWA Android/Brave.
  function silenciarCamposTutorial(e) {
    if (!ctx.tutorialActivo || !ctx.pasoEnPantalla || !ctx.pasoEnPantalla.accionable || !e.target.closest) return;
    let objetivo = null;
    try { objetivo = e.target.closest(ctx.pasoEnPantalla.selector); } catch (err) { return; }
    if (!objetivo) return;
    if (objetivo.closest("input, textarea, select")) e.preventDefault();
  }
  document.addEventListener("pointerdown", silenciarCamposTutorial, true);
  document.addEventListener("mousedown", silenciarCamposTutorial, true);

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
    ctx.tutorialActivo = false;
    ctx.pasoEnPantalla = null;
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
      if (ctx.tutorialActivo) return;                              // visita guiada: carrusel en pausa (el velo se traga los toques fuera del foco)
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
      if (fabRaf === null) fabRaf = requestAnimationFrame(pintaFabSubir);
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (fabRaf === null) fabRaf = requestAnimationFrame(pintaFabSubir);   // el umbral INNER cambia al girar
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
  const weeklyAlert = $("#weekly-alert");

  foodScore.addEventListener("input", () => foodScoreVal.textContent = foodScore.value);
  foodQty.addEventListener("input", () => foodQtyVal.textContent = foodQty.value || 0);
  foodMin.addEventListener("input", () => foodMinVal.textContent = foodMin.value || 0);

  // CONMUTADOR del formulario: alta de ALIMENTO (con criterio de alerta) o de PRODUCTO DE HOGAR
  // (sin importancia ni mínimo — entran fijos por módulo como en el escáner del ticket).
  let altaComoHogar = false;
  const btnCatAlimento = $("#food-cat-alimento");
  const btnCatHogar = $("#food-cat-hogar");
  const grupoScoreAlta = foodScore.closest(".slider-group");
  const grupoMinAlta = foodMin.closest(".qty-group");
  function pintaCatAlta() {
    if (btnCatAlimento && btnCatHogar) {
      btnCatAlimento.setAttribute("aria-pressed", String(!altaComoHogar));
      btnCatHogar.setAttribute("aria-pressed", String(altaComoHogar));
    }
    [grupoScoreAlta, grupoMinAlta].forEach(g => { if (g) g.classList.toggle("hidden", altaComoHogar); });
  }
  if (btnCatAlimento && btnCatHogar) {
    btnCatAlimento.addEventListener("click", () => { altaComoHogar = false; pintaCatAlta(); });
    btnCatHogar.addEventListener("click", () => { altaComoHogar = true; pintaCatAlta(); });
  }

  foodForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = foodName.value.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    const exists = ctx.foods.find(f => f.name.toLowerCase() === lower);
    if (exists) {
      toast(altaComoHogar ? "Ese producto ya está en tu lista" : "Ese alimento ya está en tu lista", "error");
      return;
    }
    const qty = Math.max(0, parseInt(foodQty.value, 10) || 0);
    // El HOGAR no pide criterio (petición del usuario): importancia 5 neutra y mínimo 0 (avisar
    // cuando se agote) — mismos defaults que la alta desde el escáner (modules/ocr-despensa.js).
    const food = altaComoHogar
      ? { id: uid(), name, score: 5, qty, min: 0, checked: false, createdAt: Date.now(), categoria: "hogar" }
      : { id: uid(), name, score: parseInt(foodScore.value, 10), qty, min: Math.max(0, parseInt(foodMin.value, 10) || 0), checked: false, createdAt: Date.now() };
    ctx.foods.push(food);
    save(LS.foods, ctx.foods);
    foodName.value = "";
    foodScore.value = 5;
    foodScoreVal.textContent = "5";
    foodQty.value = 0;
    foodQtyVal.textContent = "0";
    foodMin.value = 1;
    foodMinVal.textContent = "1";
    renderFoods();
    renderWeeklyAlert();
    ctx.renderShoppingListTrasDespensa();
    toast(altaComoHogar ? "Producto de hogar añadido" : "Alimento añadido");
  });
  pintaCatAlta();

  foodFilter.addEventListener("input", renderFoods);

  // Lógica de urgencia/reposición extraída al módulo puro modules/priority.js (sin DOM ni localStorage). Se consume para que el
  // resto de la app se comporte idénticamente. Ver CODING_STANDARDS.md §3 option A / DIP y §5 "alimentos/alerta semanal":
  // urgencyLevel = color por item; buildWeeklyAlert = decide qué entra/presenta (icono/título/orden/CAPA-A-8) — lógica pura, testeable sin DOM.
  const { urgencyLevel, buildWeeklyAlert } = window.MRCheff.priority;

  // ─── Inventario en DOS SECCIONES (etiqueta alimento/hogar — modules/categoria-producto.js): los
  // ALIMENTOS en la lista de siempre y los PRODUCTOS DE HOGAR (detergente, papel…) en la suya,
  // aparte: sin importancia/mínimo contenidos (van fijos en su alta) y con la misma mecánica de
  // ➕➖/🗑. El buscador filtra ambas.
  function renderFoods() {
    const q = foodFilter.value.trim().toLowerCase();
    const filtered = ctx.foods.filter(f => !q || f.name.toLowerCase().includes(q));
    const listaAlimentos = filtered.filter(f => !ctx.categoria.esHogar(f));
    const listaHogares = filtered.filter(f => ctx.categoria.esHogar(f));
    foodList.innerHTML = "";
    if (listaAlimentos.length === 0) {
      foodEmpty.classList.toggle("hidden", ctx.foods.length > 0);
    } else {
      foodEmpty.classList.add("hidden");
    }
    const hogarSeccion = $("#hogar-seccion");
    const hogarLista = $("#hogar-list");
    if (hogarSeccion && hogarLista) {
      hogarLista.innerHTML = "";
      hogarSeccion.classList.toggle("hidden", listaHogares.length === 0);
      listaHogares.forEach(f => pintaFilaInventario(hogarLista, f, true));
      conectarFilasInventario(hogarLista, "Producto");
    }
    listaAlimentos.forEach(f => pintaFilaInventario(foodList, f, false));
    conectarFilasInventario(foodList, "Alimento");
  }

  // Una fila del inventario (alimento o hogar — la única diferencia viva es el badge/score).
  function pintaFilaInventario(lista, f, esHogar) {
    const qty = f.qty ?? 0;
    const min = f.min ?? 0;
    const low = qty <= min;
    const level = urgencyLevel(f.score);
    const li = document.createElement("li");
    li.className = "food-item urg-" + level + (low ? " low" : "") + (esHogar ? " cat-hogar" : "");
    // El id también llega por backup/sync (se preserva tal cual) — se escapa como cualquier otro campo de usuario.
    const idSeguro = escapeHTML(f.id);
    li.innerHTML = `
      <button type="button" class="btn ghost small food-edit" data-edit="${idSeguro}" aria-label="Editar ${escapeHTML(f.name)}" title="Editar">✏️</button>
      <span class="food-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</span>
      <span class="food-qty" title="En casa / mínimo para avisar">${escapeHTML(qty)} / ${escapeHTML(min)}</span>
      ${esHogar
        ? `<span class="food-score cat-hogar" title="Producto de hogar">🏠</span>`
        : `<span class="food-score urg-${level}" title="Importancia">${escapeHTML(f.score)}</span>`}
      <span class="food-actions">
        <button class="btn ghost small" data-inc="${idSeguro}" title="Sumar 1" data-step="1" aria-label="Sumar 1 a ${escapeHTML(f.name)}">➕</button>
        <button class="btn ghost small" data-inc="${idSeguro}" title="Restar 1" data-step="-1" aria-label="Restar 1 a ${escapeHTML(f.name)}">➖</button>
        <button class="btn ghost small" data-del="${idSeguro}" title="Eliminar" aria-label="Eliminar ${escapeHTML(f.name)}">🗑</button>
      </span>`;
    lista.appendChild(li);
  }

  // Los listeners de la lista de inventario (uno por sección — cada lista lleva su etiqueta al borrar).
  // El checkbox "hoy está en casa" se retiró (2026-10-23): la re-greenía por cantidad + mínimo manda,
  // y el ✏️ de la fila abre el editor del alimento en el modal.
  function conectarFilasInventario(lista, nombreTipo) {
    lista.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => abrirModalEditarAlimento(btn.dataset.edit));
    });
    lista.querySelectorAll("[data-inc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const f = ctx.foods.find(x => x.id === btn.dataset.inc);
        if (f) {
          f.qty = Math.max(0, (f.qty ?? 0) + parseInt(btn.dataset.step, 10));
          save(LS.foods, ctx.foods);
          renderFoods();
          renderWeeklyAlert();
          ctx.renderShoppingListTrasDespensa();
        }
      });
    });
    lista.querySelectorAll("[data-del]").forEach(btn => {
      // 2026-10-23: el 🗑 YA no borra a la primera — abre el diálogo de confirmación
      // (petición del usuario: evitar borrados por error).
      btn.addEventListener("click", () => abrirModalEliminarAlimento(btn.dataset.del, nombreTipo));
    });
  }

  // Diálogo de confirmación del borrado (🗑 en la fila): mismo modal #modal-content. Nada se
  // quita hasta el "Eliminar" — Cancelar/Escape/✕ dejan el inventario exactamente como estaba.
  function abrirModalEliminarAlimento(id, nombreTipo) {
    const f = ctx.foods.find(x => x.id === id);
    if (!f) return;                                   // id perdido tras un repintado: NADA se borra
    ctx.modalContent.innerHTML = `
      <h2>🗑 ¿Eliminar "${escapeHTML(f.name)}"?</h2>
      <p class="muted">Se quita de tu inventario y de sus alertas. Esta acción no se puede deshacer.</p>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn danger" data-eliminar-confirmar>Eliminar</button>
      </div>`;
    ctx.abrirModal("¿Eliminar " + f.name + "?");
    $$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
    $("[data-eliminar-confirmar]", ctx.modalContent).addEventListener("click", () => {
      ctx.foods = ctx.foods.filter(x => x.id !== id);
      save(LS.foods, ctx.foods);
      renderFoods();
      renderWeeklyAlert();
      ctx.renderShoppingListTrasDespensa();
      ctx.closeModal();
      toast(`${nombreTipo} eliminado`);
    });
  }

  // Editor del alimento/producto (✏️ en la fila): reutiliza el MISMO modal (#modal-content) que
  // "✅ Comprado". Los productos de hogar no piden criterio (fijos en su alta: score 5 / min 0).
  function abrirModalEditarAlimento(id) {
    const f = ctx.foods.find(x => x.id === id);
    if (!f) return;                                   // id perdido tras un repintado: NADA se edita
    const hogar = ctx.categoria.esHogar(f);
    ctx.modalContent.innerHTML = `
      <h2>✏️ Editar ${hogar ? "producto" : "alimento"}</h2>
      <p class="muted">Los cambios se guardan en el inventario y en sus alertas.</p>
      <div class="recipe-edit">
        <label for="edit-food-nombre">Nombre
          <input type="text" id="edit-food-nombre" value="${escapeHTML(f.name)}">
        </label>
        <label for="edit-food-qty">Cantidad en casa
          <input type="number" id="edit-food-qty" min="0" step="1" value="${f.qty ?? 0}">
        </label>
        ${hogar ? "" : `
        <label for="edit-food-min">Cantidad mínima para la alerta de reponer
          <input type="number" id="edit-food-min" min="0" step="1" value="${f.min ?? 0}" title="Cuando baje de aquí te avisamos">
        </label>
        <label for="edit-food-score">Importancia (1–10)
          <input type="number" id="edit-food-score" min="1" max="10" step="1" value="${f.score ?? 5}">
        </label>`}
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn primary" data-edit-food-guardar>Guardar cambios</button>
      </div>`;
    ctx.abrirModal("Editar: " + f.name);
    $$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
    $("#edit-food-nombre", ctx.modalContent).focus();
    $("#edit-food-nombre", ctx.modalContent).select();
    $("[data-edit-food-guardar]", ctx.modalContent).addEventListener("click", () => {
      const nombre = $("#edit-food-nombre", ctx.modalContent).value.trim();
      if (!nombre) { toast("Ponle un nombre al alimento", "error"); return; }
      const duplicado = ctx.foods.find(x => x.id !== id && x.name.toLowerCase() === nombre.toLowerCase());
      if (duplicado) { toast("Ese nombre ya está en tu inventario", "error"); return; }
      f.name = nombre;
      f.qty = Math.max(0, parseInt($("#edit-food-qty", ctx.modalContent).value, 10) || 0);
      if (!hogar) {
        f.min = Math.max(0, parseInt($("#edit-food-min", ctx.modalContent).value, 10) || 0);
        f.score = Math.min(10, Math.max(1, parseInt($("#edit-food-score", ctx.modalContent).value, 10) || 5));
      }
      save(LS.foods, ctx.foods);
      renderFoods();
      renderWeeklyAlert();
      ctx.renderShoppingListTrasDespensa();
      ctx.closeModal();
      toast("Cambios guardados");
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
    const m = buildWeeklyAlert(ctx.foods);
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
              <span class="alert-meta">tienes <b>${escapeHTML(f.qty ?? 0)}</b> · mínimo <b>${escapeHTML(f.min ?? 0)}</b> · importancia <b>${escapeHTML(f.score)}/10</b></span>
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

  // Molde badge sync (Copia "duplicada" del resolver): en el core para que TODAS las vistas lo
  // lean por ctx desde la PRIMERA renderización (recetas/innovación arrancan antes que copias).
  const badgeSyncHTML = (rec) =>
    rec && rec.duplicada ? '<span class="tag tag-sync-duplicada" title="Copia conservada por una resolución del sync">⧉ duplicada</span>' : "";
  ctx.badgeSyncHTML = badgeSyncHTML;

  // ===== MÓDULOS DE VISTA (refactor final 2026-10): entrega del contexto compartido =====
  // NOTA de orden: recetasModal PRIMERO — es el dueño del MODAL común (modalContent /
  // abrirModal / closeModal) que las otras tres vistas piden por `ctx`.
  window.MRCheff.views.recetasModal(ctx);
  window.MRCheff.views.escanerOcr(ctx);
  window.MRCheff.views.innovacionSugerencias(ctx);
  window.MRCheff.views.copiasSeguridad(ctx);

  // ===== INICIALIZACIÓN =====

  renderFoods();
  renderWeeklyAlert();
  ctx.renderRecipes();
  ctx.renderInnovations();
  renderSeason();
  ctx.actualizarSyncUI();

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

// modules/tutorial.js — Lógica PURA del tutorial interactivo de entrada (feature 2026-10-20,
// petición del usuario: "al entrar te sale toda la app sin datos y no sabes por dónde empezar").
// Sin DOM, sin localStorage (CODING_STANDARDS.md §3, option A): aquí viven los PASOS (el guion
// de la visita guiada), la máquina de sesión (avanzar/saltar/terminar) y las reglas de validez;
// el velo semitransparente, el foco luminoso sobre el elemento y el posicionamiento son DOM y
// viven en app.js, que es el composition-root.
//
// Cómo funciona el guion: cada PASO dice (1) qué vista abrir (vista; null = tarjeta centrada
// sin foco), (2) a qué elemento señalar (selector CSS; null = sin foco), (3) qué decir
// (titulo + texto) y (4) si el elemento es ACTIONABLE (la persona toca el elemento real y así
// avanza) o no (aparece el botón "Siguiente"). Si el selector no existe en el DOM del día, el
// paso degrada a informativo: nunca se atasca el tutorial.
//
// API PÚBLICA CERRADA (sin fugas de helpers internos):
//   PASOS             — guion completo (grupos concatenados: intro, cada vista, cierre)
//   pasosDeVista(vista) — pasos que abren esa vista (para tests y orden por grupos)
//   sesionNueva() / pasoActual(sesion) / numero(sesion) / totalPasos()
//   avanzar(sesion)   — muta la sesión al paso siguiente (al pasarse, sesion.hecho = true)
//   pasoValido(paso)  — contrato de un paso (vista/titulo/texto consistentes)

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node
  root.MRCheff = root.MRCheff || {};
  root.MRCheff.tutorial = api;                                            // Navegador
})(typeof self !== "undefined" ? self : this, function () {

  // ===== GRUPOS DE PASOS =====
  // Cada grupo vive en su tarea (task/tutorial-screen-*) y se concatena aquí en orden de visita:
  // INTRO (esta rama) → Alimentos → Recetas → Innovación → Sugerencias/menú → Temporada → OUTRO.

  const PASOS_INTRO = [
    {
      id: "bienvenida",
      vista: null, selector: null, accionable: false,
      titulo: "Bienvenido a Mr Cheff",
      texto: "Esto es tu despensa, tus recetas y tu plan de semana en un mismo sitio — y ahora mismo está vacía, como una cocina nueva. Te enseño lo esencial en un minuto; si quieres salir en cualquier momento, usa la ✕.",
      cta: "Adelante",
    },
    {
      id: "cabecera",
      vista: null, selector: ".topbar-actions", accionable: false,
      titulo: "La cabecera",
      texto: "A la derecha viven tres botones redondos: el 🎓 reabre este tutorial cuando te haga falta, la 🗄️ copia de seguridad y el 🌙 modo claro u oscuro. Las pestañas del centro cambian de vista (en móvil también deslizando a los lados).",
      cta: "Empecemos",
    },
  ];

  // (Kernels de pasos por vista: se escriben sus grupos propios en task/tutorial-screen-*.)

  const PASOS_OUTRO = [
    {
      id: "listo",
      vista: null, selector: null, accionable: false,
      titulo: "Ya sabes moverte por la cocina",
      texto: "Anota lo que tengas en Alimentos y el resto de la app trabaja con ello: ideas del catálogo, plan de la semana y lista de la compra. Si algún día quieres repasar esto, toca el 🎓 de la cabecera.",
      cta: "Terminar",
    },
  ];

  const PASOS_ALIMENTOS = [
    {
      id: "alimentos-anotar",
      vista: "foods", selector: "#food-name", accionable: true,
      titulo: "Apunta lo que tienes en casa",
      texto: "Escribe aquí un alimento que tengas, p. ej. Huevos, y ajusta cuántos tienes, tu mínimo para ser avisado y lo importante que es. Toca el campo para seguir.",
    },
    {
      id: "alimentos-importancia",
      vista: "foods", selector: "#food-score", accionable: true,
      titulo: "La importancia decide la urgencia",
      texto: "Puntúa del 1 al 10 lo indispensable: rojo 8-10, naranja 6-7 y verde 5 o menos es cómo se pintarán las alertas. Toca la barra para seguir.",
    },
    {
      id: "alimentos-inventario",
      vista: "foods", selector: "#food-list", accionable: false,
      titulo: "Inventario y alerta semanal",
      texto: "Cada alimento vive aquí con su cantidad y su color. Cuando algo baje de su mínimo, la alerta semanal te avisa al abrir la app (y en Sugerencias y menú entra automáticamente en la lista de la compra).",
      cta: "Siguiente",
    },
  ];
  const PASOS_RECETAS = [
    {
      id: "recetas-crear",
      vista: "recipes", selector: "#recipe-desc", accionable: true,
      titulo: "Crea recetas con tus palabras",
      texto: "Describe aquí lo que has cocinado como lo contarías a un amigo y la app saca tus ingredientes y tus pasos en orden — interpretado en tu dispositivo, sin redes. Toca el campo para seguir.",
    },
    {
      id: "recetas-catalogo",
      vista: "recipes", selector: "#recipe-catalog-search", accionable: true,
      titulo: "El catálogo te hace el trabajo",
      texto: "200 recetas curadas de cocina española e italiana por título o por ingrediente. Y vale con escribir pocas letras: con \"gamb\" ya salen las gambas al ajillo. Toca el buscador para seguir.",
    },
    {
      id: "recetas-mis-recetas",
      vista: "recipes", selector: "#recipe-list", accionable: false,
      titulo: "Mis recetas y su origen",
      texto: "Lo que guardes (⭐ desde Innovación, o lo que edites) vive aquí: todas editables, con su sello de origen — española o italiana — y con el detalle de qué te falta para cocinarla.",
      cta: "Siguiente",
    },
  ];
  const PASOS_INNOVACION = [
    {
      id: "innovacion-generador",
      vista: "innovation", selector: "#btn-generate-innov", accionable: true,
      titulo: "Ideas del catálogo, no combinaciones al vuelo",
      texto: "Aquí Mr Cheff te propone platos reales ordenados por su encaje con tu despensa: el nº de ideas (4 a 20) y el sesgo (mezcla, platos nuevos o parecidos) se ajustan en esta misma fila. Toca Generar ideas y verás.",
    },
    {
      id: "innovacion-lote",
      vista: "innovation", selector: "#innovation-list", accionable: false,
      titulo: "Un lote listo para mirar",
      texto: "Cada tarjeta es una receta real con sus ingredientes a juego con lo que has anotado: ábrela para la ficha completa y guárdala con ⭐ si te convence — pasa a Mis recetas y ya cuenta en el plan de la semana. (Con la despensa vacía el generador te dirá antes de apuntar algo en Alimentos.)",
      cta: "Siguiente",
    },
  ];
  const PASOS_MENU = [
    {
      id: "menu-hoy",
      vista: "suggest", selector: "#btn-suggest-generate", accionable: true,
      titulo: "Lo que puedes cocinar HOY",
      texto: "Recetas ordenadas por lo que aprovechas de tu despensa, con todo lo que falta arriba de todo. \"↻ Sugerir ahora\" trae un lote que no repite lo que ya cocinaste esta semana. Toca el botón para verlo.",
    },
    {
      id: "menu-semana",
      vista: "suggest", selector: "#btn-menu-generate", accionable: true,
      titulo: "La semana entera, propuesta",
      texto: "Genera un plan de 7 días con desayuno, comida y cena, respetando lo ya cocinado. La casilla \"incluir aunque no disponibles\" completa los huecos que te faltan ingredientes y anota los pendientes. Toca Generar menú y mira tu semana.",
    },
    {
      id: "menu-aprobar",
      vista: "suggest", selector: "#btn-menu-approve", accionable: false,
      titulo: "Aprobar el plan y la compra",
      texto: "Cuando la semana te guste, \"Aprobar plan\" la fija: desbloquea el 🍳 Cocinar de cada comida y crea abajo la lista de la compra, con semáforo por fecha (rojo hoy, verde si corre).",
      cta: "Siguiente",
    },
  ];
  const PASOS_TEMPORADA = [
    {
      id: "temporada-mes",
      vista: "seasonal", selector: "#season-month", accionable: true,
      titulo: "Cada mes tiene lo suyo",
      texto: "El selector viene en el mes actual, pero puedes husmear en cualquiera: así planeas compras finas antes de que acabe la temporada. Toca el selector para seguir.",
    },
    {
      id: "temporada-grid",
      vista: "seasonal", selector: "#season-grid", accionable: false,
      titulo: "Buena fruta, buena verdura",
      texto: "Lo que ves aquí está en su mejor momento: la clave para que el gazpacho, la ensalada o el arroz de hoy salgan como tocan. También puedes buscar por nombre con la otra caja.",
      cta: "Siguiente",
    },
  ];

  const PASOS = [].concat(
    PASOS_INTRO,
    PASOS_ALIMENTOS,
    PASOS_RECETAS,
    PASOS_INNOVACION,
    PASOS_MENU,
    PASOS_TEMPORADA,
    PASOS_OUTRO
  );

  // ===== MÁQUINA DE SESIÓN =====

  function pasoValido(p) {
    return !!p
      && typeof p.titulo === "string" && p.titulo.trim() !== ""
      && typeof p.texto === "string" && p.texto.trim() !== ""
      && (p.vista === null || typeof p.vista === "string")
      && (p.selector === null || typeof p.selector === "string")
      && (!p.accionable || (typeof p.selector === "string" && p.selector !== ""));
  }

  // El guion del día: sólo los pasos con contrato sano (protege frente a un paso mal escrito).
  function pasosSanos() {
    return PASOS.filter(pasoValido);
  }

  function sesionNueva() {
    return Object.create(null);
  }

  function pasoActual(sesion) {
    const pasos = pasosSanos();
    if (!sesion || typeof sesion !== "object") return null;
    const i = Number(sesion.i) || 0;
    return pasos[i] || null;
  }

  function numero(sesion) {
    const pasos = pasosSanos();
    if (!sesion || typeof sesion !== "object") return 0;
    return Math.min((Number(sesion.i) || 0) + 1, pasos.length);
  }

  function totalPasos() {
    return pasosSanos().length;
  }

  // Avanza la sesión (muta, como recordarScroll): al pasar del último paso marca sesion.hecho.
  function avanzar(sesion) {
    const pasos = pasosSanos();
    if (!sesion || typeof sesion !== "object") return sesion;
    sesion.i = Math.min(((Number(sesion.i)) || 0) + 1, pasos.length);
    if (sesion.i >= pasos.length) sesion.hecho = true;
    return sesion;
  }

  function pasosDeVista(vista) {
    return pasosSanos().filter(p => p.vista === vista);
  }

  return {
    PASOS, pasosDeVista, sesionNueva, pasoActual, numero, totalPasos, avanzar, pasoValido,
  };
});

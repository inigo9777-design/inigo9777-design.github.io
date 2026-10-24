/* views/escaner.js · Mr Cheff — vista escanerOcr
   Escáner del TICKET de la compra (OCR) + su confirmación en 2 diálogos. Extraído del cierre de app.js en la refactor final (2026-10-23); fábrica con el contexto compartido `ctx` (patrón A de CODING_STANDARDS). La decisión sigue en módulos puros (ocr-despensa.js / ocr-foto.js / ocr-ticket-parser.js); aquí sólo wiring de vista.
*/
(function () {
  window.MRCheff.views = window.MRCheff.views || {};
  window.MRCheff.views.escanerOcr = function (ctx) {

    // Publicaciones anticipadas (function declarations = hoisting):
    ctx.lanzarDemoEscaner = lanzarDemoEscaner;   // el paso-demo del tutorial (en el core) la llama

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
  // PARSER ESTRUCTURAL del ticket (requisito 95%): lee las LÍNEAS ancladas a los precios en vez de
  // buscar palabras del vocabulario — Mercadona (columna de cantidad) y ALDI (auxiliares de
  // peso/pack, granel a lotes de 500 g). Si no estuviera cargado (caché vieja del SW), el flujo
  // cae al camino del vocabulario de siempre sin romper nada.
  const ticketParser = window.MRCheff.ticketParser || null;
  // ETIQUETA alimento/hogar del Inventario: los productos no alimentarios del ticket entran por la
  // revisión sin importancia ni mínimo y viven en su SECCIÓN propia, fuera de recetas y menús.
  const categoria = window.MRCheff.categoriaProducto || { esProductoHogar: () => false, esHogar: () => false, esAlimento: () => true, alimentos: f => f || [], hogares: () => [], criterioDeAlta: (h, c) => c };
  ctx.categoria = categoria;   // el core (Alimentos) la lee por ctx
  // La despensa ALIMENTARIA (regla del producto no alimentario): los hogareños viven EN EL
  // INVENTARIO y en sus alertas, pero quedan FUERA de recetas, sugerencias, menú semanal y de la
  // comprobación de cobertura de la lista de la compra. Todo consumo de la despensa para COCINAR
  // pasa por aquí (innovations, planner, menu-semanal).
  const despensaCocina = () => categoria.alimentos(ctx.foods);
  ctx.despensaCocina = despensaCocina;   // Innovación y lista de la compra la piden por ctx
  const ocrBtnCamara = ctx.$("#btn-ocr-camara");
  const ocrBtnFoto = ctx.$("#btn-ocr-foto");
  const ocrFile = ctx.$("#ocr-file");
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  // SRI (audit security 2026-10-23): hash SHA-384 del fichero exacto fijado, verificado contra
  // jsdelivr y unpkg (mismo byte→mismo hash). Un CDN comprometido no puede ejecutar código aquí.
  const TESSERACT_SRI = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";
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
        s.integrity = TESSERACT_SRI;          // el navegador rechaza el script si el CDN sirve otro byte
        s.crossOrigin = "anonymous";          // SRI exige modo CORS
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
  const HEIC_SRI = "sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL";   // SRI, misma verificación doble que Tesseract
  const HEIC_CargaMaxima = 90000;              // un CDN caído debe FALLAR con su ctx.toast, no congelar el ctx.modal
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
        s.integrity = HEIC_SRI;               // SRI: un CDN alterado no llega a convertir la foto
        s.crossOrigin = "anonymous";          // SRI exige modo CORS
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

  // WORKER del OCR creado UNA vez y reutilizado por todas las caras de la foto (antes cada
  // `Tesseract.recognize` levantaba el suyo): la foto del ticket se reconoce 2-3 veces seguidas
  // (de frente y girada), así que el reuso evita cargar el núcleo dos veces más. Con los
  // PARÁMETROS del requisito 95%: PSM 6 (bloque uniforme — el ticket es una columna de líneas),
  // espacios entre palabras preservados (la alineación de las columnas qty/precio es lo que el
  // parser lee) y el DPI real avisado al núcleo. El worker creado aquí se TERMINA en escanearFoto.
  async function crearWorkerTesseract(progreso) {
    const Tesseract = await cargarTesseract();
    const modales = m => {
      if (m && m.status === "recognizing text" && progreso && progreso.isConnected) {
        progreso.textContent = `Reconociendo texto… ${Math.round((m.progress || 0) * 100)}%`;
      }
    };
    const worker = await Tesseract.createWorker("spa", 1, { logger: modales });
    await worker.setParameters({
      tessedit_pageseg_mode: "6",               // PSM_SINGLE_BLOCK: las líneas del ticket
      preserve_interword_spaces: "1",
      user_defined_dpi: "300"                   // fotos de móvil ≈ 300 DPI tras el escalado
    });
    return worker;
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
    const abierto = () => !ctx.modal.classList.contains("hidden");
    await cargarTesseract();                             // precarga: el worker de abajo la necesita
    const { foto } = await ocrFoto.prepararFoto(archivo, {
      esHeic: ocr.esHeic,
      decodificar: (typeof createImageBitmap === "function") ? b => createImageBitmap(b) : null,   // sin decodificador real (jsdom): la foto pasa sin conversión
      convertir: a => convertirHeic(a, progreso)
    });
    if (!abierto()) return;                              // canceló durante la carga/conversión
    const bitmap = await createImageBitmap(foto);        // decodificación real: HEIC sin convertir moriría aquí (lo avisa el catch del change)
    let worker = null;
    let resultado;
    try {
      worker = await crearWorkerTesseract(progreso);     // UNO para todas las caras (giros incluidos)
      resultado = await ocrFoto.escanearCaras({
        abierta: abierto,
        // "alimentos" para decidir el giro siguiente = lo que el PARSER entiende por producto
        // (línea anclada a precio) O lo que el vocabulario de la nevera conocería — el giro de
        // reintentos se detiene a la primera cara que lee algo aprovechable.
        hayAlimentos: texto => {
          if (ticketParser && ticketParser.parsearTicket(texto).items.length > 0) return true;
          return ocr.extraerCandidatos(texto, ocrVocabulario).length > 0;
        },
        lienzoDe: grados => lienzoDeBitmap(bitmap, grados),
        reconocer: async (lienzo, grados) => {
          const girada = grados !== 0;
          if (progreso.isConnected) {
            progreso.textContent = girada
              ? "Reconociendo texto… (girando la foto para leerla boca arriba)"
              : "Reconociendo texto…";
          }
          const { data } = await worker.recognize(lienzo);
          return (data && data.text) || "";
        }
      });
    } finally {
      if (worker) await worker.terminate().catch(() => {});   // el núcleo liberado SIEMPRE (tb al cancelar)
    }
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
      ctx.modalContent.innerHTML = `
        <h2>📷 Reconociendo alimentos…</h2>
        <p class="muted" id="ocr-progreso">Cargando el motor de OCR (la primera vez descarga unos megas; la foto no sale de tu navegador)…</p>
        <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button></div>`;
      ctx.abrirModal("Escáner del ticket");
      ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
      const progreso = ctx.$("#ocr-progreso", ctx.modalContent);
      escanearFoto(archivo, progreso).catch(err => {
        if (ctx.modal.classList.contains("hidden")) return;   // cerrado por el usuario: nada que contar
        ctx.closeModal();
        ctx.toast((err && err.message) || "No se ha podido escanear la foto", "error");
      });
    });
  }

  // Del texto que el OCR ha leído se ocupa la MISMA función en producción y en pruebas: el motor
  // Tesseract es lo único que depende de la foto, así que `window.__mrcheffProcesarTextoOcr` queda
  // solo como inyección de test (§6, patrón __mrcheffEsMovil/__mrcheffCryptoImpl) — jsdom y Playwright
  // ejercitan el flujo del ticket sin cámara ni CDN.
  //
  // REQUISITO 95%: PRIMERO el PARSER ESTRUCTURAL del ticket (modules/ocr-ticket-parser.js) — lee
  // las líneas ancladas a los precios, recoge cantidades (columna Mercadona / auxiliares ALDI) y
  // convierte el granel a lotes de 500 g. Sepa o no la cadena, CADA ítem del ticket se presenta
  // para revisión: los conocidos del Inventario SUMAN en el 1er diálogo y todo lo demás va al
  // diálogo de revisión (nuevos/dudosos) — el vocabulario FOOD_TYPES ya NO decide qué se pierde.
  // Sólo cuando el parser no ve un ticket (p. ej. la foto de la nevera) decides por el camino de
  // siempre: extraerCandidatos sobre el vocabulario.
  function procesarTextoOcr(texto, textoCrudo) {
    const crudo = textoCrudo != null ? textoCrudo : texto;
    if (ticketParser) {
      const parseo = ticketParser.parsearTicket(texto);
      if (parseo.items.length) {
        abrirConfirmarOcr(candidatosDeTicket(parseo.items), crudo);
        return;
      }
    }
    const candidatos = ocr.extraerCandidatos(texto, ocrVocabulario);
    if (!candidatos.length) {
      ctx.modalContent.innerHTML = `
        <h2>📷 No he detectado alimentos</h2>
        <p class="muted">Prueba con una foto más cercana, de frente y con buena luz al papel (ticket
            del super). Las etiquetas con letra pequeña engañan al OCR.</p>
        ${detallesTextoCrudo(crudo)}
        <div class="modal-footer"><button class="btn ghost" data-close>Cerrar</button></div>`;
      ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
      return;
    }
    abrirConfirmarOcr(candidatos, crudo);
  }
  // Candidatos de los ítems del PARSEADOR ESTRUCTURAL (parser-first): el módulo clasificatorio
  // comparte helper con la demo del tutorial (la demo del escáner parsea SU ticket de prueba).
  function candidatosDeTicket(items) {
    return (Array.isArray(items) ? items : []).map(it => ({
      nombre: it.nombre,
      qty: it.qty,
      tipo: (window.MRCheff.classify && window.MRCheff.classify.classifyFood(it.nombre)) || null,
      hogar: !!categoria.esProductoHogar(it.nombre)
    }));
  }
  // El TEXTO RECONOCIDO queda a la vista (desplegable, muted): con él la persona ve qué leyó el
  // motor de verdad y corrige el nombre de cualquier fila con confianza — y diagnosticar un escaneo
  // flojo deja de ser adivinar (requisito 95%, fase de calibración).
  function detallesTextoCrudo(crudo) {
    if (!String(crudo || "").trim()) return "";
    return `<details class="ocr-crudo"><summary>Ver texto reconocido</summary><pre>${ctx.escapeHTML(String(crudo))}</pre></details>`;
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
    const lista = ctx.$("#food-list");
    if (!lista) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      desplazarSuaveHasta(lista);
      destellarDestino(lista);
    }));
  }

  function abrirConfirmarOcr(candidatos, textoCrudo, opciones) {
    const demoDeTutorial = !!(opciones && opciones.demo);   // DEMO del tutorial: NADA se escribe
    // La despensa que VEN las pantallas: la real, o la de juguete de la demo (la primera visita
    // nace vacía y el diálogo 1 de exactos necesita algo que casar; el flujo demo no toca nada).
    const despensaVista = (opciones && Array.isArray(opciones.foods)) ? opciones.foods : ctx.foods;
    const etqTipo = { proteina: "Proteína", lacteo: "Lácteo", cereal: "Cereal", fruta: "Fruta", verdura: "Verdura", especia: "Especia" };

    // Estado del flujo: la decisión de cada fila arranca del ticket — la cantidad es la leída (o
    // 1 si la línea no traía cifra) y el criterio de alerta por defecto es el del alta manual
    // (5/1). El reparto PREVIEW de diálogos corre sobre ESTOS mismos datos: el módulo filtra qty
    // no numérica al guardar, así que lo que se decide es lo que la persona verá en las filas.
    // PRODUCTOS DE HOGAR (etiqueta alimento/no-alimentario): no piden criterio — min 0 fijo
    // (avisar cuando se agote) y sus celdas de importancia/mínimo van deshabilitadas en la fila.
    const decision = candidatos.map(c => ({
      incluir: true,
      nombre: c.nombre,
      qty: Number.isFinite(c.qty) && c.qty >= 1 ? c.qty : 1,
      score: 5,
      min: c.hogar ? 0 : 1,
      varianteId: "",                                         // dudas: "" = "es nuevo", otro valor = id de despensa
      tipo: c.tipo || null,
      hogar: !!c.hogar
    }));
    const previo = ocr.guardarCandidatos(despensaVista, decision.map(d => ({ nombre: d.nombre, qty: d.qty, tipo: d.tipo, hogar: d.hogar })), {
      uid: ctx.uid, ahora: Date.now(),
      // La DUDA se decide con el MISMO casador de variantes del "🛒 Despensa?" de la lista:
      // "¿es el mismo que uno de mi despensa?" (menu-semanal.candidatosDespensa inyectada, §3).
      candidatosDespensa: ctx.menuSemanal && ctx.menuSemanal.candidatosDespensa ? ctx.menuSemanal.candidatosDespensa : null
    });
    const pasos = ocr.pasosDeConfirmacion(previo);
    if (!pasos.length) { ctx.closeModal(); return; }               // sin nada confirmable: nada que asistir
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
      const enCasa = despensaVista.find(f => String(f.name || "").toLowerCase() === String(c.nombre || "").toLowerCase());
      const etq = d.hogar ? "🏠 Producto de hogar" : (etqTipo[c.tipo] || "Otro");
      return `
        <div class="ocr-item" data-o="${o}">
          <div class="ocr-nombre">
            <span class="rev-nombre-fijo"><strong>${ctx.escapeHTML(c.nombre)}</strong><span class="ocr-tipo">${etq}</span></span>
            <span class="ocr-linea">Ya tienes ${Number.isFinite(enCasa && enCasa.qty) ? enCasa.qty : 0} en el inventario</span>
          </div>
          <label class="rev-celda rev-celda-qty"><span class="rev-etiqueta">Cantidad</span>
            <input type="number" class="exact-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${ctx.escapeHTML(c.nombre)}">
          </label>
          <label class="rev-celda rev-celda-include"><span class="rev-etiqueta">Incluir</span>
            <input type="checkbox" class="ocr-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${ctx.escapeHTML(c.nombre)}">
          </label>
        </div>`;
    }

    // ── Diálogo 2 (secciones NUEVOS y DUDAS): cada fila se define COMPLETA ahí mismo. En las
    // dudas, la variante de despensa va en un desplegable: resuelta con casa → su alerta no se
    // toca (los campos de importancia/mínimo se deshabilitan); resuelta como nueva → se define.
    function filaRevisionHTML(c, esDuda) {
      const o = candidatos.indexOf(c);
      const d = decision[o];
      const linea = ctx.escapeHTML(String(c.linea || "").trim().slice(0, 60));
      const lineaContexto = linea ? `<span class="ocr-linea" title="Primera línea que ha leído el OCR (sólo contexto)">“${linea}”${c.veces > 1 ? ` · aparece ×${c.veces}` : ""}</span>` : "";
      const etqNombre = d.hogar ? "Producto" : "Alimento";
      const etqFila = d.hogar ? "🏠 Producto de hogar" : (etqTipo[d.tipo] || "Otro");
      // PRODUCTO DE HOGAR: sin criterio de alerta pedido (petición del usuario) — sus celdas van
      // deshabilitadas con los valores fijos del alta (importancia 5 neutra / mínimo 0: avisa al
      // agotarse) y el módulo de alta ya sabe escribirlos con el tag `categoria: "hogar"`.
      const celdasCriterio = d.hogar
        ? `<label class="rev-celda rev-celda-score" title="Producto de hogar: no lleva importancia"><span class="rev-etiqueta">Importancia</span>
             <input type="number" id="rev-score-${o}" class="rev-num rev-campo-score" value="${d.score}" disabled aria-label="Producto de hogar, sin importancia">
           </label>
           <label class="rev-celda rev-celda-min" title="Producto de hogar: avisa cuando se agote"><span class="rev-etiqueta">Mínimo</span>
             <input type="number" id="rev-min-${o}" class="rev-num rev-campo-min" value="${d.min}" disabled aria-label="Producto de hogar, avisa cuando se agote">
           </label>`
        : `<label class="rev-celda rev-celda-score" for="rev-score-${o}"><span class="rev-etiqueta">Importancia</span>
             <input type="number" id="rev-score-${o}" class="rev-num rev-campo-score" min="1" max="10" step="1" value="${d.score}" aria-label="Importancia de ${ctx.escapeHTML(d.nombre)}, del 1 al 10">
           </label>
           <label class="rev-celda rev-celda-min" for="rev-min-${o}"><span class="rev-etiqueta">Mínimo</span>
             <input type="number" id="rev-min-${o}" class="rev-num rev-campo-min" min="0" step="1" value="${d.min}" aria-label="Cantidad mínima para avisarte de ${ctx.escapeHTML(d.nombre)}">
           </label>`;
      // CONMUTADOR 🍎/🏠 (petición 2026-10-22): para el producto que NACE en esta fila, la
      // etiqueta alimento/hogar la decide la persona — el autodiagnóstico del vocabulario sólo
      // PRESELECCIONA (los íconos son la misma voz del conmutador del alta manual).
      const celdaCategoria = `
        <div class="rev-celda rev-celda-cat" role="group" aria-label="¿Es alimento o producto de hogar?">
          <span class="rev-etiqueta">Tipo</span>
          <div class="food-cat-group">
            <button type="button" class="btn ghost small food-cat-btn rev-cat-btn" data-cat="alimento" aria-pressed="${d.hogar ? "false" : "true"}" aria-label="Alimento">🍎</button>
            <button type="button" class="btn ghost small food-cat-btn rev-cat-btn" data-cat="hogar" aria-pressed="${d.hogar ? "true" : "false"}" aria-label="Producto de hogar">🏠</button>
          </div>
        </div>`;
      if (!esDuda) {
        return `
        <div class="ocr-item rev-fila-nueva" data-o="${o}">
          <label class="rev-celda rev-celda-nombre" for="rev-nombre-${o}"><span class="rev-etiqueta">${etqNombre}</span>
            <input type="text" id="rev-nombre-${o}" class="rev-campo-nombre" value="${ctx.escapeHTML(d.nombre)}" aria-label="Nombre del alimento (editable)">
          </label>
          <div class="rev-sub"><span class="ocr-tipo">${etqFila}</span>${lineaContexto}</div>
          <label class="rev-celda rev-celda-qty" for="rev-qty-${o}"><span class="rev-etiqueta">Cantidad</span>
            <input type="number" id="rev-qty-${o}" class="rev-campo-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${ctx.escapeHTML(d.nombre)}">
          </label>
          ${celdasCriterio}
          ${celdaCategoria}
          <label class="rev-celda rev-celda-include"><span class="rev-etiqueta">Incluir</span>
            <input type="checkbox" class="ocr-include rev-campo-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${ctx.escapeHTML(d.nombre)}">
          </label>
        </div>`;
      }
      const variantes = ctx.menuSemanal.candidatosDespensa(c.nombre, despensaVista) || [];
      return `
        <div class="ocr-item rev-fila-duda" data-o="${o}">
          <label class="rev-celda rev-celda-nombre" for="rev-nombre-${o}"><span class="rev-etiqueta">${etqNombre}</span>
            <input type="text" id="rev-nombre-${o}" class="rev-campo-nombre" value="${ctx.escapeHTML(d.nombre)}" aria-label="Nombre del alimento (editable)">
          </label>
          <div class="rev-sub"><span class="ocr-tipo">${etqFila}</span>${lineaContexto}</div>
          <label class="rev-celda rev-celda-variante" for="rev-variante-${o}"><span class="rev-etiqueta">De tu despensa</span>
            <select id="rev-variante-${o}" class="rev-campo-variante" aria-label="¿Es este alimento que ya tienes en casa?">
              <option value="">es nuevo: se define aquí</option>
              ${variantes.map(v => `<option value="${ctx.escapeHTML(String(v.id))}">${ctx.escapeHTML(v.name)} · tienes ${Number.isFinite(v.qty) ? v.qty : 0}</option>`).join("")}
            </select>
          </label>
          <label class="rev-celda rev-celda-qty" for="rev-qty-${o}"><span class="rev-etiqueta">Cantidad</span>
            <input type="number" id="rev-qty-${o}" class="rev-campo-qty" min="0" step="1" value="${d.qty}" aria-label="Cantidad comprada de ${ctx.escapeHTML(d.nombre)}">
          </label>
          ${celdasCriterio}
          ${celdaCategoria}
          <label class="rev-celda rev-celda-include"><span class="rev-etiqueta">Incluir</span>
            <input type="checkbox" class="ocr-include rev-campo-include" ${d.incluir ? "checked" : ""} aria-label="Incluir ${ctx.escapeHTML(d.nombre)}">
          </label>
        </div>`;
    }

    // Resuelta "es ESE alimento de casa", la pantalla DEBE decir la verdad: los campos de la fila
    // pasan a mostrar LA ALERTA REAL del alimento elegido (su importancia y su mínimo) y se
    // deshabilitan — la alerta de un alimento ya vivido no se redefine desde el ticket; sólo la
    // CANTIDAD sigue siendo de la persona. Antes de resolver, los campos propios (por defecto
    // 5/1) salen y se editan; al volver a "es nuevo" se restauran los valores que hubiera
    // escrito (snapshot al primer cambio de variante). La máquina consulta la etiqueta EN VIVO
    // (d.hogar): si la persona conmuta la fila a hogar, el criterio vuelve al fijo 5/0 y el
    // conmutador compra/venta duerme junto a la despensa (su variante ya no decide nada).
    function conectaVariante(fila) {
      const selector = ctx.$("select", fila);
      if (!selector) return;
      const d = decision[Number(fila.dataset.o)];
      if (!d) return;
      const catBtns = ctx.$$(".rev-cat-btn", fila);
      const camposAlerta = [`#rev-score-${fila.dataset.o}`, `#rev-min-${fila.dataset.o}`].map(sel => ctx.$(sel, ctx.modalContent));
      let propio = null;                                    // lo suyo, para restaurar si deshace la variante
      const aplicaAlerta = () => {
        const enCasa = selector.value ? despensaVista.find(f => String(f.id) === selector.value) : null;
        catBtns.forEach(b => { b.disabled = !!enCasa; });   // resuelta con casa: la categoría ya no decide nada
        camposAlerta.forEach(campo => { if (campo) campo.disabled = !!enCasa || d.hogar; });
        if (enCasa) {
          if (!propio) propio = {
            score: camposAlerta[0] ? camposAlerta[0].value : "",
            min: camposAlerta[1] ? camposAlerta[1].value : ""
          };
          if (camposAlerta[0]) camposAlerta[0].value = Number.isFinite(enCasa.score) ? String(enCasa.score) : "5";
          if (camposAlerta[1]) camposAlerta[1].value = Number.isFinite(enCasa.min) ? String(enCasa.min) : "0";
        } else if (d.hogar) {
          if (camposAlerta[0]) camposAlerta[0].value = "5";    // hogar: criterio fijo (avisa al agotarse)
          if (camposAlerta[1]) camposAlerta[1].value = "0";
        } else if (propio) {
          if (camposAlerta[0] && propio.score !== "") camposAlerta[0].value = propio.score;
          if (camposAlerta[1] && propio.min !== "") camposAlerta[1].value = propio.min;
        }
      };
      aplicaAlerta();
      selector.addEventListener("change", aplicaAlerta);
    }

    // ── Conmutador 🍎/🏠 de las filas NUEVAS (petición 2026-10-22): el autodiagnóstico del
    // vocabulario manda SÓLO como preselección — la etiqueta del producto que nace aquí la
    // decide la persona. Al pasar a Hogar el criterio queda fijo (importancia 5 neutra /
    // mínimo 0: avisa al agotarse) deshabilitado y la fila se renombra ("Producto", tag 🏠);
    // al volver a Alimento se restauran los valores que hubiera escrito. Guardar lee d.hogar.
    function conectaCategoria(fila) {
      const grupo = ctx.$(".rev-celda-cat", fila);
      if (!grupo) return;                              // filas del diálogo 1: sin conmutador
      const d = decision[Number(fila.dataset.o)];
      if (!d) return;
      const btnAlimento = ctx.$(".rev-cat-btn[data-cat='alimento']", grupo);
      const btnHogar = ctx.$(".rev-cat-btn[data-cat='hogar']", grupo);
      if (!btnAlimento || !btnHogar) return;
      const camposAlerta = [`#rev-score-${fila.dataset.o}`, `#rev-min-${fila.dataset.o}`].map(sel => ctx.$(sel, ctx.modalContent));
      const etqNombre = ctx.$(".rev-celda-nombre .rev-etiqueta", fila);
      const etiquetaFila = ctx.$(".rev-sub .ocr-tipo", fila);
      const propio = {                                  // lo escrito, para restaurar si vuelve a Alimento
        score: camposAlerta[0] ? camposAlerta[0].value : "",
        min: camposAlerta[1] ? camposAlerta[1].value : ""
      };
      const pinta = hogar => {
        btnAlimento.setAttribute("aria-pressed", String(!hogar));
        btnHogar.setAttribute("aria-pressed", String(!!hogar));
        if (etqNombre) etqNombre.textContent = hogar ? "Producto" : "Alimento";
        if (etiquetaFila) etiquetaFila.textContent = hogar ? "🏠 Producto de hogar" : (etqTipo[d.tipo] || "Otro");
      };
      const setHogar = hogar => {
        if (hogar === d.hogar) return;
        if (camposAlerta[0]) { camposAlerta[0].value = hogar ? "5" : propio.score; camposAlerta[0].disabled = !!hogar; camposAlerta[0].title = hogar ? "Producto de hogar: no lleva importancia" : ""; }
        if (camposAlerta[1]) { camposAlerta[1].value = hogar ? "0" : propio.min; camposAlerta[1].disabled = !!hogar; camposAlerta[1].title = hogar ? "Producto de hogar: avisa cuando se agote" : ""; }
        d.hogar = hogar;
        pinta(hogar);
      };
      pinta(d.hogar);
      btnAlimento.addEventListener("click", () => setHogar(false));
      btnHogar.addEventListener("click", () => setHogar(true));
    }

    function renderDialogo() {
      const pasoNombre = pasos[faseActual];
      let cuerpo = "";
      if (pasoNombre === "despensa") {
        cuerpo = `
          <h2>🎫 ${pasos.length > 1 ? "1 de 2 · " : ""}Ya lo tienes en el inventario</h2>
          <p class="muted">Del ticket, estos ya estaban en tu Inventario actual. La cantidad es la que
              leí del ticket: ajústala si hace falta y confirma — la compra <strong>suma</strong> a lo
              que había: su IMPORTANCIA y su mínimo quedan como estaban y, con más de lo que hacía
              falta en casa, el alimento <strong>sale solo</strong> del aviso de repuestos de esta
              semana y de la lista de la compra.${demoDeTutorial ? " Para continuar, toca <strong>Confirmar y revisar el resto</strong>." : ""}</p>
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
                  entran en la despensa con esos datos. El conmutador TIPO decide si la compra es
                  comida (🍎) o un producto de 🏠 HOGAR (detergente, papel…): los de hogar no piden
                  criterio, avisan cuando se agoten.</p>
              <div class="rev-cab-nueva" aria-hidden="true">
                <span class="rev-col-alimento">Alimento</span>
                <span>Cantidad</span><span>Importancia</span>
                <span>Mínimo</span><span>Tipo</span><span>Incluir</span>
              </div>
              ${filasDelPaso("revisar").filter(c => previo.nuevos.some(n => nombreDePago(n) === nombreDePago(c))).map(c => filaRevisionHTML(c, false)).join("")}
            </div>`
          : "";
        const seccionDudas = previo.dudosos.length
          ? `<div class="rev-seccion">
              <h3>Dudas</h3>
              <p class="muted">¿Es la misma cosa que ya tienes con otro nombre? Elige de tu despensa el
                  alimento al que pertenece esta compra (se suma a él: su prioridad no se toca y, si
                  cubre lo que faltaba, sale igual del aviso de repuestos de esta semana y de la
                  lista de la compra) o quédate la opción "es nuevo" para darlo de alta con lo
                  escrito en la misma fila.</p>
              <div class="rev-cab-duda" aria-hidden="true">
                <span class="rev-col-alimento">Alimento</span>
                <span>De tu despensa</span>
                <span>Cantidad</span><span>Importancia</span>
                <span>Mínimo</span><span>Tipo</span><span>Incluir</span>
              </div>
              ${filasDelPaso("revisar").filter(c => previo.dudosos.some(n => nombreDePago(n) === nombreDePago(c))).map(c => filaRevisionHTML(c, true)).join("")}
            </div>`
          : "";
        cuerpo = `
          <h2>🎫 ${pasos.length > 1 ? "2 de 2 · " : ""}Añade lo nuevo y resuelve las dudas</h2>
          <p class="muted">Todo lo confirmado aquí acaba directamente en tu Inventario actual. Al subir lo que hay en casa, cuando ya tienes más de lo
              que hace falta el alimento <strong>sale solo</strong> del aviso de repuestos de esta
              semana y de la lista de la compra.${demoDeTutorial ? " Para continuar, toca <strong>Añadir a la despensa</strong>." : ""}</p>
          ${seccionNuevos}${seccionDudas}`;
      }
      const esFaseExactos = pasoNombre === "despensa";
      // Banner DEMO (paso del tutorial, 2026-10-22): en ambas pantallas se dice con claridad
      // que es un ejemplo — nada de lo confirmado aquí entra en el inventario.
      const bannerDemo = demoDeTutorial
        ? `<div class="ocr-demo-banner">🎓 <strong>Demo del tutorial</strong>: estos diálogos se muestran con datos de prueba para enseñarte el escáner — <strong>nada se guarda</strong> en tu inventario.</div>`
        : "";
      ctx.modalContent.innerHTML = `
        ${bannerDemo}
        ${cuerpo}
        ${detallesTextoCrudo(textoCrudo)}
        <div class="modal-footer">
          <button class="btn ghost" data-close>Cancelar</button>
          ${esFaseExactos
            ? `<button class="btn primary${demoDeTutorial ? " btn-demo-senal" : ""}" data-confirmar-exactos>${pasos.length === 2 ? "Confirmar y revisar el resto →" : "Añadir a la despensa"}</button>`
            : `<button class="btn primary${demoDeTutorial ? " btn-demo-senal" : ""}" data-revision-guardar>Añadir a la despensa</button>`}
        </div>`;
      ctx.abrirModal(esFaseExactos ? "Confirmar la compra de los alimentos ya en casa" : "Añade lo nuevo y resuelve las dudas de la foto");
      const primero = esFaseExactos ? ctx.$(".exact-qty", ctx.modalContent) : (ctx.$(".ocr-nombre input, .rev-campo-nombre", ctx.modalContent));
      if (primero) primero.select();
      ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
      ctx.$$(".ocr-item", ctx.modalContent).forEach(fila => { conectaVariante(fila); conectaCategoria(fila); });
      const botonExactos = ctx.$("[data-confirmar-exactos]", ctx.modalContent);
      if (botonExactos) botonExactos.addEventListener("click", confirmarExactos);
      const botonRevision = ctx.$("[data-revision-guardar]", ctx.modalContent);
      if (botonRevision) botonRevision.addEventListener("click", confirmarRevision);
    }

    function confirmarExactos() {
      // Cosecha del diálogo 1: nombres fijos, sólo viajan cantidad e incluir.
      ctx.$$(".ocr-item", ctx.modalContent).forEach(fila => {
        const d = decision[Number(fila.dataset.o)];
        d.incluir = ctx.$(".ocr-include", fila).checked;
        const qty = parseInt(ctx.$(".exact-qty", fila).value, 10);
        if (Number.isFinite(qty) && qty >= 0) d.qty = qty;      // cantidad rara → se queda la del ticket
      });
      // SÓLO las filas de ESTE diálogo (los exactos): el resto se resuelve en la revisión.
      const seleccion = ctx.$$(".ocr-item", ctx.modalContent)
        .map(fila => decision[Number(fila.dataset.o)])
        .filter(d => d.incluir)
        .map(d => ({ nombre: d.nombre, qty: d.qty, tipo: d.tipo, hogar: d.hogar }));
      if (!seleccion.length) { ctx.toast("No hay alimentos marcados para guardar", "error"); return; }
      if (demoDeTutorial) {
        // DEMO: la confirmación del diálogo 1 NO toca la despensa — sólo conduce a la revisión.
        if (pasos.length === 2) { faseActual = 1; renderDialogo(); } else cerrarDemoEscaner();
        return;
      }
      const result = ocr.guardarCandidatos(ctx.foods, seleccion, { uid: ctx.uid, ahora: Date.now(), candidatosDespensa: null });
      ctx.foods = result.foods;
      ctx.save(ctx.LS.foods, ctx.foods);
      ctx.renderFoods();
      ctx.renderWeeklyAlert();
      ctx.renderShoppingListTrasDespensa();
      if (pasos.length === 2) {
        faseActual = 1;                         // confirmados los exactos: ahora sí, la revisión
        renderDialogo();
      } else {
        ctx.closeModal();
        señalarResultadoEnDespensa();
      }
    }

    function confirmarRevision() {
      // Cosecha del diálogo 2: nombre/cantidad/importancia/mínimo/variante — con variante elegida
      // esos campos no mandan (la alerta es la del alimento ya en casa) y el módulo los ignora.
      // La etiqueta se cosecha del CONMUTADOR (el estado en vivo del diálogo es la verdad, no la
      // preselección del autodiagnóstico con la que nació la fila).
      ctx.$$(".ocr-item", ctx.modalContent).forEach(fila => {
        const o = Number(fila.dataset.o);
        const d = decision[o];
        d.incluir = ctx.$(".ocr-include", fila).checked;
        if (!d.incluir) return;
        const catHogar = ctx.$(".rev-cat-btn[data-cat='hogar']", fila);
        if (catHogar) d.hogar = catHogar.getAttribute("aria-pressed") === "true";
        d.nombre = ctx.$("#rev-nombre-" + o, fila).value.trim();
        const qty = parseInt(ctx.$("#rev-qty-" + o, fila).value, 10);
        if (Number.isFinite(qty) && qty >= 0) d.qty = qty;
        const score = parseInt(ctx.$("#rev-score-" + o, fila).value, 10);
        if (Number.isFinite(score) && score >= 1 && score <= 10) d.score = score;
        const min = parseInt(ctx.$("#rev-min-" + o, fila).value, 10);
        if (Number.isFinite(min) && min >= 0) d.min = min;
        const variante = ctx.$("#rev-variante-" + o, fila);
        if (variante) d.varianteId = variante.value;
      });
      // SÓLO las filas de ESTE diálogo de revisión: los exactos ya sumaron en el diálogo 1 y NO
      // vuelven a escribirse aquí (si se colasen, la compra iría doble — lo cazó el sondeo e2e).
      const osDeRevision = new Set(ctx.$$(".ocr-item", ctx.modalContent).map(fila => Number(fila.dataset.o)));
      let mensajeError = "";
      decision.forEach((d, o) => {
        if (!osDeRevision.has(o) || !d.incluir || mensajeError) return;
        if (!d.varianteId && !d.nombre) { mensajeError = "Hay un alimento sin nombre: escribe uno o desmarca su casilla."; return; }
      });
      if (mensajeError) { ctx.toast(mensajeError, "error"); return; }
      // El destino lo decidió la persona fila a fila: con variante la compra entra ESE id; sin
      // ella es alta (el módulo evita duplicados casando nombre exacto con lo ya en casa).
      const conVariante = [], deAltaDirecta = [];
      decision.forEach((d, o) => {
        if (!osDeRevision.has(o) || !d.incluir) return;
        const fila = { nombre: d.nombre, qty: d.qty, score: d.score, min: d.min, hogar: d.hogar };
        if (d.varianteId) { fila.varianteId = d.varianteId; conVariante.push(fila); }
        else deAltaDirecta.push(fila);
      });
      if (!conVariante.length && !deAltaDirecta.length) { ctx.toast("No hay alimentos marcados para guardar", "error"); return; }
      if (demoDeTutorial) {
        // DEMO: la revisión tampoco escribe — se cierra y el paso del tutorial sigue su curso.
        cerrarDemoEscaner();
        return;
      }
      const resultado = ocr.confirmarRevision(ctx.foods, deAltaDirecta, conVariante, { uid: ctx.uid, ahora: Date.now() });
      ctx.foods = resultado.foods;
      ctx.save(ctx.LS.foods, ctx.foods);
      ctx.renderFoods();
      ctx.renderWeeklyAlert();
      ctx.renderShoppingListTrasDespensa();
      ctx.closeModal();
      señalarResultadoEnDespensa();
    }

    renderDialogo();
  }

  // ── DEMO DEL ESCÁNER EN EL TUTORIAL (feature 2026-10-22, petición del usuario: "con los
  // diálogos y con datos de prueba, estos datos NO se añaden al inventario en el modo
  // tutorial, es sólo explicativo"). El paso del guion lanza los DOS diálogos reales del
  // escáner sobre una despensa de juguete (opciones.foods) y NADA se escribe: las dos
  // confirmaciones sólo conducen el flujo visual y el cierre (confirmar, Cancelar, ✕ o
  // Escape) devuelve el paso al tutorial vía cerrarDemoEscaner.
  ctx.demoEscanerAbierta = false;   // bandera viva: la cierra cualquier vía de closeModal (la vista Recetas la consulta por ctx)

  function lanzarDemoEscaner() {
    const demo = ocr.datosDemoEscaner ? ocr.datosDemoEscaner() : null;
    if (!demo || !demo.despensa) return;
    const parseo = ticketParser ? ticketParser.parsearTicket(demo.texto) : { items: [] };
    const candidatos = parseo.items.length
      ? candidatosDeTicket(parseo.items)
      : ocr.extraerCandidatos(demo.texto, ocrVocabulario);   // red de seguridad: el ticket demo parsea seguro
    if (!candidatos.length) return;
    ctx.demoEscanerAbierta = true;
    abrirConfirmarOcr(candidatos, demo.texto, { demo: true, foods: demo.despensa });
  }

  function cerrarDemoEscaner() {
    ctx.closeModal();                            // la demo acaba SIEMPRE cerrando el diálogo
  }


  };
})();

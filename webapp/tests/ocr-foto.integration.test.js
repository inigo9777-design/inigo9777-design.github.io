// tests/ocr-foto.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS §6) para la INFRA de
// vista del escáner del ticket: el fichero ELEGIDO (input #ocr-file) pasa por la preparación
// (HEIC del iPhone → JPEG con el conversor inyectado) y por el REINTENTO DE GIRO cuando la foto
// de frente no lee nada reconocible. Tesseract y el wasm de heic2any son stubs; lo que se prueba
// es la MÁQUINA de la vista — qué formato recibe el motor, cuántas caras, con qué lienzo — no la
// DECISIÓN del texto (candidatos → despensa/pendientes: tests/ocr-ticket.integration.test.js).
// Las fotos REALES (HEIC, y el ".png" camuflado de HEIF, giradas 90°) las agarra el e2e Brave con
// el motor de verdad: e2e/ocr-tickets-reales.mjs.

const { bootApp } = require("./boot");

function appEnEscena() {
  const app = bootApp({
    seed: {
      foods: [
        { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 }
      ],
      recipes: [], innov: [], cooked: []
    }
  });
  // Canvas de TEST: jsdom no trae contexto 2d (exige node-canvas). La vista sólo usa el contexto para
  // trasladar/escalar/girar/dibujar — un sustituto mínimo basta (la "resolución" la inventa el bitmap).
  app.window.HTMLCanvasElement.prototype.getContext = function contextoDeTest() {
    return { translate() {}, scale() {}, rotate() {}, drawImage() {}, fillRect() {} };
  };
  return app;
}

// Bitmap de TEST: "decodifica" sólo los ficheros marcados decodables — los HEIC reales (y los
// camuflados) hacen fallar al decodificador de Chromium; aquí lo simulamos con el flag.
function polyfillBitmap(window) {
  window.createImageBitmap = blob => {
    if (blob && blob.decodable === false) return Promise.reject(new TypeError("image decode failed"));
    return Promise.resolve({ width: 4032, height: 3024 });
  };
}

function soltarArchivo(input, archivo) {
  Object.defineProperty(input, "files", { value: { 0: archivo, length: 1 }, configurable: true });
  input.dispatchEvent(new input.ownerDocument.defaultView.Event("change", { bubbles: true }));
}

async function pulso(window, veces = 8) {
  for (let i = 0; i < veces; i++) await new Promise(r => window.setTimeout(r, 0));
}

// Motor de TEST: cada llamada del OCR consume un texto de la cola (el último se repite).
// API del WORKER (la que usa la app desde 2026-10-22): createWorker("spa", 1, {logger}) reutilizado
// una sola vez para todas las caras + setParameters + terminate al final.
function motorDeTest(window, textos) {
  const llamadas = [];
  window.Tesseract = {
    createWorker: (idioma, _oem, opts) => {
      const worker = {
        setParameters: () => Promise.resolve(),
        recognize: lienzo => {
          llamadas.push(lienzo);
          const texto = textos[Math.min(llamadas.length - 1, textos.length - 1)];
          return Promise.resolve({ data: { text: texto } });
        },
        terminate: () => Promise.resolve()
      };
      return Promise.resolve(worker);
    }
  };
  return llamadas;
}

// Conversor de TEST (gancho §6 `window.__mrcheffHeicConvertir`): anota lo recibido y devuelve el
// JPEG fijo (por defecto decodable — el producción es un Blob JPEG que sí decodifica).
function conversorDeTest(window, resuelto = null) {
  const conversiones = [];
  window.__mrcheffHeicConvertir = entrada => {
    conversiones.push(entrada);
    if (resuelto) return Promise.resolve(resuelto);
    const jpeg = new window.File(["jpeg"], "convertida.jpg", { type: "image/jpeg" });
    jpeg.decodable = true;
    return Promise.resolve(jpeg);
  };
  return conversiones;
}

describe("Escáner del ticket — la foto ante el motor (integración de vista)", () => {
  test("el hook de conversión está disponible en el window de la app", () => {
    const app = appEnEscena();
    polyfillBitmap(app.window);
    expect(app.window.createImageBitmap).toBeInstanceOf(Function);
  });

  test("foto HEIC del iPhone (por MIME): se CONVIERTE a JPEG y el OCR lee el resultado, una sola pasada", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    const conversiones = conversorDeTest(window);
    const llamadas = motorDeTest(window, ["3 Leche entera\nTOTAL 4,20 €"]);

    const heic = new window.File(["heic"], "IMG_4123.heic", { type: "image/heic" });
    soltarArchivo(document.getElementById("ocr-file"), heic);
    await pulso(window);

    // la conversión recibió el fichero ORIGINAL completo y pidió JPEG del todo
    expect(conversiones).toHaveLength(1);
    expect(conversiones[0].blob).toBe(heic);
    expect(conversiones[0].toType).toBe("image/jpeg");
    expect(conversiones[0].quality).toBe(0.95);
    // el motor leyó UNA vez (candidatos a la primera) y no el fichero bruto: el lienzo convertido
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].tagName).toBe("CANVAS");
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBeGreaterThan(0);
    expect(document.getElementById("rev-qty-0").value).toBe("3");   // la fila nueva abre con la cifra del ticket
    expect(app.jsdomErrors).toHaveLength(0);
  });

  test("HEIC camuflado de «.png»: el decodificador lo rechaza y va igualmente por la conversión", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    const conversiones = conversorDeTest(window);
    const llamadas = motorDeTest(window, ["2 x Yogur"]);

    const camuflado = new window.File(["heif"], "ticket.png", { type: "image/png" });
    camuflado.decodable = false;                       // bytes HEIF con EXTENSIÓN mentirosa (caso real del e2e)
    soltarArchivo(document.getElementById("ocr-file"), camuflado);
    await pulso(window);

    expect(conversiones).toHaveLength(1);              // ni nombre ni MIME delatan: lo pilla el probe
    expect(conversiones[0].blob).toBe(camuflado);
    expect(llamadas).toHaveLength(1);
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBeGreaterThan(0);
    expect(app.jsdomErrors).toHaveLength(0);
  });

  test("JPG normal: SIN conversión, decodifica directo y UNA sola pasada del OCR", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    const conversiones = conversorDeTest(window);
    const llamadas = motorDeTest(window, ["1 Pan\nTOTAL 1,25 €"]);

    const jpg = new window.File(["jpg"], "nevera.jpg", { type: "image/jpeg" });
    jpg.decodable = true;
    soltarArchivo(document.getElementById("ocr-file"), jpg);
    await pulso(window);

    expect(conversiones).toHaveLength(0);              // una foto de toda la vida no paga conversión
    expect(llamadas).toHaveLength(1);
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBeGreaterThan(0);
    expect(app.jsdomErrors).toHaveLength(0);
  });

  test("ticket de lado: REINTENTA girada 90° y a la segunda cara lee; los lienzos están intercambiados", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    const conversiones = conversorDeTest(window);
    const llamadas = motorDeTest(window, [
      "ALDI\n0,680 kg x 13,99 €/kg\n9,51 €\nTOTAL 84,52 €",   // cara de frente: nada del vocabulario
      "2 LECHE FRESCA ENTERA\nTOTAL 4,20 €"                    // girada 90°: sí
    ]);

    const foto = new window.File(["jpg"], "ticket-lado.jpg", { type: "image/jpeg" });
    foto.decodable = true;
    soltarArchivo(document.getElementById("ocr-file"), foto);
    await pulso(window);

    // 2 pasadas del motor (0° falló, 90° leyó) — y SIN conversión nunca
    expect(llamadas).toHaveLength(2);
    expect(conversiones).toHaveLength(0);
    expect(llamadas[0].tagName).toBe("CANVAS");
    expect(llamadas[1].tagName).toBe("CANVAS");
    // el lienzo del giro tiene los lados intercambiados (4×3 → 3×4)
    expect(llamadas[1].width).toBe(llamadas[0].height);
    expect(llamadas[1].height).toBe(llamadas[0].width);
    // por fin la confirmación con los candidatos de la cara buena
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBeGreaterThan(0);
    expect(document.getElementById("rev-qty-0").value).toBe("2");   // la fila nueva abre con la cifra del ticket
    expect(app.jsdomErrors).toHaveLength(0);
  });

  test("agotadas las tres caras sin reconocer nada → el aviso clásico «No he detectado alimentos»", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    conversorDeTest(window);
    const llamadas = motorDeTest(window, [""]);

    const foto = new window.File(["jpg"], "vacia.jpg", { type: "image/jpeg" });
    foto.decodable = true;
    soltarArchivo(document.getElementById("ocr-file"), foto);
    await pulso(window, 15);

    expect(llamadas).toHaveLength(3);                  // 0°, 90° y 270°
    expect(document.querySelector(".modal-content h2").textContent).toContain("No he detectado alimentos");
    expect(app.jsdomErrors).toHaveLength(0);
  });

  test("el usuario CANCELA mientras escaneaba: la cara buena no procesa texto a posteriori", async () => {
    const app = appEnEscena();
    const { window, document } = app;
    polyfillBitmap(window);
    // conversión que TARDA de verdad (120ms de reloj): da tiempo a cerrar el modal antes de que vuelva
    const conversiones = conversorDeTest(window, new Promise(resolve => window.setTimeout(resolve, 120)));
    const llamadas = motorDeTest(window, ["3 Leche entera"]);

    const heic = new window.File(["heic"], "IMG_1.heic", { type: "image/heic" });
    soltarArchivo(document.getElementById("ocr-file"), heic);
    await pulso(window, 2);
    const cerrar = [...document.querySelectorAll(".modal-content [data-close]")][0];
    cerrar.click();                                    // fuera mientras aún convierte
    await new Promise(r => window.setTimeout(r, 200)); // nuestra la conversión vencida (y su cola de microtareas)
    await pulso(window, 10);

    expect(conversiones).toHaveLength(1);              // la conversión sí arrancó...
    expect(llamadas).toHaveLength(0);                  // ...pero el motor nunca llegó a leer: nada que contar
    expect(app.jsdomErrors).toHaveLength(0);
  });
});

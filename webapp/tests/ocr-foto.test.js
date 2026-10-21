// tests/ocr-foto.test.js — Spec del módulo puro de la MÁQUINA DE LA FOTO del escáner del ticket
// (#epic-ocr-despensa-camara, refactor a módulo per §3/§5 CODING_STANDARDS). Las DECISIONES sobre el
// fichero elegido viven aquí: si la foto necesita conversión HEIC, la geometría del giro por cara y
// el ciclo de caras (de frente → girada 90° → girada 270°) hasta que una lee alimentos. La I/O real
// (createImageBitmap, heic2any, lienzos, Tesseract) la inyecta la vista — aquí todo son stubs.
const ocrFoto = require("../modules/ocr-foto.js");

const jpegDePrueba = opts => Object.assign({ name: "foto.jpg", type: "image/jpeg", decodable: true }, opts);
const decodificarOk = () => Promise.resolve({ width: 4032, height: 3024 });
const decodificarMala = () => Promise.reject(new TypeError("image decode failed"));

describe("ocr-foto — prepararFoto (¿esta foto necesita conversión HEIC?)", () => {
  test("HEIC declara conversión DIRECTA: ni siquiera contesta el decodificador", async () => {
    let sondajes = 0;
    const r = await ocrFoto.prepararFoto(jpegDePrueba({ name: "IMG_4123.heic" }), {
      esHeic: f => f.name.endsWith(".heic"),
      decodificar: () => { sondajes++; return decodificarOk(); },
      convertir: async f => ({ jpeg: true, de: f.name })
    });
    expect(r.foto).toEqual({ jpeg: true, de: "IMG_4123.heic" });
    expect(r.convertido).toBe(true);
    expect(sondajes).toBe(0);
  });

  test("foto normal: pasa SIN conversión (el sondeo decodifica bien)", async () => {
    let conversiones = 0;
    const archivo = jpegDePrueba();
    const r = await ocrFoto.prepararFoto(archivo, {
      esHeic: () => false,
      decodificar: decodificarOk,
      convertir: () => { conversiones++; return Promise.resolve("no"); }
    });
    expect(r.foto).toBe(archivo);
    expect(r.convertido).toBe(false);
    expect(conversiones).toBe(0);
  });

  test("el decodificador la RECHAZA (HEIC camuflado de .png) → igualmente va al conversor", async () => {
    const r = await ocrFoto.prepararFoto(jpegDePrueba({ name: "ticket.png", decodable: false }), {
      esHeic: () => false,                       // ni nombre ni MIME delatan: por eso el sondeo es imprescindible
      decodificar: decodificarMala,
      convertir: async f => ({ jpeg: true, de: f.name })
    });
    expect(r.foto).toEqual({ jpeg: true, de: "ticket.png" });
    expect(r.convertido).toBe(true);
  });

  test("sin decodificador real (la vista pasa null, p. ej. jsdom) → pasaporte SIN conversión", async () => {
    const archivo = jpegDePrueba();
    let conversiones = 0;
    const r = await ocrFoto.prepararFoto(archivo, {
      esHeic: () => false,
      decodificar: null,
      convertir: () => { conversiones++; return Promise.resolve("no"); }
    });
    expect(r.foto).toBe(archivo);
    expect(r.convertido).toBe(false);
    expect(conversiones).toBe(0);
  });

  test("ctx ausente o sin nada → pasaporte sin morir (contrato laxo POR la vista)", async () => {
    const archivo = jpegDePrueba();
    const r1 = await ocrFoto.prepararFoto(archivo, {});
    expect(r1.foto).toBe(archivo);
    const r2 = await ocrFoto.prepararFoto(archivo, null);
    expect(r2.foto).toBe(archivo);
    expect(r2.convertido).toBe(false);
  });
});

describe("ocr-foto — geometriaDeLienzo (medidas del canvas por cara)", () => {
  const bitmapGrande = { width: 4032, height: 3024 };     // foto del iPhone

  test("cara de frente: lados intactos, escalados a máx 1600 por el lado mayor", () => {
    const geo = ocrFoto.geometriaDeLienzo(bitmapGrande, 0);
    expect(geo).toEqual({ ancho: 1600, alto: 1200, escala: 1600 / 4032 });
  });

  test("cara girada 90°/270°: lados INTERCAMBIADOS (el papel de lado se lee a ancho/alto trocados)", () => {
    for (const grados of [90, 270]) {
      const geo = ocrFoto.geometriaDeLienzo(bitmapGrande, grados);
      expect(geo.ancho).toBe(1200);
      expect(geo.alto).toBe(1600);
    }
  });

  test("foto pequeña: escala 1 (nada que encoger) y los lados quedan como están", () => {
    expect(ocrFoto.geometriaDeLienzo({ width: 800, height: 600 }, 0)).toEqual({ ancho: 800, alto: 600, escala: 1 });
    expect(ocrFoto.geometriaDeLienzo({ width: 800, height: 600 }, 90)).toEqual({ ancho: 600, alto: 800, escala: 1 });
  });

  test("sin dimensiones (o bitmap vacío) → null (la máquina degrada sin morir)", () => {
    expect(ocrFoto.geometriaDeLienzo({}, 0)).toBeNull();
    expect(ocrFoto.geometriaDeLienzo({ width: 0, height: 0 }, 0)).toBeNull();
    expect(ocrFoto.geometriaDeLienzo(null, 0)).toBeNull();
  });
});

describe("ocr-foto — escanearCaras (el ciclo de frente → 90° → 270°)", () => {
  const maquina = (textos, opt = {}) => {
    const pasadas = [];
    return {
      pasadas,
      ctx: Object.assign({
        abierta: () => true,
        lienzoDe: grados => ({ grados }),
        reconocer: async (lienzo, grados) => {
          pasadas.push(grados);
          const texto = textos[Math.min(pasadas.length - 1, textos.length - 1)];
          return texto;
        },
        hayAlimentos: texto => /leche/i.test(texto)
      }, opt)
    };
  };

  test("la cara de frente YA lee: una única pasada, y la cara 0", async () => {
    const m = maquina(["2 Leche entera\nTOTAL 4,20 €"]);
    const r = await ocrFoto.escanearCaras(m.ctx);
    expect(r).toEqual({ texto: "2 Leche entera\nTOTAL 4,20 €", caras: 1 });
    expect(m.pasadas).toEqual([0]);                 // frente, nada de giros: el caso normal no paga nada
  });

  test("el ticket de lado: frente vacía → gira 90° y lee (dos pasadas, corte a la primera con alimentos)", async () => {
    const m = maquina([
      "ALDI\n0,680 kg x 13,99 €/kg\n9,51 €\nTOTAL 84,52 €",
      "2 LECHE FRESCA ENTERA\nTOTAL 4,20 €"
    ]);
    const r = await ocrFoto.escanearCaras(m.ctx);
    expect(r).toEqual({ texto: "2 LECHE FRESCA ENTERA\nTOTAL 4,20 €", caras: 2 });
    expect(m.pasadas).toEqual([0, 90]);
  });

  test("nada reconocible en ninguna cara: 3 pasadas y texto vacío (el aviso clásico decide la vista)", async () => {
    const m = maquina([""]);
    const r = await ocrFoto.escanearCaras(m.ctx);
    expect(r).toEqual({ texto: "", caras: 3 });
    expect(m.pasadas).toEqual([0, 90, 270]);
  });

  test("cerraron el modal ANTES de empezar: cero pasadas y texto null (nada se procesa)", async () => {
    const m = maquina(["2 Leche"], { abierta: () => false });
    const r = await ocrFoto.escanearCaras(m.ctx);
    expect(r).toEqual({ texto: null, caras: 0 });
    expect(m.pasadas).toEqual([]);
  });

  test("cerraron el modal MIENTRAS la pasada reconocía: texto null igualmente (no entra texto a un modal muerto)", async () => {
    let abierta = true;
    const pasadas = [];
    const ctx = {
      abierta: () => abierta,
      lienzoDe: grados => ({ grados }),
      reconocer: async (lienzo, grados) => {
        pasadas.push(grados);
        abierta = false;                            // el usuario cierra justo durante el reconocimiento
        return "";
      },
      hayAlimentos: texto => /Leche/.test(texto)
    };
    const r = await ocrFoto.escanearCaras(ctx);
    expect(r.texto).toBeNull();
    expect(pasadas).toEqual([0]);                   // cortó tras la 1ª: no gira para nadie
  });

  test("una cara sin lienzo REAL (el contexto de test no pinta) corta el ciclo con texto vacío", async () => {
    const pasadas = [];
    const ctx = {
      abierta: () => true,
      lienzoDe: grados => (grados === 0 ? { grados } : null),   // a 90° nada que pintar
      reconocer: async () => { pasadas.push(1); return ""; },
      hayAlimentos: () => false
    };
    const r = await ocrFoto.escanearCaras(ctx);
    expect(r.texto).toBe("");
    expect(pasadas.length).toBe(1);
  });

  test("hayAlimentos/abierta sin inyectar: contratos por defecto (candidatos siempre sí, modal siempre abierto)", async () => {
    const pasadas = [];
    const ctx = {
      lienzoDe: grados => ({ grados }),
      reconocer: async (lienzo, grados) => { pasadas.push(grados); return "texto"; }
    };
    const r = await ocrFoto.escanearCaras(ctx);
    expect(r).toEqual({ texto: "texto", caras: 1 });
    expect(pasadas).toEqual([0]);
  });

  test("reconocer que devuelve null/undefined (motor roto) se degrada a cadena vacía, no pesta dentro", async () => {
    const ctx = {
      abierta: () => true,
      lienzoDe: grados => ({ grados }),
      reconocer: async () => null,
      hayAlimentos: () => false
    };
    const r = await ocrFoto.escanearCaras(ctx);
    expect(r).toEqual({ texto: "", caras: 3 });
  });
});

describe("ocr-foto — el contrato del ciclo (CARAS y techo de resolución)", () => {
  test("CARAS: de frente, girada 90° y girada 270° — ni 180 (vuelta ridícula) ni giros de más", () => {
    expect(ocrFoto.CARAS).toEqual([0, 90, 270]);
  });

  test("LADO_MAX = 1600px (el techo del lienzo, el mismo que aplicaba la vista antes del módulo)", () => {
    expect(ocrFoto.LADO_MAX).toBe(1600);
  });
});

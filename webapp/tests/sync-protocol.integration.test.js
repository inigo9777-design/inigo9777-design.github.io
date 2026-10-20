// tests/sync-protocol.integration.test.js — CAPA 2 (integración §6 CODING_STANDARDS.md), FASE 3 del plan-sync-buzon.md.
// Dos DISPOSITIVOS simulados con `fetcher` fake CONTRA UN "gist" EN MEMORIA: correo completo offer → ack → vaciar,
// ramas de la máquina (nada / pendiente / passphrase errónea / red caída / idempotencia) y reciprocidad
// (A y B llegan AL MISMO estado final). Los stubs e2e/*.spec.js del repo NO los ejecuta Jest (roots de jest.config.js):
// este spec pero se registra SIN jsdom vía require() directo — igual que backup.test.js.
//
// La fusion injectada aquí es una UNION determinista por id (el diff3 REAL es la FASE 4): basta para probar
// el PROTOCOLO (qué escribe cada dispositivo, cuándo vacía y cómo converge), no la calidad del merge.

const sync = require("../modules/sync");
const cripto = require("../modules/sync-crypto");
const WEB_CRYPTO = require("crypto").webcrypto;    // WebCrypto CRUDO: en jsdom el global NO trae .subtle

const NOMBRE = "mrcheff-sync.json";

// ---------- "gist" EN MEMORIA + fetcher fake ----------
function gistEnMemoria() {
  return { contenido: null, redViva: true, peticiones: [], falloPatch: false };
}
function fetcherDe(gist) {
  return async (url, init) => {
    if (!gist.redViva) throw new Error("Network unavailable");
    gist.peticiones.push({ metodo: (init && init.method) || "GET" });
    if (init && init.method === "PATCH") {
      gist.contadorPatch = (gist.contadorPatch || 0) + 1;
      if (gist.falloPatch || (gist.falloPatchNumero && gist.contadorPatch === gist.falloPatchNumero))
        throw new Error("Network unavailable (PATCH)");
      gist.contenido = JSON.parse(JSON.parse(init.body).files[NOMBRE].content);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return {
      ok: true, status: 200,
      json: async () => gist.contenido == null
        ? ({ files: {} })
        : ({ files: { [NOMBRE]: {
              content: typeof gist.contenido === "string" ? gist.contenido : JSON.stringify(gist.contenido) } } })
    };
  };
}

// ---------- dispositivo simulado: almacén en memoria + snapshot mutable de recetas ----------
function dispositivo(gist, { id, pass, recetasIniciales = [], uidSeq = ["n-1", "n-2", "n-3", "n-4", "n-5", "n-6"] }) {
  const memoria = new Map();          // base / pendiente / consumida
  const almacen = {
    leer: k => (memoria.has(k) ? memoria.get(k) : null),
    escribir: (k, v) => memoria.set(k, typeof v === "object" && v !== null ? JSON.parse(JSON.stringify(v)) : v),
    guardarLocal: estado => { local.recetas = estado.recetas; }
  };
  let indiceUid = 0;
  const ctx = {
    deviceId: id,
    dispositivo: id,
    token: "token-simbólico-de-prueba",
    gistId: "gist123",
    passphrase: pass,
    iteraciones: 1000,                       // iteraciones BAJAS por velocidad de test (los parámetros viajan en el header, así que son libres)
    uid: () => uidSeq[Math.min(indiceUid++, uidSeq.length - 1)],
    ahora: () => "2026-10-19T10:00:00.000Z",
    fetcher: fetcherDe(gist),
    crypto: cripto,
    cryptoImpl: WEB_CRYPTO,                   // passthrough del proveedor crudo (jsdom: el global no trae subtle)
    snapshotLocal: () => ({ recetas: local.recetas }),
    fusionar: unionPorId,
    almacen
  };
  const local = { recetas: recetasIniciales };
  return { ctx, local };
}

// Comparación INVARIANTE AL ORDEN de arrays de recetas (la union del fixture no garantiza orden de inserción):
const ordenadasPorId = arr => [...arr].sort((x, y) => (x.id < y.id ? -1 : 1));
function recetasEsperadas(...recetas) {
  return ordenadasPorId(recetas);
}

// Fusión de test: union determinista por receta-id (el diff3 real se testea en la FASE 4).
function unionPorId(base, mio, suyo) {
  const porId = new Map();
  [base, mio, suyo].forEach(f => ((f && f.recetas) || []).forEach(r => porId.set(r.id, { id: r.id, title: r.title })));
  return { estado: { recetas: Array.from(porId.values()) }, conflictos: [] };
}

const REC_A = { id: "receta-A", title: "Tortilla de patatas" };
const REC_B = { id: "receta-B", title: "Lentejas con verduras" };
const REC_C = { id: "receta-C", title: "Salmorejo" };

describe("sync-protocol — máquina de estados del buzón (FASE 3)", () => {
  it("CICLO COMPLETO: offer (A) → ack (B) → absorción con vaciado de A, y el buzón acaba en kind empty SIN estado", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-compartida", recetasIniciales: [REC_A] });
    const B = dispositivo(gist, { id: "pc", pass: "clave-compartida", recetasIniciales: [REC_B] });

    // 1) A publica (buzón vacío + cambios pendientes → OFFER)
    const paso1 = await sync.ejecutar(A.ctx);
    expect(paso1.rama).toBe("publicado");
    expect(paso1.mensaje).toContain("Cambios publicados");
    expect(gist.contenido.kind).toBe("offer");
    expect(gist.contenido.deviceId).toBe("movil");
    const nonceOffer = gist.contenido.nonce;
    expect(A.ctx.almacen.leer("pendiente")).toBe(nonceOffer);   // la offer queda marcada como pendiente de recolección

    // 2) A vé otra vez su propia envolvente → "pendiente del otro" (no toca NADA)
    const paso2 = await sync.ejecutar(A.ctx);
    expect(paso2.rama).toBe("pendiente");
    expect(paso2.mensaje).toContain("pendiente");
    expect(gist.contenido.nonce).toBe(nonceOffer);              // su offer AÚN está (no reescrita)

    // 3) B recoge la offer → descifra, fusiona, escribe ACK + aplica local + base
    const paso3 = await sync.ejecutar(B.ctx);
    expect(paso3.rama).toBe("aplicado");
    expect(paso3.buzonVaciado).toBe(false);                     // B NO vacía: A vacía a la absorción
    expect(ordenadasPorId(B.local.recetas)).toEqual(recetasEsperadas(REC_A, REC_B));            // B aprendió la receta de A
    expect(ordenadasPorId(B.ctx.almacen.leer("base").recetas)).toEqual(recetasEsperadas(REC_A, REC_B));   // base avanza al convergido
    expect(B.ctx.almacen.leer("consumida")).toBe(nonceOffer);
    expect(gist.contenido.kind).toBe("ack");                    // el ACK completo está en el buzón
    expect(gist.contenido.deviceId).toBe("pc");
    expect(gist.contenido.parentId).toBe(nonceOffer);          

    // A absorbe el ACK (parentId == su offer pendiente) → aplicar + VACIAR
    const paso4 = await sync.ejecutar(A.ctx);
    expect(paso4.rama).toBe("aplicado");
    expect(paso4.buzonVaciado).toBe(true);
    expect(paso4.mensaje).toContain("Buzón limpio");
    expect(ordenadasPorId(A.local.recetas)).toEqual(recetasEsperadas(REC_A, REC_B));            // A aprendió la receta de B del ACK
    expect(A.ctx.almacen.leer("pendiente")).toBeNull();         // su offer ya absorbida
    expect(gist.contenido).toEqual({ kind: "empty", v: 1, updatedAt: expect.any(String) });  // placeholder SIN datos

    // reciprocidad: tras el ciclo, A y B tienen el mismo estado convergido local y base
    expect(ordenadasPorId(A.local.recetas)).toEqual(ordenadasPorId(B.local.recetas));
    expect(ordenadasPorId(A.ctx.almacen.leer("base").recetas)).toEqual(ordenadasPorId(B.ctx.almacen.leer("base").recetas));

    // 6) idempotencia: dos syncs seguidos sin cambios → "Nada que sincronizar" (no re-publican nada)
    const paso5 = await sync.ejecutar(A.ctx);
    expect(paso5.rama).toBe("nada");
    expect(paso5.mensaje).toBe("Nada que sincronizar.");
    const paso6 = await sync.ejecutar(B.ctx);
    expect(paso6.rama).toBe("nada");
    expect(gist.contenido).toEqual({ kind: "empty", v: 1, updatedAt: expect.any(String) });   // el gist sigue empty
  });

  it("la OFFER/ACK del gist viajan cifradas: RECETA NUNCA legible y header con salt/iteraciones públicos", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-compartida", recetasIniciales: [REC_A] });
    await sync.ejecutar(A.ctx);
    const env = gist.contenido;
    expect(env.v).toBe(1);
    expect(env.header.salt).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(env.header.iterations).toBe(1000);                  // iteraciones BAJAS inyectadas (determinadas por ctx, no hardcode)
    expect(env.payload.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(JSON.stringify(env)).not.toContain("Tortilla");       // NADA legible ya entre sincronizaciones (criterio §11)
  });

  it("PASSPHRASE ERRÓNEA: rama error SIN escribir nada — local y gist quedan intactos", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-compartida", recetasIniciales: [REC_A] });
    await sync.ejecutar(A.ctx);                                 // A publica su offer
    const contenidoAntes = JSON.parse(JSON.stringify(gist.contenido));

    const B = dispositivo(gist, { id: "pc", pass: "PASPHRASE-DISTINTA", recetasIniciales: [] });
    const resultado = await sync.ejecutar(B.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.tipo).toBe("passphrase");
    expect(resultado.mensaje).toContain("passphrase");
    expect(JSON.stringify(gist.contenido)).toBe(JSON.stringify(contenidoAntes));   // el buzón NO cambió
    expect(B.local.recetas).toEqual([]);                        // el local NO cambió
    expect(B.ctx.almacen.leer("base")).toBeNull();
  });

  it("RED CAÍDA en un GET: rama error y el local/pendiente del sync NO se corrompen", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    gist.falloPatch = false;                                    // no es un PATCH: es el GET
    gist.redViva = false;
    const resultado = await sync.ejecutar(A.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.mensaje).toContain("no está accesible");
    expect(gist.contenido).toBeNull();                          // nada se escribió
    expect(A.local.recetas).toEqual([REC_A]);                   // el local quedó entero
    expect(A.ctx.almacen.leer("pendiente")).toBeNull();         // ni la marca de pendiente
  });

  it("RED CAÍDA en el PATCH de la OFFER: rama error y NINGÚN estado local modificado (§11)", async () => {
    const gist = gistEnMemoria();
    gist.falloPatch = true;                                     // el GET funciona, el PATCH cae
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    const resultado = await sync.ejecutar(A.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.mensaje).toContain("no está accesible");
    expect(A.ctx.almacen.leer("pendiente")).toBeNull();     // la marca sólo se escribe si el buzón se escribió bien
    expect(A.local.recetas).toEqual([REC_A]);
  });

  it("CONFLICTOS: la máquina se detiene sin escribir (ni local ni buzón) y el resolver puede continuar el flujo", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-cifra", recetasIniciales: [REC_A] });
    await sync.ejecutar(A.ctx);                                 // A publica su offer con REC_A
    const contenidoAntes = JSON.parse(JSON.stringify(gist.contenido));

    const B = dispositivo(gist, { id: "pc", pass: "clave-cifra", recetasIniciales: [REC_B] });
    B.ctx.fusionar = () => ({ estado: null,
      conflictos: [{ campo: "method", recetaId: "receta-C" }] });   // merge SIMULADO que devuelve conflicto bloqueante

    const bloqueada = await sync.ejecutar(B.ctx);
    expect(bloqueada.rama).toBe("conflictos");
    expect(bloqueada.mensaje).toContain("conflicto");
    expect(bloqueada.conflictos).toEqual([{ campo: "method", recetaId: "receta-C" }]);
    expect(JSON.stringify(gist.contenido)).toBe(JSON.stringify(contenidoAntes));   // el buzón INTACTO
    expect(B.local.recetas).toEqual([REC_B]);                   // local intacto también

    // El usuario resuelve en el modal (F5) → continuarTrasConflictos escribe ACK con el estado resuelto
    B.ctx.fusionar = unionPorId;                                // (repongo la fusión válida para el ACK posterior)
    const resuelto = await sync.continuarTrasConflictos(B.ctx, { recetas: [REC_A, REC_B] }, bloqueada.recibida);
    expect(resuelto.rama).toBe("aplicado");
    expect(ordenadasPorId(B.local.recetas)).toEqual(recetasEsperadas(REC_A, REC_B));            // el estado resuelto ya está aplicado
    expect(ordenadasPorId(B.ctx.almacen.leer("base").recetas)).toEqual(recetasEsperadas(REC_A, REC_B));
    expect(gist.contenido.kind).toBe("ack");
    expect(gist.contenido.parentId).toBe(bloqueada.recibida.nonce);

    // y A absorbe el ack resuelto terminando el ciclo (recíproco del ciclo sin conflictos)
    const pasoFinal = await sync.ejecutar(A.ctx);
    expect(pasoFinal.rama).toBe("aplicado");
    expect(pasoFinal.buzonVaciado).toBe(true);
    expect(ordenadasPorId(A.local.recetas)).toEqual(recetasEsperadas(REC_A, REC_B));
  });

  it('la envolvente vacía del plan es el placeholder kind "empty" del §3 (sin payload ni header)', () => {
    const vacia = sync.envolventeVacia(() => "2026-10-19T10:00:00.000Z");
    expect(vacia).toEqual({ v: 1, kind: "empty", updatedAt: "2026-10-19T10:00:00.000Z" });
    expect(Object.keys(vacia)).toEqual(["v", "kind", "updatedAt"]);       // SIN payload, SIN header, SIN estado
  });

  it("crearBuzon fase el buzón inicial y ejecutar sobre el buzón vacío con base existente → nada", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [] });
    const creacion = await sync.crearBuzon(A.ctx);
    expect(creacion.rama).toBe("limpio");
    expect(gist.contenido).toEqual({ v: 1, kind: "empty", updatedAt: expect.any(String) });

    const primera = await sync.ejecutar(A.ctx);                 // base null → primer sync SIEMPRE tiene algo (el propio estado como semilla)
    expect(primera.rama).toBe("publicado");
    expect(gist.contenido.kind).toBe("offer");
    expect(JSON.stringify(gist.contenido)).not.toContain("recetas");   // el payload va cifrado: la clave exterior no contiene el estado en claro
  });
});

describe("sync-protocol — ramas de error y bordes del protocolo", () => {
  it("GET con HTTP != 2xx: rama error y el local NO se toca", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    A.ctx.fetcher = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const resultado = await sync.ejecutar(A.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.mensaje).toContain("no está accesible");
    expect(A.local.recetas).toEqual([REC_A]);
    expect(gist.contenido).toBeNull();
  });

  it("contenido del gist NO es JSON válido → tratado como buzón vacío (ofrece cambios tras el caso)", async () => {
    const gist = gistEnMemoria();
    gist.contenido = "no-es-json";
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    const resultado = await sync.ejecutar(A.ctx);
    expect(resultado.rama).toBe("publicado");        // buzón "vacío" (ilegible) + cambios locales → offer
    expect(gist.contenido.kind).toBe("offer");       // la envolvente nueva sustituye a la basura
  });

  it("el VACIAR falla por red: el fusionado YA está aplicado y el mensaje lo dice (cosmético, sin pérdida)", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    const B = dispositivo(gist, { id: "pc", pass: "clave-esta", recetasIniciales: [REC_B] });
    await sync.ejecutar(A.ctx);                                  // patch nº1: offer A
    await sync.ejecutar(B.ctx);                                  // patch nº2: ack B
    gist.falloPatchNumero = 3;                                   // patch nº3: vaciado de A → falla
    const resultado = await sync.ejecutar(A.ctx);
    expect(resultado.rama).toBe("aplicado");
    expect(resultado.buzonVaciado).toBe(false);
    expect(resultado.mensaje).toContain("no se pudo vaciar");
    expect(ordenadasPorId(A.local.recetas)).toEqual(recetasEsperadas(REC_A, REC_B));   // el estado ya está guardado aunque el vaciado fallara
    expect(A.ctx.almacen.leer("pendiente")).toBeNull();
  });

  it("el PATCH del ACK falla por red: rama error y el LOCAL queda intacto (PATCH antes de tocar local, §11)", async () => {
    const gist = gistEnMemoria();
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [REC_A] });
    await sync.ejecutar(A.ctx);                      // patch nº1 (offer de A)
    gist.falloPatchNumero = 2;                       // el nº2 será el ACK de B → falla
    const B = dispositivo(gist, { id: "pc", pass: "clave-esta", recetasIniciales: [REC_B] });
    const resultado = await sync.ejecutar(B.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.mensaje).toContain("no está accesible");
    expect(B.local.recetas).toEqual([REC_B]);        // sin la receta de A: PATCH falló ANTES de tocar local
    expect(B.ctx.almacen.leer("base")).toBeNull();
    expect(gist.contenido.deviceId).toBe("movil");   // el buzón conserva la offer de A
  });

  it("crearBuzon con la red caída: rama error y el placeholder nunca llegó a escribirse", async () => {
    const gist = gistEnMemoria();
    gist.falloPatch = true;
    const A = dispositivo(gist, { id: "movil", pass: "clave-esta", recetasIniciales: [] });
    const resultado = await sync.crearBuzon(A.ctx);
    expect(resultado.rama).toBe("error");
    expect(resultado.mensaje).toContain("no está accesible");
    expect(gist.contenido).toBeNull();
  });
});

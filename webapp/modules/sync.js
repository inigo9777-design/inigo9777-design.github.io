// modules/sync.js — PROTOCOLO DEL BUZÓN (FASE 3, plan-sync-buzon.md §3): sincronización entre 2
// dispositivos usando un gist de GitHub como buzón. La FUENTE DE VERDAD SIEMPRE es el estado LOCAL
// de cada dispositivo; el buzón SOLO transporta (nunca es dueño del dato).
//
// Envolvente ÚNICA del gist (mrcheff-sync.json), SIEMPRE un snapshot completo cifrado:
//
//   { v: 1, kind: "offer"|"ack"|"empty", deviceId, nonce, parentId, updatedAt,
//     header: { salt, iterations },            // salt/iteraciones EN CLARO (portabilidad, §2)
//     payload: { iv, ciphertext } }            // AES-GCM de TODO el estado (clave PBKDF2, §2)
//
// Máquina de estados (UNA por clic en "🔄 Sync"; el wiring DOM vive en app.js — F5):
//
//   GET buzón
//   ├─ kind "empty"          → ¿cambios locales pendientes? → publica OFFER / o "Nada que sincronizar."
//   ├─ deviceId == yo        → "Publicado: pendiente de que el otro dispositivo lo recoja." (no toca)
//   └─ deviceId == el otro   → descifrar → fusionar → (¿conflictos? → modal, parar SIN escribir)
//                              ├─ write ACK + aplicar local + base avanza
//                              └─ si parentId == MI offer pendiente → además VACÍA el buzón
//
// "Vaciar" = PATCH con {"kind":"empty"}, NUNCA borrar el gist (el id es la config del otro dispositivo).
// La base (último estado convergecido) vive en el almacén local inyecto — regla §4 del plan: avanza tras
// CONSUMIR la envolvente del otro; mientras haya offer propia pendiente, no se toca.
//
// NOTA de diseño (desviación documentada del §3 literal, por trazada en CODING_STANDARDS §8 en F6):
// al publicar un ACK se limpia la marca "offer pendiente" propia: el ACK lleva snapshot COMPLETO
// fusionado (que ya incluyó lo que la offer publicaba) — con 2 dispositivos y sync manual la propie-
// dad de "nunca vaciar antes de absorbida" queda intacta y el bucle siempre converge.
//
// PUREZA §3: sin DOM ni localStorage — TODO se inyecta por ctx (red como `fetcher`, cripto como
// `crypto`, dominio como `snapshotLocal`/`fusionar`, persistencia como `almacen`; ids/hora para
// determinismo de tests, §6). app.js (F5) es el único que los enlaza con fetch/localStorage/syncCrypto.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node: require() directo
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { sync: api });                                // patrón (A): window.MRCheff
})(typeof self !== "undefined" ? self : this, function () {

  const NOMBRE_ARCHIVO = "mrcheff-sync.json";      // fichero ÚNICO del gist (una envolvente, SIEMPRE de relevancia completa)
  const API = "https://api.github.com/gists/";

  // ---- MENSAJES de cada rama (texto de UI que app.js pinta tal cual, §6 del plan) ----
  const MENSAJES = {
    publicado: "Cambios publicados — recógelos en el otro dispositivo.",
    pendiente: "Publicado: pendiente de que el otro dispositivo lo recoja.",
    aplicado: "Cambios del otro dispositivo aplicados.",
    nada: "Nada que sincronizar.",
    limpio: "Buzón limpio.",
    errorRed: "El buzón no está accesible ahora mismo — tus datos locales no han cambiado.",
    passphrase: "No se pudo descifrar el buzón — revisa la passphrase e inténtalo de nuevo.",
    conflictos: "Hay cambios en conflicto en ambos dispositivos — resuélvelos en el modal y vuelve a sincronizar."
  };

  // ---- Envolvente vacía (placeholder SIN datos: {kind:"empty"}, literal del §3 del plan) ----
  // acepta una FUNCIÓN (inyección de test, §6) o ya la ISO string lista (los call-sites usan ahoraDe(ctx))
  function envolventeVacia(ahora) {
    return { v: 1, kind: "empty", updatedAt: typeof ahora === "function" ? ahora() : (ahora || new Date().toISOString()) };
  }

  // ---- cripto de la envolvente (inyectada por ctx.crypto; si falta, window.MRCheff.syncCrypto) ----
  // `ctx.cryptoImpl` es el proveedor WebCrypto CRUDO (opcional): los entornos de test (jsdom) exponen
  // un globalThis.crypto SIN .subtle, así que la inyección cruda es imprescindible ahí (misma decisión
  // de sync-crypto.test.js). En el navegador NO se necesita: el global real trae .subtle.
  function criptoDe(ctx) {
    return ctx.crypto || (typeof root !== "undefined" && root.MRCheff && root.MRCheff.syncCrypto);
  }
  function optsRaw(ctx) { return ctx.cryptoImpl ? { crypto: ctx.cryptoImpl } : undefined; }

  async function cifrarEstado(ctx, estado) {
    const cripto = criptoDe(ctx);
    const salt = cripto.nuevoSalt(ctx.cryptoImpl);
    const iteraciones = ctx.iteraciones || cripto.iteracionesPorDefecto;
    const key = await cripto.deriveKey(ctx.passphrase, salt, iteraciones, optsRaw(ctx));
    const payload = await cripto.encryptJson(key, estado, optsRaw(ctx));
    return { saltB64: cripto.bytesABase64(salt), iteraciones, payload };
  }

  async function descifrarEstado(ctx, header, payload) {
    const cripto = criptoDe(ctx);
    const key = await cripto.deriveKey(ctx.passphrase, header.salt, header.iterations, optsRaw(ctx));
    return cripto.decryptJson(key, payload, optsRaw(ctx));
  }

  // ---- RED: leer / escribir el gist (dos helpers, la máquina usa sólo esto) ----
  function cabeceras(ctx) {
    return { Authorization: "token " + ctx.token, Accept: "application/vnd.github+json" };
  }

  async function leerBuzon(ctx) {
    const res = await ctx.fetcher(API + ctx.gistId, { method: "GET", headers: cabeceras(ctx) });
    if (!res.ok) {
      const error = new Error("GET buzón HTTP " + res.status);
      error.tipo = "red";                                            // tanto red como 4xx impiden el sync: el estado local queda intacto
      throw error;
    }
    const gisto = await res.json();
    const fichero = gisto && gisto.files && gisto.files[NOMBRE_ARCHIVO];
    if (!fichero || !fichero.content) return null;                    // gist sin fichero o vacío → "empty"
    try { return JSON.parse(fichero.content); }
    catch (e) { return null; }                                        // content no-JSON → tratado igual que "empty" (defensivo; nunca debería ocurrir)
  }

  async function escribirBuzon(ctx, envolvente) {
    const res = await ctx.fetcher(API + ctx.gistId, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, cabeceras(ctx)),
      body: JSON.stringify({ files: { [NOMBRE_ARCHIVO]: { content: JSON.stringify(envolvente) } } })
    });
    if (!res.ok) {
      const error = new Error("PATCH buzón HTTP " + res.status);
      error.tipo = "red";
      throw error;
    }
  }

  // nonce y hora de cada envolvente: deterministas si el ctx los inyecta (tests, §6).
  function nonceDe(ctx) {
    return ctx.uid ? ctx.uid() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  function ahoraDe(ctx) { return ctx.ahora ? ctx.ahora() : new Date().toISOString(); }

  function igualPorSerial(estadoA, estadoB) {
    return JSON.stringify(estadoA) === JSON.stringify(estadoB);        // snapshots de la MISMA maquinaria (app.js): forma/orden canonica únicos
  }

  // ¿cambios locales frente a la base del último convergido? Sin base (primer sync) SÍ hay cambios:
  // el primer sync SIEMPRE tiene algo que ofrecer (el otro dispositivo aprendeSnapshot desde 0).
  function hayCambiosPendientes(ctx) {
    const base = ctx.almacen.leer("base");
    if (base == null) return true;
    return !igualPorSerial(base, ctx.snapshotLocal());
  }

  // ---------- EJECUTAR: la máquina COMPLETA de UN clic de sync ----------
  // Retorna un "resultado" descriptivo (rama + mensaje + anexos) — NUNCA lanza al caller de app.js:
  // TODO fallo deja el estado local INTACTO (criterio de aceptación del §11 del plan).
  async function ejecutar(ctx) {
    let envolvente;
    try { envolvente = await leerBuzon(ctx); }
    catch (e) { return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message }; }

    const yo = ctx.dispositivo;

    // --- rama: buzón vacío ---
    if (!envolvente || envolvente.kind === "empty") {
      try {
        if (!hayCambiosPendientes(ctx)) return { rama: "nada", mensaje: MENSAJES.nada };
        const suyo = ctx.snapshotLocal();
        const datos = await cifrarEstado(ctx, suyo);
        const envolventeOffer = {
          v: 1, kind: "offer", deviceId: yo,
          nonce: nonceDe(ctx), parentId: ctx.almacen.leer("consumida") || null,
          updatedAt: ahoraDe(ctx),
          header: { salt: datos.saltB64, iterations: datos.iteraciones },
          payload: datos.payload
        };
        await escribirBuzon(ctx, envolventeOffer);
        ctx.almacen.escribir("pendiente", envolventeOffer.nonce);
        return { rama: "publicado", mensaje: MENSAJES.publicado, detalle: envolventeOffer.nonce };
      } catch (e) {
        return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message };
      }
    }

    // --- rama: la envolvente del buzón ES MÍA (sigo esperando al otro) ---
    if (envolvente.deviceId === yo) {
      return { rama: "pendiente", mensaje: MENSAJES.pendiente };
    }

    // --- rama: envolvente del OTRO dispositivo (offer o ack: ambas transportan snapshot completo) ---
    try {
      let estadoSuyo;
      try { estadoSuyo = await descifrarEstado(ctx, envolvente.header, envolvente.payload); }
      catch (e) {
        return { rama: "error", tipo: "passphrase", mensaje: MENSAJES.passphrase };   // abortar sin escribir NADA
      }
      if (estadoSuyo == null) return { rama: "error", tipo: "passphrase", mensaje: MENSAJES.passphrase };

      const base = ctx.almacen.leer("base");
      const resultadoFusion = ctx.fusionar(base, ctx.snapshotLocal(), estadoSuyo);   // diff3 (F4) — inyectado
      if (Array.isArray(resultadoFusion.conflictos) && resultadoFusion.conflictos.length > 0) {
        // conflictos BLOQUEANTES: NADA se escribe (ni local ni buzón) hasta que el usuario resuelve (F5).
        return { rama: "conflictos", mensaje: MENSAJES.conflictos, conflictos: resultadoFusion.conflictos,
                 recibida: { nonce: envolvente.nonce, parentId: envolvente.parentId, deviceId: envolvente.deviceId,
                             estadoSuyo, base } };
      }
      const pendiente = ctx.almacen.leer("pendiente");
      return await consolidarFusion(ctx, resultadoFusion.estado,
        { nonce: envolvente.nonce, parentId: envolvente.parentId }, pendiente);
    } catch (e) {
      return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message };
    }
  }

  // CONTINUAR el protocolo con un estado fusionado YA CONSOLIDADO — dos caminos (§3 del plan):
  //   · ABSORCIÓN (la envolvente entrante responde a MI offer pendiente):
  //     el estado fusionado ya trae TAMBIÉN mi contenido (el otro lo fusionó en su snapshot completo)
  //     → aplicar local + base + consumir nonce + VACIAR el buzón. NO se escribe un ACK nuevo (el que
  //     absorbimos ya es nuestro recibo: un ACK extra provocaría un vaivén infinito de ACKs idénticos).
  //   · ACK (envolvente del otro que NO responde a mi offer — contacto nuevo u offer del otro):
  //     escribir PRIMERO el ACK con el estado fusionado COMPLETO (PATCH ANTES de tocar local: un fallo
  //     de red en cualquier punto deja el estado local INTACTO, §11 del plan) y después aplicar local.
  async function consolidarFusion(ctx, estado, recibida, pendiente) {
    const absorbeMiPublicacion = !!(recibida && recibida.parentId) && recibida.parentId === pendiente;

    try {
      if (!absorbeMiPublicacion) {
        // Sólo se escribe ACK si la fusión APORTA algo: si el estado fusionado ya ES el mío convergecido,
        // un ACK nuevo no trae información y con 2 dispositivos provocaría un bucle de ACKs sin fin.
        const base = ctx.almacen.leer("base");
        const convergecidoYa = igualPorSerial(estado, ctx.snapshotLocal()) && base != null && igualPorSerial(estado, base);
        if (!convergecidoYa) {
          const datos = await cifrarEstado(ctx, estado);
          const ack = {
            v: 1, kind: "ack", deviceId: ctx.dispositivo,
            nonce: nonceDe(ctx), parentId: recibida.nonce, updatedAt: ahoraDe(ctx),
            header: { salt: datos.saltB64, iterations: datos.iteraciones },
            payload: datos.payload
          };
          await escribirBuzon(ctx, ack);
          ctx.almacen.escribir("pendiente", null);   // desviación trazada en la cabecera: la offer queda SUSTITUIDA por este ACK full-snapshot
        }
      }
    } catch (e) {
      return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message };
    }

    ctx.almacen.guardarLocal(estado);          // la FUENTE DE VERDAD sigue siendo LOCAL: persistir la fusión al instante
    ctx.almacen.escribir("base", estado);      // §4: la base avanza — el estado CONVERGECIDO es el nuevo antecesor
    ctx.almacen.escribir("consumida", recibida.nonce);

    if (absorbeMiPublicacion) {
      ctx.almacen.escribir("pendiente", null);
      try { await escribirBuzon(ctx, envolventeVacia(ahoraDe(ctx))); }     // mi publicación YA fue absorbida: vaciar seguro
      catch (e) {
        // El merge local YA se guardó (nada se pierde): el vaciado fallido es cosmético y el próximo
        // sync lo re-intenta (la envolvente seguirá con deviceId==yo → rama "pendiente").
        return { rama: "aplicado", buzonVaciado: false, mensaje: MENSAJES.aplicado + " (el buzón no se pudo vaciar ahora — inténtalo de nuevo luego)" };
      }
      return { rama: "aplicado", buzonVaciado: true, mensaje: MENSAJES.aplicado + " " + MENSAJES.limpio };
    }
    return { rama: "aplicado", buzonVaciado: false, mensaje: MENSAJES.aplicado };
  }

  // ---------- CONTINUAR TRAS RESOLVER CONFLICTOS (F5): escribir ACK con el estado ya resuelto ----------
  // El usuario eligió en el modal; el módulo SÓLO graba lo decidido: guardar local + base + ACK + (si
  // procede) vaciar. `recibida` es el objeto que la rama "conflictos" devolvió (nonce/parentId/…).
  async function continuarTrasConflictos(ctx, estadoResuelto, recibida) {
    try {
      const pendiente = ctx.almacen.leer("pendiente");
      return await consolidarFusion(ctx, estadoResuelto, recibida, pendiente);
    } catch (e) {
      return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message };
    }
  }

  // Crear buzón desde cero (botón "Crear buzón", F5): PATCH con el placeholder {"kind":"empty"} literal.
  async function crearBuzon(ctx) {
    try {
      await escribirBuzon(ctx, envolventeVacia(ahoraDe(ctx)));
      return { rama: "limpio", mensaje: MENSAJES.limpio };
    } catch (e) {
      return { rama: "error", mensaje: MENSAJES.errorRed, detalle: e.status || e.message };
    }
  }

  return {
    NOMBRE_ARCHIVO,
    MENSAJES,
    envolventeVacia,
    ejecutar,
    continuarTrasConflictos,
    crearBuzon
  };
});

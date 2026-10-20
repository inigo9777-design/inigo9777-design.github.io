// modules/sync-crypto.js — Cifrado extremo a extremo del buzón de sincronización (FASE 2, plan-sync-buzon.md).
// Módulo PURE de decisión: sin DOM ni localStorage ni sessionStorage (la passphrase la gestiona la vista, §6 del plan).
//
// Reglas del plan (§2) fijadas y NO reabiertas:
//   · Algoritmo: AES-GCM-256 con clave derivada por PBKDF2-HMAC-SHA256 (OWASP 2023: 600.000 iteraciones).
//   · La passphrase NO se persiste: su seguridad vive en el dispositivo (sessionStorage, decisión de app.js F5).
//   · El salt y las iteraciones viajan EN CLARO en la cabecera de la envolvente (portabilidad entre
//     dispositivos: dispositivos distintos derivan la MISMA clave con los mismos parámetros; el salt es
//     público por diseño — PBKDF2 está diseñado para eso).
//   · IV aleatorio por cada cifrado (crypto.getRandomValues → NUNCA un contador reutilizable con la misma clave).
//   · Passphrase errónea ⟹ GCM falla la autenticación del tag ⟹ decryptJson devuelve NULL (jamás basura legible).
//
// API PÚBLICA (5 pasos + 1 constante): iteracionesPorDefecto / nuevoSalt / deriveKey / encryptJson /
// decryptJson / bytesABase64 + base64ABytes (serialización que la envolvente del gist necesita, §3).
// El proveedor WebCrypto se INYECTA por contexto (opts.crypto) para tests; por defecto el global del
// runtime (self.crypto en navegador, globalThis.crypto en Node >= 18) — §6 CODING_STANDARDS.md.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node: require() directo
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { syncCrypto: api });                          // patrón (A): namespace window.MRCheff
})(typeof self !== "undefined" ? self : this, function () {

  // 600.000 iteraciones = recomendación OWASP Password Storage 2023 para PBKDF2-HMAC-SHA256.
  const iteracionesPorDefecto = 600000;

  // Resolución ÚNICA del proveedor WebCrypto (inyección §6): el `opts.crypto` de la llamada SIEMPRE gana;
  // si falta, el proveedor global del runtime. Devolver null si el runtime NO trae
  // WebCrypto → los call-sites fallan con un mensaje claro en vez de un TypeError medio o más profundo.
  function decidirCrypto(opts) {
    const elegido = (opts && opts.crypto) ||
      (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto : null);
    return elegido;
  }

  // Serialización base64 de bytes (Uint8Array) — la envolvente viaja como JSON del gist y el JSON no
  // soporta arrays de bytes crudos. Base64 estándar (RFC 4648), SIN relleno "/" para URL (no hace falta:
  // vive dentro del cuerpo JSON del archivo, no en la query).
  function bytesABase64(bytes) {
    const bin = Array.from(bytes, b => String.fromCharCode(b)).join("");
    if (typeof btoa === "function") return btoa(bin);
    return Buffer.from(bytes).toString("base64");     // Node sin atob/btoa en el entorno de test (usa Buffer)
  }

  function base64ABytes(texto) {
    if (typeof atob === "function") {
      const bin = atob(String(texto || ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return new Uint8Array(Buffer.from(String(texto || ""), "base64"));
  }

  // Salt NUEVO por derivación de clave (16 bytes = 128 bits de azar): entropía suficiente y tamaño cómodo
  // para la cabecera de la envolvente de la gist.
  function nuevoSalt(optCrypto, longitud = 16) {
    const crypto = decidirCrypto({ crypto: optCrypto });
    if (!crypto) throw new Error("Falta WebCrypto en este entorno: no hay crypto.subtle para preparar el salt");
    const salt = new Uint8Array(longitud);
    crypto.getRandomValues(salt);
    return salt;
  }

  // passphrase → clave AES-GCM-256 vía PBKDF2-HMAC-SHA256 (clave material crudo passphrase + salt público).
  // El salt llega como Uint8Array o como base64 (como vive en la cabecera de la envolvente tras un GET del
  // gist, §3). Si el caller pasa Uint8Array se usa tal cual; si pasa texto se asume base64 (cabecera del plan).
  async function deriveKey(passphrase, salt, iterations, opts = {}) {
    const crypto = decidirCrypto(opts);
    if (!crypto) throw new Error("No hay WebCrypto disponible en este entorno (sin crypto.subtle)");
    const saltBytes = salt instanceof Uint8Array ? salt : base64ABytes(salt);
    const passUtf8 = new TextEncoder().encode(String(passphrase == null ? "" : passphrase));
    const claveBase = await crypto.subtle.importKey(
      "raw", passUtf8, { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: iterations >>> 0 > 0 ? Number(iterations) : iteracionesPorDefecto,
        hash: "SHA-256" },
      claveBase,
      { name: "AES-GCM", length: 256 },
      false,           // no extraible: NADIE puede sacar los bytes de la clave (ni la vista, ni el sync)
      ["encrypt", "decrypt"]
    );
  }

  // encryptJson(key, obj) → { iv: base64, ciphertext: base64 } — IV FRESH por cifrado (12 bytes
  // recomendados para AES-GCM por NIST SP 800-38D).
  async function encryptJson(key, obj, opts = {}) {
    const crypto = decidirCrypto(opts);
    if (!crypto) throw new Error("No hay WebCrypto disponible para cifrar");
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const claro = new TextEncoder().encode(JSON.stringify(obj));
    const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, claro);
    return { iv: bytesABase64(iv), ciphertext: bytesABase64(new Uint8Array(cifrado)) };
  }

  // decryptJson(key, {iv, ciphertext}) → obj | null. NULL en CUALQUIER fallo (passphrase errónea ⟹ tag
  // GCM inválido; payload corrompido; JSON inesperado) — el caller (sync, §3) aborta SIN escribir nada.
  async function decryptJson(key, envolvente, opts = {}) {
    try {
      const crypto = decidirCrypto(opts);
      if (!crypto) return null;
      const iv = base64ABytes(envolvente && envolvente.iv);
      const bytes = base64ABytes(envolvente && envolvente.ciphertext);
      const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, bytes);
      return JSON.parse(new TextDecoder().decode(claro));
    } catch (e) {                                   // passphrase errónea / datos inválidos — se degrade silencioso a null ES el contrato del §2
      return null;
    }
  }

  return {
    iteracionesPorDefecto,
    bytesABase64,
    base64ABytes,
    nuevoSalt,
    deriveKey,
    encryptJson,
    decryptJson
  };
});

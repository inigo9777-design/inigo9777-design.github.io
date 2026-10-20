// tests/sync-crypto.test.js — Capa 1 (unitaria, §6 CODING_STANDARDS.md) para modules/sync-crypto.js.
// Cobre la FASE 2 del plan-sync-buzon.md: PBKDF2-HMAC-SHA256 → AES-GCM-256, roundtrip cifrar/descifrar,
// passphrase errónea → NULL (jamás basura legible) e injección del proveedor WebCrypto (§6).
// El módulo es puro (sin DOM ni storage): require() directo; los tests son async (el WebCrypto ES async).

const cryptoSync = require("../modules/sync-crypto");

const PASSPHRASE = "la passphrase compartida del buzón";
// WebCrypto REAL de Node (require("crypto").webcrypto): en jsdom el globalThis.crypto NO trae .subtle,
// así que el proveedor que se inyecta en todas las pruebas es este (§6: decisión inyectable salída a prueba);
// la resolución del proveedor global y el error limpio si NO hay proveedor están testeadas por separado (fallbacks).
const NODE_CRYPTO = require("crypto").webcrypto;

describe("sync-crypto — constantes y resolución del proveedor", () => {
  it("iteracionesPorDefecto = 600000 (OWASP Password Storage 2023 = regla del plan §2)", () => {
    expect(cryptoSync.iteracionesPorDefecto).toBe(600000);
  });

  it("nuevoSalt produce 16 bytes por defecto y es ALEATORIO (dos salts nunca iguales)", () => {
    expect(cryptoSync.nuevoSalt(NODE_CRYPTO).length).toBe(16);
    expect(cryptoSync.nuevoSalt(NODE_CRYPTO, 32).length).toBe(32);
    expect(Buffer.compare(Buffer.from(cryptoSync.nuevoSalt(NODE_CRYPTO)), Buffer.from(cryptoSync.nuevoSalt(NODE_CRYPTO))))
      .not.toBe(0);
  });

  it("nuevoSalt lanza error CLARO si no hay proveedor disponible (inyección ausente + runtime sin crypto)", () => {
    const sinGlobal = globalThis.crypto;   // el proveedor se resuelve del global: temporalmente lo ocultamos
    delete globalThis.crypto;
    expect(() => cryptoSync.nuevoSalt()).toThrow(/WebCrypto/);
    globalThis.crypto = sinGlobal;
  });

  it("la inyección del proveedor por opts vuelve la llamada COMPLETAMENTE determinista (opts.crypto gana al global)", () => {
    // Un impostor que NO sabe nada de PBKDF2: deriveKey falla SIN caer al global que SÍ funcionaría
    // — pruebar que el objeto inyectado ES el usado, no el global (contrato de la inyección §6).
    const impostor = { subtle: {} };
    return expect(cryptoSync.deriveKey(PASSPHRASE, cryptoSync.nuevoSalt(NODE_CRYPTO), 10, { crypto: impostor }))
      .rejects.toBeTruthy();
  });
});

describe("sync-crypto — bytesABase64 / base64ABytes (serialización de la envolvente)", () => {
  it("roundtrip exacto con valores límite (0, 255) y textos UTF-8 no entra por aquí (es bytes, no texto)", () => {
    const bytes = new Uint8Array([0, 1, 128, 255]);
    const de = cryptoSync.base64ABytes(cryptoSync.bytesABase64(bytes));
    expect(Array.from(de)).toEqual([0, 1, 128, 255]);
  });
});

describe("sync-crypto — deriveKey", () => {
  it("el salt en TEXTO base64 y el salt EN RAW derivan la MISMA clave (mismo roundtrip entre ambos)", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const kRaw = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const kB64 = await cryptoSync.deriveKey(PASSPHRASE, cryptoSync.bytesABase64(salt), 1000, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(kRaw, { saludo: "hola con tilde á", n: 7 }, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(kB64, env, { crypto: NODE_CRYPTO })).toEqual({ saludo: "hola con tilde á", n: 7 });
  });

  it("iteraciones distintas derivan claves DISTINTAS (la passphrase sola NO basta sin los parámetros públicos)", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const kA = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const kB = await cryptoSync.deriveKey(PASSPHRASE, salt, 2000, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(kA, { ok: true }, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(kB, env, { crypto: NODE_CRYPTO })).toBeNull();
  });

  it("iteraciones AUSENTES caen a 600000 por defecto (firma de llamada de producción sin 4º arg útil)", async () => {
    // Las 600000 reales tardan un pelín (~decenas ms en Node), SIENDO la ruta por defecto de producción: se prueba UNA vez.
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const k = await cryptoSync.deriveKey(PASSPHRASE, salt, undefined, { crypto: NODE_CRYPTO });
    const k2 = await cryptoSync.deriveKey(PASSPHRASE, salt, cryptoSync.iteracionesPorDefecto, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(k, { v: "defecto" }, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(k2, env, { crypto: NODE_CRYPTO })).toEqual({ v: "defecto" });
  });

  it("passphrase VACÍA no lanza (String() normaliza) y sigue siendo una clave válida y estable", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const kA = await cryptoSync.deriveKey("", salt, 1000, { crypto: NODE_CRYPTO });
    const kB = await cryptoSync.deriveKey(null, salt, 1000, { crypto: NODE_CRYPTO });   // null → "" por String(name==null?"":name)
    const env = await cryptoSync.encryptJson(kA, { a: 1 }, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(kB, env, { crypto: NODE_CRYPTO })).toEqual({ a: 1 });
  });
});

describe("sync-crypto — encryptJson / decryptJson (roundtrip y fallos)", () => {
  it("roundtrip completo con UTF-8: tildes, símbolos del separador de fingerprint y emojis (el plan §8 pide UTF-8/tildes)", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const k = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const obj = { texto: "s πολύ ¦ acentuación é difícil", lista: ["🥘 Cocina ñoño"] };
    const env = await cryptoSync.encryptJson(k, obj, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(k, env, { crypto: NODE_CRYPTO })).toEqual(obj);
  });

  it("payload cifrado NO expone el objeto (ningún dato plano en el ciphertext/iv)", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const k = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const secreto = "receta secreta de la casa";
    const env = await cryptoSync.encryptJson(k, { texto: secreto }, { crypto: NODE_CRYPTO });
    expect(JSON.stringify(env)).not.toContain(secreto);
    expect(env.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(env.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("IV NUEVO por cifrado — el mismo objeto y la MISMA clave producen dos envolventes DISTINTAS", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const k = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const a = await cryptoSync.encryptJson(k, { igual: "siempre" }, { crypto: NODE_CRYPTO });
    const b = await cryptoSync.encryptJson(k, { igual: "siempre" }, { crypto: NODE_CRYPTO });
    expect(a.iv).not.toBe(b.iv);           // IV aleatorio distinto (crypto.getRandomValues del §2)
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(await cryptoSync.decryptJson(k, a, { crypto: NODE_CRYPTO })).toEqual({ igual: "siempre" });
    expect(await cryptoSync.decryptJson(k, b, { crypto: NODE_CRYPTO })).toEqual({ igual: "siempre" });
  });

  it("passphrase ERRÓNEA → null (el tag GCM no valida) — NUNCA un objeto basura legible", async () => {
    const salt = cryptoSync.nuevoSalt(NODE_CRYPTO);
    const kBuena = await cryptoSync.deriveKey(PASSPHRASE, salt, 1000, { crypto: NODE_CRYPTO });
    const kMala = await cryptoSync.deriveKey("TOTALMENTE distinta", salt, 1000, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(kBuena, { secreto: "hola" }, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(kMala, env, { crypto: NODE_CRYPTO })).toBeNull();
  });

  it("salt distinto en el otro dispositivo → null también (testing el caso de gists manipulados de cabecera)", async () => {
    const k = await cryptoSync.deriveKey(PASSPHRASE, cryptoSync.nuevoSalt(NODE_CRYPTO), 1000, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(k, { ok: true }, { crypto: NODE_CRYPTO });
    const kOtroSal = await cryptoSync.deriveKey(PASSPHRASE, cryptoSync.nuevoSalt(NODE_CRYPTO), 1000, { crypto: NODE_CRYPTO });
    expect(await cryptoSync.decryptJson(kOtroSal, env, { crypto: NODE_CRYPTO })).toBeNull();
  });

  it("ciphertext manipulado (un byte alterado) → null; envolvente sin iv/ciphertext → null; sin proveedor → null sin lanzar", async () => {
    const k = await cryptoSync.deriveKey(PASSPHRASE, cryptoSync.nuevoSalt(NODE_CRYPTO), 1000, { crypto: NODE_CRYPTO });
    const env = await cryptoSync.encryptJson(k, { ok: true }, { crypto: NODE_CRYPTO });

    const corrompido = cryptoSync.base64ABytes(env.ciphertext);
    corrompido[corrompido.length - 1] ^= 0xff;    // flip de un bit del bloque final (tag GCM invalidado)
    expect(await cryptoSync.decryptJson(k, { iv: env.iv, ciphertext: cryptoSync.bytesABase64(corrompido) }, { crypto: NODE_CRYPTO })).toBeNull();

    expect(await cryptoSync.decryptJson(k, {}, { crypto: NODE_CRYPTO })).toBeNull();
    expect(await cryptoSync.decryptJson(k, null, { crypto: NODE_CRYPTO })).toBeNull();

    // Sin proveedor y SIN inyección en runtime-descubierto: null honesto, no excepción no gestionada por el caller §3.
    const sinGlobal = globalThis.crypto;
    delete globalThis.crypto;
    expect(await cryptoSync.decryptJson(k, env)).toBeNull();
    globalThis.crypto = sinGlobal;
  });
});

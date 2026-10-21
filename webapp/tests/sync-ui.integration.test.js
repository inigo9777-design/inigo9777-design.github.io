// tests/sync-ui.integration.test.js — CAPA 2 (integración §6 CODING_STANDARDS.md), FASE 5 del
// plan-sync-buzon.md: wiring REAL de app.js (botón "🔄 Sync", modal de configuración, modal
// resolver y badges "duplicada") contra un "gist" en memoria vía window.fetch sustituido.
// Obre un boot de la app COMPLETA (tests/boot.js) por corridors de test: cruza storage+DOM,
// así que es OBLIGATORIA como integración. Los stubs e2e/*.spec.js del repo NO los ejecuta
// Jest (roots de jest.config.js); el flujo real de 2 navegadores queda trazado en
// e2e/sync-ui.spec.js + e2e/sync-buzon.mjs (FASE 6).

const { bootApp } = require("./boot");
const cripto = require("../modules/sync-crypto");
const sync = require("../modules/sync");
const WEB_CRYPTO = require("crypto").webcrypto;    // WebCrypto CRUDO: en jsdom el global NO trae .subtle

const NOMBRE = "mrcheff-sync.json";
const PASS = "frase-test";

// ---------- fixtures ----------
const estadoLocal = () => ({
  foods: [{ id: "f1", name: "Tomate", qty: 2, min: 1, score: 5, checked: true }],
  recipes: [{
    id: "rec-1", title: "Tortilla española", meal: "comida", createdAt: 1000,
    ingredients: ["Huevos", "Patata"], method: ["Batir huevos", "Cuajar a fuego bajo"]
  }],
  innovations: [], cooked: [], weekmenu: null
});

// Envolvente cifrada de VERDAD (misma maquinaria que el protocolo usa) para sembrar el "gist".
async function envolventeDe({ deviceId, estado, nonce, parentId, iterations = 100 }) {
  const salt = cripto.nuevoSalt(WEB_CRYPTO);
  const key = await cripto.deriveKey(PASS, salt, iterations, { crypto: WEB_CRYPTO });
  const payload = await cripto.encryptJson(key, estado, { crypto: WEB_CRYPTO });
  return {
    v: 1, kind: deviceId === "movil" ? "offer" : "ack", deviceId,
    nonce, parentId: parentId || null,
    updatedAt: "2026-10-19T10:00:00.000Z",
    header: { salt: cripto.bytesABase64(salt), iterations },
    payload
  };
}

// ---------- "gist" en memoria + fetch de test ----------
function gistEnMemoria() {
  return { contenido: null, redViva: true, solicitudes: [] };
}
function fetcherDe(gist) {
  const servicio = async (url, init) => {
    if (!gist.redViva) throw new Error("Network unavailable");
    gist.solicitudes.push({ metodo: (init && init.method) || "GET" });
    if (init && init.method === "PATCH") {
      gist.contenido = JSON.parse(JSON.parse(init.body).files[NOMBRE].content);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return {
      ok: true, status: 200,
      json: async () => gist.contenido == null
        ? ({ files: {} })
        : ({ files: { [NOMBRE]: { content: JSON.stringify(gist.contenido) } } })
    };
  };
  return servicio;
}

// ---------- preparación de un dispositivo de app REAL ----------
const CLAVES = {
  config: "mrcheff.sync.config",
  base: "mrcheff.sync.base",
  pendiente: "mrcheff.sync.pendiente",
  consumida: "mrcheff.sync.consumida"
};

function preparaApp({ gist, seed = estadoLocal() } = {}) {
  const app = bootApp({ seed, cryptoImpl: WEB_CRYPTO });
  app.localStorage.setItem("mrcheff.sync.iteraciones", "100");   // inyección de test (PBKDF2 bajo)
  app.localStorage.setItem(CLAVES.config, JSON.stringify({
    token: "token-de-test", gistId: "gist123", nombre: "PC de escritorio"
  }));
  app.window.sessionStorage.setItem("mrcheff.sync.pass", PASS);
  app.window.fetch = fetcherDe(gist || gistEnMemoria());
  return app;
}

const nota = app => app.document.getElementById("sync-note").textContent;
const btnSync = app => app.document.getElementById("btn-sync");

// Click en el window del boot (evento creado en SU jsdom-window, no en el global del test).
const clic = (app, el) => el.dispatchEvent(new app.window.MouseEvent("click", { bubbles: true }));

// Espera activa a un predicado asíncrono (el clic dispara cadenas await + WebCrypto).
async function hasta(predicado, ms = 4000) {
  const limite = Date.now() + ms;
  let error = null;
  for (;;) {
    try { if (await predicado()) return; } catch (e) { error = e; }
    if (Date.now() > limite) throw (error || new Error("timeout: el clic de sync no terminó"));
    await new Promise(r => setTimeout(r, 15));
  }
}


// ---------- tests ----------
describe("sync-ui — wiring real de app.js (FASE 5)", () => {

  test("sin configurar: Sync deshabilitado y con hint; el config modal guarda token/gist y habilita", () => {
    const app = bootApp({ seed: estadoLocal(), cryptoImpl: WEB_CRYPTO });
    expect(btnSync(app).disabled).toBe(true);
    expect(nota(app)).toContain("Sin configurar");

    clic(app, app.document.getElementById("btn-sync-config"));
    app.document.getElementById("sync-token").value = "mi-token-teclado";
    app.document.getElementById("sync-gist").value = "gist999";
    app.document.getElementById("sync-nombre").value = "PC de escritorio";
    app.document.getElementById("sync-pass").value = PASS;
    clic(app, app.document.getElementById("sync-guardar"));

    const guardada = JSON.parse(app.localStorage.getItem(CLAVES.config));
    expect(guardada).toEqual({ token: "mi-token-teclado", gistId: "gist999", nombre: "PC de escritorio" });
    // la passphrase SOLO en sessionStorage: jamás localStorage (§2 del plan)
    expect(app.localStorage.getItem(CLAVES.config)).not.toContain(PASS);
    expect(app.window.sessionStorage.getItem("mrcheff.sync.pass")).toBe(PASS);
    expect(btnSync(app).disabled).toBe(false);
    expect(nota(app)).toContain("Listo");
  });

  test("primer sync sin buzón: publica OFFER cifrada (con nonce pendiente en LS) y el mensaje del módulo", async () => {
    const app = preparaApp();
    clic(app, btnSync(app));
    await hasta(() => JSON.parse(app.localStorage.getItem(CLAVES.pendiente) || "null"));
    expect(nota(app)).toBe(sync.MENSAJES.publicado);
    const pendiente = JSON.parse(app.localStorage.getItem(CLAVES.pendiente));
    expect(typeof pendiente).toBe("string");
    // el payload publicado NO puede traer el texto de las recetas en claro (AES-GCM §2)
    const storage = app.window.localStorage.getItem(CLAVES.pendiente);
    expect(storage).not.toContain("Tortilla");
  });

  test("envolvente del otro dispositivo: aplica la fusión localmente, escribe ACK y deriva base", async () => {
    const gist = gistEnMemoria();
    const suyo = {
      foods: [{ id: "f2", name: "Cebolla", qty: 3, min: 1, score: 5, checked: true }],
      recipes: [{ id: "rec-nueva", title: "Paella del PC", meal: "comida", createdAt: 2000,
        ingredients: ["Arroz"], method: ["Sofreír"] }],
      innovations: [], cooked: [], weekmenu: null
    };
    gist.contenido = await envolventeDe({ deviceId: "movil", estado: suyo, nonce: "nonce-movil" });
    const app = preparaApp({ gist });

    clic(app, btnSync(app));
    await hasta(() => app.recipes.some(r => r.id === "rec-nueva"));
    expect(nota(app)).toBe(sync.MENSAJES.aplicado);
    // la receta local sobrevive y la nueva entra; el food nuevo sube a la vista
    expect(app.recipes.length).toBe(2);
    expect(app.foods.some(f => f.name === "Cebolla")).toBe(true);
    const titleEnDOM = [...app.document.querySelectorAll("h3")].some(h => h.textContent.includes("Paella del PC"));
    expect(titleEnDOM).toBe(true);
    // el ACK del gist responde a la envolvente recibida
    expect(gist.contenido.kind).toBe("ack");
    expect(gist.contenido.parentId).toBe("nonce-movil");
    // base del antecesor común avanza (según sync convergido: incluye ambas recetas)
    const base = JSON.parse(app.localStorage.getItem(CLAVES.base));
    expect(base.recipes.map(r => r.id).sort()).toEqual(["rec-1", "rec-nueva"].sort());
    // idempotencia inmediata: la envolvente en el buzón es MÍA → rama "pendiente", nada explota
    clic(app, btnSync(app));
    await hasta(() => nota(app) === sync.MENSAJES.pendiente);
  });

  test("conflicto de la MISMA línea: abre el resolver con las 2 versiones y 'Conservar ambas' aplica copia con badge", async () => {
    const base = estadoLocal();               // método v0: "Batir huevos"
    base.recipes[0] = Object.assign({}, base.recipes[0], { method: ["Batir huevos", "Cuajar a fuego bajo"] });
    const mio = estadoLocal();
    mio.recipes[0] = Object.assign({}, mio.recipes[0], { method: ["Bate la mezcla con sal", "Cuajar a fuego bajo"], editedAt: "2026-10-19T09:00:00.000Z" });
    const suyo = estadoLocal();
    suyo.recipes[0] = Object.assign({}, suyo.recipes[0], { method: ["Batir huevos con hielo", "Cuajar a fuego bajo"], editedAt: "2026-10-19T09:30:00.000Z" });
    const gist = gistEnMemoria();
    gist.contenido = await envolventeDe({ deviceId: "movil", estado: suyo, nonce: "nonce-conflicto" });

    const app = preparaApp({ gist, seed: mio });
    app.localStorage.setItem(CLAVES.base, JSON.stringify(base));

    clic(app, btnSync(app));
    await hasta(() => app.document.getElementById("resolver-aplicar"));
    // el resolver muestra el título con badge y las DOS versiones lado a lado (nada descartado)
    const cuerpo = app.document.getElementById("modal-content").textContent || "";
    expect(cuerpo).toContain("Tortilla española");
    expect(cuerpo).toContain("Bate la mezcla con sal");        // versión de aquí
    expect(cuerpo).toContain("Batir huevos con hielo");        // versión del otro
    expect(cuerpo).toContain("⇄ conflicto");
    expect(btnSync(app).disabled).toBe(false);                 // el protocolo NO bloquea la app
    expect(app.recipes.length).toBe(1);                        // nada escrito aún (§3/§5)

    // decisión "Conservar ambas" → aplicar → ACK + copia "duplicada" + render con badge
    const btnAmbas = [...app.document.querySelectorAll("[data-decision='ambas']")][0];
    clic(app, btnAmbas);
    clic(app, app.document.getElementById("resolver-aplicar"));
    await hasta(() => app.recipes.length === 2);
    expect(nota(app)).toBe(sync.MENSAJES.aplicado);
    expect(gist.contenido.kind).toBe("ack");
    expect(gist.contenido.parentId).toBe("nonce-conflicto");
    const copia = app.recipes.find(r => r.id !== "rec-1");
    expect(copia.duplicada).toBe(true);                        // marcar para limpieza manual, §5
    expect(copia.method[0]).toBe("Batir huevos con hielo");    // la versión PERDEDORA se conserva
    const badge = app.document.querySelector(".tag-sync-duplicada");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain("duplicada");
    // la copia entró en el almacen persistido también
    const persistidas = JSON.parse(app.localStorage.getItem("mrcheff.recipes"));
    expect(persistidas.length).toBe(2);
  });

  test("red caída a mitad del protocolo: error textual y estado local intacto", async () => {
    const gist = gistEnMemoria();
    gist.redViva = false;
    const app = preparaApp({ gist, seed: estadoLocal() });
    const antes = app.window.localStorage.getItem("mrcheff.recipes");

    clic(app, btnSync(app));
    await hasta(() => nota(app) !== "" && nota(app) !== "⏳ Sincronizando con el buzón…");
    expect(nota(app)).toBe(sync.MENSAJES.errorRed);
    expect(app.window.localStorage.getItem("mrcheff.recipes")).toBe(antes);
    expect(app.window.localStorage.getItem(CLAVES.pendiente)).toBeFalsy();
  });

  test("passphrase errónea: el error NO corrompe nada y el badge de estado avisa sin escribir", async () => {
    const gist = gistEnMemoria();
    gist.contenido = await envolventeDe({ deviceId: "movil", estado: estadoLocal(), nonce: "nonce-otro-pass" });
    const app = preparaApp({ gist, seed: estadoLocal() });
    app.window.sessionStorage.setItem("mrcheff.sync.pass", "phrase-INCORRECTA");

    clic(app, btnSync(app));
    await hasta(() => nota(app) === sync.MENSAJES.passphrase);
    expect(app.recipes.length).toBe(1);                        // la local, solo la local
    expect(app.window.localStorage.getItem(CLAVES.base)).toBeFalsy();
  });
});

// ---------- REGLA del transporte del plan semanal (petición 2026-10-21) ----------
// El plan APROBADO viaja por el buzón con TODO su contenido (plan 7×3 + needyFoods = lista de la
// compra) y se recupera VIVO en el otro dispositivo; un preview NO aprobado no viaja.

// Plan REAL 7×3 con los huecos aún sin receta (meals[]) — los needy Foods alimentan la Card 3.
const semanaPlan = () => ({
  approved: true, generatedOn: "2026-10-21",
  plan: Array.from({ length: 7 }, (_, i) => ({ dayLabel: `Día ${i + 1}`, meals: [] })),
  needyFoods: [{ name: "Leche", qty: 1, min: 0, score: 5 }]
});

describe("sync-ui — el PLAN APROBADO viaja por el buzón (regla del transporte, 2026-10-21)", () => {

  async function snapshotPublicado(gist, app) {
    await hasta(() => JSON.parse(app.localStorage.getItem(CLAVES.pendiente) || "null"));
    const publicada = gist.contenido;                          // la offer tal como quedó en el buzón
    expect(publicada.kind).toBe("offer");
    const key = await cripto.deriveKey(PASS, publicada.header.salt, publicada.header.iterations, { crypto: WEB_CRYPTO });
    return cripto.decryptJson(key, publicada.payload, { crypto: WEB_CRYPTO });
  }

  test("PUBLICACIÓN: el plan aprobado viaja ENTERO (needyFoods incluidas) — descifrado y legible", async () => {
    const gist = gistEnMemoria();
    const seed = estadoLocal();
    seed.weekmenu = semanaPlan();
    const app = preparaApp({ gist, seed });

    clic(app, btnSync(app));
    const snapshot = await snapshotPublicado(gist, app);
    expect(snapshot.weekmenu.approved).toBe(true);
    expect(snapshot.weekmenu.plan).toHaveLength(7);
    expect(snapshot.weekmenu.needyFoods.map(f => f.name)).toEqual(["Leche"]);   // la lista de la compra viaja con el plan
  });

  test("PUBLICACIÓN: un PREVIEW no aprobado NO viaja (weekmenu null en el snapshot cifrado)", async () => {
    const gist = gistEnMemoria();
    const seed = estadoLocal();
    seed.weekmenu = { approved: false, generatedOn: "2026-10-21", plan: semanaPlan().plan.slice(0, 3) };
    const app = preparaApp({ gist, seed });

    clic(app, btnSync(app));
    const snapshot = await snapshotPublicado(gist, app);
    expect(snapshot.weekmenu).toBeNull();                      // aprobar es lo que pone la semana en circulación
  });

  test("RECOGIDA: el plan aprobado del otro dispositivo se recupera VIVO (días, botón de Aprobar y lista de la compra)", async () => {
    const gist = gistEnMemoria();
    const suyo = estadoLocal();
    suyo.weekmenu = semanaPlan();
    gist.contenido = await envolventeDe({ deviceId: "movil", estado: suyo, nonce: "nonce-plan" });
    const app = preparaApp({ gist });

    expect(app.window.localStorage.getItem("mrcheff.weekmenu")).toBeNull();    // sin plan local antes
    clic(app, btnSync(app));
    await hasta(() => JSON.parse(app.window.localStorage.getItem("mrcheff.weekmenu") || "null"));
    const adoptado = JSON.parse(app.window.localStorage.getItem("mrcheff.weekmenu"));
    expect(adoptado.approved).toBe(true);
    expect(adoptado.plan).toHaveLength(7);
    expect(nota(app)).toBe(sync.MENSAJES.aplicado);

    // el plan nace en su estado final: 7 días pintados + botón de Aprobar bajo el faldón + barra
    expect(app.document.querySelectorAll("#menu-plan-list .menu-day")).toHaveLength(7);
    expect(app.document.getElementById("btn-menu-approve").disabled).toBe(true);
    expect(app.document.getElementById("btn-menu-approve").textContent).toBe("✅ Plan aprobado");

    // la lista de la compra (Card 3) nace de los needyFoods adoptados: la Leche no está en casa
    const filas = [...app.document.querySelectorAll("#shopping-list ul li")].map(li => li.textContent);
    expect(filas.some(t => t.includes("Leche"))).toBe(true);

    // la base avanza con el plan aprobado: el próximo sync parte de él
    expect(JSON.parse(app.localStorage.getItem(CLAVES.base)).weekmenu.approved).toBe(true);
  });
});

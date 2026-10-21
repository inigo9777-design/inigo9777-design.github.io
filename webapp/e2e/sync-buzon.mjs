// e2e/sync-buzon.mjs — E2E MANUAL del sync por buzón GitHub (plan-sync-buzon.md §8/§9, FASE 6).
// Dos navegadores REALES (contextos Playwright separados) contra un gist REAL: es la única pieza
// que la suite Jest no puede sustituir (red + PWA instalada + passphrase compartida).
//
//   ✦ NUNCA hardcodees el token:  MCHEFF_TOKEN=ghp_xxx [MCHEFF_GIST=…] [MCHEFF_APP=https://…] [MCHEFF_PASS=…]
//     node e2e/sync-buzon.mjs
//   ✦ Si MCHEFF_GIST no viene, se crea un gist nuevo (el token necesita scope `gist`) y se
//     imprime su id para reutilizarlo como buzón estable; al terminar el gist queda {"kind":"empty"}.
//   ✦ La app debe estar servida por https o localhost (MCHEFF_APP, por defecto la PWA de
//     https://inigo9777-design.github.io/webapp/).
//
// Pasos que replica (mismos mensajes de rama del plan §3/§6):
//   (1) PC: sembrar localStorage (1 receta), configurar token/gist/passphrase, "🔄 Sync" →
//       "Cambios publicados…" y el gist contiene kind:"offer" SIN texto legible (§11).
//   (2) Móvil: configurar con la MISMA passphrase, "🔄 Sync" → "Cambios del otro dispositivo
//       aplicados."; su localStorage trae la receta del PC (verificada por título) y el gist
//       queda en kind:"ack".
//   (3) PC: "🔄 Sync" → absorbe su propia offer → "aplicados" + "limpio"; el gist queda
//       {"kind":"empty"} — entre sincronizaciones NO hay datos online (§11).
//   (4) CONFLICTO de la misma línea (§5): ambos editan el paso 1 de la receta (PC y móvil
//       lo escriben distinto, sin sync intermedio) → "🔄 Sync" en el móvil → badge
//       "⇄ conflicto", modal resolver con las DOS versiones → "Conservar ambas" → copia
//       con badge "duplicada"; "Aplicar resolución" → ACK. Nada de texto se pierde (§11).
//   (5) PC: "🔄 Sync" → la resolución viaja: las 2 versiones están en ambos dispositivos.
//   (6) Móvil en modo avión (fetch caído) → mensaje de error textual y estado local intacto.
//   (7) REGLA del transporte del plan (2026-10-21): en el PC genera y APRUEBA el menú semanal
//       (con su compra pendiente) → "🔄 Sync" → en el móvil "🔄 Sync" → "Cambios del otro
//       dispositivo aplicados." y en Sugerencias y menú aparecen los 7 días y la lista de la
//       compra con el botón de Aprobar bajo el faldón. Lo mismo por copia manual: exportar
//       en el PC e importar en el móvil replica la recuperación. Con el menú SÓLO GENERADO
//       (preview, no aprobado) ni el sync ni el export transportan nada del plan.
// Capturas en reports/ui-brave/40-…43-sync-*.png.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const TOKEN = process.env.MCHEFF_TOKEN;
let GIST = process.env.MCHEFF_GIST || null;
const APP = process.env.MCHEFF_APP || "https://inigo9777-design.github.io/webapp/";
const PASS = process.env.MCHEFF_PASS || "frase-de-prueba-e2e";
mkdirSync(new URL("../../reports/ui-brave/", import.meta.url), { recursive: true });

if (!TOKEN) {
  console.error("Falta MCHEFF_TOKEN (PAT con scope gist — NUNCA hardcodeado; plan §9). Abortando.");
  process.exit(1);
}

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};

const API = "https://api.github.com";
const CABECERAS = { Authorization: "token " + TOKEN, Accept: "application/vnd.github+json" };

async function gistLeer() {
  const res = await fetch(API + "/gists/" + GIST, { headers: CABECERAS });
  if (!res.ok) return null;
  const g = await res.json();
  const fichero = g.files && g.files["mrcheff-sync.json"];
  if (!fichero || !fichero.content) return null;
  try { return JSON.parse(fichero.content); } catch { return null; }
}
async function gistCrear() {
  const res = await fetch(API + "/gists", {
    method: "POST", headers: CABECERAS,
    body: JSON.stringify({ public: false, files: { "mrcheff-sync.json": { content: '{"kind":"empty"}' } } })
  });
  if (!res.ok) throw new Error("POST gist: HTTP " + res.status);
  const g = await res.json();
  console.log("(buzón nuevo creado: " + g.id + ")");
  return g.id;
}

// ---------- helpers de UI ----------
async function configSync(page, nombre) {
  await page.locator("#btn-sync-config").click();
  await page.locator("#sync-token").fill(TOKEN);
  await page.locator("#sync-gist").fill(GIST);
  await page.locator("#sync-nombre").fill(nombre);
  await page.locator("#sync-pass").fill(PASS);
  await page.locator("#sync-guardar").click();
}
async function syncEsperar(page) {
  const btn = page.locator("#btn-sync");
  await btn.click();
  await page.waitForFunction(() => !document.getElementById("btn-sync").disabled, null, { timeout: 30000 });
  return (await page.locator("#sync-note").textContent()).trim();
}
async function editarInPlace(page, titulo, paso) {
  await page.evaluate((t, p) => {
    const rs = JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]");
    const r = rs.find(x => x.title === t);
    if (r) { r.method[0] = p; r.editedAt = new Date().toISOString(); }
    localStorage.setItem("mrcheff.recipes", JSON.stringify(rs));
    location.reload();
  }, titulo, paso);
  await page.waitForLoadState("networkidle");
}

// ---------- arranque ----------
if (!GIST) GIST = await gistCrear();
const antes = await gistLeer();
ok(antes == null || antes.kind === "empty", "(0) el buzón empieza vacío (sin datos)");

const browser = await chromium.launch({
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
});
const pc = await browser.newContext();
const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// (1) PC siembra datos y publica la offer
const pagePC = await pc.newPage();
await pagePC.goto(APP, { waitUntil: "networkidle" });
await pagePC.evaluate(() => {
  localStorage.setItem("mrcheff.recipes", JSON.stringify([{
    id: "rec-e2e-1", title: "Tortilla e2e", meal: "comida", createdAt: 1,
    ingredients: ["Huevos", "Patata"], method: ["Batir huevos", "Cuajar"]
  }]));
  location.reload();
});
await pagePC.waitForLoadState("networkidle");
await configSync(pagePC, "PC");
const msgPC1 = await syncEsperar(pagePC);
ok(msgPC1.includes("Cambios publicados"), "(1) PC publica la offer");
const offer = await gistLeer();
ok(offer && offer.kind === "offer", "(1) el gist contiene kind offer");
ok(!JSON.stringify(offer).includes("Tortilla e2e"), "(1) GitHub solo ve ciphertext (sin texto legible)");
await pagePC.screenshot({ path: "reports/ui-brave/40-sync-1-pc-offer.png" });

// (2) móvil aplica la fusión y el gist queda en ACK
const pageM = await movil.newPage();
await pageM.goto(APP, { waitUntil: "networkidle" });
await configSync(pageM, "Móvil");
const msgM1 = await syncEsperar(pageM);
ok(msgM1.includes("aplicados"), "(2) móvil aplica la fusión");
const recetasM = await pageM.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]"));
ok(recetasM.some(r => r.title === "Tortilla e2e"), "(2) la receta del PC llegó al móvil");
const ack = await gistLeer();
ok(ack && ack.kind === "ack", "(2) el gist queda en kind ack");
await pageM.screenshot({ path: "reports/ui-brave/41-sync-2-movil-aplicado.png" });

// (3) PC absorbe su propia offer → buzón limpio
const msgPC2 = await syncEsperar(pagePC);
ok(msgPC2.includes("aplicados") && msgPC2.includes("limpio"), "(3) PC absorbe su offer y vacía el buzón");
const vacio = await gistLeer();
ok(vacio && vacio.kind === "empty", '(3) el gist queda {"kind":"empty"} — nada online');

// (4) CONFLICTO de la misma línea + resolver (§5)
await editarInPlace(pagePC, "Tortilla e2e", "Batir huevos por el PC");
await editarInPlace(pageM, "Tortilla e2e", "Batir huevos por el móvil");
const msgM2 = await syncEsperar(pageM);
ok(!(msgM2 || "").includes("aplicados"), "(4) el sync con conflicto NO aplica nada");
const resolver = pageM.locator(".resolver-receta");
ok((await resolver.count()) === 1, "(4) el modal resolver abre (chip ⇄ conflicto)");
const resumen = await resolver.textContent();
ok(resumen.includes("Batir huevos por el PC") && resumen.includes("Batir huevos por el móvil"), "(4) las DOS versiones de la misma línea están lado a lado");
await pageM.screenshot({ path: "reports/ui-brave/42-sync-4-conflicto-resolver.png" });
await pageM.locator("[data-decision='ambas']").click();
await pageM.locator("#resolver-aplicar").click();
await pageM.waitForFunction(() => {
  const rs = JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]");
  return rs.length === 2 && rs.some(r => r.duplicada === true);
}, null, { timeout: 30000 });
ok((await pageM.locator(".tag-sync-duplicada").count()) >= 1, "(4) la copia conserva el badge duplicada");
const trasConflicto = await gistLeer();
ok(trasConflicto && trasConflicto.kind === "ack", "(4) el ACK transporta el estado fusionado completo");

// (5) reciprocidad: el PC adopta la resolución (ninguna versión se pierde en ninguno)
const msgPC3 = await syncEsperar(pagePC);
ok(msgPC3.includes("aplicados"), "(5) PC recibe la resolución");
const recetasPC = await pagePC.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]"));
const recetasM2 = await pageM.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]"));
ok(recetasPC.length === 2 && recetasM2.length === 2, "(5) las 2 versiones están en ambos dispositivos");
const pasosPC = recetasPC.map(r => r.method[0]).sort().join("|");
const pasosM = recetasM2.map(r => r.method[0]).sort().join("|");
ok(pasosPC === pasosM, "(5) reciprocidad del diff3: mismo par de versiones en los dos lados");

// (6) red caída: mensaje honesto y estado local intacto
await pageM.context().setOffline(true);
const antesM = await pageM.evaluate(() => localStorage.getItem("mrcheff.recipes"));
const msgM3 = await syncEsperar(pageM);
ok(msgM3.includes("no está accesible"), "(6) red caída → mensaje textual");
ok((await pageM.evaluate(() => localStorage.getItem("mrcheff.recipes"))) === antesM, "(6) el estado local queda intacto");
await pageM.context().setOffline(false);
await pageM.screenshot({ path: "reports/ui-brave/43-sync-6-offline.png" });

await browser.close();
console.log(fallos === 0 ? "\nALL GREEN — sync de 2 dispositivos verificado" : `\n${fallos} FAIL`);
process.exit(fallos === 0 ? 0 : 1);

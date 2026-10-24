// e2e/ocr-precision.mjs — LA MÉTRICA del requisito 95% (épica ocr-despensa-camara).
// Ejecutar:  node e2e/ocr-precision.mjs   (requiere las fotos reales en reports/OCR + la VERDAD
// en reports/OCR/verdad/*.json; si falta material, la prueba SE SALTA sola — lo cubren los
// sintéticos y las 18 specs del parser con fixtures reales).
//
// El loop COMPLETO y honesto: foto real del ticket → conversión/giro (heic2any/WebKit) → Tesseract
// spa real (Brave) → window.__mrcheffProcesarTextoOcr → PARSER estructural → filas de los diálogos
// del escáner. Cada fila detectada se confronta con la VERDAD (lo que la tienda cobró de verdad,
// contado a mano): match por TOKENS (el OCR muerde nombres; se exige el ítem, no la palabra).
// El 95% por cadena: CADA cadena del corpus debe alcanzar ≥95% de sus ítems reales con nombre
// legible y cantidad correcta (la media no vale, lo pidió el usuario con los dos tickets).
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));              // webapp/
const CARPETA = path.resolve(fileURLToPath(new URL("../../reports/OCR/", import.meta.url)));
const VERDAD = path.join(CARPETA, "verdad");
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

let FOTOS = [];
try {
  FOTOS = readdirSync(CARPETA).filter(f => /\.(png|jpe?g|heic|heif)$/i.test(f) && !f.startsWith("."));
} catch {}

function verdadDe(foto) {
  if (!existsSync(VERDAD)) return null;
  for (const f of readdirSync(VERDAD).filter(f => f.endsWith(".json"))) {
    const v = JSON.parse(readFileSync(path.join(VERDAD, f), "utf8"));
    const stem = v.archivo.replace(/\.[^.]+$/, "").replace(/[^\w]+/g, "");
    const stemFoto = foto.replace(/\.[^.]+$/, "").replace(/[^\w]+/g, "");
    if (stemFoto.includes(stem) || stem.includes(stemFoto) || foto.startsWith(v.archivo.slice(0, 6))) return { ...v, fichero: f };
  }
  return null;
}

if (!FOTOS.length || !FOTOS.some(verdadDe)) {
  console.log("(sin fotos+verdad emparejables en reports/OCR — la métrica se salta; specs del parser y e2e sintéticos siguen cubriendo la feature)");
  process.exit(0);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json"
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1").pathname;
  const file = path.join(RAIZ, url === "/" ? "index.html" : decodeURIComponent(url));
  if (!file.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  try {
    const data = readFileSync(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;
console.log("(app servida en " + APP + ")");

let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const tokensDe = s => norm(s).split(/[^a-z0-9]+/).filter(t => t.length >= 2);
const criaTokens = n => tokensDe(n.replace(/\(500gr\)/i, ""));   // el sufijo del granel no mienta al match
// DISTANCIA de edición acotada (Levenshtein en ventanita): el OCR muerde letras ("DEBIDA" por
// "BEBIDA", "PASTGSIN" por "PASESIN") — la métrica exige el ÍTEM con nombre legible/editable,
// no la palabra perfecta; ≤2 cambios por token, ≤1 para tokens cortos (≤5).
function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}
const tecito = (t, u) => t === u || (t.length <= 5 ? lev(t, u) <= 1 : lev(t, u) <= 2);

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let indice = 40;                       // capturas 40+ de la métrica (el resto del repo usa 1-36)
try {
  for (const foto of FOTOS) {
    const verdad = verdadDe(foto);
    if (!verdad) { console.log(`\n(sin verdad para ${foto} — se salta)`); continue; }
    console.log(`\n════════ ${verdad.cadena}: ${foto} · verdad ${verdad.items.length} ítems ════════`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-ES" });
    await context.addInitScript(() => {
      localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
      localStorage.setItem("mrcheff.foods", JSON.stringify([]));   // despensa VACÍA: todo el ticket cae en la revisión
    });
    const page = await context.newPage();
    page.setDefaultTimeout(600000);
    await page.goto(APP, { waitUntil: "domcontentloaded" });

    // CAPTURA del texto RECONOCIDO de producción (para calibrar el parser con el corpus vivo):
    // envolvemos el gancho en cuanto la app lo registra — el escaneo tarda segundos, el envuelto
    // llega mucho antes.
    await page.evaluate(async () => {
      for (let i = 0; i < 400; i++) {
        if (window.MRCheff && window.MRCheff.ticketParser) break;
        await new Promise(r => setTimeout(r, 50));
      }
      // CAPTURA del texto de PRODUCCIÓN: envolvemos parsearTicket — es a donde escanearFoto pasa
      // cada cara reconocida; su ÚLTIMA llamada es el texto que el procesamiento de verdad usó.
      const tp = window.MRCheff && window.MRCheff.ticketParser;
      window.__mrcheffTextoOcrCrudo = "";
      if (tp) {
        const p0 = tp.parsearTicket.bind(tp);
        tp.parsearTicket = t => {
          window.__mrcheffTextoOcrCrudo = t;
          return p0(t);
        };
      }
    });

    await page.setInputFiles("#ocr-file", path.join(CARPETA, foto));
    const modal = page.locator(".modal-content");
    await Promise.race([
      modal.locator("h2", { hasText: "Ya lo tienes en el inventario" }).waitFor({ timeout: 600000 }),
      modal.locator("h2", { hasText: "Añade lo nuevo" }).waitFor({ timeout: 600000 }),
      modal.locator("h2", { hasText: "No he detectado alimentos" }).waitFor({ timeout: 600000 })
    ]);
    const titulo = await modal.locator("h2").first().textContent();
    ok(!titulo.includes("No he detectado"), `${verdad.cadena}: la foto se abre y el OCR la lee`);

    // TODAS las filas de los diálogos (con despensa vacía, la revisión lleva todo el ticket)
    const filas = await modal.locator(".ocr-item").all();
    const detectados = [];
    for (const fila of filas) {
      const inputNombre = fila.locator(".rev-campo-nombre");
      const nombre = (await inputNombre.count())
        ? (await inputNombre.inputValue()).trim()
        : (await fila.locator(".ocr-nombre strong").textContent()).trim();
      const qty = Number(await fila.locator(".exact-qty, input[id^='rev-qty-']").first().inputValue());
      detectados.push({ nombre, qty });
    }
    console.log("   detectados:", detectados.length, "ítems");
    // El texto de PRODUCCIÓN queda en el corpus volcado (reports/OCR/texto/, descartable): es el
    // que el motor con PSM6+espacios lee HOY — las specs del parser calibran contra él.
    const crudo = await page.evaluate(() => window.__mrcheffTextoOcrCrudo || "");
    try {
      const pathCrudo = path.join(CARPETA, "texto", `PRODUCCION-${verdad.cadena.toLowerCase()}.txt`);
      writeFileSync(pathCrudo, `# ${foto} · PRODUCCIÓN (1600px, PSM 6, worker reutilizado) · ${new Date().toISOString()}\n\n${crudo}`);
    } catch {}
    await page.screenshot({ path: path.join(OUT_DIR, `${indice}-precision-${path.extname(foto).slice(1)}.png`), fullPage: false });
    indice++;

    // ─── CONFRONTA con la verdad: greedy por tokens (máxima solapación primero)
    const esperados = verdad.items.map(v => ({ ...v, usada: false }));
    const esperadoLotes = item => item.pesoKg != null ? Math.max(1, Math.round(item.pesoKg * 2)) : item.qty;
    let aciertos = 0, conQty = 0;
    const faltas = [];
    for (const d of detectados) {
      const dt = criaTokens(d.nombre);
      let mejor = null, mejorSolap = 0;
      for (const e of esperados) {
        if (e.usada) continue;
        const et = criaTokens(e.nombre);
        const comun = dt.filter(t => et.some(u => t === u || (u.length > 3 && t.startsWith(u)) || tecito(t, u))).length;
        if (comun > mejorSolap) { mejorSolap = comun; mejor = e; }
      }
      if (mejor && mejorSolap >= Math.max(1, Math.min(dt.length, 2))) {
        mejor.usada = true;
        const esperadoQty = esperadoLotes(mejor);
        const qtyOk = Number(d.qty) === esperadoQty;
        if (qtyOk) conQty++;
        else faltas.push(`qty de "${mejor.nombre}": esperada ${esperadoQty} · leída ${d.qty} ("${d.nombre}")`);
        aciertos++;
      } else {
        faltas.push(`falso positivo: "${d.nombre}" ×${d.qty} no está en la verdad`);
      }
    }
    const sinDetectar = esperados.filter(e => !e.usada).map(e => `${e.nombre} ×${esperadoLotes(e)}`);
    const total = verdad.items.length;
    const ratio = aciertos / total;
    const ratioQty = conQty / total;
    console.log(`   emparejados ${aciertos}/${total} (${(ratio * 100).toFixed(1)}%) · qty correcta ${conQty}/${total} (${(ratioQty * 100).toFixed(1)}%)`);
    for (const f of faltas) console.log("      · " + f);
    for (const s of sinDetectar) console.log("      · SIN detectar: " + s);

    ok(ratio >= 0.95, `${verdad.cadena}: ≥95% de los ítems REALES llegan al diálogo (${(ratio * 100).toFixed(1)}%)`);
    ok(ratioQty >= 0.95, `${verdad.cadena}: ≥95% con la CANTIDAD correcta (${(ratioQty * 100).toFixed(1)}%)`);
    // Los nombres se ofrecen EDITABLES en ambas filas (exactos fijos, revisión libres): lo que el
    // OCR mordió se corrige a mano sin re-hacer nada — parte del criterio del requisito.
    const editables = await modal.locator(".rev-campo-nombre").count();
    ok(editables > 0, `${verdad.cadena}: filas con nombre EDITABLE en la revisión`);
    await context.close();
  }
} catch (err) {
  fallos++;
  console.error("✘ falla no esperada del e2e:", err && err.message);
} finally {
  await browser.close();
  server.close();
}

console.log(fallos ? `\n${fallos} comprobaciones FALLARON` : "\nMétrica 95% completa OK");
process.exit(fallos ? 1 : 0);

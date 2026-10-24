// e2e/ocr-inspeccion.mjs — INSPECCIÓN DEL CORPUS del requisito 95% (épica ocr-despensa-camara).
// Por cada foto REAL de reports/OCR vuelca el TEXTO CRUDO que el motor lee con tres configuraciones:
//   A) baseline actual — lienco a LADO_MAX 1600 + Tesseract default (lo que hace la app hoy);
//   B) afinada — lienco grande + PSM 6 (bloque uniforme) + preserve_interword_spaces + DPI 300;
//   C) B + binarización (gris + contraste, umbral fijo de 2 picos).
// El resultado queda en reports/OCR/texto/<foto>.<variante>.txt: ahí se ESCRIBE el parser
// (E-2) con material real, y cada re-corrida mide el progreso del motor con el mismo corpus.
// Ejecutar: node e2e/ocr-inspeccion.mjs
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));              // webapp/
const CARPETA = path.resolve(fileURLToPath(new URL("../../reports/OCR/", import.meta.url)));
const OUT_TXT = path.join(CARPETA, "texto");

let FOTOS = [];
try {
  FOTOS = readdirSync(CARPETA).filter(f => /\.(png|jpe?g|heic|heif)$/i.test(f) && !f.startsWith(".") && !f.includes("/texto/"));
} catch {}
if (!FOTOS.length) {
  console.log("(sin fotos en reports/OCR — nada que inspeccionar)");
  process.exit(0);
}
mkdirSync(OUT_TXT, { recursive: true });

// Las HEIC del iPhone necesitan decodificación (heic2any no trae HEVC): macOS la hace NATIVA con
// `sips` — material DESCARTABLE igual que la carpeta (reports/OCR/decodificadas, nunca a git).
import { execFileSync } from "node:child_process";
const DECODIFICADAS = path.join(CARPETA, "decodificadas");
mkdirSync(DECODIFICADAS, { recursive: true });
function fotoCargable(foto) {
  const ruta = path.join(CARPETA, foto);
  if (!/\.(heic|heif)$/i.test(foto)) return ruta;
  const destino = path.join(DECODIFICADAS, foto.replace(/\.[^.]+$/, "") + ".jpg");
  try {
    execFileSync("sips", ["-s", "format", "jpeg", ruta, "--out", destino], { stdio: "pipe" });
  } catch (e) {
    console.log(`   (sips no pudo decodificar ${foto}: ${e.message})`);
    return null;
  }
  return destino;
}

const MIME = { ".html": "text/html; charset=utf-8" };
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

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-ES" });
const page = await context.newPage();
page.setDefaultTimeout(600000);
await page.goto(APP, { waitUntil: "domcontentloaded" });

// El motor (Tesseract + wasm) y el conversor HEIC se cargan UNA vez por sesión y sirven a todas
// las variantes — las caras y el pre-procesado son decisiones locales del script.
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js" });
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js" });
await page.waitForFunction(() => window.Tesseract && window.heic2any, null, { timeout: 600000 });

// ── el pipeline de foto: HEIC→JPEG, canvas escalado a `ladoMax` por el lado mayor y la pasada del
//    motor; `binarizar` aplica el pre-procesado del lienzo ANTES de reconocer (variante C).
await page.evaluate(() => {
  window.__escanerInspeccion = async (base64, mime, ladoMax, psm, binarizar) => {
    const Tesseract = window.Tesseract;
    const worker = await Tesseract.createWorker("spa", 1, {});
    try {
      const params = { user_defined_dpi: "300", preserve_interword_spaces: "1" };
      if (psm) params.tessedit_pageseg_mode = String(psm);
      await worker.setParameters(params);

      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      let blob = new Blob([bytes], { type: mime });
      if (mime.includes("heic") || mime.includes("heif")) {
        blob = await window.heic2any({ blob, toType: "image/jpeg", quality: 0.95 });
        if (Array.isArray(blob)) blob = blob[0];
      }
      const bitmap = await createImageBitmap(blob);
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const cx = lienzo.getContext("2d");
    cx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

      if (binarizar) {
      const img = cx.getImageData(0, 0, lienzo.width, lienzo.height);
      const d = img.data;
      // gris + estirar contraste por percentiles robustos (2 y 98) y umbral de Otsu aproximado:
      // el papel térmico es casi blanco, la tinta casi negra — separo por histograma.
      let min = 255, max = 0;
      const gris = new Float32Array(lienzo.width * lienzo.height);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gris[p] = g;
        if (g < min) min = g;
        if (g > max) max = g;
      }
      const rango = Math.max(1, max - min);
      for (let p = 0, i = 0; p < gris.length; p++, i += 4) {
        const estirada = Math.round(((gris[p] - min) / rango) * 255);
        const v = estirada > 150 ? 255 : 0;          // umbral del papel térmico bien iluminado
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
    }

    const { data } = await worker.recognize(lienzo);
      return {
        texto: (data && data.text) || "",
        confianza: (data && data.confidence) || 0,
        dims: `${lienzo.width}x${lienzo.height}`
      };
    } finally {
      await worker.terminate().catch(() => {});
    }
  };
});

let fallos = 0;
for (const foto of FOTOS) {
  const cargable = fotoCargable(foto);
  if (!cargable) continue;
  const buffer = readFileSync(cargable);
  const mime = "image/jpeg";
  const base = foto.replace(/\.[^.]+$/, "").replace(/[^\w.,-]+/g, "_").slice(0, 40);
  console.log(`\n════════ ${foto} ════════`);
  const variantes = [
    ["A_default_1600_defaultPSM", 1600, null, false],
    ["B_fullres_2400_psm6", 2400, 6, false],
    ["C_fullres_2400_psm6_binarizada", 2400, 6, true]
  ];
  for (const [nombre, ladoMax, psm, binarizar] of variantes) {
    let r;
    try {
      r = await page.evaluate(async ([bs64, m, l, p, b]) => {
        try {
          return await window.__escanerInspeccion(bs64, m, l, p, b);
        } catch (e) {
          return { error: String((e && e.message) || e) };
        }
      }, [buffer.toString("base64"), mime, ladoMax, psm, binarizar]);
    } catch (e) {
      console.log(`   ✘ ${nombre}: evaluate falló: ${String((e && e.message) || e)}`);
      fallos++;
      continue;
    }
    if (!r || r.error) {
      console.log(`   ✘ ${nombre}: ${r ? r.error : "(sin resultado)"}`);
      fallos++;
      continue;
    }
    {
      const destino = path.join(OUT_TXT, `${base}.${nombre}.txt`);
      writeFileSync(destino, `# ${foto} · variante ${nombre} · ${r.dims} · confianza ${r.confidence}\n\n${r.texto}`, "utf8");
      console.log(`   ${nombre}: ${r.dims} conf=${r.confidence} líneas=${r.texto.split(/\r?\n/).filter(Boolean).length} → ${path.basename(destino)}`);
    }
  }
}

await context.close();
await browser.close();
server.close();
console.log(fallos ? `\n${fallos} variantes fallaron` : "\nInspección completa: textos en reports/OCR/texto/");
process.exit(fallos ? 1 : 0);

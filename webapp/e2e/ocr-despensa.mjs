// e2e/ocr-despensa.mjs — Verificación del ESCÁNER DEL TICKET de la compra (OCR) con Brave REAL. #epic-ocr-despensa-camara
// Ejecutar:  node e2e/ocr-despensa.mjs     (levanta su propio servidor en http://127.0.0.1 — necesario
// para que Tesseract.js cargue su worker desde el CDN; por file:// el worker no arranca)
//
// ══════════════ CÓMO PROBARLO EN EL MUNDO REAL ══════════════
//   MÓVIL (lo que pide el epic: la cámara SÓLO se ofrece en la vista móvil):
//     1. Sirve la app por https (Netlify Drop / GitHub Pages — ver e2e/pwa-instalable.mjs) y ábrela en Brave.
//     2. Vista Alimentos → botón "📷 Escanear el ticket con la cámara" (SÓLO aparece en móvil).
//     3. Se abre la app de la cámara del sistema SIN pedir permisos ni https extra: fotógrafo el
//        ticket del super (o el frigorífico: la vía es la misma), de frente y con buena luz.
//     4. CONFIRMACIÓN EN DOS DIÁLOGOS, sin salir de Alimentos: 1º los alimentos DEL TICKET que YA
//        están en el inventario (cantidad comprada editable — se suma); 2º la revisión con las
//        secciones NUEVOS (nombre/cantidad/IMPORTANCIA/MÍNIMO definidos en la fila) y DUDAS
//        ("¿es ESE alimento de tu despensa?" con desplegable de variantes).
//     5. "Añadir a la despensa": lo confirmado entra directo en el Inventario actual.
//   ESCRITORIO (Mac): botón "🖼️ Escanear foto del ticket" → eliges una foto del disco → mismo modal.
//   La primera vez Tesseract.js descarga su motor/español del CDN (unos megas, una sola vez); la
//   FOTO nunca sale del dispositivo: todo el reconocimiento corre en el navegador.
//
// Lo que automatiza esta prueba:
//   (A) Escritorio: botón cámara OCULTO, botón foto visible (la cámara sólo sale en móvil).
//   (B) Móvil emulado (UA iPhone): botón cámara VISIBLE.
//   (C) Flujo REAL de OCR (foto sintética de texto dibujada en canvas → PNG): con la despensa
//       vacía todo es NUEVO → el 2º diálogo con la sección Nuevos; nombre/cantidad/importancia
//       editados EN la fila y alta directa en la despensa. Capturas 23-*, 24-*.
//   (D) FLUJO DEL TICKET con texto inyectado por la ventanilla §6 (sin depender de la conexión):
//       cantidad por línea, NUEVOS arriba y DUDOS abajo en el diálogo de revisión — la duda se
//       resuelve con la variante de despensa (suma en-situ) todo DENTRO de Alimentos. Captura 25-*.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const RAIZ = path.resolve(fileURLToPath(new URL("../", import.meta.url)));  // webapp/
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

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

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let tmpPng = null;      // NO se borra hasta el final: Chromium lee el archivo SUBIDO con pereza y el OCR lo necesita vivo
try {
  // ── (A) ESCRITORIO: la cámara NO se ofrece; la vía foto, sí ──
  // (el TUTORIAL auto-abre en http — y este e2e vive por http: para el motor del OCR hace falta
  // red (el worker del CDN); marcamos la visita guía como vista para que no coma los clicks))
  const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxDesk.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
  });
  const page = await ctxDesk.newPage();
  page.on("pageerror", e => console.log("[pageerror]", String(e).slice(0, 300)));
  page.on("requestfailed", r => console.log("[reqfail]", r.url().slice(0, 100), r.failure()?.errorText));
  await page.goto(APP);
  await page.waitForSelector("#view-foods.active");
  ok(await page.isHidden("#btn-ocr-camara"), "(A) escritorio: botón de cámara OCULTO (la cámara sólo en móvil)");
  ok(await page.isVisible("#btn-ocr-foto"), "(A) escritorio: botón de foto VISIBLE (misma función, otra vía)");

  // ── (B) MÓVIL EMULADO (UA de iPhone): el botón de cámara APARECE ──
  const ctxMovil = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  await ctxMovil.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
  });
  const pageM = await ctxMovil.newPage();
  pageM.on("pageerror", e => console.log("[pageerror movil]", String(e).slice(0, 300)));
  pageM.on("requestfailed", r => console.log("[reqfail movil]", r.url().slice(0, 100), r.failure()?.errorText));
  await pageM.goto(APP);
  await pageM.waitForSelector("#view-foods.active");
  ok(await pageM.isVisible("#btn-ocr-camara"), "(B) móvil emulado: botón de cámara VISIBLE (política del epic)");
  // El click debe ABRIR UN FILE CHOOSER (en el móvil real, la app de cámara del sistema): lo
  // consumimos limpiamente para no dejar un diálogo a medias colgado del navegador.
  const chooserMovil = pageM.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
  await pageM.click("#btn-ocr-camara");
  const chooser = await chooserMovil;
  ok(!!chooser, "(B) móvil: el botón de cámara abre el file chooser (input con capture='environment')");
  const capture = await pageM.getAttribute("#ocr-file", "capture");
  ok(capture === "environment", "(B) móvil: el input de la foto lleva capture='environment' (abre la cámara del sistema)");
  await pageM.screenshot({ path: path.join(OUT_DIR, "24-ocr-camara-visible-movil.png") });
  await ctxMovil.close();

  // ── (C) FLUJO REAL: foto sintética (¡canvas!) → OCR Tesseract spa → modal → editar nombre → guardar ──
  // ¿Hay red hacia el CDN? Si no, saltamos esta parte con aviso (el resto ya ha validado el epic).
  let hayRed = true;
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    const r = await fetch("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/package.json", { signal: ctl.signal });
    hayRed = r.ok;
  } catch { hayRed = false; }
  if (!hayRed) {
    ok(false, "sin conexión al CDN de jsdelivr: el paso (C) queda SKIPPED (lo demás ya validado)");
  } else {
    // La foto la PINTA el propio navegador (no hay fixture de imagen en el repo): texto de nevera.
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 900; c.height = 300;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, 900, 300);
      x.fillStyle = "#111111"; x.font = "bold 40px Arial";
      x.fillText("NEVERA - SEMANA 44", 30, 60);
      x.fillText("Leche entera 1L", 30, 130);
      x.fillText("Huevos docena XL", 30, 190);
      x.fillText("Cebollas 2 bolsas", 30, 250);
      return c.toDataURL("image/png");
    });
    const tmpPng = path.join(os.tmpdir(), "mrcheff-ocr-foto.png");
    writeFileSync(tmpPng, Buffer.from(dataUrl.split(",")[1], "base64"));

    const chooserFoto = page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
    await page.click("#btn-ocr-foto");
    await chooserFoto;                              // consumir el chooser limpio (headless no tiene UI)
    await page.setInputFiles("#ocr-file", tmpPng);

    // 1ª vez: descarga del motor (puede tardar ~1 min). Modal de progreso → modal de confirmación.
    try {
      await page.waitForSelector(".ocr-item", { timeout: 180000 });
    } catch {
      const estado = await page.evaluate(() => ({
        tesseract: !!window.Tesseract,
        modal: document.getElementById("modal-content").innerText.slice(0, 240).replace(/\n+/g, " | ")
      })).catch(e => ({ tesseract: "?", modal: String(e).slice(0, 120) }));
      throw new Error("(C) el modal de confirmación no apareció tras el OCR — diagnóstico: " + JSON.stringify(estado));
    }
    const nCand = await page.locator(".ocr-item").count();
    ok(nCand >= 2, `(C) OCR real en Brave: modal con ${nCand} candidatos detectados de la foto (≥2)`);

    // Requisito variable 2026-10-21: TODO se define EN el diálogo de revisión — renombrar la 1ª
    // fila, cambiar su cantidad y dar su IMPORTANCIA ahí mismo (despensa vacía → todo es nuevo).
    const secciones = await page.locator(".rev-seccion h3").allTextContents();
    ok(secciones.join() === "Nuevos", "(C) despensa vacía → todo NUEVO: sólo la sección 'Nuevos' del 2º diálogo");
    const fila1 = page.locator(".rev-seccion .ocr-item").first();
    const nombreOriginal = await fila1.locator("input[type='text']").inputValue();
    ok(nombreOriginal.length > 1, `(C) el nombre detectado sale editable (valor actual: "${nombreOriginal}")`);
    await fila1.locator("input[type='text']").fill("Prueba OCR renombrada");
    await fila1.locator("input[type='number']").first().fill("7");
    await fila1.locator(".rev-num").first().fill("8");
    await page.screenshot({ path: path.join(OUT_DIR, "23-ocr-confirmar-candidatos.png") });

    await page.click("[data-revision-guardar]");
    await page.waitForSelector("#modal.hidden", { state: "attached" });
    ok(await page.$eval("#view-foods", v => v.classList.contains("active")),
      "(C) sin toast y sin saltos: el escáner NO sale de la pestaña de Alimentos");
    await page.waitForFunction(() => document.getElementById("food-list").classList.contains("destello-suave"), null, { timeout: 3000 });
    ok(true, "(C) el Inventario actual destella una vez (el ojo sabe dónde acaba lo confirmado)");

    // CONTRATO 2026-10-21: la compra ya está hecha → TODOS los nuevos entran directo con su
    // criterio definido EN el diálogo. La clave de pendientes del ticket NI LLEGA A ESCRIBIRSE
    // (esa implementación se retiró: la lista de la compra queda fuera del escáner).
    const ls = await page.evaluate(() => ({
      foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]"),
      compraTicket: localStorage.getItem("mrcheff.compraTicket")
    }));
    ok(ls.compraTicket === null, "(C) sin pendientes del ticket en la lista de la compra (clave retirada, nunca escrita)");
    ok(ls.foods.length >= 2 && ls.foods.length === nCand, `(C) la despensa recibe los ${ls.foods.length} nuevos del ticket AL CONFIRMAR`);
    ok(new Set(ls.foods.map(f => f.name.toLowerCase())).size === ls.foods.length, "(C) la despensa no queda duplicada");
    const guardado = ls.foods.find(f => f.name === "Prueba OCR renombrada");
    ok(!!guardado && guardado.qty === 7 && guardado.score === 8 && Number.isFinite(guardado.min),
      "(C) localStorage: alta con qty=7 e IMPORTANCIA definida en el diálogo (8) — nada lo decide la app sola");
    const filaDespensa = page.locator("#food-list .food-item", { hasText: "Prueba OCR renombrada" });
    ok(await filaDespensa.count() === 1, "(C) el candidato renombrado está GUARDADO en la despensa (nombre editable respetado)");
  }

  // ── (D) FLUJO DEL TICKET (rework 2026-10-21): la revisión de exactos/nuevos/dudas sucede en
  //    los dos DIÁLOGOS del escáner, dentro de Alimentos — nada salta a la lista de la compra
  //    (la implementación de pendientes del ticket se retiró, `mrcheff.compraTicket` incluida).
  //    El texto entra por la inyección §6 (los datos que pasaría el OCR tras leer la foto): la
  //    sección NO depende de la conexión; el motor REAL ya queda cubierto en (C).
  const ctxTicket = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxTicket.addInitScript(() => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify([
      { id: "a1", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 1 }
    ]));
  });
  const pageT = await ctxTicket.newPage();
  pageT.on("pageerror", e => console.log("[pageerror ticket]", String(e).slice(0, 300)));
  await pageT.goto(APP);
  await pageT.waitForSelector("#view-foods.active");

  await pageT.evaluate(t => window.__mrcheffProcesarTextoOcr(t),
    ["3 Leche entera 1,29 €", "2 x Yogur", "1 Pan de pueblo", "TOTAL 12,40 €. GRACIAS"].join("\n"));
  ok((await pageT.locator(".rev-seccion h3").allTextContents()).join() === "Nuevos,Dudas",
    "(D) nada exacto en casa: el primer diálogo es YA la revisión con Nuevos ENCIMA de Dudas");
  ok((await pageT.inputValue("#rev-qty-0")) === "3", "(D) la CANTIDAD la fija la línea del ticket ('3 Leche' → 3)");
  ok((await pageT.inputValue("#rev-qty-1")) === "2", "(D) '2 x Yogur' → 2");
  ok((await pageT.inputValue("#rev-qty-2")) === "1", "(D) '1 Pan de pueblo' → 1 (nuevo: se define en la propia fila)");
  ok((await pageT.locator("option", { hasText: "Yogur natural" }).count()) >= 1,
    "(D) la duda trae el desplegable con la variante de despensa disponible ('Yogur natural')");

  // RETíCULA alineada: cada etiqueta de la cabecera queda sobre el campo de su columna (±6px).
  // La guardia vive aquí porque es geometría real del navegador (jsdom no puede).
  const columnas = await pageT.evaluate(() => {
    const centro = el => { const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2); };
    return [...document.querySelectorAll(".rev-seccion")].map(sec => {
      const etiquetas = [...sec.querySelectorAll(".rev-cab-nueva span:not(.rev-col-alimento), .rev-cab-duda span:not(.rev-col-alimento)")];
      const campos = [...sec.querySelector(".ocr-item").querySelectorAll("select, input[type=number], input[type=checkbox]")];
      return etiquetas.map((etq, i) => ({ texto: etq.textContent.trim(), delta: Math.abs(centro(etq) - (campos[i] ? centro(campos[i]) : -999)) }));
    });
  });
  const descuadradas = columnas.flat().filter(c => c.delta > 6);
  ok(descuadradas.length === 0, `(D) cabecera y fila COMPARTEN retícula: etiqueta sobre su campo (±6px)${descuadradas.length ? " — descuadrado: " + descuadradas.map(c => c.texto).join(", ") : ""}`);

  await pageT.screenshot({ path: path.join(OUT_DIR, "25-ocr-ticket-confirmar.png") });

  // La persona define TODO en las filas: la nueva Leche con su IMPORTANCIA (7), Pan con los
  // valores por defecto, y la duda del Yogur se resuelve eligiendo la variante de despensa:
  // la fila pasa a mostrar LA ALERTA REAL del alimento (7/3) con sus campos apagados — pantalla
  // e inventario dicen lo mismo; la CANTIDAD sigue siendo editable.
  await pageT.fill("#rev-score-0", "7");
  await pageT.locator("#rev-variante-1").selectOption("a1");
  ok((await pageT.inputValue("#rev-score-1")) === "7" && (await pageT.inputValue("#rev-min-1")) === "3",
    "(D) al elegir variante, la fila muestra YA la alerta REAL del alimento (7/3 — nada de los 5/1 de la alta)");
  ok(await pageT.$eval("#rev-score-1", el => el.disabled) && await pageT.$eval("#rev-min-1", el => el.disabled),
    "(D) variante elegida → su propio criterio ya NO se pide (la alerta es la del alimento real)");
  ok(await pageT.$eval("#rev-qty-1", el => !el.disabled),
    "(D) con variante, el campo EDITABLE sigue siendo la CANTIDAD de la compra");
  await pageT.click("[data-revision-guardar]");
  await pageT.waitForSelector("#modal.hidden", { state: "attached" });
  await pageT.waitForFunction(() => document.getElementById("food-list").classList.contains("destello-suave"), null, { timeout: 3000 });
  ok(await pageT.$eval("#view-foods", v => v.classList.contains("active")),
    "(D) sin toast ni saltos: la vista Alimentos queda activa tras confirmar todo");

  const d = await pageT.evaluate(() => ({
    compraTicket: localStorage.getItem("mrcheff.compraTicket"),
    foods: JSON.parse(localStorage.getItem("mrcheff.foods") || "[]")
  }));
  ok(d.compraTicket === null, "(D) la lista de la compra NUNCA recibe el ticket (clave de pendientes retirada)");
  ok(!!d.foods.find(f => f.name === "Leche" && f.qty === 3 && f.score === 7),
    "(D) el NUEVO 'Leche' entra en la despensa con qty del ticket + su IMPORTANCIA definida en la fila (7)");
  ok(!!d.foods.find(f => f.name === "Pan" && f.qty === 1), "(D) el NUEVO 'Pan' entra con los criterios por defecto de la fila");
  const yo = d.foods.find(f => f.name === "Yogur natural");
  ok(!!yo && yo.qty === 4 && yo.score === 7 && yo.min === 3,
    "(D) la DUDA resuelta con variante SUMA a 'Yogur natural' (2 en casa + 2 del ticket) y su alerta queda 7/3, sin pisar");
  ok(!d.foods.some(f => f.name === "Yogur"), "(D) no se da de alta un 'Yogur' aparte: la compra va AL alimento ya en casa");
  ok(d.foods.length === 3, "(D) la despensa acaba con las tres cosas del ticket y nada más");
  await ctxTicket.close();

  await ctxDesk.close();
  if (fallos) throw new Error(fallos + " comprobaciones del escáner fallidas");
  console.log("\nESCÁNER DEL TICKET OK — cámara sólo en móvil ✔ + OCR real en navegador ✔ + la revisión en DOS DIÁLOGOS dentro de Alimentos (exactos suman / nuevos y dudas se definen en fila — nada en la lista de la compra) ✔");
  console.log("Capturas: reports/ui-brave/23-ocr-confirmar-candidatos.png · 24-ocr-camara-visible-movil.png · 25-ocr-ticket-confirmar.png");
} catch (e) {
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (tmpPng) rmSync(tmpPng, { force: true });
  server.close();
}

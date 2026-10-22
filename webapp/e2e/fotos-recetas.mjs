// e2e/fotos-recetas.mjs — Brave: la banda de FOTO en las cards de receta
// (feature imagenes-recetas-cards, petición 2026-10-22). Demuestra con navegador REAL:
//  1. el buscador del catálogo muestra la foto del repo y CARGA (naturalWidth > 0);
//  2. Mis Recetas: la copia con título del catálogo lleva foto con carga real; la manual
//     lleva el PLACEHOLDER con la inicial del plato;
//  3. Innovación: las ideas con foto de catálogo nacen con banda de foto;
//  4. Cocinar hoy (Card 1 de Sugerencias): también lleva banda;
//  5. el modal de detalle NO entra foto (alcance cerrado) y ninguna imagen queda ROTA.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)), "reports/ui-brave");
fs.mkdirSync(OUT_DIR, { recursive: true });

let contadas = 0;
const ok = (cond, msg) => { if (cond) { contadas++; console.log("✔ " + msg); } else { console.log("✘ " + msg); process.exitCode = 1; } };

// Despensa suficiente para que "↻ Sugerir ahora" saque lote (misma semilla del e2e de cook-hoy).
const foods = [
  ["Pan", 2], ["Tomate", 3], ["Aceite de oliva", 4], ["Huevos", 3], ["Leche", 3], ["Patata", 4],
  ["Cebolla", 2], ["Ajo", 1], ["Queso", 2], ["Jamón", 2], ["Arroz", 1], ["Pollo", 2], ["Yogur", 4],
  ["Manzana", 4], ["Puerro", 2], ["Zanahoria", 3], ["Gambas", 3], ["Merluza", 2], ["Nata", 2],
  ["Queso parmesano", 2], ["Espinacas", 2], ["Mascarpone", 2], ["Café", 2], ["Canela", 2]
].map(([name, qty], i) => ({ id: "f" + i, name, qty, min: 1, score: 5, checked: false, createdAt: i }));

const recipes = [
  // Copia con el título de un plato del catálogo (sale por TÍTULO normalizado): la foto es la del catálogo.
  { id: "uid-foto", title: "Paella valenciana tradicional", meal: "comida", ingredients: ["Arroz", "Pollo"], method: ["Haz la paella."], createdAt: 1 },
  // Receta de la persona (sin foto posible): placeholder del diseño.
  { id: "uid-manual", title: "Sopa rara de mi casa", meal: "comida", ingredients: ["Caldo"], method: ["Calienta."], createdAt: 2 },
];

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript((g) => {
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify(g.foods));
    localStorage.setItem("mrcheff.recipes", JSON.stringify(g.recipes));
  }, { foods, recipes });

  await p.goto(APP);
  await p.waitForSelector("[data-view=\"recipes\"].tab"); await p.click('[data-view="recipes"]'); await p.waitForSelector("#recipe-list .recipe-card", { state: "attached" });

  // (1) RECETAS: copia con título del catálogo → foto real cargada; manual → placeholder.
  const tarjetaFoto = p.locator("#recipe-list .recipe-card", { hasText: "Paella valenciana tradicional" });
  const imgPaella = (await tarjetaFoto.locator("img.recipe-photo")).first();
  const fotoInfo = await imgPaella.evaluate(async img => {        // lazy: scroll al viewport y esperamos al load real
    img.loading = "eager"; img.scrollIntoView({ block: "center" });
    if (!img.complete) await new Promise(res => img.addEventListener("load", res, { once: true }));
    return { src: img.getAttribute("src"), w: img.naturalWidth };
  });
  ok(fotoInfo.src && fotoInfo.src.startsWith("img/recetas/"), "(1a) la card del título del catálogo lleva img del repo: " + fotoInfo.src);
  ok(fotoInfo.w > 0, "(1b) la foto de la paella CARGA de verdad (naturalWidth " + fotoInfo.w + ")");
  const placeholder = p.locator("#recipe-list .recipe-card", { hasText: "Sopa rara de mi casa" });
  const letraPlaceholder = await placeholder.locator(".recipe-foto-falta").getAttribute("data-letra");
  ok(letraPlaceholder === "S", "(1c) la receta manual lleva placeholder con la inicial del plato («" + letraPlaceholder + "»)");
  await p.screenshot({ path: path.join(OUT_DIR, "78-foto-cards-recetas.png") });

  // (2) BUSCADOR: hit del catálogo con foto → img cargada.
  await p.fill("#recipe-catalog-search", "gambas");
  await p.waitForTimeout(300);
  const buscadorImg = await p.locator("#recipe-catalog-results .recipe-card img.recipe-photo").first().evaluate(img => ({ src: img.getAttribute("src"), w: img.naturalWidth }));
  ok(buscadorImg.src && buscadorImg.src.startsWith("img/recetas/"), "(2a) buscador: el hit con foto lleva img del repo: " + buscadorImg.src);
  ok(buscadorImg.w > 0, "(2b) la foto del buscador carga de verdad");

  // (3) INNOVACIÓN: ideas de catálogo → banda de foto en las cards.
  await p.click('[data-view="innovation"]');
  await p.click("#btn-generate-innov");
  await p.waitForSelector("#innovation-list .recipe-card");
  const innovImgs = await p.$$eval("#innovation-list .recipe-card img.recipe-photo", els =>
    els.map(img => ({ src: img.getAttribute("src"), w: img.naturalWidth })));
  ok(innovImgs.length >= 1, "(3a) Innovación: hay ideas con foto del catálogo (" + innovImgs.length + ")");
  ok(innovImgs.every(i => i.w > 0), "(3b) TODAS las fotos de Innovación cargan (ninguna rota)");

  // (4) COCINAR HOY (Card 1 de Sugerencias): banda en las cards del lote.
  await p.click('[data-view="suggest"]');
  await p.click("#btn-suggest-generate");
  await p.waitForSelector("#suggest-list .recipe-card");
  const loteInfo = await p.$eval("#suggest-list .recipe-card .recipe-photo", el => ({
    esFoto: el.tagName === "IMG", src: el.getAttribute("src"), w: el.tagName === "IMG" ? el.naturalWidth : 0 }));
  ok(loteInfo.esFoto || (await p.$("#suggest-list .recipe-card .recipe-foto-falta")) !== null,
    "(4a) Cocinar hoy: la card del lote lleva banda de foto o placeholder");
  const rotas = await p.$$eval("img.recipe-photo", els => els.filter(i => i.complete && i.naturalWidth === 0).length);
  ok(rotas === 0, "(4b) cero imágenes rotas en toda la app (" + rotas + " rotas)");

  // (5) ALCANCE CERRADO: el modal NO lleva foto; los botones siguen vivos.
  await p.locator("#suggest-list .recipe-card").first().click();
  await p.waitForSelector("#modal-content:not(.hidden)");
  ok(await p.$("#modal-content img.recipe-photo") === null, "(5a) el modal de detalle NO lleva foto (scope cerrado)");
  await p.keyboard.press("Escape");

  console.log((process.exitCode === 1 ? "CON FALLOS · " : "TODO OK > ") + contadas + " checks");
} finally {
  await browser.close();
}

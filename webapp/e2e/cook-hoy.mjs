// e2e/cook-hoy.mjs — Verificación visual en BRAVE del "🍳 Cocinar hoy" en la vista Recetas.
// Ejecutar:  node e2e/cook-hoy.mjs   (capturas en reports/ui-brave/)
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const catalogo = require("../data/recetas-espanolas-data.js");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));

// Aforo con los ingredientes de las 2 primeras recetas del catálogo (para tarjetas realistas)
const nombres = [...new Set(catalogo.slice(0, 2).flatMap(r => r.ingredients || []))];
const PANTRY = nombres.map((n, i) => ({ id: "f-" + i, name: n, qty: 5, min: 1, score: 5, checked: false, createdAt: i }));
const RECETAS = [
  { id: "r-1", title: "Tortilla de patatas de la abuela", meal: "comida", ingredients: ["Patatas", "Huevos", "Aceite de oliva"], method: ["Pela y corta las patatas", "Cuaja y dora"], createdAt: 1 },
  { id: "r-2", title: "Salmorejo cordobés", meal: "comida", ingredients: ["Tomates", "Pan de barra", "Aceite"], method: ["Tritura todo", "Sirve frío"], createdAt: 2 }
];

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const p = await ctx.newPage();
await p.addInitScript(state => {
  localStorage.setItem("mrcheff.foods", JSON.stringify(state.pantry));
  localStorage.setItem("mrcheff.recipes", JSON.stringify(state.recipes));
}, { pantry: PANTRY, recipes: RECETAS });
await p.goto(APP);
await p.locator('.tab[data-view="recipes"]').click();
await p.waitForSelector("#recipe-list .recipe-card");

// (1) Tarjeta: botón en SOLO ICONO con title/aria "Cocinar hoy"
const btn = p.locator("#recipe-list .recipe-card [data-cook]").first();
const soloIcono = (await btn.textContent()).trim() === "🍳";
const ariaOk = (await btn.getAttribute("aria-label")) === "Cocinar hoy";
await p.screenshot({ path: path.join(OUT, "08-recetas-card-cook-icono.png") });

// (2) Click en el icono: persiste cooked SIN abrir el modal
await btn.click();
await p.waitForTimeout(300);
const cookedTrasTarjeta = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]"));
const modalCerrado = await p.evaluate(() => document.getElementById("modal").classList.contains("hidden"));

// (3) Modal: botón ICONO + TEXTO y misma lógica
await p.locator("#recipe-list .recipe-card h3").first().click();
await p.waitForSelector("#modal:not(.hidden)");
const btnModal = p.locator("#modal-content [data-cook]");
const textoModal = (await btnModal.textContent()).trim();
await p.screenshot({ path: path.join(OUT, "09-modal-cook-icono-texto.png") });
await btnModal.click();
await p.waitForTimeout(300);
const cookedTrasModal = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]"));
await p.screenshot({ path: path.join(OUT, "10-modal-tras-cocinar.png") });

console.log([
  "tarjeta soloIcono=" + soloIcono + " ariaOk=" + ariaOk,
  "clickIcono: cooked=" + cookedTrasTarjeta.length + " modalCerrado=" + modalCerrado + " on=" + (cookedTrasTarjeta[0] && cookedTrasTarjeta[0].on),
  "modal boton='" + textoModal + "'",
  "clickModal: cooked=" + cookedTrasModal.length,
  "fingerprint igual cross-vista: " + (cookedTrasTarjeta[0] && cookedTrasModal[0] && cookedTrasTarjeta[0].keyFingerprint === cookedTrasModal[0].keyFingerprint)
].join("\n"));
await browser.close();

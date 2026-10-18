// e2e/cocinar-post-aprobado.mjs — Brave: "🍳 Cocinar" en filas del MENÚ sólo tras APROBAR (tasks 2026-10-18).
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const p = await ctx.newPage();
  // Despensa con algo de stock para que genere platos
  const foods = [
    ["Pan", 2], ["Tomate", 3], ["Aceite de oliva", 4], ["Huevos", 3],
    ["Leche", 3], ["Patata", 4], ["Cebolla", 2], ["Ajo", 1],
    ["Queso", 2], ["Jamón", 2], ["Arroz", 1], ["Pollo", 2],
  ].map(([name, qty], i) => JSON.stringify({ id: "f-" + i, name, qty, min: 1, score: 5, checked: false, createdAt: i }));
  await p.addInitScript(`localStorage.clear(); localStorage.setItem("mrcheff.foods", JSON.stringify([${foods.join(",")}]));`);
  await p.goto(APP);
  await p.locator('.topbar .tab[data-view="suggest"]').click();
  await p.locator("#btn-menu-generate").click();
  await p.waitForSelector("#menu-plan-list .menu-day");

  const preview = await p.evaluate(() => {
    const filas = [...document.querySelectorAll("#menu-plan-list .menu-meal-row")];
    return {
      filas: filas.length,
      cocinar: filas.filter(f => f.querySelector("[data-cook]")).length,
      cambiar: filas.filter(f => f.querySelector("[data-swap]")).length,
    };
  });
  console.log("PREVIEW:", JSON.stringify(preview), "→", preview.cocinar === 0 && preview.cambiar > 0 ? "OK (sin 🍳, con 🔄)" : "FALLO");

  const botones = await p.locator("#menu-plan-list .menu-meal-row [data-swap]").first();
  await p.screenshot({ path: "../reports/ui-brave/17-menu-preview-sin-cocinar.png" });

  await p.locator("#btn-menu-approve").click();
  await p.waitForTimeout(200);
  const aprobado = await p.evaluate(() => {
    const filas = [...document.querySelectorAll("#menu-plan-list .menu-meal-row")];
    return {
      cocinar: filas.filter(f => f.querySelector("[data-cook]")).length,
      cambiar: filas.filter(f => f.querySelector("[data-swap]")).length,
      btn: document.getElementById("btn-menu-approve").textContent.trim(),
    };
  });
  console.log("APROBADO:", JSON.stringify(aprobado), "→", aprobado.cocinar > 0 && aprobado.btn.includes("aprobado") ? "OK (con 🍳)" : "FALLO");
  await p.screenshot({ path: "../reports/ui-brave/17-menu-aprobado-con-cocinar.png" });

  // El "🍳 Cocinar" del menú sigue funcional post-aprobado (uno de ellos escribe en mrcheff.cooked)
  await p.locator("#menu-plan-list .menu-meal-row [data-cook]").first().click();
  await p.waitForTimeout(200);
  const cooked = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]"));
  console.log("aunque no se toca recipes[], cooked tras click =", cooked.length, "→", cooked.length > 0 ? "OK (acción operativa)" : "OJO: 0 entradas");
} finally { await browser.close(); }

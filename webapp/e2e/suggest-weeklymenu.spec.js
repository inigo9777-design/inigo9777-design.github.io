// webapp/e2e/suggest-weeklymenu.spec.js — STUB E2E (pending, no ejecutar).
// Trazabilidad del flujo Card 2 + Card 3 "Menú semanal + lista de la compra" (§4 del plan de feature).
// Playwright NO está instalado en este entorno (§6 CODING_STANDARDS.md), por tanto este spec
// queda como texto comentado / pendiente. Se activa solo cuando se añada Playwright al proyecto.
//
// Flujo trazado (actualizado al menú 7×3 — feature 2026-10-18):
//   1. Ir a la pestaña "Sugerencias y menú" (data-view="suggest").
//   2. "Generar menú" (toggle "incluir no disponibles" va activado por defecto) → 7 días con
//      3 filas de comida cada uno (.menu-day × 7, .menu-meal-row × 21).
//   3. Pulsar "Aprobar plan" → mrcheff.weekmenu (approved=true, generatedOn=hoy) y cooked[]
//      con una entrada por receta anclada a la FECHA de su día planificado.
//   4. "🔄 Cambiar" en una .menu-meal-row → SÓLO esa comida del día cambia; el resto del plan queda intacto.
//   5. Si hay needyFoods, Card 3 "Lista de la compra" muestra filas urg-red/orange/green ordenadas
//      rojo→verde según la fecha de preparación (regla: mañana/hoy=rojo, 2-3 días=naranja, ≥4=verde);
//      marcar "✅ comprado" auto-añade el alimento a foods con {qty:0, min:0, score:5}.
//
// Test pendiente (template cuando Playwright esté disponible):
//
// test('flujo menú semanal 7×3 + swap por comida + lista de compra con semáforo', async ({ page }) => {
//   await page.goto('http://localhost/');
//   await page.click('[data-view="suggest"]');
//   await page.click('#btn-menu-generate');
//   await expect(page.locator('#menu-plan-list .menu-day')).toHaveCount(7);
//   await expect(page.locator('#menu-plan-list .menu-meal-row')).toHaveCount(21);
//   await page.click('#btn-menu-approve');
//   // cambiar la comida del martes y verificar que sólo ese hueco cambia (page.evaluate sobre el plan)
//   const filaMartes = page.locator('#menu-plan-list li:nth-child(2) .menu-meal-row[data-meal="comida"]');
//   await filaMartes.locator('[data-swap]').click();
//   // verificar semáforo de Card 3: la primera fila debe llevar urg-red (plato de HOY/mañana)
//   await expect(page.locator('#shopping-list li.urg-red').first()).toBeVisible();
//   // marcar comprado y verificar foods[] via page.evaluate(...)
// });

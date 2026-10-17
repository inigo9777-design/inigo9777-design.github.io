// webapp/e2e/suggest-weeklymenu.spec.js — STUB E2E (pending, no ejecutar).
// Trazabilidad del flujo Card 2 + Card 3 "Menú semanal + lista de la compra" (§4 del plan de feature).
// Playwright NO está instalado en este entorno (§6 CODING_STANDARDS.md), por tanto este spec
// queda como texto comentado / pendiente. Se activa solo cuando se añada Playwright al proyecto.
//
// Flujo trazado:
//   1. Ir a la pestaña "Sugerencias y menú" (data-view="suggest").
//   2. Marcar "Incluir aunque no estén ahora disponibles".
//   3. Pulsar "Generar menú" → ver 7 filas (Lunes..Domingo) con preview.
//   4. Pulsar "Aprobar plan" → se guarda mrcheff.weekmenu (approved=true, generatedOn=hoy)
//      y se registra cada receta del plan en mrcheff.cooked con on=hoy.
//   5. Si hay needyFoods, aparece Card 3 "Lista de la compra"; marcar "✅ comprado" en un ítem
//      auto-añade ese alimento a foods con {qty:0, min:0, score:5} y refresca la alerta semanal.
//
// Test pendiente (template cuando Playwright esté disponible):
//
// test('flujo menú semanal + lista de compra', async ({ page }) => {
//   await page.goto('http://localhost/');
//   await page.click('[data-view="suggest"]');
//   await page.check('#menu-include-unavailable');
//   await page.click('#btn-menu-generate');
//   await expect(page.locator('#menu-plan-list .alert-row')).toHaveCount(7);
//   await page.click('#btn-menu-approve');
//   // verificar localStorage mrcheff.cooked / mrcheff.weekmenu via page.evaluate(...)
//   // marcar primer ítem de Card 3 como comprado y verificar foods[]
// });

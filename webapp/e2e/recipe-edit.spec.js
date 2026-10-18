// webapp/e2e/recipe-edit.spec.js — STUB E2E (pending, no ejecutar).
// Trazabilidad del flujo "✏️ Editar receta" en el modal de detalle (feature 2026-10-18):
// la edición toca la UI y la persistencia (mrcheff.recipes) y refresca el plato del menú semanal.
// Playwright NO está instalado en este entorno (§6 CODING_STANDARDS.md); se activa al añadirlo.
//
// Flujo trazado:
//   1. Pestaña "Recetas" → abrir la tarjeta de una receta guardada → modal de detalle.
//   2. Botón "✏️ Editar" → editor con campos rellenos (título, momento, ingredientes, pasos).
//   3. Cambiar título + añadir ingrediente y paso → "Guardar cambios" → modal se cierra y
//      la tarjeta muestra el título editado (mrcheff.recipes actualizado con el MISMO id).
//   4. Plato del menú aprobado (catálogo, sólo lectura) → "✏️ Editar y guardar" → copia nueva
//      en Mis Recetas + el hueco del plan muestra el título editado (parche por id original).
//   5. Guardar sin ingredientes/pasos → toast de error, el editor sigue abierto, nada persiste.
//   6. Lápiz ✏️ en TODAS las vistas de recetas: tarjeta de "Mis Recetas" (edición in-situ),
//      tarjeta de Innovación/Sugerencias (copias), y franja del menú → abren el editor directo.
//
// Test pendiente (template cuando Playwright esté disponible):
//
// test('editar receta guardada in-situ y editar plato del plan como copia', async ({ page }) => {
//   await page.goto('http://localhost/');
//   await page.click('#recipe-list .recipe-card');
//   await page.click('#modal-content [data-edit]');                       // "✏️ Editar"
//   await page.fill('#edit-title', 'Tortilla de patatas y cebolla');
//   await page.fill('#edit-ingredients', 'Patata\nHuevo\nCebolla');
//   await page.click('[data-save-edit]');
//   await expect(page.locator('#recipe-list .recipe-card h3').first()).toHaveText('Tortilla de patatas y cebolla');
//   // lápiz de la tarjeta (atajo directo al editor)
//   await page.click('#recipe-list [data-edit]');
//   await expect(page.locator('#edit-title')).toBeVisible();
//   await page.keyboard.press('Escape');
//   // plato del plan: flujo "Editar y guardar"
//   await page.click('[data-view="suggest"]');
//   await page.click('#btn-menu-generate');
//   await page.click('#btn-menu-approve');
//   await page.locator('#menu-plan-list .menu-meal-row[data-meal-idx]').first().click();
//   await expect(page.locator('#modal-content [data-edit]')).toHaveText('✏️ Editar y guardar');
//   await page.click('#modal-content [data-edit]');
//   await page.fill('#edit-title', 'Mi versión casera');
//   await page.click('[data-save-edit]');
//   await expect(page.locator('#recipe-list .recipe-card h3').first()).toHaveText('Mi versión casera');
// });

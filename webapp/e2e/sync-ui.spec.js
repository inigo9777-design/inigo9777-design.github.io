// webapp/e2e/sync-ui.spec.js — STUB E2E (pendiente, no ejecutar; patrón sync-protocol.spec.js).
// Trazabilidad de la FASE 5 del plan-sync-buzon.md: el WIRING real ya está probado como
// integración Jest en `tests/sync-ui.integration.test.js` (boot de la app COMPLETA en jsdom con
// window.fetch sustituido por un "gist" en memoria: config modal, OFFER del primer sync,
// aplicación del envolvente del otro dispositivo + ACK en el gist, conflicto de la MISMA línea
// con el modal resolver y "Conservar ambas" → copia con badge "duplicada", red caída y
// passphrase errónea sin corromper nada). Este stub registra el flujo real (2 navegadores +
// gist REAL con PAT) para e2e/sync-buzon.mjs (FASE 6, variable de entorno; NUNCA el token
// hardcodeado).
//
// Flujo trazado (se ejecuta tras configurar ambos dispositivos — ver plan §9):
//   1. Móvil: botón "🔄 Sync" → toast "Cambios publicados..." y el gist contiene kind offer
//      con payload cifrado (sin texto legible de las recetas).
//   2. PC: botón "🔄 Sync" → toast "Cambios del otro dispositivo aplicados."; su localStorage
//      trae las recetas del móvil y el gist queda con el ACK (deviceId del PC).
//   3. Móvil: botón "🔄 Sync" → toast "Cambios del otro dispositivo aplicados." + "Buzón
//      limpio." (absorbe su propia offer pendiente; el gist queda {"kind":"empty"}).
//   4. Ambos editan la MISMA línea del method de la misma receta, sin sync intermedio → sync
//      en el PC → badge "⇄ conflicto" + modal resolver con las DOS versiones (lado a lado,
//      escapeHTML siempre) → "Conservar ambas" → la copia hereda badge "duplicada" y el ACK
//      transporta el estado fusionado completo.
//   5. PC otra vez → sync recíproco → la elección viaja y ninguna de las dos versiones desaparece.
//   6. Red caída (offline en el móvil): mensaje de error textual y localStorage intacto.
//
// test('wiring completo del sync con gist real', async ({ page }) => {
//   // pendiente de Playwright real + MCHEFF_GIST/MCHEFF_TOKEN en el entorno — ver plan §8/§9
// });

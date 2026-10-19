// webapp/e2e/sync-protocol.spec.js — STUB E2E (pending, no ejecutar; patrón recipe-edit.spec.js).
// Trazabilidad de la FASE 3 del plan-sync-buzon.md: el PROTOCOLO del buzón ya está probado como
// integración Jest REAL en `tests/sync-protocol.integration.test.js` (dos dispositivos simulados con
// `fetcher` fake contra un gist en memoria: ciclo offer → ack → vaciar, ramas de la máquina, passphrase
// errónea, red caída, idempotencia, conflictos y reciprocidad). Este stub registra el FLUJO REAL
// (2 navegadores + gist REAL con PAT) para cuando se ejecute `e2e/sync-buzon.mjs` (FASES 5/6 del plan).
//
// Flujo trazado (2 contextos Playwright, mismo app servido):
//   1. Contexto "PC": sembrar localStorage con recetas propias → Copia de seguridad → configurar
//      token + gist (real, en variable de entorno MCHEFF_GIST) → passphrase.
//   2. "Crear buzón" → GET del gist devuelve {"kind":"empty"}.
//   3. Contexto "Móvil": configurar idéntica passphrase → "🔄 Sync" → toast "Cambios publicados...".
//      GET del gist: kind offer, payload cifrado (sin texto legible de las recetas).
//   4. PC → "🔄 Sync" → toast "Cambios del otro dispositivo aplicados."; su localStorage ya tiene
//      las recetas del móvil (doble comparación por title); el gist contiene el ACK.
//   5. Móvil → "🔄 Sync" → toast "Buzón limpio."; el gist queda en {"kind":"empty"} literal.
//   6. Duas ediciones de la MISMA línea de method en ambos, sin sync desde entonces → "🔄 Sync" en
//      el correcto → badge "⇄ conflicto" + modal resolver con las dos versiones lado a lado →
//      "conservar ambas" → la segunda copia hereda badge "duplicada"; tras confirmar el flujo
//      converge a la misma receta×2 en ambos dispositivos (nunca texto perdido).
//   7. Pasphrase distinta en el móvil → sync → mensaje de error textual; el estado local queda intacto.
//
// test('ciclo real 2 dispositivos con gist de GitHub', async ({ page }) => {
//   // pendiente de Playwright real + token de entorno (NUNCA hardcodeado) — ver plan §8/§9
// });

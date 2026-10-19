# Plan — Sync entre 2 dispositivos por buzón GitHub

Feature: sincronización de datos entre 2 dispositivos (móvil PWA + escritorio) usando un gist
de GitHub como buzón, con cifrado extremo a extremo y nada persistente online. La persistencia
de la app sigue siendo 100% local (localStorage vía helpers `load`/`save`); la evaluación de
transportes y sus decisiones queda logeada en la sesión 2026-10-19.

- Ubicación de este plan: `webapp/e2e/plan-sync-buzon.md` (a petición del usuario).
- Decisiones fijadas (no reabrir sin motivo):
  1. **Transporte:** GitHub gist vía REST API (`api.github.com`), la PWA hace `fetch` directo.
     No hay git, ni repo clonado, ni agentes: el token lo teclea el usuario en la app.
  2. **Confidencialidad:** AES-GCM-256 con clave derivada por PBKDF2 de una passphrase.
     La passphrase NO se persiste (solo sessionStorage). GitHub solo ve ciphertext o placeholder.
  3. **BD local:** el check "cambiar export JSON por BD local" queda CERRADO — localStorage
     basta; el JSON de backup sigue siendo el formato universal (plan B manual intacto).
  4. **Política de conflictos:** diff3 (3-way con antecesor común) + modal resolver.
     Misma línea/campo editada distinta en ambos dispositivos = conflicto declarado, nada silencioso.

---

## 1. Prerrequisito: identidad estable de recetas (FASE 1)

Hoy `mergeIncoming` re-emite uids frescas en cada import → "la misma receta" no existe entre
dispositivos y el sync automático duplicaría gemelas. Sin identidad estable no hay diff3 posible.

- **RECIPES:** al importar/sincronizar, PRESERVAR el `uid` entrante (la probabilidad de colisión
  entre uids generadas en navegadores distintos es despreciable). Red de seguridad para recetas
  legacy/copias guardadas sin id fiable: dedup por fingerprint de ingredientes = Jaccard 1.0
  (mecánica ya existente del matcher para el hard-exclude de Mis Recetas, lenguaje/in-orden invariante).
- **FOODS:** dedup por nombre en minúsculas (como hoy) + preservar el resto de campos.
- **editedAt:** las rutas de guardado/edición (recipe-editor `applyEdit` + guardado de copias
  ⭐/✏️) añaden `editedAt` (ISO) cuando tocan una receta. Lo usa el fallback LWW del primer sync
  y el orden de presentación en el resolver.
- Extender el payload de backup con `cooked` y `weekmenu` (hoy `buildBackup` no los incluye):
  nuevo campo `version: 2` del payload; el import de versiones 1 sigue funcionando (merge sin
  esas claves).

## 2. Cifrado (FASE 2) — módulo puro `modules/sync-crypto.js`

IIFE + dual-export, sin DOM ni localStorage (§3), inyectable para tests (§6).

- `deriveKey(passphrase, salt, iterations)`: PBKDF2-HMAC-SHA256 (OWASP 2023: 600.000 iteraciones)
  → `AES-GCM` 256. El `salt` y `iterations` viajan en CLARO en la cabecera de la envolvente
  (portabilidad entre dispositivos; la seguridad vive en la passphrase, no en el salt).
- `encryptJson(key, obj)` → `{iv, ciphertext}` (IV aleatorio por cifrado, `crypto.getRandomValues`).
- `decryptJson(key, {iv, ciphertext})` → obj o `null` en error (passphrase errónea → GCM falla).
- Passphrase: pedida con modal, guardada SOLO en `sessionStorage` (se re-pide al reabrir la app).
  Misma passphrase en ambos dispositivos.

## 3. Protocolo del buzón (FASE 3) — módulo puro `modules/sync.js`

Envolvente única del gist (`mrcheff-sync.json`), SIEMPRE un snapshot completo cifrado:

```json
{
  "v": 1,
  "kind": "offer" | "ack" | "empty",
  "deviceId": "movil" | "pc" | "...",
  "nonce": "id-único-aleatorio-de-esta-envolvente",
  "parentId": "nonce de la envolvente anterior conocida | null",
  "updatedAt": "ISO",
  "header": { "salt": "...", "iterations": 600000 },
  "payload": { "iv": "...", "ciphertext": "..." }
}
```

Reglas de la API GitHub usada (sin CORS issues; límite gist autenticado ~5k/h, sobra):
- `GET /gists/{id}` → contenido (si >1MB trunca; usar `raw_url`; nuestros datos son KBs).
- `PATCH /gists/{id}` con `{ "files": { "mrcheff-sync.json": { "content": "..." } } }` → escribir.
- **"Vaciar" = PATCH con content `{"kind":"empty"}`, NO borrar el gist** (borrar/recrear el gist
  cambia el id y rompe la config del otro dispositivo). Online queda un JSON mínimo sin datos.

Máquina de estados (una por clic en "🔄 Sync"; la lógica vive en `modules/sync.js`, el wiring
DOM en `app.js`):

```
sync() → GET buzón
├─ kind == "empty" (o gist vacío)
│   ├─ ¿cambios locales pendientes? → publicar OFFER
│   │   {kind:"offer", deviceId:yo, parentId: última nonce conocida consumida,
│   │    payload: cifrado(backup local)} → "Cambios publicados — recógelos en el
│   │   otro dispositivo." (NO se vacía aún)
│   └─ sin cambios locales → "Nada que sincronizar."
├─ deviceId == yo
│   → "Publicado: pendiente de que el otro dispositivo lo recoja." (no tocar)
└─ deviceId == el otro dispositivo
    1) descifrar (si falla → pedir passphrase de nuevo, abortar sin escribir)
    2) MERGE (ver §4) usando el antecesor común
    3) resolver conflictos bloqueantes (modal §5) ANTES de escribir
    4) escribir ACK {kind:"ack", deviceId:yo, parentId: nonce recibida,
       payload: cifrado(estado fusionado completo)}
    5) actualizar la base local (§4) → "Cambios del otro dispositivo aplicados."
Vaciar: SOLO el dispositivo que recibe una envolvente cuyo parentId == nonce de su
ÚLTIMA OFFER (o sea, su publicación ya fue absorbida por el otro) tras fusionar
ese payload → PATCH {"kind":"empty"} → "Buzón limpio."
```

Propiedades buscadas: **la fuente de verdad siempre es el estado LOCAL de cada dispositivo**;
el buzón solo transporta. Nunca se vacía antes de confirmar que la propia publicación fue
absorbida (parentId recibido) — elimina la ventana de pérdida del borrado prematuro que motivó
este diseño.

## 4. Fusión diff3 (FASE 4) — módulo puro `modules/diff-merge.js`

- Cada dispositivo guarda el **snapshot del último estado convergecido** en `mrcheff.sync.base`
  (clave nueva en el objeto `LS`, siempre vía helpers `load`/`save`). Regla operativa: la base
  avanza al estado local cuando este contiene la unión completa — es decir, tras CONSUMIR la
  envolvente del otro dispositivo (su estado fusionado viaja ya dentro del ACK); mientras haya
  una offer propia pendiente de recoger, la base no se toca.
- `merge3(base, mine, theirs)` por receta (agrupadas por identidad de FASE 1):
  - **campos escalares** (`title`, `meal`, tags/origen...): si solo A cambió gana A; si solo B
    cambió gana B; si ambos pusieron el mismo valor es indiferente; **ambos distinto → conflicto**.
  - **listas de strings** (`ingredients[]`, `method[]`): diff3 basado en LCS (~150 líneas,
    escrito a mano, CERO dependencias nuevas): inserciones/borrados/ediciones en zonas
    separadas se auto-fusionan; **dos ediciones en la MISMA región con texto distinto →
    conflicto** (exactamente el caso preguntado en sesión: A y B editan la misma línea del
    method y nadie hizo sync en medio → modal de resolución, nunca se pierde ningún texto).
  - **añadidos:** entidades nuevas en cualquiera de los dos lados entran (dedup por identidad);
    entidades idénticas pasan sin tocar.
- **Primer sync sin base** (ningún estado convergecido aún): fallback honesto = merge union
  por identidad + LWW por `editedAt` SOLO para escalares en conflicto (la versión perdedora
  NO se descarta: queda flag "conflicto" y va al resolver). Desde el 2º sync hay base y diff3 pleno.
- **Casos borde documentados** (no ocultos):
  - Borrado en A + copia viva en B → la fusión lo "resucita" (igual que el import manual de
    hoy). Tombstones (`deletedAt`) = mejora futura separada, NO en este feature.
  - PATCH del gist no es compare-and-swap: con 2 dispositivos y botón manual la colisión de
    escritura simultánea es improbable; si pasa, la segunda envolvente pisa a la primera, PERO
    los estados locales de ambos siguen siendo fuente de verdad y el siguiente sync 3-way reconverge.

## 5. UX de conflicto (mismo patrón de diseño que los badges de origen)

- Receta en conflicto: **badge "⇄ conflicto"** (mismo mecanismo/estilo que los badges de origen,
  como `badgeOrigenHTML` en `app.js`).
- Modal resolver (`abrirModal`, accesibilidad estándar del repo): lado a lado las dos versiones
  SOLO del campo/paso en conflicto (con `escapeHTML` SIEMPRE) y 3 botones:
  **Quedarse con móvil / Quedarse con PC / conservar ambas** (la segunda copia hereda badge
  "duplicada" para limpieza manual). Al resolver, la elección viaja en el ack y el otro
  dispositivo la adopta (nunca re-pregunta lo ya resuelto).

## 6. UI en la vista Copia de seguridad (FASE 5, wiring en `app.js`)

- Botón **"🔄 Sync"** junto a los de export/import (mismo tamaño/accesibilidad que el resto:
  `aria-label`; `activablePorTeclado` si es clicable-solo).
- **Modal de configuración** (una vez por dispositivo): campo token PAT (password input,
  sin `escapeHTML` al teclear pero validado/vaciado antes de usar), campo gist_id y passphrase
  por sesión. Sin token → botón Sync deshabilitado con hint. Todo guardado en LS bajo
  `LS.sync*` con los helpers.
- Estados de texto de cada rama de la máquina (§3): publicado / aplicado / pendiente / limpio /
  nada que sincronizar / errores de red (fetch falla → mensaje textual y el estado local NUNCA
  se corrompe).
- El flujo NO es automático en background: cada sync es un clic explícito (decisión del
  usuario). Un "auto-sync al abrir" queda como idea futura, no en este feature.

## 7. Detalles de repo a no olvidar (regresiones históricas del AGENTS.md)

- **`index.html` script order:** añadir los módulos nuevos DESPUÉS de `ingredient-matching.js`
  (diff-merge reusa fingerprints) y antes del `DOMContentLoaded`, como el resto de módulos.
- **`sw.js`:** los módulos nuevos (sync-crypto, sync, diff-merge) entran en la lista SHELL de
  precache y **SUBE +1 el nombre del caché** (mrcheff-v3 → v4): la entrega network-first
  funciona sin bump, pero el precache offline del shell debe incluir los ficheros nuevos.
- **AGENTS.md:** al cerrar el feature, documentar la pieza (sección patrón como las demás
  features) y anotar la decisión en CODING_STANDARDS §8 porque se amplía contrato público
  (mergeIncoming/buildBackup con campos nuevos + `version: 2`).
- Tests nuevos con nombres de la carpeta actual: unit bajo `webapp/tests/`, integración Jest
  bajo `webapp/e2e/*.spec.js` (patrón `recipe-edit.spec.js`), manuales Playwright `*.mjs`.

## 8. Verificación

**Unit/integración (Jest):**
- `tests/sync-crypto.test.js` — derivación determinista (salt/iterations inyectados),
  roundtrip encrypt/decrypt, passphrase errónea → null. (Node ≥18 trae WebCrypto global;
  si jsdom lo oculta, inyectar `cryptoImpl` por contexto — inyectables §6 CODING_STANDARDS.)
- `tests/diff-merge.test.js` — tabla de casos: solo-A, solo-B, ortogonales (pasos 2 y 6),
  **misma-línea-editada-distinta** (el caso de la sesión), inserción+edición en zonas
  distintas, reordenación, listas de longitud distinta, UTF-8/tildes.
- `tests/merge-identidad.test.js` — uid preservado, dedup por fingerprint para legacy,
  foods dedup por nombre en payload v2, no-regresión del import v1.
- `e2e/sync-protocol.spec.js` — DOS dispositivos simulados con `fetcher` fake contra un
  "gist" en memoria: ciclo completo offer → ack → vaciar; ofrecer sin cambios → "nada";
  deviceId propio → pendiente; passphrase errónea; red caída a mitad del protocolo (estado
  local intacto); idempotencia (sync 2 veces seguidas); reciprocidad dif3 (A y B llegan al
  mismo estado final).
- Suite completa: `cd webapp && npm test` verde (302 tests en la última ejecución 2026-10-18;
  seguirá creciendo) + `npm run coverage`.

**E2E manual real (2 navegadores + gist real):**
- `e2e/sync-buzon.mjs` — script Playwright: dos contextos (uno con LS sembrado distinto),
  flujo por botones con asserts de mensajes/UI y del contenido real del gist (GET con token
  en variable de entorno), incluyendo el caso de conflicto de la misma línea.
- Checklist manual adicional: móvil PWA real + escritorio (instalada), passphrase idéntica en
  ambos, modo avión en A durante un sync → error textual sin corromper nada.

## 9. Preparación manual del usuario (una vez)

1. Crear PAT clásico SOLO con scope `gist` (github.com/settings/tokens) — nunca se da a un agente.
2. En cada dispositivo: tab Copia de seguridad → configurar token + gist_id (el gist lo crea
   un botón "Crear buzón" la primera vez, o lo pega el usuario) y la passphrase compartida
   entre ambos.

## 10. Orden de ejecución (fases de implementación)

- [ ] **F1** Identidad + backup v2: mergeIncoming/buildBackup (uid preservado, fingerprint,
      cooked/weekmenu, editedAt) + `tests/merge-identidad.test.js`.
- [ ] **F2** `modules/sync-crypto.js` + `tests/sync-crypto.test.js`.
- [ ] **F3** `modules/sync.js` (máquina de estados, fetcher inyectable) + `e2e/sync-protocol.spec.js`.
- [ ] **F4** `modules/diff-merge.js` (diff3 + identidad) + `tests/diff-merge.test.js`.
- [ ] **F5** Wiring `app.js` (botón Sync, modal config, resolver, badges, textos de estado)
      + integración `e2e/sync-ui.spec.js` (obligatoria: cruza storage+DOM, CODING_STANDARDS).
- [ ] **F6** `sw.js` SHELL + caché v4; AGENTS.md + CODING_STANDARDS §8; suite completa verde;
      e2e manual real con 2 dispositivos y gist real.

## 11. Criterios de aceptación

- [ ] Entre sincronizaciones, el gist solo contiene `{"kind":"empty"}` o ciphertext ilegible.
- [ ] El caso exacto de la sesión (misma línea del method editada en A y B sin sync previo)
      termina con ambas versiones preservadas y resueltas por el usuario, sin duplicados
      eternos ni texto perdido.
- [ ] Un fallo de red en cualquier punto del protocolo deja intacto el estado local de ambos.
- [ ] El export/import manual sigue funcionando idéntico (no regresa).
- [ ] Suite Jest completa verde y e2e manual de 2 dispositivos capturada en `reports/`.

# Plan — Feature: Recetas sugeridas + Menú semanal

**Estado:** DISEÑO CERRADO (5 decisiones). Pendiente de implementar. Documentación única canónica para arrancar la implementación por fases pequeñas; no se ha tocado ningún código todavía en esta ronda.
**Origen:** Sesión anterior que acordó las 5 decisiones; este archivo sustituye al borrador raw original y consolida el contrato (incluido `mrcheff.weekmenu`, línea que quedó truncada en el transcurso). Todo está pensado para cumplir CODING_STANDARDS.md §7 "Definition of Done": cada fase debe entregar su propio test verde ANTES de pasar a la siguiente.
**Fecha:** 2026-10-17 · Autor: decisión compartida (usuario + agente).

---

## ¿Qué toca y qué NO toca?

- **NUEVAS claves de localStorage** — se añaden 2, sin borrar/doblegar ninguna de las 4 existentes
   (`mrcheff.foods`, `.recipes`, `.innov`, `.innov.date` siguen igual):
  | Clave | Forma (nuevo contrato → nota en CODING_STANDARDS.md §5) |
      |---|---|
  `mrcheff.cooked` |
    Array de:
      `{ id: string(uid), title: string, keyFingerprint: string, on: "YYYY-MM-DD" }`
    — registro de que una receta se aprobó/cocinó esa fecha real. Es el **único ancla del cooldown de 7 días**
    y NO depende del `id` interno concreto en `recipes[]` (robustez ante borrado/re-import): usa un
    *fingerprint por ingredientes normalizado* idéntico al ya usado en Innovación (`recipeIngredientKey`,
    no reinventamos nada, ver "Referencias de código verificado" más abajo).

  | Clave | Forma (nuevo contrato → nota en CODING_STANDARDS.md §5) |
      |---|---|
  `mrcheff.weekmenu` | **(LÍNEA RECONSTRUIDA — el borrador original quedó truncado tras `recipeIdRef`). Forma de referencia: **
    ```js
    {
      approved: boolean,            // plan aprobado o sólo previsualización
      includeUnavailable: boolean,  // toggle "aunque no estén disponibles → van a la compra"
      // ANCLA DE FECHA = HORA (today del momento en que se pulsó "Aprobar plan"), NO el día visual marcado
      generatedOn: string("YYYY-MM-DD" | ISO),
      plan: Array<
        {
          daySlotIdRef: string,   // ref al slot/día elegido (sólo para etiqueta visual)
          recipeRef: <ref de receta seleccionada>,  // referencia interna a la receta asignada
          includeUnavailableItems?: Array<string>,   // ingredientes marcados como "a comprar" SÓLO si applyIncludeUnavailable
                                                       // = true; en caso contrario ausente o vacía
        }
      >,
      needyFoods: Array<FoodDraftShape>,  // union de ingredients-ausentes dedup por nombre-normalizado → lista de compra transitoria (NO se persiste su propio estado "comprado"; ver §3 Card-3)
    }
    ```
    Nota a confirmar por quien arranca Fase 4 antes de codificar: la forma anterior es **mi reconstrucción** del contrato truncado; si el borrador original tenía otros campos, sustituirlos y re-ajuste `mrcheff.cooked[].keyFingerprint` (sigue siendo el mismo anchor único y no cambia).

## 1. Nueva capa modular (`webapp/modules/planner.js`, patrón §3 option-A)
Misma forma IIFE + doble-*export* que ya usa el resto de módulos del repo; **sin tocar DOM ni localStorage desde dentro** → testable por Node/Jest sin jsdom. API pública cerrada:

```js
window.MRCheff.planner = {
  fingerprintOf(recipe)                    // reusa el mismo cálculo que innovations.recipeIngredientKey (ver § "Referencias de código verificado")
  buildCandidatePool(foods, recipes, catalog, opts),   // fusión Mis Recetas + catálogo curado; dedup por fingerprint contra `recipes` ANTES de devolver; filtra lo cocinado-en-7-días según `mrcheff.cooked` (regla §4 "Filtro… ANTES del scoring")
  suggestToday(pool, foods, opts),         // receta con TODOS sus ingredientes presentes Y qty>0 en aforo, ordenada por haveRatio desc; devuelve ideas mapeadas al shape de Innovación (usa meal/id/…) pero con source: "sugerencia-hoy" para la etiqueta en UI (§4 "SOURCE_LABEL")
  buildWeeklyMenu(pool, foods, { includeUnavailable }), // si includeUnavailable=false → exige "hoy disponible"; si true permite qty==0 marcándolos como "a comprar" y devuelve también `needyFoods[]` = union de ingredientes-ausentes dedup por nombre-normalizado, con shape listo para auto-inyectarse en `foods` (score=5 / qty=0 / min=0), mismo patrón que ya hace backup.mergeIncoming para nuevos alimentos
  shoppingListFor(plan, foods)             // derivado PURO del plan ya aprobado: lista de alimentos que "faltan" por fingerprint contra panter actual; MISMO shape que una fila de alerta semanal; NO persiste nada nuevo (regla §4 última bala)
};
```

Reutila **directamente** la función de fingerprint idéntica a la de Innovación. **Decisión tomada en esta sesión:** duplicar la función tal cual ya hace `backup.js` con su constante interna `MEAL_SET` (por consistencia con el resto del repo), **no** extraerla todavía a un módulo `fingerprint.js`. Queda registrado como decisión explícita para no "romper §5 sin avisar"; si en Fase 1 al inspeccionarlo se ve que la duplicación es incómoda, puede migrarse a shared module con nota nueva de registro.

> **Verificado antes de escribir esto (ver § Referencias):** los helpers `normForMatch`/`recipeIngredientKey`
> viven *cerrados dentro* del IIFE de `innovations.js` y NO están expuestos sobre `window.MRCheff`. Por eso la decisión es **duplicar**, no reexportar; si se opta por extraer, es una refactor separada registrada en §8 igual que cualquier otro cambio de contrato.

## 2. Cambios de UI / HTML / CSS (sólo `index.html` + closure de `app.js` + pequeña extensión a `style.css`)
- New tab nav entre **Innovación** y **Temporada**:
  ```html
  <button class="tab" data-view="suggest">🍽️ Sugerencias y menú</button>
  ```
- Una sola sección `#view-suggest` con 3 tarjetas:

#### Card 1 — "🍳 Se puede cocinar hoy"
Botón **"↻ Sugerir ahora"** (mismo patrón de acción que la tarjeta de Innovación) + botón **"Limpiar"**.
Lista de tipo `recipe-card` con etiqueta nueva **`SOURCE_LABEL.sugerenciaHoy = "Sugerencia de hoy"`** a
añadir en la constante ya existente junto a las etiquetas presentes (`curada`, `variacion…`). Cada tarjeta
tiene acción **"🍳 Cocinar hoy"** → inserta registro `{ id (uid, mismo generador que usa Innovación para ids), title: <título de receta>, keyFingerprint: planner.fingerprintOf(recipe), on: today()` en `mrcheff.cooked` + re-render. **No toca Mis Recetas / `recipes[]`.**

#### Card 2 — "📅 Menú semanal"
- Toggle checkbox: **"Incluir alimentos aunque no estén ahora disponibles (se añadirán como pendientes de compra)"**.
- Botones **"Generar menú"** y **"Aprobar plan"**.
- En previsualización NO-aprobado se muestran 7 filas por día, cada una con un `select` del slot/día + la receta asignada ANTES de aprobar. "Aprobar plan": guarda en `mrcheff.weekmenu` (ver forma reconstruida arriba) Y registra en
   `mrcheff.cooked` **para cada receta del plan** con ancla de fecha = HOY (la real del momento, NO el día visual marcado — eso es sólo para la etiqueta). Re-render.

#### Card 3 — "🛒 Lista de la compra"
Aparece **sólo si hay `mrcheff.weekmenu.approved=true` con `includeUnavailable=true`** o si tras aprobar
quedan ingredientes ausentes en el aforo. Mismo estilo visual que `.alert-card.alert-green`; cada item es una
fila con casilla "marcar comprada" (checkable, no inventamos un nuevo componente tipo de fila; reutilizar el patrón ya existente de alertas semanales). Al marcar como comprada: **auto-añade** ese alimento a `foods` del inventario (`qty=0`, `min=0`,
`score=5`) deduplicando por nombre, **siguiendo exactamente el mismo procedimiento que `backup.mergeIncoming` ya hace para nuevos alimentos**. Además refresca la alerta semanal existente (mismo re-render ya presente hoy).

### Modal mejorado (`openRecipeModal`)
Extensión no rompingas de su forma actual (`openRecipeModal(r)`), recibe opcionalmente 2º arg:
```js
openRecipeModal(recipe, { highlightMissing: true })
```
Si viene del flujo Sugerencias/Menú con algún ingrediente NO presente en aforo (match normalizado contra el inventory actual): ese `<li>` lleva clase **`.meal-missing`** (rojo) + etiqueta **"⚠️ No lo tienes"**. Las demás llamadas al modal (vistas Recetas / Innovación actuales) **NO activan esta bandera → comportamiento visual idéntico al de hoy** (no se rompe nada probado ya).

## 3. Reglas de negocio concretas (contrato para que sea probable/estable)
- Filtro **"cocinados esta semana" se aplica ANTES del scoring** dentro de `buildCandidatePool`, por lo que tanto Sugerencia-hoy como Menú semanal comparten la MISMA lista ya-cocinada-filtrada — no hay dos mecanismos distintos.
- **"Cantidad real disponible": para Sugerencia-hoy exige `qty > 0` en aforo** (no basta con estar listado). Para Menú-semenal CON toggle activado, **sí se permite `qty == 0`** y esos ingredientes van directamente a la compra.
- Deducir por **"mismo plato ya guardado"** reutilizando el *fingerprint de ingredientes* (Jaccard = 1.0 exacto igual que Innovación) **no sólo el `id` del registro**, para ser robusto ante borrado/re-import entre sesiones — consistente con la regla ya existente de exclusión hard por usuario (`isHardExcludedByUser`).
- La **lista de la compra se calcula en cada render del menú semanal aprobado** (derivada, NO persistida extra), igual que hoy lo hace la alerta semanal contra el inventario. No se introduce ninguna nueva clave de localStorage para ese subcaso concreto.

## 4. Tests / Cobertura / E2E
- **NUEVO unit test `webapp/tests/planner.test.js`** (Capa-1, sin jsdom), casos:
   - "todo disponible" → Sugerencia-hoy devuelve receta con todos los ingredientes y qty>0;
   - "falta algo — WITH/WITHOUT includeUnavailable" en Menú-semenal (comportamiento opuesto según el toggle);
   - **dedup por fingerprint** contra `recipes` ya guardados;
   - **"cooldown 7 días inyectando hoy"** usando `opts.today` idéntico al patrón `mergeIncoming(current, data, { today })` ya probado en tests/backup.test.js (inmutabilidad + determinismo §6);
   - **"lista de compra · unión dedup por nombre-normalizado"** (`shoppingListFor` contra aforo con alimentos que ya existen no se duplican; los nuevos entran dedup-ido).
- **NUEVO test de integración `webapp/tests/suggest-weeklymenu.integration.test.js`** siguiendo EXACTAMENTE el patrón existente en [`e2e-flow-receta-a-alerta-compra.integration.test.js`](./e2e-flow-receta-a-alerta-compra.integration.test.js): arranca vía `bootApp()`, pulsa la new tab Sugerencias y menú, genera menú con toggle activado → aprueba plan → comprueba por snapshot del localStorage que `mrcheff.cooked` tiene las entradas con ancla = hoy y que los alimentos auto-creados quedaron en `foods` con `{qty:0,min:0,score:5}`.
- **Stub E2E** new file `webapp/e2e/suggest-weeklymenu.spec.js` marcado como *pending* (texto comentado, sin ejecutar todavía — hoy NO hay Playwright instalado según §6 de CODING_STANDARDS.md; se crea únicamente para no perder trazabilidad del flujo).
- **Actualizar `jest.config.js > collectCoverageFrom`** (línea 8 ya existe) → añadir `modules/planner.js`.
- **Nota obligatoria en CODING_STANDARDS.md:**
   - §5: nueva forma de `mrcheff.cooked` + `mrcheff.weekmenu` documentadas.
   - §8: registro explícito "por qué no romper §5 sin avisar" y decisión de duplicación vs extracción del helper de fingerprint (ver §1 arriba).
- **Actualizar el bullet "Data model & gotchas"** ya existente en AGENTS.md para que el single-canonical-in-repo-reference no quede desactualizado.

## 5. Orden de implementación (Boy Scout por fases; cada fase con test verde ANTES de pasar a la siguiente)
1. Añadir `modules/planner.js` (capa pura, sin UI todavía) + `tests/planner.test.js` → **npm run coverage** verde nuevo módulo, 0 cambios en DOM/UI.
2. Extender `openRecipeModal(r, { highlightMissing })` + CSS `.meal-missing` + test visual/mini de la bandera (NO rompe las vistas ya probadas — ver §6 determinism/inmutabilidad y el e2e-flow actual intacto).
3. Añadir tab HTML + wiring en closure de `app.js` para Card-1 "Sugerencia de hoy" → su test-integración parcial (mismo estilo de assertions que `tests/app.integration.test.js`).
4. Card 2 "Menú semanal" + approval-flow + auto-injección de foods ausentes + Lista-de-compra derivada (Card-3) → **test de integración completo** cruzando contra la alerta semanal ya existente (`shoppingListFor` vs re-render de alerta). Estilo: `tests/suggest-weeklymenu.integration.test.js`.
5. Notas en CODING_STANDARDS.md §5/§8 + AGENTS.md bullet Data-model + stub E2E trazabilidad (ver §4 arriba) → cierre documentario antes de considerar la feature "done".

---

## ¿Por dónde arrancamos?
Cambiar a modo edición/Build y decir: **a) por Fase 1 solo** (lo mínimo para que `planner.js` sea real en su capa pura, con test verde aislado), o **b) secuencia completa 1→5 seguido** tal como está.

> Alternativas de decisión que se pueden ajustar todavía SIN tocar código (antes del Fase-1):
>   - Nombre exacto final de `mrcheff.weekmenu` campos (ver reconstrucción arriba, § nuevo contrato).
>   - Duplicar vs extraer el helper de fingerprint a un módulo shared (`fingerprint.js`) — hoy decisión = **duplicación**.
>   - Si la Card-3 lista-de-compra debe persistir su propio registro "marcado comprado" aparte o seguir siendo derivada (hoy: **derivada + sólo auto-add al inventario**, por diseño explícito).

## Referencias de código verificado antes de escribir este documento (2026-10-17; no es un "supuesto")
> Verificación hechas con grep directo en `webapp/`; si algo ya cambió entre sesiones, re-verificar antes de codificar Fase 1.
  - Helpers de fingerprint **cerrados en el IIFE** de `modules/innovations.js` (líneas ~140–215), NO expuestos sobre `window.MRCheff`:
      - `normForMatch(normFn, s)` — recibe normalizer function + string;
      - `recipeIngredientKey(ingredients, normFn)` → key canónica Jaccard=1.0 usada también por `isHardExcludedByUser(recipe, userKeys, userTitles, normFn)` (líneas ~159–210);
      - ⇒ Por eso la decisión del §1 es **duplicar** esa lógica interna en `planner.js` tal como ya hace `modules/backup.js` con su constante `MEAL_SET`, no reexportar. Si se opta por extraer → refactor separada registrada en CODING_STANDARDS.md §8.
  - `openRecipeModal(recipe)` **actual es single-arg** (`app.js:~381`) — confirmada como punto de extensión no-roble con 2º arg opcional `{ highlightMissing }` (§2 Modal).
  - `SOURCE_LABEL` constante en `app.js` ya incluye labels presentes (`curada`, etc.); nuevo valor a añadir:
      `sugerenciaHoy: "Sugerencia de hoy"` (ver §2 Card-1 + innovaciones.js línea ~40
   `"IDEA_SOURCE_CANONICO" = "curada"` como patrón de cómo se inyecta un value-singel-source en UI).
  - `collectCoverageFrom` ya está en `webapp/jest.config.js:8` → Fase 1/§5 añade `modules/planner.js`.
  - Test de integración existente para espejar: [`tests/e2e-flow-receta-a-alerta-compra.integration.test.js`](./)
    (usa `bootApp()` de `tests/boot.js`, ejercita clicks reales y snapshot de localStorage — mismo estilo que usará la nueva capa-3/4).
  - **No existe** todavía ningún file/folder under:
      - `webapp/tests/suggest-weeklymenu.integration.test.js`
      - `webapp/e2e/**` (carpeta y stub spec marcados *pending*, ver §4 E2E).

---

## 11. Evolución del contrato (2026-10-18 — bugfix matching + menú 7×3 + swap individual)

Aplicada con el usuario según CODING_STANDARDS.md (log de excepciones §8 actualizado):

1. **BUG matching de ingredientes (Innovación + Menú):** el matcher por subcadena-cruda
   (`nombreA.includes(nombreB)`) daba falsos positivos — ingrediente "Sal" encajaba dentro del
   alimento "Salchichón ibérico". Se extrae `modules/ingredient-matching.js` (tokens + deplural,
   stopwords, SIN prefijos sueltos: "agua" no casa "aguacate") y lo consumen `planner.js`
   (`pantryMatchDetails`, con gate qty>0) e `innovations.js` (`pantryMatchesForRecipe`). La
   duplicación del matcher entre ambos módulos se CIERRA (§8).
2. **BUG lista de la compra:** `shoppingListFor` dedup por lower-case EXACTO → ahora dedup por
   tokens del matcher ("Plátano" y "Plátanos" ya no se duplican) y tacha ítems con stock REAL
   (qty>0). Además, **semáforo de urgencia** por fecha de preparación (ctx `{ plan, generatedOn,
   today }`): `onDay` = fecha MÁS próxima en que un slot necesita el ítem; `daysUntil`; urgencia
   hoy/mañana=red, 2-3 días=orange, ≥4=green; salida ordenada rojo→verde.
3. **Menú 7×3:** `buildWeeklyMenu` devuelve `plan[7] = { dayLabel, meals[3] = { meal, recipe|null,
   missing } }` (21 platos). DETERMINISTA por ranking sin azar (se retira `opts.rng` del contrato —
   §8); dedup global (no repite plato en la semana) con degradación a repetición inter-día si el
   pool se agota. Catálogo curado: 11 desayunos / 77 comidas / 27 cenas → 21 platos distintos
   alcanzables.
4. **🔄 Cambiar individual (por día + comida):** nueva 6ª función pública `planner.pickRecipeForSlot
   (pool, foods, { meal, excludeKeys, includeUnavailable, uid, today })` + `menu-semanal.
   swapSlotRecipe(ctx)` (inmutable, recompone `needyFoods`, mantiene `approved/generatedOn`, añade
   `slot.triedKeys` para recorrer el ranking sin oscilar). Se RETIRA `regenerateAfterCook`: "🍳
   Cocinar" desde el menú compone `cookEntry` + `swapSlotRecipe` (renueva SOLO ese hueco).
   Tests: `planner.test.js` (contrato 6 fns + 7×3 + pickRecipeForSlot), `menu-semanal.test.js`
   (approve 7×3, swap, urgencia), `suggest-weeklymenu.integration.test.js` (flujo 7×3 + swap).
   Docs: AGENTS.md (data model) + CODING_STANDARDS.md §8.

## 12. Rediseño UI tokenizado + editor de recetas (2026-10-18 — tarde)

Aplicado con el usuario (feedback directo sobre el primer rediseño "La cocina tranquila"):

1. **Sistema de diseño tokenizado** (`style.css` reescrito): todo color vive en `:root` / `[data-theme="dark"]`,
   sin hex sueltos en componentes (fin del bug histórico del modo claro: un token basura fuera de comentario
   aniquilaba el bloque `:root`). Tipografía editorial (Georgia para títulos/marca) + sans de sistema.
2. **Menú semanal en franjas largas a sangre**: una franja por día a todo el ancho; filas de comida
   iguales de ancho (tocan los bordes de la franja, recorte con `overflow: hidden`), filete de color
   por comida (data-meal: desayuno=ámbar / comida=azul / cena=violeta), reparto fijo etiqueta|plato|acciones.
3. **Modal de receta ampliado** (hoja 820px, columna de lectura 680px): secciones Ingredientes/Método con
   filete, pasos numerados con insignia, footer separado.
4. **✏️ Editar recetas** (nuevo flujo): todo modal de detalle lleva "✏️ Editar" / "✏️ Editar y guardar".
   Receta de Mis Recetas → edición in-situ (mismo id, persistida); plato del catálogo o del plan →
   COPIA editable en Mis Recetas (el original queda intacto) + el hueco del plan aprobado refresca su
   plato (`aplicarEdicionAlPlan`, parche por id original — decisión §8). Form: título/momento/ingredientes
   (uno por línea)/pasos (uno por línea), con validación (toast si falta alguno).
   Tests: `tests/recipe-edit.integration.test.js` (3 casos) + stub `e2e/recipe-edit.spec.js`.

### 12.1. Segunda iteración (mismo día — review del usuario)

1. **Lógica del editor a módulo puro:** la decisión de in-situ/copia, la validación del borrador y el
   parche del plan se extraen a `modules/recipe-editor.js` (API cerrada: buildDraft / validateDraft /
   estaGuardada / applyEdit / patchPlan; tests en `tests/recipe-editor.test.js`). app.js queda como
   composition-root: sólo lee campos de DOM, persiste y pinta. `aplicarEdicionAlPlan` se RETIRA de app.js.
2. **Fix emoji duplicado** en la etiqueta de cada fila del menú: `MEAL_ICONS` (icono suelto) + `mealLabels`
   (que YA incluye su icono) producían "🌅 🌅 Desayuno". Se retira `MEAL_ICONS` y la etiqueta usa su
   icono embebido: "🌅 Desayuno".
3. **Anchura de filas blindada:** `.menu-meal-row` declara `width: 100%` + `align-self: stretch`
   explícitos (comportamiento anómalo de filas a distinta anchura reportado con captura en el review).

### 12.2. Tercera iteración (mismo día — review continuo)

1. **Aire vertical en el modal de detalle:** las secciones "🧾 Ingredientes"/"👨‍🍳 Método" ganan
   separación (h4 con margin 28/14 + filete) y el footer de botones ya NO se pega al último paso
   (margin-top 34px). El editor sube el aire entre campos.
2. **Lápiz ✏️ en TODAS las vistas de recetas** (atajo directo al editor, sin pasar por el modal):
   tarjetas de Mis Recetas (edición in-situ), tarjetas de Innovación y de Sugerencia de hoy
   (copias editables), y franja del menú (plato del hueco). Guardas de click de cada vista
   actualizadas (`[data-edit]` en los guards) + caso de integración en recipe-edit.integration.test.js.

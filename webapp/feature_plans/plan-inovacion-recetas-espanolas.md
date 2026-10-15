# Plan — Rediseño del módulo de Innovación: propuestas con recetas españolas reales curadas

**Estado:** Borrador de diseño aprobado (Fase 1 aún pendiente de implementar) · **Última revisión:** 2026-10-16
· **Ámbito:** `webapp/modules/` — nuevo módulo de datos + reescritura interna de `innovations.js`.

---

## 1. Contexto y motivo

La generación actual de "ideas" es puramente aleatoria/combinatoria sobre esquemas sintéticos, sin garantía de
que el resultado sea un plato verosímil y real — casuística concreta reportada como defecto:

> *"revuelto de ajos con yogur y cilantro"* → combinación que nadie cocinaría, inventada al vuelo.

**Raíz del problema:** los cuatro generadores internos montan ingredientes de forma **aleatoria** a partir de
arquetipos + estilo-cocina aleatorio (`STYLES`) + "twists"/"remates" aleatorios (`TWISTS`/`FINISH`). No hay ninguna
garantía culinaria sobre la salida.

**Intención declarada por el usuario (a lo largo de toda la conversación):**
- Proponer **recetas españolas reales, sencillas y cotidianas** (cocina casera / estilo Karlos Arguiñano), NO combinaciones inventadas.
- Priorizar recetas cuyos **ingredientes ya tenga en casa** (`state.foods`), **sin penalización dura si falta alguno**: matching parcial = prioridad menor, no bloqueo total ni parada obligatoria.
- Personalizar mediante un **perfil simple de hábitos** inferido de sus propias recetas guardadas (`state.recipes`), para sesgar suavemente hacia lo que ya le gusta pero no saturar siempre lo mismo.
- Mantener **descubrimiento/serendipia genuina**: al pedir más ideado, las posiciones extra son sorpresa real elegida al azar del surtido curado completo — sin volver a forzar combos absurdos.

---

## 2. Estado actual del código (verificado en disco hoy; líneas exactas)

### `modules/innovations.js` (líneas 1–215; IIFE + doble-export idéntico a `classify.js`/`priority.js`)
- Utilidades aleatorias **no inyectables salvo `uid`** (preexistente, líneas ~189–193): `pick`, `chance`, `randInt`,
  `shuffle`, `sample`, `byScore(.,n)`, `joinNames`, `defaultUid()`.
- Plantillas/superadas por el nuevo diseño: `STYLES`/`STYLE_KEYS`, `TWISTS`, `FINISH`, `SEASONINGS`, `PREFIXES`, `ADJ`,
  `ARCHETYPES` (líneas ~47–85) — a eliminar de su uso.
- Los cuatro generadores internos **se retiran en bloque** por ser la causa raíz: `makeVariation` (~L99), `makeCombo`
  (~L134), `makeFreeform` (~L154), `makeSolo` (~L170).

`generate(count, focus, state)` (líneas ~188–212): **firma pública invariante que SÍ se mantiene intacta** para no
necesitar tocar el call-site de integración en `app.js`. Hoy incluye: dedup intra-lote solo por título (`Set` local contra
los ya generados en esa misma llamada) — NO existe ninguna dedup cruzada contra `state.recipes`; eso es infraestructura
**nueva que hay que añadir** este cambio (ver §4.1).

Nota de arquitectura: la organización actual "registry implícito de 4 sub-generadores por `source`" refleja el ideal
Open/Closed ilustrado en CODING_STANDARDS §3; se abandona **solo para esta feature** por una razón concreta y documentada
(ver §7 / log de excepciones que preparamos abajo), no genera vacío ni decisión silenciosa.

### `app.js` — capa controladora que lo consume (verificado hoy)
- Líneas 34–35: claves `LS.innov = "mrcheff.innov"` y `innovDate = "mrcheff.innov.date"`.
- Líneas ~46–55: auto-expiración diaria de la lista sin-guardada (precedente existente, no se toca).
- **Línea 394 y ~508**: render de tarjetas con `${(SOURCE_LABEL[r.source] || "Idea").toString()}` / `|| "Nueva"` →
  fallback defensivo YA presente y tolerante ante cualquier valor nuevo de `source` que aún no exista en el mapa.
- **Línea 430**: `const innovFocus = $("#innov-focus");`
- **Línea 434** (exacto, verificado hoy):
  ```js
  const SOURCE_LABEL = { variacion: "Variación", combo: "Combinación", libre: "Creada", protagonista: "Enfocado", nueva: "Nueva" };
  ```
- **Línea 441**: `const count = parseInt(innovCount.value, 10) || 8;` → por defecto 8 ideas/lote.
- **Línea ~445** (único call-site a mantener sin cambio de contrato — verificado hoy):
  ```js
  const batch = window.MRCheff.innovations.generate(count, innovFocus.value, { foods, recipes });
  ```
- Líneas ~518–530: handlers `data-save` / `data-del` sobre tarjetas (flujo existente; no se modifica).

### `index.html` — vista Innovación (verificado hoy)
- **Línea 137** (texto que queda semánticamente desactualizado al migrar a "determinismo + slot aleatorio controlado"):
  > *"Cada 'Generar ideas' tira un **nuevo lote al azar**: cuantos más alimentos tengas, más ideas y más sorprendentes."*

- **Líneas 140–146** (`#innov-count`, valores actuales exactos — se dejan SIN CAMBIAR por decisión):
  `value="4"` / `value="8" selected` / `value="12"` / `value="20"`. → Se descarta toda idea de tope lógico interno 10; estos rangos quedan intactos, solo cambia la lógica interna por tramos.

- **Líneas 148–155** (`#innov-focus`, opciones/valores actuales exactos, verificado hoy):
  | `value`         | Etiqueta visible actual            | Tratamiento Fase 2 (diferido)                         |
  |-----------------|------------------------------------|------------------------------------------------------|
  | `todo`          | "Todo mezclado"                    | Se mantiene como fallback/por defecto seguro.         |
  | `nuevas`        | "Solo recetas nuevas (de casa)"    | Reinterpretar o retocar; pierde sentido literal con pool unificado. |
  | `variaciones`   | "Solo variaciones de mis recetas"  | Igual que arriba: reinterpretar/deshacer este selector concreto. |

### Módulos reutilizables ya existentes (API surface verificado hoy)
- **`modules/classify.js`** (líneas 1–36, exporta `{ norm, FOOD_TYPES, TYPE_ORDER, classifyFood }`): `norm(s)` = NFD + quitar
  combining-marks; `classifyFood(name)` → uno de `proteina|lacteo|cereal|fruta|verdura|especia|otros`. Se reusa tal cual para el histograma.
- **`modules/priority.js`** (líneas 1–26): no se reutiliza directamente, confirma patrón/estilo de módulo-puro con mismo lenguaje/comentarios.
- Los **~17 tests** en `tests/innovations.test.js` actuales son heredados del diseño viejo (asertan sobre `source ∈ {variacion,combo,libre,protagonista}` y sobre el flujo aleatorio) → quedan obsoletos con este cambio; su reescritura se **diferisce a Fase 2** de forma consciente documentada (§5).

---

## 3. Decisiones cerradas (con justificación breve cada una; todas ya acordadas con el usuario)

1. **Datos separados en su propio módulo.** Nuevo `webapp/modules/recetas-espanolas.data.js` con el **mismo patrón IIFE
   + doble-export** (`module.exports` para Node/Jest, además de exponerse a `window.MRCheff`, idéntico al ya existente en
   `classify.js`/`priority.js`). Lo consume `innovations.js` vía referencia global / `require()`. No se embebe dentro de
   `innovations.js`; **no** conserva la lógica anterior del módulo.
2. **Personalización "Nivel completo."** Uso simultáneo de (a) ratio de ingredientes compartidos con el aforo y, además,
   (b) un perfil sencillo por categorías reusando `classify.classifyFood()`/`norm()`, para sesgar suavemente hacia lo que ya
   le gusta pero sin saturar. No es mínimo ni stub diferido — se implementa en Fase 1 mismo.
3. **Metadato mínimo.** Cada registro: `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }`. Sin campos
   `chef`/`región`/proveniencia por ahora (no pedido → coherente con principio Boy Scout / expand-contract de CODING_STANDARDS §1.3).
4. **Determinismo total del núcleo + dedup difusa sin parada dura.** Ordenamiento estable por `id` del dataset frente a
   empates; Jaccard ~0.6–0.7 contra `state.recipes` se usa ONLY como down-weight suave para cuasi-duplicados conceptuales NO idénticos;
   **la única exclusión absoluta/dura es el match exacto** (Jaccard = 1.0 en el conjunto de ingredientes, o título normalizado
   idéntico), aplicado como pre-filtro universal ANTES de cualquier método de selección (§4.1) — no es down-weight sino
   exclusión real y total, exactamente lo que pidió: "las guardadas con estrella desaparecen temporalmente hasta que las eliminas".
5. **Tramos fijos por lote (decisión corregida respecto a una lectura inicial errónea de mi parte):** las **primeras 6 ideas**
   del lote SIEMPRE se eligen por ranking determinista estricto (`PRIORITY_SLOTS = 6`); desde la posición 7 hasta `count`, si
   `count > 6`, se eligen por selección **uniformemente aleatoria** del pool curado no-excluido, ignorando TODA regla de scoring/
   nudge/dedup suave para esas posiciones concretas (solo respetan el pre-filtro universal de exclusión exacta §4.1 y no repetir un
   plato ya elegido en ese mismo lote — garantía natural de "salida limpia sin repeticiones intra-lote"). Para `count ≤ 6`, el lote es
   **100% determinista**, trivialmente testeable sin inyectar randomness alguna. Umbral = 6 fijo, NO escala con `count` superior
   (corrección explícita del malentendido inicial "≥5" → confirmado por el usuario como: primeras 6 prioridad estricta siempre; resto
   aleatorio solo cuando piden explícitamente más de 6).
6. **Tope máximo descartado.** Se descarta toda idea de tope-lógico interno a 10 ideas por lote; los rangos/valores actuales del
   selector `#innov-count` (4 / 8-seleccionado / 12 / 20, ver §2) se dejan intactos, sin tocar HTML/capa vista. Solo cambia el
   comportamiento lógico interno por tramos (§3.5), independiente de qué valor pase la UI por el call-site actual (`app.js:~441/445`).
7. **Testabilidad vía inyección opcional `ctx.rng`.** Se extiende el **precedente ya existente de inyección por contexto del `uid`**
   (verificado hoy en `innovations.js` líneas ~189–193: `ctx.uid = state?.uid ?? defaultUid`, exactamente el mismo idiom) añadiendo una
   propiedad opcional simétrica `ctx.rng` con defualt `() => Math.random()` real en producción; inyectable en tests para anclar la
   secuencia exacta y asertar de forma determinista cuáles recetas caen como "slot aleatorio" del lote sin caos en CI. Esto cierra de
   forma elegante la tensión entre **reproducibilidad total (tests/CI)** y **variabilidad genuina en producción real** que el usuario
   sí quiere por su intención declarada muy al principio: *"quiero descubrir cosas nuevas que me puedan apetecer"*. Este diseño no es
   arbitrario sino directamente alineado con la regla de determinismo explícita de CODING_STANDARDS §6 Capa 1 ("Si algún path exige reloj
   real o random, inyectar `uid`/random provider cuando el código lo permita").

### 3-extra. Detalle: auto-sanidad emergente del diseño (no es mágico, pero vale la pena nombrarlo)

Como **cada llamada a `generate()` recomputa su resultado desde un snapshot VIVO y actual** de `state` (no memoiza/cachea entre
llamadas ni cachea entre pestañas diarias — cada pulsación "Generar ideas" construye el `ctx` nuevo con los valores actuales de ese
momento), si el usuario **borra una receta guardada de su lista "Mis Recetas"** en cualquier momento, esa receta
**reaparece AUTOMÁTICAMENTE** en la pila de opciones del siguiente "Generar ideas" SIN ninguna acción extra ni flag-por-receta que
mantener. Es un efecto emergente positivo y directo del diseño "sin caché entre llamadas" ya descrito §3.4, no requiere código extra.

---

## 4. Especificación técnica (Fase 1)

### 4.1. Nuevos datos — `modules/recetas-espanolas.data.js`
- **Schema estricto por registro** (5 campos, sin metadato extra):
  ```js
  {
    id: "tostada-tomate-ajo",           // string único estable, usado como tie-breaker determinista de orden
    title: "Tostada de tomate y ajo",   // título real y verosímil de plato casero español sencillo
    meal: "comida",                     // solo "desayuno" | "comida" | "cena"
    ingredients: ["Pan", "Tomate", "Ajo", "Aceite de oliva virgen extra"],  // conjunto canónico fijo
    method: ["Tostar el pan...", "..."] // pasos reales coherentes con ese plato
  }
  ```
- **Doble-export idéntico** al ya existente en `classify.js`/`priority.js`: expone array a `window.MRCheff.recetasEspanolas`
  y también como default export CommonJS para `require()` desde tests (patrón IIFE).
- **Contenido:** target recomendado inicial de ~30–40 platos cotidianos REALES sencillas al uso casero español (no fusiones inventadas,
  NO combos imposibles tipo el ejemplo defecto §1) — número flexible/ajustable por el propio usuario en su ritmo futuro ("cambiaré la lógica
  probablemente en un futuro"), no una constante de arquitectura fija: es contenido curado que va creciendo con el tiempo.

  Ejemplos concretos de entradas válidas (ilustrativas, NO el listado final completo):
  ```js
  { id:"tostada-tomate-ajo", title:"Tostada de tomate y ajo", meal:"comida",
    ingredients:["Pan","Tomate","Ajo","Aceite de oliva virgen extra"],
    method:["Calienta una sartén con un chorrito de aceite.","Saltea 1–2 dientes de ajo picado hasta que doran sin quemar.
            Coge pan tostado y frota los tomates maduros cortados por la superficie caliente de las tostadas, añade el ajo salteado
            y vuelve a poner encima un poco de ajos, pincela con aceite y una pizca de sal."] },

  { id:"salmorejo-basico", title:"Salmorejo (rápido, sin cocinar)", meal:"comida"
    ,ingredients:["Tomate","Pan","Aceite de oliva virgen extra","Ajos","Vinagre blanco","Sal"],
    method:["Mojamos el pan en agua fría una hora y escurrimos. Licuamos tomates maduros con los ajos, vinagre y sal hasta que quede
            líquido denso. Añadimos aceite a chorro mientras sigue licuando."] },

  { id:"huevos-remojados-verdura-sencilla", title:"Revuelto de huevos con pimiento y cebolla", meal:"desayuno"
    ,ingredients:["Huevos","Pimiento","Cebolla","Aceite de oliva virgen extra","Sal"],
    method:["Calienta un poco de aceite en la sartén. Pica fino el pimiento y la cebolla, pochalos sin resecar hasta que estén tiernos.
            Añade los huevos batidos con una pizca de sal; remueve suavemente hasta que cuajen."] }
  ```

### 4.2. Nueva mecánica de selección — `generate(count, focus, state)` reescrito internamente

Firma pública **invariante** — el call-site de integración (`app.js:~445`) NO necesita ningún ajuste de contrato.

```js
// Constantes nombradas y ajustables (NO números mágicos ocultos): valores INICIALES sugeridos, explícitamente etiquetados
// como baselines sujetas a re-sintonía posterior por el propio usuario con feedback real de uso — coherente con su aviso recurrente
// "cambiaré la lógica probablemente en un futuro". Son decisiones razonadas y explicables hoy, no parámetros óptimos pretendidamente absolutos.
const PRIORITY_SLOTS = 6;                 // posiciones 1..6 siembre por ranking determinista estricto (decisión §3.5)

// Weights sugeridos para el scoring pipeline de las primeras PRIORITY_SLOTS ideas:
const W_HAVE_RATION      = 0.55;          // cuánto pesa "tienes ya en casa" vs total ingredientes del plato
const W_VARIETY_NUDGE    = 0.25;          // cuánto sesga hacia categorías sub-representadas en tus recetas guardadas (perfil)
const P_DUP_PENALTY      = 0.20;          // cuánto penaliza Jaccard difuso (<1.0, no exacto) contra tus propias recetas guardadas

// Umbral Jaccard para tratar una receta como "cuasi-duplicado conceptual NO idéntico" → down-weight suave ONLY (nunca exclusión):
const FUZZY_JACCARD_DUP_THRESHOLD = 0.65; // valor inicial sugerido, también ajustable

function generate(count, focus, state) {
  const ctx = {
      foods:   Array.isArray(state?.foods) ? state.foods : [],
      recipes: Array.isArray(state?.recipes) ? state.recipes : [],
    uid:      typeof state?.uid === "function" ? state.uid : defaultUid,  // precedent existente (sin cambios)
    rng:      typeof state?.rng === "function" ? state.rng : Math.random, // NUEVO: inyección opcional simétrica a `uid` (§3.7);
                                                                          // por defecto real para producción; tests pueden sembrar secuencia fija
  };

  // --- PRE-FILTRO UNIVERSAL, absoluto y ANTES de cualquier método de selección (ni prioridad ni azar lo saltan) ---
  const guardadasKeys = new Set(
      ctx.recipes.map(r => recipeKeyOf(r))     // key = Jaccard-1.0 equivalente: orden alfabético-estable del conjunto-canónico de
                  ).filter(Boolean));            // ingredientes normalizados (ver §4.3); respaldo secundario por título normalizado exacto

  const poolCuradoNoExcluido = RECHETAS_ESPANOLAS.filter(r => !guardadasKeys.has(recipeKeyOf(r)));
    // Auto-sanidad (§3-extra): si el user borra una receta guardada, la próxima llamada recomputa esto fresco y reaparece sola.

  if (poolCuradoNoExcluido.length === 0) return [];   // caso extremo: catálogo vacío o todo-exactamente-guardado → nada que proponer
    // (no inventar nada nuevo jamás; coherente total con el principio "nunca fabricar combos inexistentes")

  const pool = [...poolCuradoNoExcluido];
  const out = [];
  const alreadyPickedKeys = new Set();   // garantiza NO repetir un plato ya elegido DENTRO del mismo lote (§3.5)

  // (A) Primeras PRIORITY_SLOTS ideas: ranking determinista estricto + stable tie-break por `id` del dataset.
  const rated = pool.map(r => {
      const score = W_HAVE_RATION * haveRatio(r, ctx.foods)
                  + W_VARIETY_NUDGE * varietyNudge(r, categoryHistogramaOf(ctx.recipes))
                  - P_DUP_PENALTY * Math.min(maxJaccardWithAnyUserRecipe(r, ctx.recipes, FUZZY_JACCARD_DUP_THRESHOLD), 1);
      return { r, score };
    })
    .sort((a,b) => (b.score - a.score) || (a.r.id < b.r.id ? -1 : a.r.id === b.r.id ? 0 : 1)); // empates rotos por id estable

  const nPriority = Math.min(PRIORITY_SLOTS, count, rated.length);
  for (let i = 0; i < nPriority; i++) { out.push(rated[i].r); alreadyPickedKeys.add(recipeKeyOf(rated[i])); }

  // (B) Si el user pidió MÁS que PRIORITY_SLOTS: rellenamos posiciones desde la 7 en adelante con selección
  //     UNIFORME-ALEATORIA del pool curado no-excluido Y no ya-elegido, IGNORANDO scoring/nudge/dedup-suave (solo respeta el pre-filtro universal).
  if (count > PRIORITY_SLOTS && out.length < count) {
    let remainingPool = pool.filter(r => !alreadyPickedKeys.has(recipeKeyOf(r)));
    while (out.length < count && remainingPool.length > 0) {
      const idx = Math.floor(ctx.rng() * remainingPool.length);   // uniforme puro, inyectable/testeable
      const picked = remainingPool.splice(idx, 1)[0];
      out.push(picked);
      alreadyPickedKeys.add(recipeKeyOf(picked));
    }
  }

  return out.map(r => toIdeaFromRecipe(r, ctx.uid));   // mapea cada receta curada a forma "idea" compatible con §5 de CODING_
              // STANDARDS: añade `source`, `uses`(=ingredients del plato usados que coincide con tu aforo), etc.
}

// Helpers puros internos (también testeable con ctx.rng inyectado donde aplica):
function haveRatio(recipe, foods) { /* % de ingredientes del plato ya presentes en 'foods' por nombre-normalizado; 0 si foods vacío */ }
function maxJaccardWithAnyUserRecipe(recipe, userRecipes, threshold) {
    // devuelve el máximo Jaccard entre ingredients(normalizados) de esta recipe y CUALQUIER receta guardada del user; 1.0=solo en
   // casos de match exacto (ya filtrado §4.3); <threshold no afecta (down-weight nulo), solo cuenta si cae dentro de [threshold, 1.0).
}
function varietyNudge(recipe, categoryHistogram) { /* sesgo suave hacia categorías ALIMENTARIAS con MENOS presencia en el historial
   // del user; reusa classify.classifyFood()/norm() exactamente — NO re-inventa clasificación nueva */ }
function recipeKeyOf(r){ return r.ingredients.map(norm).sort().join("¦"); }  // fingerprint estable e invariante de orden para Jaccard=1.0 exacto
```

**Detalles clave de la fórmula:**
- **`haveRatio` es NO bloqueante:** cocinamiento parcial (tenes 3 de 4 ingredientes del plato) reduce su prioridad, NUNCA lo descarta por completo salvo que coincida exactamente con una receta ya guardada (§4.1 pre-filtro). Coherente con "missing ingredients must NOT be a hard stop".
- **`maxJaccardWithAnyUserRecipe(...)`** solo penaliza dentro del rango difuso `[threshold, 1.0)`: un plato CONCEPTUALLY-muy-similar (p.ej. otra "tortilla de patatas" variante frente a una que ya tienes guardada con algo distinto) baja prioridad suavemente; UN match exácto NO debería llegar aquí porque ya quedó excluido por el pre-filtro absoluto de §4.1 — este helper es red de seguridad defensiva, no la vía principal.
- **`varietyNudge`** reusa `classify.classifyFood()`/`norm()` del módulo ya existente (no inventa taxonomía nueva).

### 4.3. Match-key universal para "ya guardada con estrella" (exclusión absoluta)
Primera clave de match = fingerprint estable por orden-alfabético-canónico del conjunto de ingredientes normalizados (`recipeKeyOf`, §4.2):
es **invariante frente al orden y a acentos** (usa `norm()` ya existente), robusto frente a cualquier reordenamiento de lista o
diferencia menor de formato de título en la UI. Se guarda en un `Set` calculado UNA VEZ por llamada a partir de `state.recipes`
vivo, y se usa como único criterio HARD-EXCLUSION para cualquiera de las dos ramas de selección (A prioritarias / B aleatorias) por igual.
Esto implementa literalmente "las recetas guardadas con estrella desaparecen temporalmente hasta que el usuario las elimina de 'Mis
Recetas'" (§3-extra: reaparece solo automáticamente al recomputar sin caché entre llamadas tras su borrado manual).

### 4.4. Forma del objeto-idea devuelto (compatibilidad de contrato con UI existente)
Cada idea sigue mapeándose a la misma forma que ya consume la capa vista (`app.js`): `{ id, title, meal, ingredients[], method[],
source?, uses? }`. Recomendación: asignar un **nuevo valor canónico `source`** para esta feature (p.ej. `"curada"` o `"espanola_real"`)
— NO es bloqueante porque `app.js:~394/508` ya tolera cualquier `source` inesperado vía el `|| "Nueva"/"Idea"` fallback verificable hoy en §2;
simplemente significa que hasta que se implemente la Fase 2 de UI (§5), esa etiqueta visual saldrá con la etiqueta genérica de fallback, no
rotura.

### 4.5. Descarte del patrón "registry-multiplegenerador" para ESTA feature — justificación formal para CODING_STANDARDS §8

CODING_STANDARDS §3 ilustra el ideal Open/Closed como *array de generadores registrables por `source`*
(`makeVariation`/`makeCombo`/etc. en `modules/domain/innovations/*.mjs`, §2-O). Para **esta** feature ese patrón concreto se abandona
porque ES la propia arquitectura aleatoria-multi-generadora con ensamblaje de ingredientes al vuelo lo que produce el defecto reportado
(§1). No es violación silenciosa: preparar una entrada de log lista para pegar en `CODING_STANDARDS.md §8` cuando se abra PR real:

> `_YYYY-MM-DD · @usuario (asistido por IA) · #tarea= plan-inovacion-recetas-espanolas ·
   Principio afectado: O (Open/Closed, multi-generador-registry) + D parcialmente ·
   Justificación: la arquitectura de 4 generadores por `source` con ensamblaje aleatorio (`makeCombo/makeFreeform/...`) es la causa raíz del defecto
   "combos inventados no verosímiles" (§1). Se sustituye por UN único pipeline determinista de puntuación sobre un dataset curado (nunca se
   fabrica algo nuevo al vuelo; todo sale del conjunto finito de platos reales) + un slot aleatorio controlado solo para descubrimiento genuino,
   respetando el espíritu Open/Closed al registrar Nuevas RECEPITAS (no Nuevos GENERADORES) en ese dataset extensible (`recetas-espanolas.data.js`), que es a su vez la forma de añadir capacidad sin tocar logica existente. Registrado explicitamente por decisión del propietario con asistencia IA, no en silencio._

Y una segunda entrada para el log (§8 también) referente al "lógica nueva despachada transitoriamente SIN su prueba co-local ya verde" durante
Fase 1 (ver §5), que es exactamente la clase de excepción que ese mismo documento ya contempla formalmente:

> _YYYY-MM-DD · @usuario · #tarea= plan-inovacion-recetas-espanolas.md Fase 1 · Principio afectado: D/Testing-obligation-Cap-1 (§6)
   · Justificación: los ~17 tests heredados en `tests/innovations.test.js` asertan sobre `source`/flujo aleatorio del diseño VIEJO, que desaparece
   exactamente a consecuencia de este mismo cambio → escribirla AHORA sería trabajo descartado inmediato (anti-patrón "test-throwaway"). Se difiere la
   reescritura co-local obligatoria al §6-Capa1 a Fase 2 (cuando el diseño new esté estabilizado), decisión explícita y consciente del usuario, NO una omisión silenciosa._

Ambas entradas son **solo plantillas listos-para-completar con fecha/autor reales en la PR de implementación**, no algo escrito ahora mismo
a mano en §8 sin contexto (no se toca `CODING_STANDARDS.md` físicamente todavía).

---

## 5. No tocar AHORA · scope estricto Fase 2 diferido

- **UI (index.html):** reinterpretar valores/etiquetas del selector `#innov-focus` (§2, líneas 148–155); actualizar la copia de línea ~137
   ("nuevo lote al azar / más sorprendentes") para dejar de contradecir que ahora son determinista+slot-aleatorio-controlado en su mayoría; y añadir/
   repurposing a la clave `"curada":"Receta española real"` (o similar) en `SOURCE_LABEL` (`app.js:~434`) cuando corresponda. NADA de esto bloquea Fase 1:
   el call-site actual ya tolera cualquier valor nuevo no-mapeado vía su fallback `|| "Idea"/"Nueva "` verificado (§2), y la semántica de `focus` "extraña/desfasada"
   se degrada con seguridad por defecto (`todo` = comportamiento total/sin filtro, igual que hoy). No romper nunca bajo input inesperado/legacy: contrato defensivo garantizado.
- **Reescritura de los ~17 tests** existentes en `tests/innovations.test.js`: quedan obsoletos por este cambio mismo; su reescritura co-local obligatoria por
   §6 Capa 1 es **Fase 2 diferida con registro consciente** (no omisión silenciosa — ver entradas para §8, §4.5). No se crean specs nuevos ni se reescriben en Fase 1.
- **Enriquecer metadato de dataset** (`chef`/`región`, etiquetas de descubrimiento extra) — solo si se decide después; no pedido ahora (Boy Scout / expand-contract, §3 de CODing_STANDARDS).

---

## 6. Próximos pasos (checklist ordenada para cuando se levante el resto del scope bloqueante)

1. **Crear/finalizar contenido** real y verosímil en `modules/recetas-espanolas.data.js` con ~60–80 recetas caseras españolas sencistas (target inicial
   flexible, no fijo — coherente con "cambiaré la lógica probablemente"). Verificar esquema exacto de 5 campos + doble-export idéntico a `classify.js`.
2. **Reescribir internalmente `generate()`** en `modules/innovations.js` según §4 (pre-filtro universal absoluto Jaccard=1.0 por ingredientes, ranking
   determinista top-6 con tie-break estable por `id`, slot aleatorio uniforme >PRIORITY_SLOTS inyectable vía `ctx.rng`, helpers puros de scoring reusando
   `classify.classifyFood()`/`norm()`) — **manteniendo la firma pública idéntica** al call-site actual de `app.js:~445`.
3. **No tocar todavía:** UI (`index.html` copy/selectores), `SOURCE_LABEL`, ni crear/reescribir tests nuevos (TODO Fase 2 registrado conscientemente §4.5/§5).
4. **(Fase separada/Fase 2)** cuando llegue el momento: reinterpretar etiqueta `#innov-focus`, actualizar copia "al azar/sorprendentes" de la línea ~137 y añadir
   `"curada"` a `SOURCE_LABEL` en `app.js`; reescribir `tests/innovations.test.js` para el nuevo diseño determinista+inyectable; y cerrar las dos entradas del log §8
   con fecha/autor reales antes de merge real.

---

## 7. Notas finales / no se asumen ni se inventan en código

- NO se toca `app.js` (call-site ya compatible por invariancia de contrato) salvo la eventual Fase 2 de UI (§5).
- No se añade dependencia nueva a `package.json`; no `.git add -A`; no se rompe ningún shape del §5 de CODING_STANDARDS (`Recipe`/`Innovation idea` formas públicas).
- La aleatoriedad real en producción y la reproducibilidad total en tests conviven gracias a la inyección opcional `ctx.rng` (§3.7), alineada con el principio
   explícito de determinismo de §6 Capa 1 de los propios estándares del repo — no es capricho, cumple una obligación ya escrita del equipo.

_Ver también: `MR Cheff/CODING_STANDARDS.md` (§1–§8) como fuente canónica de convenciones a respetar en la implementación real._

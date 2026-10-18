# Código & testing — Estándares del proyecto Mr Cheff (webapp)

Vigentes a partir de 2026-10. Esta es la **fuente única** y canónica de los estándares de código y
testing del MVP; `AGENTS.md` lo referencia como tal (sustituyendo al *pointer* previo
`.claude/rules/CodingStandards.md`, ya eliminado junto a toda la carpeta `.claude/`). Este archivo
tiene siempre prioridad si alguna versión está desactualizada.

Aplica **solo a `webapp/`** del MVP de Mr Cheff. No aplica a `Scripts-Utilities/`, ni a ningún
proyecto KMP/Android/iOS (no existe — ver AGENTS.md).

---

## 1. Principios base ("what we care about, in priority order")

1. **Corrección > legibilidad > mantenibilidad > velocidad de escritura.** Lo que se pruebe es lo
   que se mantiene. Un cambio sin su prueba correspondiente no entra en `main`.
2. **Testabilidad antes que comodidad de implementación.** Si una decisión hace más difícil el test,
   probablemente rompe un principio SOLID y hay que reconsiderarla — salvo justificación explícita
   documentada al final del archivo con motivo ("why").
3. **Cambios son *expand-contract / Boy Scout Rule*.** No reescribir `app.js` de una vez; en cada
   PR: dejar el código que tocas un poco mejor (extract function, inyectar dependencia, separar lógica
   del DOM) que cuando llegas. La refactor total es opcional y gradual ("per-feature").
4. **Sin build step hoy** — la app se abre como `index.html`. Cualquier propuesta que introduzca
   bundler/compilador debe abrirse como PR *explícita* con justificación, no "de pasada".

---

## 2. SOLID en JavaScript (adaptado, no copiado literal)

Java-oriented en origen; aquí se traduce a patrones pragmáticos JS:

| Principio | En esta app significa | Ejemplo concreto (Mr Cheff webapp) |
|---|---|---|
| **S** Single Responsibility | Un módulo = un motivo de cambio. Separar *lógica pura/decidir* de *renderizar DOM* de *persistir*. | `urgencyLevel()`, `classifyFood()`, los generadores de innovación, `buildBackup()`/`applyBackup()` deben ser funciones/módulos **puros** (sin tocar DOM ni localStorage). Hoy están dentro del closure de `app.js`; el objetivo per-feature es extraerlos. |
| **O** Open/Closed | Añadir capacidad sin editar código existente que ya funciona. | Nuevos *arquidiólogos* de innovación (`makeVariation`/`makeCombo`/…) o nuevos tipos de alimento se registran en un **array de generadores clasificados por `source`**, no mediante `if/else` anidados dentro `generateInnovations()`. |
| **L** Liskov Substitution | Un "objeto" solo es válido si cumple su *shape* contract; una suplantación (`mock storage`, un futuro real-LLM en lugar del simulado) debe comportarse igual. Los shapes de `Food`/`Recipe`/`Innovation`/payload-de-backup son contratos: **no amplíes ni rompas su forma** (ver §5). |
| **I** Interface Segregation | Dependencias inyectadas deben ser **estrechas**: un módulo que solo necesita "leer y escribir un diccionario de clave-valor" no se le pasa `window` entero. | Definir interfaces mínimas: `Storage { get(key); set(key,val) }`, `IdeaGenerator { generate(count, focus, pantry): Idea[] }`. Los consumidores reciben exactamente eso por argumento (factory inyectado), no el estado global del DOM. |
| **D** Dependency Inversion / testability | El código de alto nivel (**decisiones: generar innovación, avisar reponer, mergear backup**) no debe llamar a detalles concretos (`localStorage`, `document`); esos detalles se inyectan desde abajo hacia arriba en un **composition root**. | Esto lo que hoy es el cierre único de `DOMContentLoaded`: mañana, un módulo `main()` (composition root) crea y *inyecta* en los servicios ya creados las dependencias. Hasta ese día: funciones puras exportables + DOM solo en la capa vista. Es **la** razón por la que los unit tests deben poder ejecutarse sin jsdom (§6). |

> Nota: si un cambio *no puede* cumplir un principio, documentar el "Por qué no" al final de este
> archivo antes del merge (con autor + fecha), que quede registrado en la decisión, no en silencio.

---

## 3. Arquitectura objetivo (mandato **per-feature**, no forzado global)

Estado actual: toda la lógica vive dentro de un único closure `document.addEventListener("DOMContentLoaded", …)`
en `app.js`, con acceso directo a `window`/`localStorage`/`document`. Esto hace que testear "todo" requiera
cargar el app completo en jsdom (ver §6), no probar unidades aisladas.

**Mandato per-feature:** cada **nuevo módulo o feature** se escribe modular y testeable; el código
*legacy* (lo que ya está en ese closure) se va refactoring *oportunístico* cuando se toca, nunca una
reescritura monolítica.

Estructa recomendada en la nueva capa (no obligatoria migrar `app.js` de golpe):

```
webapp/
├─ index.html            # composition root visual: carga <script>s en orden fijo
├─ data.js               # datos estáticos puros → window.MR_CHEFF_DATA { MESES, TEMPORADA }
├─ main.js  (nuevo)      # composition root JS: crea e inyecta deps; reemplaza el "inicio" del closure de app.js
└─ modules/              # nuevo directorio para código modularizado
    ├─ domain/           # funciones/módulos PUROS, sin DOM ni I/O  → objeto Food/Recipe/Idea builders,
    │   ├─ urgency.mjs         urgLevel(score), needsRestock(food, today)
    │   ├─ classify.mjs        FOOD_TYPES/TYPE_ORDER + norm() + classifyFood()
    │   └─ innovations/
    │       ├─ registry.mjs   # array de { source, run() } → cumple Open/Closed al añadir generador
    │       └─ variation.mjs  combo.mjs  libre.mjs  foco.mjs (protagonista)
    ├─ infra/            # adaptadores concretos detrás de interfaces (DI desde abajo hacia arriba)
    │   ├─ storage.localJsdomSafe.mjs   implementa Storage usando localStorage + try/catch
    │   └─ ai.simulated.mjs  implementa IdeaGenerator con las heurísticas deterministas actuales ("Modo simulado")
    └─ views/            # capa de "binding": recibe store+generators inyectados, manipula el DOM
        ├─ alimentos.mjs
        ├─ recetas.mjs
        ├─ innovacion.mjs
        ├─ temporada.mjs
        └─ backup.mjs
```

Patrones aceptados de módulo (elige por feature; ambos válidos dada la ausencia de build step):

- **(A) Factory global + namespace bajo `window.MrCheff`** — sin migrar a ESM nativo todavía: cada archivo
  new-feature expone una factory p.ej. `window.MrCheff.Innovations = { generate, ... }`; el DOM/seguimos
  cargándolo por `<script>` en `index.html`. Sin server requirement, cero fricción migratoria. (Recomendado hoy)
- **(B) Native ES Modules** (`<script type="module">` + `import/export`) — cuando se quiera desplegar servido (no `file://`); trae requerimiento de **servidor HTTP para tests E2E/UI** (CORS/restrictiones del navegador con módulos nativos vía file://), que hay que asumir explícitamente en ese momento.

Ambos caminos deben respetar: **lógica pura fuera del DOM**, deps inyectadas por factory argumento,
un `main.js`/composition-root como "entrada única" de inicio (hoy el cierre de `DOMContentLoaded`; mañana
`main.js`). La carga ordenada `data.js → app.js → ...modules…` se preserva.

Recomendación de migración: empezar por extraer `domain/urgency.mjs`, `domain/classify.mjs` y un
`infra/storage.localJsdomSafe.mjs` como PR piloto (dejan la app funcionando idénticamente), luego una feature
nueva ya nace completa en el patrón elegido.

---

## 4. Convenciones de código

- **Idioma** — Todo texto visible al usuario y todo comentario de código **en español** (convención
  histórica del repo; ver AGENTS.md). No mezclar en un mismo archivo sin justificación documentada.
- **Seguridad XSS** — Todo contenido de usuario que se inserte en HTML (`innerHTML`, `insertAdjacentHTML`)
  se pasa por `escapeHTML()` (ver `app.js`). **Nueva** UI que renderice datos de usuario: aplicar la misma
  regla; si no puede aplicarse, justificar por qué ese campo no es inyectable. Nunca string-concatenar un
  nombre de alimento / receta de entrada del usuario sin escapar.
- **Acentos** — Los *keywords* para clasificar alimentos se normalizan (NFD + quitar combining-marks) antes
  de comparar (`norm`), pero los nombres en `TEMPORADA`/`MESES` conservan acento real (es datos de
  presentación, no de matching). No homogeneizar sin entender la distinción.
- **Persistencia** — Solo vía helpers `load(key, def)` / `save(key, val)` sobre las claves del objeto `LS`
  (`mrcheff.foods`, `.recipes`, `.innov`, `.innov.date`), nunca `localStorage.*` crudo nuevo en el código:
  así se conserva la fallback y el manejo de JSON consistentes. Cuando se migre a patrón (A)/(B): estas
  helpers conviven con un objeto `Storage` inyectado que ya las encapsula por dentro; no duplicar la lógica.
- **Concurrencia de estado** — No asumir atomicidad entre leer + escribir localStorage si dos pestañas abren
  el app a la vez (no hay transacción); documentar esta limitación si algún feature dependiera de ella.
- **Naming** - Los nombres de las variables de las funciones y de las clases tienen que ser autoExplicativos que
  leas el código y se parezca más a leer en español que tener variables con nombres p2, x1 etc o funciones como
  play a secas, a que se refiere a jugar? a reproducir?. Si una función es muy larga extraer trozos de ella a 
  funciones privadas con nombres coherentes.
- **Comentarios** - No abusar de los comentarios el código debe entenderse según se lee

---

## 5. Data model: contratos que no puedes romper sin avisar *(Liskov)*

Estos shapes son públicos entre varios módulos (alertas, backup merge, innovación): **cualquier cambio de
forma es un change breaking a nivel contrato** y necesita: test + nota en esta sección + decisión registrada.

- `Food` = `{ id, name, score(1–10), qty, min, checked(boolean), createdAt }`. Regla invariante del alertado:
  `qty <= min` ⇒ *necesita reponer*; `urgencyLevel(score)` → rojo [8–10], naranja [6–7], verde [1–5]. El aviso
  semanal muestra el nivel del item más urgente y **capa a 8**.
- `Recipe` = `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[], createdAt }`. Las
  recetas guardadas *desde innovación* añaden opcionalmente `source`, `from`, `uses[]` — no obligantes al crear
  una receta manualmente.
- `Innovation idea` = shape compatible con Recipe + `{ source: "variacion"|"combo"|"libre"|"protagonista"|"nueva", uses?, ... }`.
  **Expiración automática**: si `mrcheff.innov.date != hoy`, al cargar se vacía la lista; además siempre
  recortada a las 30 ideas más recientes. Ambos invariantes están sujetos a test de integración (§6).
- Payload de copia de seguridad = `{ version, exportedAt, foods[], recipes[], innovations[], innovDate }`.
  IMPORT **anexa** los datos de otra copia: alimentos deduplicados por nombre, recetas/innovaciones añadidas 
  al final del histórico (nada de lo guardado desaparece) y cada una recibe un `uid()` fresco; el histórico previo no se borra. No romper este flujo — debe seguir cubierto por un test de integración (§6).


(Nota sobre tipado: hoy no usamos TS ni tipos estáticos en la app, pero las pruebas de integración actúan como
nuestro "contract test": si un shape cambia, el test roto es el aviso.)

---

## 6. Testing — obligatorio para lógica nueva; capa por capa

Pila ya configurada: **Jest + jsdom** (`webapp/jest.config.js`), con `tests/boot.js` que simula la carga
del app en un DOM real y `tests/setup.js` con polyfills (requestAnimationFrame, scrollIntoView, mock de
Clipboard/FileReader). Umbrales de cobertura configurados: statements 70 / branches 65 / functions 70 / lines 70.

### Capa 1 — Unitarias · **OBLIGATORIAS** (todo código nuevo en este repo)
- Cada módulo *puro* de `modules/domain/` y cualquier función nueva que decida comportamiento (no solo
  renderiza DOM) **debe tener su spec co-ubicada** (`tests/<modulo>.test.js`, naming `*.test.js` por
  convención del `jest.config`). Ejemplos: urgLevel score→color, needsRestock, classifyFood con/ sin acento,
  generadores de innovación (seed fijo determinista → salida predecible), merge/dedup de backup, auto-expire.
- Sin jsdom lo antes posible para estas unidades: si un "unit test" necesita lanzar `tests/boot.js` y cargar el
  app completo es señal que la lógica **no está bien separada del DOM** — refactorizar hasta lograr
  requerirla directa (esto es literalmente lo que §2-D pide).
- Cobertura mínima por módulo nuevo/refactorizado: **≥80 lines / ≥75 branches** para el código 
- Si creamos un nuevo fichero de tests tenemos que añadir la clase correspondiente sobre la que se hacen los tests en jest.config.js en collectCoverageFrom como una nueva entrada.
*nuevo* de ese
  PR. Las cifras de cobertura globales (~65/70 %) se mantienen como piso del proyecto; pueden subirse 
  lentamente pero nunca reducirse sin justificación en §8.
- Workflow del equipo (ver `.continue/prompts/unit-tests.md`): escribir specs → correr `cd webapp && npm run coverage`
  → iterar hasta que todo pase con la cobertura mínima → commit. No se entra un PR sin esto.
- **Determinismo**: tests no pueden depender de fecha real (`new Date()`), ni de `Date.now()`/random para ids en
  lógica: inyectar "hoy" y un `uid` provider cuando el código lo permita; si algún path exige reloj real, usar
  mocks/fakes de jsdom que ya existen en `tests/setup.js`.


### Capa 2 — Integración vía jsdom/harness · **OBLIGATORIA cuando el cambio atraviesa módulos**
- Requerida cada vez que un PR toca más de uno módulo o altera el flujo DOM↔localStorage: guardar→recargar→re-render,
  auto-expire 24h real, round-trip export→import (merge correcto, deduplicado por nombre). Viven en `tests/**/*.integration.test.js`,
  reutilizando `tests/boot.js` + `setup.js`. Ejemplo canónico: un nuevo generador de innovación que se integre a la
  vista → debe existir una test de integración que lo pruebe *cargando* el app como si fuera un usuario.

### Capa 3 — UI / E2E · **"si es posible"** (camino recomendado, no bloqueante todavía)
- Herramienta sugerida: **Playwright**, corriendo sobre una versión *servida* de `index.html` (no via `file://`),
  ya que cualquier migración hacia ESM nativo (§3, patrón B) necesitará servidor HTTP para CORS/módulos.
- Cuando se elija adotar este nivel: crear carpeta `/webapp/e2e/` con un `playwright.config.js` + al menos una smokes
  de flujo principal p.ej. "crear receta → guardar → recargar página → verla en lista; exportar backup → importar en
  contexto vacío y comprobar merge" — antes o junto a la feature que lo añade.
- No es **obligatorio hoy** ni bloqueante para merges si no se está tocando flujo visible al usuario de forma nueva; pero **si** un PR toca/crea un flujo *visible al usuario* nuevo (un tab, una acción que antes no existía),
  debe dejar al menos un *stub* E2E registrado (aunque sea `todo:`) para no perder la trazibilidad.

> Nota opcional/recomendada (no obligatoria en este momento dado el escopio acordado): añadir ESLint + Prettier y
> precargarlo vía pre-commit/CI haría que los estándares sean ejecutables, no solo convenciones. Se recomienda
> revisarlo como siguiente paso independiente, no mezclar con otro PR.

---

## 7. Definición "Done" por PR / cambio (Definition of Done)

Antes de dar un change como terminable:

- [ ] Lógica nueva tiene **unit test(s)** en `tests/*.test.js` y pasa con cobertura ≥ el mínimo del módulo (≥80/75)
  para ese trecho de código; y no se reducen los umbrales globales sin registro decidido (§8).
- [ ] Si cruza módulos o toca persistencia/DOM: **integrción via jsdom** presente y verde
      (`npm test` / `npm run coverage`).
- [ ] `cd webapp && npm run coverage` pasa sin warnings nuevos; si hay cobertura caída, justificarlo.
- [ ] No rompe ningún shape de §5; si cambia uno: nota documentada aquí + decisión registrada (autor/fecha) al final del archivo.
- [ ] Si crea/toca un flujo *visible al usuario* nuevo: stub E2E registrado en `e2e/` (aunque sea pending).
- [ ] No se ha añadido dependencias (`package.json`) sin PR explícito justificándole; `node_modules/` sigue sin
      tracking por git (no `.gitignore` hoy — ver AGENTS.md, **nunca** `git add -A`).
- [ ] Cambios de UI: texto en español + escapeHTML aplicado a nuevo contenido injectable.
- [ ] `AGENTS.md` actualizado si cambió arquitectura o comandos/directorio de config (p. ej. `.opencode/commands/`, `.opencode/skills/`) para no quedar desactualizados; `CLAUDE.md` fue eliminado, ya no existe como referencia aparte.

---

## 8. Log de excepciones (decisiones que violan un principio)

_Aquí se anota cualquier "Por qué rompimos X en este caso", con formato_ `YYYY-MM-DD · @autor · #tarea · Principio: <S/O/L/I/D> · Justificación: …`. _

- `2026-10-18 · @AI-agent · #bugfix-matching · Principio: O, D · Justificación:` el matcher bidireccional
  por subcadena-cruda (`includes()`) de `planner.js` e `innovations.js` daba falsos positivos graves
  (ingrediente "Sal" encajaba dentro del alimento "Salchichón ibérico"). Se extrae el módulo puro
  compartido `modules/ingredient-matching.js` (tokens+deplural, sin prefijos sueltos) y ambos módulos
  lo consumen: se CIERRA la duplicación de matcher que existía entre ambos (deuda §3 previa) en lugar
  de corregir dos copias idénticas.
- `2026-10-18 · @AI-agent · #feature-menu-7x3 · Principio: O, D · Justificación:` cambios de contrato
  acordados con el usuario (menú semanal de 3 comidas/día + cambio individual de receta):
  1. `planner.buildWeeklyMenu` pasa de `plan[7] = { dayLabel, recipe, missing }` a
     `plan[7] = { dayLabel, meals[3] = { meal, recipe, missing } }` (shape evoluciona, tests actualizados).
  2. Se AÑADE una 6ª función pública a planner (`pickRecipeForSlot`) rompiendo temporalmente la "API
     cerrada de 5" porque el swap por día+comida pertenece al dominio del planner (ranking compartido,
     un solo mecanismo §3); la lista cerrada se re-valida en `planner.test.js` con las 6 funciones.
  3. Se RETIRA `opts.rng` de `buildWeeklyMenu` (la rama aleatoria de rampa B no aporta valor con 21
     slots por tipo de comida: el relleno es determinista por ranking + degradación por repeticiones
     inter-día; los tests del contrato rng se reescriben en consecuencia).
  4. En `menu-semanal.js` se RETIRA `regenerateAfterCook` (regeneración completa al cocinar) y se
     sustituye por la composición `cookEntry` + `swapSlotRecipe`: cocinar desde el menú renueva SOLO
     el hueco del plato cocinado en lugar de descartar el resto del plan (mejor semántica para el
     usuario, misma pureza). `"🔄 Cambiar"` persiste además un campo opcional `triedKeys` por slot
     para que clicks sucesivos recorran el ranking sin oscilar (shape persistido extendido, sólo para
     `mrcheff.weekmenu`).
- `2026-10-18 · @AI-agent · #feature-editar-recetas · Principio: O · Justificación:` el plan semanal
  aprobado era un SNAPSHOT de sólo lectura ("no muta hasta regenerar/cambiar"). Con el editor de
  recetas (botón "✏️ Editar" del modal de detalle), si la receta editada proviene de Mis Recetas el
  hueco del plan que la incrusta NO puede quedar mostrando el estado viejo: `aplicarEdicionAlPlan`
  (app.js, capa views) parchea las copias del objeto embedded en `mrcheff.weekmenu.plan` por
  `recipe.id`; para una copia nueva creada desde el catálogo se parchea por el id ORIGINAL del plato
  del menú. El resto del plan (missing flags, needyFoods) NO se recalcula: el plan sigue siendo
  snapshot para el cálculo de compra; lo editado es la ficha visible del plato, no su análisis de
  disponibilidad. Regenerar el menú reancla todo al estado nuevo de Mis Recetas.

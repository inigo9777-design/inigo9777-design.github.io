---
name: git-worktree-multi-agent
description: Pone varias tareas a trabajar EN PARALELO con aislamiento git real, en cualquier repo. Pide el número de tareas y la descripción de cada una, corta las ramas SIEMPRE desde develop y crea un git worktree hermano por tarea (rama, HEAD y cambios sin commit propios), lanzando dentro de cada worktree una SESIÓN NUEVA del agente que implementa su tarea. Úsalo cuando el usuario pida "en paralelo", "varias tareas a la vez" o "multi-agente".
---

# git-worktree-multi-agent — tareas en paralelo con worktrees

Un directorio de repo solo aguanta UNA rama y UN estado de cambios a la vez: si dos
sesiones de agente comparten carpeta, se pisan (la segunda abre el repo tal como lo
dejó la primera: su rama, sus cambios sin commit). Esta skill aísla a cada trabajadora
en su propio **git worktree**: un checkout del MISMO repo en una carpeta hermana
(rama, HEAD e índice propios; historial compartido). Nada de clones completos,
nada de stashes, nada de turnos.

## Modelo de roles

- **Sesión actual = coordinadora.** Recoge las tareas, crea los worktrees, lanza las
  sesiones y vigila. La coordinadora NO implementa ninguna tarea: cada tarea tiene su
  propia sesión nueva. Tampoco toca ficheros del repo: solo git y lanzamientos.
- **Sesiones trabajadoras.** Una por tarea, nacen DENTRO de su worktree, trabajan
  SIEMPRE sobre su rama y nunca tocan las demás ramas ni el checkout principal.

## Paso 0 — Comprobaciones previas (terminal)

1. El trunk de integración de este flujo es **develop** por definición:
   `git rev-parse --verify develop` debe existir. Si falta, NO lo adivines —
   pregunta al usuario si se corta de otra rama de integración (`main`, `trunk`)
   y usa la que confirme, siempre la MISMA para todas las tareas de la ronda.
2. `git worktree list` — anota los worktrees ya existentes para evitar colisiones
   de carpeta y de rama.
3. `git fetch origin` de fondo y sin drama: si no hay red, sigue con la rama local.
4. **No cambies la rama del checkout principal ni uses `git checkout -b` en él.**
   Las ramas nuevas nacen EN SU worktree; el principal se queda como esté
   (idealmente en el trunk, para poder fusionar después).

## Paso 1 — Recoger las tareas (herramienta `question`)

1. Pregunta 1 — "¿Cuántas tareas quieres en paralelo?" con opciones
   `1 tarea`, `2 tareas`, `3 tareas`, `4 tareas`, `5 tareas`
   (el campo de respuesta libre cubre números mayores; más de 5 avisa de costes de
   fusión, no lo bloquees).
2. Pregunta por CADA tarea (una por vez, header "Tarea N"):
   "Describe en detalle la tarea N: qué se hace, en qué parte del proyecto y
   cualquier criterio de listo/no-listo".
   Si la descripción de dos tareas solapa scope (mismos ficheros calientes del
   proyecto), avisa del conflicto de fusión que van a provocar y confirma antes
   de seguir.
3. Confirma al final una bandeja resumen: nº de tareas, para cada una su descripción
   en una línea. Continúa solo con un OK.

## Paso 2 — Nombres de rama

1. Si el agente tiene disponible la skill `git-flow-branch-creator`, cárgala y
   decide, para cada tarea, el TIPO y el NOMBRE de la rama con su Analysis
   Framework y sus Naming Conventions (`feature/…`, `bugfix/…`, `tasks/…`,
   refactor/polish → `tasks/…`, entregas grandes multibase → `epic/…`). Sin esa
   skill: mismo esquema a mano — prefijo por tipo + nombre kebab-case descriptivo.
   Como no hay cambios aún, la decisión sale de la DESCRIPCIÓN de la tarea, no de
   `git status`.

   ⚠️ **En este flujo NO ejecutes los pasos finales de esa skill.** Sus comandos
   (`git checkout -b …`) cambiarían de rama el checkout principal y pisarían las
   demás sesiones. Se usa SOLO su análisis y su nombre; la rama se crea en el
   worktree (Paso 3).
2. Regla fija de esta skill: **todas las ramas cortan del mismo trunk**, también las
   `bugfix/`. Si el análisis concluyera `hotfix/` (desde la rama de producción),
   detente y pregunta al usuario — distinto flujo de branches y merges.
3. Evita colisiones: si la rama ya existe, sufijo `-2`, `-3`, … y reintenta.
4. Muestra la lista rama→tarea para confirmación rápida (puede ir junto a la
   bandeja del Paso 1 en una sola pregunta, y así no se pregunta dos veces).

## Paso 3 — Crear los worktrees (uno por tarea)

Carpeta hermana: `../` + nombre del repo saneado (espacios→`-`, sin acentos) +
`-` + slug de la tarea (kebab-case ASCII, ≤ 30 chars). Ejemplo:
`../mi-proyecto-filtro-fotos`. Si la carpeta ya existe, sufijo `-2`.

```bash
git worktree add -b <rama> ../<carpeta> develop
```

Por cada worktree, verifica sin abrir sesiones:

```bash
git worktree list            # carpeta + rama + el repositorio principal intacto
git -C ../<carpeta> status   # "On branch <rama>" y limpio
```

Nota: los ficheros IGNORADOS (dependencias instaladas, artefactos de build) NO
viajan a los worktrees. Deja la instalación de dependencias a cada trabajadora
(se lo pedimos en su prompt); solo comprueba que el manifest de dependencias del
proyecto (`package.json`, `requirements.txt`, …) está en el checkout.

## Paso 4 — Lanzar una sesión nueva por tarea (dentro de su worktree)

1. Crea una carpeta temporal (`mktemp -d`) y escribe el prompt de la trabajadora
   en `<tmp>/tarea<N>.prompt` — plantilla EXACTA, sustituyendo los marcadores
   `<RUTA>` (worktree), `<RAMA>` y `<TAREA>` (descripción literal del usuario):

```text
Eres un agente implementador, TRABAJANDO AISLADO en este repo.

1. Antes de tocar nada: lee con la terminal los ficheros de convenciones del
   repo — AGENTS.md si existe (o CLAUDE.md, .cursorrules y parientes), las reglas
   que el repo declare en .opencode/ (.opencode/rules/*.md) y el README para VER
   cómo se corre y se testea — y sígelos sin excepción.
2. REGLA PERMANENTE: durante TODA la sesión lees ficheros SIEMPRE con la
   terminal (grep/cat/sed/less), no con otras herramientas de lectura de ficheros.
3. Estás en el worktree <RUTA> sobre la rama <RAMA>. NO cambies de rama, NO crees
   ramas ni worktrees, NO lances más sesiones, NO hagas push ni merges, y NO
   toques el checkout principal (../ de esta carpeta no es tuyo).
4. Tarea a implementar (solo esta): <TAREA>
5. Si el proyecto usa dependencias y en tu checkout no están instaladas
   (node_modules/, vendor/, entorno virtual…), instálalas UNA vez al empezar
   (p. ej. `npm install`) y corre SUITE DE TESTS cuando toque (el README/AGENTS
   lo dirá; típico `npm test`).
6. Implementa según las convenciones del repo: nuevo comportamiento ⇒ su spec de
   tests; si el cambio cruza módulos o toca persistencia/DOM ⇒ pruebas de
   integración.
7. Haz commits en tu rama al completar bloques probados, con el formato de
   commits del repo (si hay convención Conventional Commits, úsala). NUNCA
   commitees ficheros ignorados: node_modules/, coverage/, artefactos de build,
   metadatos del SO (.DS_Store…).
8. La fusión al trunk NO es tuya: al terminar, deja tu rama lista
   (commits hechos, suite verde) y da un RESUMEN final: qué cambiaste, tests
   pasados y ficheros tocados.
```

2. Por cada tarea, lanza la sesión EN SEGUNDO PLANO desde su worktree:

```bash
cd ../<carpeta> && opencode run "$(cat <tmp>/tarea<N>.prompt)" \
  --format json > <tmp>/tarea<N>.ndjson 2>&1
```

   - En paralelo (todas de golpe, fondo). Con motores locales (ollama en la misma
     máquina) los procesos comparten cola del motor: es lo normal, avisa.
   - De cada `.ndjson` saca el id de sesión:
     `grep -oE 'ses_[A-Za-z0-9]+' <tmp>/tarea<N>.ndjson | head -n1`
     (si el JSON no parsea, repite sin `--format`; el id no es crítico, sí útil).
3. Vigila sin bloquear: cuando acaben, comprueba por worktree
   `git -C ../<carpeta> log --oneline -5` y `git -C ../<carpeta> status`.

## Paso 5 — Informe para el usuario

Tabla con: tarea (1 línea) → rama → carpeta worktree → sessionID → estado
(en marcha / terminada: commits N, tests). Y dos modos de retomar una sesión:

```bash
cd ../<carpeta> && opencode    # el TUI en esa carpeta lista/continúa su sesión
```

## Paso 6 — Cierre (coordinadora, a petición del usuario)

- Fusión al trunk SECUENCIAL en el checkout principal
  (`git checkout develop && git merge --no-ff <rama>` — usa el trunk confirmado en
  el Paso 0 si no era develop), una a una resolviendo conflictos; si hay conflicto
  en la 2ª, pide criterio antes de resolver.
  Epics: si la skill git-flow está en juego, la fusión epic→trunk es SIEMPRE
  manual del usuario — no la ejecutes aunque te lo pidan en bloque.
- Casa de limpieza tras CADA merge completado, en ESTE orden:
  1. **La CARPETA del worktree se borra SIEMPRE** que la rama queda fusionada:
     `git worktree remove ../<carpeta>` — los ficheros trackeados ya viven en el
     merge y la copia hermana no aporta nada; no acumulemos carpetas. Ojo: esto
     también limpia los metadatos de `.git/worktrees/` (a mano con `rm -rf` NO
     valdría: habría que `git worktree prune` después). Si git se niega porque el
     árbol está sucio (cambios sin commit o ficheros sin seguimiento), informa y
     PREGUNTA: `--force` BOTA ese trabajo y solo va con confirmación explícita.
     `--force` en cualquier caso NUNCA lo decidas tú solo.
  2. **La RAMA se retira según el TIPO git-flow de `git-flow-branch-creator`**
     (después de quitar el worktree — git no deja borrar una rama checkeada en un
     worktree vivo): `bugfix/…` y `tasks/…` → `git branch -d <rama>` tras el merge
     limpio (`-d` seguro: solo borra si está fusionada; `-D` forzada solo si el
     usuario la pide); `feature/…` y `release-X.Y.Z` → se CONSERVAN tras el merge
     (histórico/referencia, nada de borrar);
     `epic/…` → JAMÁS ni fusionada ni borrada por el agente (paso manual del usuario, rama conservada).
     Sin skill git-flow en el repo: solo borra rama si el usuario lo pide.
- Si algo quedó a medias, déjalo: el estado sin commit vive a salvo en su worktree
  (esa carpeta NO se borra hasta que el usuario resuelva lo que guarda).

## Trampas a no olvidar

- NUNCA `git checkout -b` ni cambio de rama en el checkout principal durante el flujo.
- NUNCA `git add -A` ciego con dependencias ignoradas ya instaladas en el repo
  (se colaría `node_modules/` entero, como poco).
- Dos tareas que tocan los MISMOS ficheros calientes: está bien aisladas para
  escribir, pero la fusión secuencial del Paso 6 peleará con conflictos — avísalo
  antes de empezar (Paso 1).
- El `question` de cantidad usa opciones; el de descripción se responde con el
  campo de texto libre (opción extra que llega sola).
- Todas las rutas de trabajo de esta skill van en la configuración/e2e que el
  propio repo documente: si el repo da comandos de test/e2e específicos, pásaselos
  a las trabajadoras en el punto 5 de su prompt.

# AGENTS.md — Mr Cheff

Compact guide for AI agents. For product vision read `Readme.html`; the longer (partly stale)
prose is in `CLAUDE.md`. When docs and code disagree, **trust this file + the code**.

## What this actually is
- A kitchen-assistant prototype. `Readme.html` badges it "Kotlin Multiplatform · Android · iOS",
  but the **only runnable code is a vanilla-JS static web app in `webapp/`**. There is **no KMP,
  no Gradle, no native target, and no backend** — do not assume one exists or try to build it.
- Repo boundary: this folder (`Mr Cheff`, the dir with `.git`) *is* the repository. The parent dir
  `IA LOCAL/` also contains an unrelated `Scripts-Utilities/` shell script — leave it alone.

## Commands (run from `webapp/` unless noted)
- **Run:** open `webapp/index.html` in a browser. No server or build step needed for the app.
  There is no linter/formatter/typecheck for the app itself; "verify a change" = open index.html
  and exercise the affected tab.
- **Tests:** `cd webapp && npm test` (`jest`) / `npm run coverage` (`jest --coverage`). Jest IS a
  declared devDependency with installed `node_modules/`. Spec files now **do** exist under
  `webapp/tests/` — one per module so far: `classify.test.js`, `priority.test.js`, `recipe-analysis.test.js`,
  `innovations.test.js`, plus harness scaffolding (`boot.js` / `setup.js`). As of the last run on 2026-10-16,
  the whole suite is green (`4 passed / 60 tests total`) — verify with a fresh run before trusting it: **logic
  rewrites to any module that these specs cover (see `webapp/feature_plans/plan-inovacion-recetas-espanolas.md`
  for the in-progress Innovation-redesign plan) are expected to leave some of those specs obsolete, pending their
  own Phase-2 rewrite; a red suite after such a change is an intentional, documented intermediate state, not a regression.**
- Note: there is **no `.gitignore`** and `webapp/node_modules/` is **untracked** — never `git add -A`
  it. `dataBackup/*.json` backups *are* tracked.

## Architecture (`webapp/`)
Single-page, five-tab app loaded via `index.html`, in this order (order matters): inline `<script>`
→ `data.js` → `app.js`. All logic lives inside one `DOMContentLoaded` closure in `app.js`, sectioned
by `// ===== SECTION =====` banners. Files:

- **data.js** — static seasonal data; exposes `window.MR_CHEFF_DATA = { MESES, TEMPORADA }`. `app.js`
  depends on this having run first (keep the script order).
- **app.js** — everything else, sectioned by banner.
- **style.css** — hand-written CSS (no framework); palette via `:root` variables + a light/dark theme.

Views: **Alimentos** (pantry/restock alerts) · **Recetas** (free-text → structured recipe) ·
**Innovación** (invent recipes from the pantry) · **Temporada** (in-season fruit/veg by month) ·
**Copia de seguridad** (cross-browser Export/Import — its own tab).

### In-progress: `innovations.js` redesign (Phase 1 planned, not yet coded)
See `webapp/feature_plans/plan-inovacion-recetas-espanolas.md` for the full approved design. Summary so a future
reader isn't fooled by still-old code on disk until that PR lands:

- New module **`webapp/modules/recetas-espanolas.data.js`** (IIFE + dual-export identical to `classify.js`/`priority.js`,
  loaded before `innovations.js`) holds a curated catalog of real, plausible everyday Spanish recipes. Each record is minimal:
  `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }`.
- `modules/innovations.js` `generate(count, focus, state)` keeps its **exact public signature** (the sole call-site at
  `app.js:~445` is unaffected), but internally stops assembling random ingredient combinations from `STYLES`/`TWISTS`/
  `ARCHETYPES`. Instead it scores the curated catalog deterministically and ranks the top 6 by a named-weighted formula
  (`haveRatio` + variety-nudge − fuzzy-duplicate penalty, stable tiebreak by dataset `id`); **beyond slot 6** (only if more are
  requested) a uniformly random pick fills the rest from the remaining non-excluded pool — closing the "feature goes static / no
  discovery freshness" concern while keeping every output real. An optional injected `rng` provider (`ctx.rng`, defaulting to
  `Math.random()`) mirrors the already-existing `uid` injection precedent, so tests stay fully reproducible (see
  CODING_STANDARDS §6 determinism rule).
- Recipes the user has starred into **Mis Recetas** are hard-excluded from every slot via an absolute pre-filter (ingredient-set
  Jaccard = 1.0 match, language/order-invariant) — they vanish until manually deleted from their own recipes list.
- Open/Closed note: abandoning the legacy multi-generator-by-`source` pattern **for this one feature only** is a logged decision
  (CODING_STANDARDS §8), not an open silent deviation; same for shipping this logic without yet re-writing its co-located specs.

## Data model & gotchas
- Persistence = localStorage via `load(key, default)`/`save(key, val)` helpers and keys in `LS`:
  `mrcheff.foods`, `mrcheff.recipes`, `mrcheff.innov`, `mrcheff.innov.date`. **Use the helpers, not
  raw localStorage**, so JSON handling + defaults stay consistent.
- Foods: restock alert when `qty <= min`; urgency color from `score` (1–10) via `urgencyLevel` —
  red 8–10, orange 6–7, green 1–5; weekly alert caps the list at 8.
- Innovations auto-expire: on load, if `mrcheff.innov.date != today`, wipe `mrcheff.innov`; also
  capped at the most recent 30. Generated "ideas" are deterministic heuristics (UI: "Modo simulado"),
  **not an LLM** — this is where real integration would go, nothing hidden elsewhere.
- Backup tab exists because localStorage is per-browser: `buildBackup()`/`applyBackup()`. Export
  downloads a real-timestamp JSON (`dataBackup-YYYY-MM-DD-HH-MM-SS.json`) to Downloads; import **merges**
  (foods de-duped by name, recipes/appended). A static page can't write `dataBackup/` — the user moves
  the file there by hand or uses 📋 Copiar. The old `showSaveFilePicker` path was removed on purpose.

## Conventions to follow
- **All UI text and code comments are in Spanish** — match that when editing strings/comments.
- **Escape all user content with `escapeHTML()` before inserting into innerHTML** (food names, recipe
  titles, descriptions). Any new rendered user field must do the same — XSS risk otherwise.
- **Accent handling differs by context:** pantry food-type matching strips accents via `norm` (NFD +
  combining-mark strip) in `FOOD_TYPES`/`TYPE_ORDER`; the seasonal `TEMPORADA` `nombre` fields keep
  their accents. Mind this when adding foods or seasonal items.

## Other instruction / config sources worth knowing
- **`CODING_STANDARDS.md`** (repo root, canonical; `.claude/rules/CodingStandards.md` is a short pointer into
  it) — the team's coding/testing standards going forward: SOLID, per-feature modular architecture mandate
  (`modules/domain|infra|views`; `app.js` stays the legacy composition-root), and mandatory unit testing. **Follow it.**
  Per PR: new logic ships a co-located `tests/*.test.js` spec (jsdom harness exists in `webapp/jest.config.js` +
  `tests/boot.js`/`setup.js`, and per-module specs already exist under `webapp/tests/` — see the "Tests" bullet above for current
  suite status); integration tests are required when a change crosses modules or touches
  storage+DOM; UI/E2E via Playwright is "if possible" / add a stub whenever you introduce a new user-visible flow.
- `.claude/` and `.continue/` hold Claude Code & Continue.dev agents, commands, rules and prompts —
  e.g. `.continue/prompts/unit-tests.md` encodes the team's test workflow (write specs → run with
  coverage → iterate until all pass). These are not auto-loaded by OpenCode; check them for intent.
- `CLAUDE.md` is the older guide but has gone stale in spots (it predates the Jest setup and some
  clean-ups, and its top-level `@.claude/rules/Accesibilidad.md` include no longer resolves — that file was
  renamed to `CodingStandards.md`) — prefer this file / `CODING_STANDARDS.md` when they disagree.

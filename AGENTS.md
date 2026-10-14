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
  declared devDependency with installed `node_modules/`, but **no spec files exist yet** (git log:
  "WIP unit tests"). Today `npm test` finds nothing — do not treat its presence as a passing suite.
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
  `tests/boot.js`/`setup.js`, but no specs yet); integration tests are required when a change crosses modules or touches
  storage+DOM; UI/E2E via Playwright is "if possible" / add a stub whenever you introduce a new user-visible flow.
- `.claude/` and `.continue/` hold Claude Code & Continue.dev agents, commands, rules and prompts —
  e.g. `.continue/prompts/unit-tests.md` encodes the team's test workflow (write specs → run with
  coverage → iterate until all pass). These are not auto-loaded by OpenCode; check them for intent.
- `CLAUDE.md` is the older guide but has gone stale in spots (it predates the Jest setup and some
  clean-ups, and its top-level `@.claude/rules/Accesibilidad.md` include no longer resolves — that file was
  renamed to `CodingStandards.md`) — prefer this file / `CODING_STANDARDS.md` when they disagree.

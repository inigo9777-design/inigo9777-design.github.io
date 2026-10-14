# Coding Standards — Mr Cheff webapp (*pointer*)

Esta regla es un *resumen obligatorio + puntero*. La fuente completa (SOLID con ejemplos concretos para esta app,
arquitectura per-feature, capas de testing, contratos de datos y Definition of Done) está en:

  → **`CODING_STANDARDS.md`** (raíz del repo)

Si algo aquí difiere, **gana `CODING_STANDARDS.md`**.

## Lo obligatorio sin leer la doc completa
- **Lenguaje:** toda UI y comentarios de código en español. No mezclar idiomas sin justificarlo al final del doc.
- **SOLID aplica** (ver §2 de CODING_STANDARDS): separa *lógica pura* de DOM/persistencia; inyecta deps por factory; añade capacidad por registro, no editando el núcleo (Open/Closed). Si un cambio rompe un principio, anótalo en "Log de excepciones" al final del doc.
- **XSS:** cualquier contenido de usuario que se renderice pasa por `escapeHTML()` antes de entrar a HTML. Nueva UI con datos del usuario = misma regla obligatoria.
- **Persistencia:** solo vía helpers `load()/save()` sobre las claves del objeto `LS` (`mrcheff.*`). Nunca `localStorage.getItem/setItem` crudo nuevo salvo dentro del adaptador que ya los envuelve.
- **Contratos de datos** (Liskov): no cambies la forma de `Food` / `Recipe` / innovation idea / payload de backup sin: test + nota en §5 + decisión registrada (§8). Al importar una copia de seguridad se **anexa** al final (sin borrar lo existente; comidas deduplicadas por nombre) y hay *auto-expire* si la fecha almacenada no es hoy.
- **Testing:** unitarias OBLIGATORIAS para toda lógica nueva (`tests/*.test.js`, cobertura ≥ 80 lines / ≥ 75 branches en el trecho nuevo); los umbrales globales actuales (~65–70 %) se mantienen o suben, nunca bajan. Integración jsdom **requerida** cuando un PR cruza módulos o toca persistencia/DOM (reutiliza `tests/boot.js` + `setup.js`). UI/E2E "si es posible" vía Playwright; si tocas un flujo nuevo visible al usuario, deja por lo menos un stub registrado. Ver §6 para detalles y workflow (`cd webapp && npm run coverage`, iterando hasta todo verde).
- **No `git add -A`** — no hay `.gitignore` hoy y `webapp/node_modules/` está *untracked*; añadiría todo el árbol. Ver AGENTS.md.

## Arquitectura per-feature (mandato)
Nuevo código nace modular y testeable en `modules/domain | infra | views`; `app.js` sigue como *composition root* legacy y se refactoriza por oportunidad (Boy Scout / expand-contract), no de golpe. Sin build step hoy; si propones un bundler o ESM nativo (`type="module"` → requiere servidor HTTP en E2E UI/CORS), ábrelo como PR explícita con justificación. Ver §3 del doc completo.

## Definition of Done (resumen)
Unit test nuevo + cobertura mínima del módulo · sin regressores sobre umbrales globales · integración jsdom si cruza módulos/persistencia ·
no romper contratos de datos sin nota+decisión registrada (§8) · stub E2E si es flujo nuevo visible al usuario ·
documentación (AGENTS/CLAUDE) actualizada. Ver §7 del doc completo.

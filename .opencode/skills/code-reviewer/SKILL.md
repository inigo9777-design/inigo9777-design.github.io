---
name: code-reviewer
description: Revisa el código al estilo SonarQube (bugs, vulnerabilidades, hotspots de seguridad, deuda técnica y memory leaks), corrige lo seguro y genera un report.html claro en reports/. Úsalo para una revisión de código, una limpieza de deuda técnica o un análisis de seguridad/fugas de memoria.
---

# code-reviewer — Revisión de código estilo SonarQube

Analiza el código, **corrige** la deuda técnica y los fallos de seguridad / memory leaks
que sean seguros de arreglar, y deja un **informe HTML simple y claro** en
`reports/report.html`. El modelo de salida (categorías, severidades, esfuerzo) es el de
SonarQube; el informe es un único fichero autocontenido, sin dependencias.

## 0. Invocación y argumento
- Uso: `/code-reviewer` (todo el proyecto) o `/code-reviewer <ruta|patrón|archivo>`
  para limitar el alcance (p. ej. `webapp/app.js`, `webapp`, `src/`).
- Si no viene argumento, se revisa **todo el proyecto** salvo lo que se ignora abajo.

## 1. Alcance y qué se ignora
- **Se analiza:** el código real y ejecutable. En este repo es JS vanilla en `webapp/`
  (`app.js`, `data.js`, `index.html`, `style.css`). No hay build, tests ni dependencias.
- **Se ignora (no se cuenta como hallazgo):** `node_modules/`, `.git/`, `dist/`, `build/`,
  `coverage/`, `.DS_Store`, la propia carpeta `reports/`, y los respaldos (`dataBackup/`,
  `*.json` de copia de seguridad). No se modifica el HTML/CSS/JS de ejemplo de la UI salvo
  que contenga el propio fallo.
- **Idioma:** se detecta por extensiones y ficheros de build. La checklist de §3 tiene foco
  en JS/TS porque es el proyecto, pero aplica a cualquier lenguaje.

## 2. Modelo de clasificación (estilo SonarQube)
**Categorías:**
- `Bug` — comportamiento incorrecto o frágil.
- `Vulnerabilidad` — fallo de seguridad explotable.
- `Hotspot` — código sensible que *puede* ser un fallo de seguridad (requiere juicio humano).
- `Deuda técnica` (Code Smell) — complejidad, duplicación, legibilidad, mantenimiento.
- `Memory leak` — recursos que crecen sin liberarse (JS: listeners, timers, observers,
  cierres, caché sin tope, `createObjectURL` sin `revoke`).

**Severidades (de mayor a menor):** `Bloqueante` · `Crítico` · `Mayor` · `Menor` · `Info`.
- Bloqueante/Crítico: puede romper la app o es un fallo de seguridad explotable hoy.
- Mayor: fallo real o deuda relevante. Menor: problema menor. Info: sugerencia / no bloquea.

**Esfuerzo de remediación:** estima en minutos (p. ej. 5, 15, 30, 60). Es una estimación.

## 3. Qué buscar (checklist)

### 3.1 Bugs
- Off-by-one y condiciones con `==`/`!=` (usa `===`/`!==`), comparación de strings con números.
- `null`/`undefined` no tratados, divisiones por cero, índice fuera de rango, `NaN` propagado.
- Promesas/`async` sin `await` ni manejo de `catch`, eventos que corren en orden incorrecto.
- Lógica de límites/`min`/`max` incorrecta, redondeos, estado compartido mutable.

### 3.2 Seguridad (Vulnerabilidad / Hotspot) — foco JS
- **XSS:** `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`.html()` con contenido de usuario
  **sin escapar**. El proyecto ya usa `escapeHTML` — **verifica** que todo el contenido de
  usuario (nombre de alimento, título/descripción de receta) se escape antes de insertarse.
- **Ejecución de código:** `eval`, `new Function`, `setTimeout(string,…)`, `document.write`.
- **URLs no validadas** que lleven a `javascript:`/`data:` o exfilcremación, y `JSON.parse`
  de entrada no validada.
- **Polución de prototipo** al asignar claves dinámicas (`__proto__`, `constructor`).
- **Datos sensibles** en `localStorage`/`console.log` (tokens, contraseñas, PII).
- **Genérico:** credenciales/secretos hardcodeados, comandos de shell/`exec` sin saneo,
  dependencias con CVE conocido (señalar; no actualizar sin confirmar).

### 3.3 Memory leaks — foco JS
- `addEventListener` **sin** `removeEventListener` en componentes que se re-renderizan.
- `setInterval`/`setTimeout` **sin** `clearInterval`/`clearTimeout` al desmontar.
- `MutationObserver`/`IntersectionObserver`/`requestAnimationFrame` **sin** `disconnect()`/cancelar.
- `URL.createObjectURL` **sin** `URL.revokeObjectURL` (el proyecto ya hace `revoke` — verificar).
- Cierres que retienen DOM grande; **cachés/arrays sin tope** que crecen sin límite
  (p. ej. listas que no se recortan — el cap en innovaciones a 30 es un buen ejemplo a copiar).
- Suscripciones (`WebSocket`, `EventEmitter`, eventos del DOM global) **sin** darse de baja.

### 3.4 Deuda técnica (Code Smells)
- Complejidad ciclomática alta y funciones/bloques largos; anidación profunda.
- Duplicación de código; nombres poco claros; **números/strings mágicos** sin const.
- Módulos monolíticos ("God object"), responsabilidad mezclada.
- **Dead code** (símbolos sin uso) y **comentarios obsoletos** — p. ej. el bloque de
  comentarios duplicado ~línea 247 de `app.js` (deja `const` sin usar: borrarlo).
- Falta de `escapeHTML` en un insert de contenido de usuario (cruza con §3.2).

## 4. Método de revisión
1. Explora el árbol y **lee el código** antes de juzgar (usa `Glob`/`Grep`/`Read`).
2. Para cada hallazgo anota: **archivo, línea, categoría, severidad, esfuerzo, descripción**
   (qué y por qué importa) y **remedio** (cómo se arregla).
3. **Evita falsos positivos:** verifica contexto antes de marcar (¿ya hay `escapeHTML`? ¿ya
   hay `clearTimeout`?). Solo marca lo que realmente se cumpla.
4. Prioriza por severidad; un mismo patrón se lista por cada lugar afectado.

## 5. Corregir (con criterio, no ciego)
- **Corrige** lo claro y seguro: memory leaks (añadir el cleanup que falta), XSS
  (aplicar `escapeHTML`/no usar `innerHTML` con datos crudos), dead code, comentarios
  obsoletos, duplicación obvia, `==`→`===`, const para números mágicos.
- **NO** apliques de forma automática un cambio de seguridad de **alto riesgo** o que pueda
  alterar el comportamiento visible: márcalo **`Pendiente`** en el informe con la razón
  (mejor avisar que romper la app). El objetivo es que la app siga funcionando.
- **Respeta las convenciones del proyecto** (`AGENTS.md`): textos de usuario y comentarios
  en **español**; escapar contenido de usuario con `escapeHTML`; usar `load(key, default)`/
  `save(key, val)` para persistencia, no `localStorage` en bruto.
- **Cambios mínimos y locales:** no toques lógica sana alrededor del fallo.

## 6. Generar el informe
1. Crea la carpeta **`reports/`** en la raíz del proyecto (si no existe).
2. Escribe **`reports/report.html`**: **único fichero autocontenido**, sin CSS/JS externo,
   que funcione abierto por `file://`. Estilo **simple y claro**.
3. Si la revisión se repite, sobrescribe `report.html` (o usa
   `report-AAAA-MM-DD-HH-MM-SS.html` si se quiere historial). El interior lleva la
   fecha/hora de generación.
4. **Contenido** del informe:
   - Encabezado: título, fecha/hora, alcance revisado y **resumen** (conteo por categoría y
     por severidad, y nº corregidos vs pendientes).
   - **Panel de puntuación**: tarjetas con los números (Bugs, Vulnerabilidades, Hotspots,
     Deuda técnica, Memory leaks) y un total.
   - **Tabla de hallazgos**: ID · Severidad (badge de color) · Categoría · Archivo:Línea ·
     Descripción · Estado (`✅ Corregido` / `⚠️ Pendiente` / `ℹ️ Info`) · Esfuerzo · Remedio.
   - **Correcciones aplicadas**: para cada fix, antes/después (`<pre>` con el snippet).
   - **Recomendaciones pendientes**: lo marcado como `Pendiente` y por qué.
   - Todo el **texto en español**.

### Plantilla de `reports/report.html` (rellénala; no copies los `{{…}}` tal cual)
```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informe de revisión de código · Mr Cheff</title>
<style>
  :root{
    --bg:#f7f7f8; --card:#fff; --ink:#1f2328; --muted:#6b7280; --line:#e5e7eb;
    --ok:#1a7f37; --pend:#b45309; --info:#6b7280;
    --red:#d1242f; --orange:#e36c0a; --amber:#b08800; --gray:#8a8f98;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#0d1117; --card:#161b22; --ink:#e6edf3; --muted:#9198a1; --line:#30363d;
      --ok:#3fb950; --pend:#d29922; --info:#9198a1; --red:#f85149; --orange:#f0883e;
      --amber:#d29922; --gray:#8b949e; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    padding:24px;}
  .wrap{max-width:1040px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 4px} h2{font-size:1.15rem;margin:28px 0 10px}
  .meta{color:var(--muted);margin:0 0 20px}
  .cards{display:flex;flex-wrap:wrap;gap:12px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:10px;
    padding:14px 16px;min-width:130px;flex:1}
  .card .n{font-size:1.7rem;font-weight:700} .card .l{color:var(--muted);font-size:.85rem}
  table{width:100%;border-collapse:collapse;background:var(--card);
    border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:.92rem}
  th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  th{background:#f0f1f3;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
  @media (prefers-color-scheme: dark){ th{background:#21262d} }
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;color:#fff;
    font-size:.72rem;font-weight:600;white-space:nowrap}
  .sev-Bloqueante,.sev-Critico{background:var(--red)}
  .sev-Mayor{background:var(--orange)} .sev-Menor{background:var(--amber)}
  .sev-Info{background:var(--gray)}
  .st{font-weight:600}
  .st-fixed{color:var(--ok)} .st-pending{color:var(--pend)} .st-info{color:var(--info)}
  .loc{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem}
  .fix{margin:0 0 16px;background:var(--card);border:1px solid var(--line);
    border-radius:10px;padding:14px 16px}
  .fix h3{margin:0 0 8px;font-size:1rem}
  pre{background:#f0f1f3;border:1px solid var(--line);border-radius:8px;padding:10px;
    overflow:auto;font-size:.85rem}
  @media (prefers-color-scheme: dark){ pre{background:#161b22} }
  .del{color:var(--red)} .add{color:var(--ok)}
  .foot{color:var(--muted);font-size:.8rem;margin-top:28px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🔎 Informe de revisión de código</h1>
  <p class="meta">Generado: {{FECHA_HORA}} · Alcance: {{ALCANCE}} · Modelo: estilo SonarQube</p>

  <!-- PANEL DE PUNTUACIÓN -->
  <div class="cards">
    <div class="card"><div class="n">{{N_BUGS}}</div><div class="l">🐞 Bugs</div></div>
    <div class="card"><div class="n">{{N_VULNS}}</div><div class="l">🔒 Vulnerabilidades</div></div>
    <div class="card"><div class="n">{{N_HOTSPOTS}}</div><div class="l">🔑 Hotspots</div></div>
    <div class="card"><div class="n">{{N_DEUDA}}</div><div class="l">🧹 Deuda técnica</div></div>
    <div class="card"><div class="n">{{N_LEAKS}}</div><div class="l">💧 Memory leaks</div></div>
    <div class="card"><div class="n">{{N_TOTAL}}</div><div class="l">Total · ✅ {{N_FIX}} corregidos · ⚠️ {</div>
  </div>

  <!-- TABLA DE HALLAZGOS -->
  <h2>Hallazgos</h2>
  <table>
    <thead><tr>
      <th>ID</th><th>Sev.</th><th>Categoría</th><th>Archivo:Línea</th>
      <th>Descripción</th><th>Estado</th><th>Esfuerzo</th><th>Remedio</th>
    </tr></thead>
    <tbody>
      <!-- una fila por hallazgo, p. ej.:
      <tr>
        <td>SR-01</td>
        <td><span class="badge sev-Critico">Crítico</span></td>
        <td>🔒 Vulnerabilidad</td>
        <td class="loc">webapp/app.js:155</td>
        <td>Nombre de alimento sin escapar en <code>innerHTML</code> → XSS</td>
        <td class="st st-fixed">✅ Corregido</td>
        <td>15 min</td>
        <td>Envolver en <code>escapeHTML()</code></td>
      </tr> -->
    </tbody>
  </table>

  <!-- CORRECCIONES APLICADAS -->
  <h2>Correcciones aplicadas</h2>
  <!-- p. ej.:
  <div class="fix">
    <h3>SR-01 · Escapar nombre de alimento · webapp/app.js:155</h3>
    <pre><span class="del">- html += "&lt;li&gt;" + f.name + "&lt;/li&gt;";</span>
<span class="add">+ html += "&lt;li&gt;" + escapeHTML(f.name) + "&lt;/li&gt;";</span></pre>
  </div> -->
  <p class="meta" id="no-fixes" hidden>No se aplicaron correcciones en esta pasada.</p>

  <!-- RECOMENDACIONES PENDIENTES -->
  <h2>Recomendaciones pendientes</h2>
  <p class="meta" id="no-pending" hidden>Nada pendiente. Todo lo detectado se corrigió o es informativo.</p>

  <p class="foot">Este informe es autocontenido y puede abrirse por <code>file://</code>.
  Los cambios aplicados deben verificarse abriendo <code>webapp/index.html</code> en el navegador
  (el proyecto no tiene build ni tests).</p>
</div>
</body>
</html>
```

## 7. Resumen final (en el chat)
- Cuenta, en 3-5 líneas: **nº por categoría y por severidad**, cuántos **corregidos** vs
  **pendientes**, y la **ruta** del informe (`reports/report.html`).
- Anota cualquier fix marcado **`Pendiente`** y por qué, y **cómo verificar** en el navegador.

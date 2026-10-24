/* views/copias.js · Mr Cheff — vista copiasSeguridad
   Vista Copia de seguridad (export/import/portapapeles) + Sync entre dispositivos (UI del buzón GitHub cifrado). Extraída del cierre de app.js (refactor final 2026-10-23).
*/
(function () {
  window.MRCheff.views = window.MRCheff.views || {};
  window.MRCheff.views.copiasSeguridad = function (ctx) {

    // Publicaciones anticipadas (function declarations = hoisting):
    ctx.actualizarSyncUI = actualizarSyncUI;

  // ===== COPIA DE SEGURIDAD =====
  // Los datos viven en este navegador (localStorage). Como localStorage es privado de cada
  // navegador, para llevarlos a otro navegador o dispositivo se exportan a un .json y se
  // importan de vuelta. No hay ninguna base de datos local que comparta datos entre
  // navegadores por sí sola (IndexedDB/sql.js son privados de un solo navegador también).
  // === LÓGICA DECISIONAL DE COPIA DE SEGURIDAD EXTRAÍDA A modules/backup.js (función pura) ===
  // buildBackApi = window.MRCheff.backup: construye el payload exportable, nombra "dataBackup-YYYY-MM-DD-HH-MM-SS.json" y fusiona un
  // backup importado sin destruir lo ya guardado — lógica PURA con inyección opcional de uid/hoy para tests (§5 / §2-D). En la app
  // sólo orquestamos: guardar (save) + re-renderizar + toast. Los dos "aliases" locales dejan intocados los call-sites existentes
  // ("buildBackup()" / "backupFilename()") delegando en el módulo — sin tocar ni una línea de esos handlers.
  const buildBackApi = window.MRCheff.backup;
  const buildBackup  = () => buildBackApi.buildBackup({ foods: ctx.foods, recipes: ctx.recipes, innovations: ctx.innovations, innovDay: ctx.innovDay, cooked: ctx.load(ctx.LS.cooked, []), weekmenu: ctx.load(ctx.LS.weekmenu, null) });
  const backupFilename = () => buildBackApi.makeFilename();   // hora REAL por defecto inyectable por el módulo (tests §6)

  const btnExport = ctx.$("#btn-export");
  const btnImport = ctx.$("#btn-import");
  const importFile = ctx.$("#import-file");
  const importNote = ctx.$("#import-note");

  // contenido en un cuadro para copiarlo a un archivo a mano.
  function showBackupFallback(filename, content) {
    ctx.modalContent.innerHTML = `
      <h2>Copia manual de seguridad</h2>
      <p class="muted">Tu navegador no ha podido guardar el archivo con el nombre
          <strong>${ctx.escapeHTML(filename)}</strong>. Copia este texto y pégalo en un archivo nuevo
          con ese mismo nombre, dentro de la carpeta <code>dataBackup/</code> (o en Descargas).</p>
      <textarea id="backup-text" style="width:100%;min-height:220px;font-family:ui-monospace,Menlo,Consolas,monospace">${ctx.escapeHTML(content)}</textarea>
      <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" id="backup-copy">📋 Copiar</button>
      </div>`;
    ctx.abrirModal("Copia manual de seguridad");
    ctx.$$("[data-close]", ctx.modalContent).forEach(b => b.addEventListener("click", ctx.closeModal));
    ctx.$("#backup-copy", ctx.modalContent).addEventListener("click", () => {
      const ta = ctx.$("#backup-text", ctx.modalContent);
      ta.focus();
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value)
          .then(() => ctx.toast("Copiado al portapapeles"))
          .catch(() => ctx.toast("Texto seleccionado: pulsa Cmd/Ctrl+C"));
      } else {
        ctx.toast("Texto seleccionado: pulsa Cmd/Ctrl+C");
      }
    });
  }

  const btnCopyJson = ctx.$("#btn-copy-json");

  // Guardar el archivo con nombre dataBackup + fecha/hora REALES del momento de la exportación:
  // descarga a Descargas con ese nombre (blob + <a download>).
  //
  // Nota: antes se intentaba primero la API de sistema de archivos (showSaveFilePicker) para
  // guardar directo en dataBackup/. Se quitó porque, abriendo index.html por file://, ese
  // diálogo solía dejar un archivo VACÍO y caía igualmente a la descarga, resultando en DOS
  // ventanas (diálogo + Descargas) y un JSON vacío. La descarga a Descargas es estable en
  // todos los navegadores; si el navegador no descarga nada, queda el botón "📋 Copiar" para
  // pegar el contenido a mano.
  btnExport.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    ctx.toast("Copia de seguridad descargada en Descargas");
  });

  // Vía garantizada: copia el JSON al portapapeles (o lo muestra para pegarlo a mano).
  btnCopyJson.addEventListener("click", () => {
    const filename = backupFilename();
    const content = JSON.stringify(buildBackup(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => ctx.toast("JSON copiado: pégalo en " + filename))
        .catch(() => showBackupFallback(filename, content));
    } else {
      showBackupFallback(filename, content);
    }
  });

  btnImport.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { commitImport(JSON.parse(String(reader.result))); }
      catch { ctx.toast("No se pudo leer el archivo", "error"); }
    };
    reader.onerror = () => ctx.toast("No se pudo leer el archivo", "error");
    reader.readAsText(file);
    e.target.value = ""; // permite volver a importar el mismo archivo
  });

  // Wrapper de CAPA VISTA sobre la fusión PURA del módulo: sólo decide CUÁNDO/CÓMO persistir/re-renderizar + toast; TODA la lógica
  // decisoria (dedup por nombre, normalización MEAL_SET/recorte a 30, uids frescos) vive en modules/backup.js. Ver CODING_STANDARDS.md §5 / DIp:
  function commitImport(data) {
    // (sync-buzon §1, payload v2): cooked/weekmenu participan del anexo al importar; versiones v1 sin
    // esas claves siguen funcionando — el módulo las trata como vacías/ausentes (§ regreso comprobado).
    const plan = buildBackApi.mergeIncoming({ foods: ctx.foods, recipes: ctx.recipes, innovations: ctx.innovations, cooked: ctx.load(ctx.LS.cooked, []), weekmenu: ctx.load(ctx.LS.weekmenu, null) }, data, { today: ctx.today });
    if (!plan) { ctx.toast("Archivo no válido", "error"); return; }   // el módulo devuelve null si la entrada NO es un objeto
    ctx.foods = plan.foods;        // las referencias LOCALES se reasignan: son exactamente lo que luego pintan los renders de abajo.
    ctx.recipes = plan.recipes;
    ctx.innovations = plan.innovations;

    ctx.save(ctx.LS.foods, ctx.foods);
    ctx.save(ctx.LS.recipes, ctx.recipes);
    if (plan.addedCooked > 0) ctx.save(ctx.LS.cooked, plan.cooked);                      // anexo del historial cocinado (v2)
    if (plan.weekmenu != null && !ctx.load(ctx.LS.weekmenu, null)) {               // se deja constancia de la adopción del plan entrante (v2)
      ctx.save(ctx.LS.weekmenu, plan.weekmenu);
      ctx.weeklyMenu = plan.weekmenu;                                         // Card 2 toma el plan importado (vive de la variable del closure)
      if (ctx.weeklyMenu.approved) {
        // El plan APROBADO del otro dispositivo se recupera YA a la vista (igual que el bloque
        // de persistencia al recargar): días + botón de Aprobar en estado final + barra/plegado
        // — la lista de la compra la repinta el renderShoppingListTrasDespensa de abajo con
        // los needyFoods del plan adoptado.
        ctx.renderWeeklyMenu(ctx.weeklyMenu.plan);            // guard interno: plan ausente/vacío ⇒ lista oculta
        ctx.btnMenuApprove.disabled = true;
        ctx.btnMenuApprove.textContent = "✅ Plan aprobado";
        ctx.menuEmpty.classList.add("hidden");
        ctx.pintaBarraPlan();
      }
    }
    if (plan.persistInnov) {   // solo si la entrada trajo innovaciones nuevas: marca "hoy" para que el auto-expiry del cierre DOMContentLoaded no las borre en la próxima carga (§5 "Alcance de expiración automática")
      ctx.innovDay = ctx.today;
      ctx.save(ctx.LS.innov, ctx.innovations);
      ctx.save(ctx.LS.innovDate, ctx.innovDay);
    }

    ctx.renderFoods();
    ctx.renderWeeklyAlert();
    ctx.renderShoppingListTrasDespensa();
    ctx.renderRecipes();
    ctx.renderInnovations();
    importNote.textContent = `Se añadieron ${plan.addedFoods} alimento(s) y ${plan.addedRecipes} receta(s).`;
    importNote.classList.remove("hidden");
    ctx.toast(`Importados: ${plan.addedFoods} alimento(s), ${plan.addedRecipes} receta(s)`);
  }

  // ===== SYNC ENTRE DISPOSITIVOS (buzón GitHub cifrado — plan-sync-buzon §6, FASE 5) =====
  // SÓLO CAPA VISTA (CODING_STANDARDS §5): la máquina de estados vive en modules/sync.js (F3), el
  // diff3 en modules/diff-merge.js (F4) y la cripto en modules/sync-crypto.js (F2 — todo puro e
  // inyectable). Aquí: botón "🔄 Sync", modal de configuración (token/gist en LS, passphrase SOLO
  // en sessionStorage), modal resolver de conflictos (§5) y badges "⇄ conflicto"/"duplicada".
  const syncApi = window.MRCheff.sync;
  const syncCryptoApi = window.MRCheff.syncCrypto;
  const diffMergeApi = window.MRCheff.diffMerge;
  const SESS_PASS = "mrcheff.sync.pass";   // passphrase de SESIÓN: nunca localStorage (§2 del plan)

  const btnSync = ctx.$("#btn-sync");
  const btnSyncConfig = ctx.$("#btn-sync-config");
  const btnSyncVaciar = ctx.$("#btn-sync-vaciar");
  const syncNote = ctx.$("#sync-note");

  function notaSync(texto) {
    syncNote.textContent = texto || "";
    syncNote.classList.toggle("hidden", !texto);
  }

  // Estado del clúster según la configuración: sin token/gist el Sync queda deshabilitado (hint §6).
  function actualizarSyncUI() {
    const cfg = ctx.load(ctx.LS.syncConfig, null) || {};
    const listo = !!(cfg.token && cfg.gistId);
    btnSync.disabled = !listo;
    btnSyncVaciar.disabled = !listo;
    const passSesion = !!sessionStorage.getItem(SESS_PASS);
    if (!listo) notaSync("Sin configurar — pulsa ⚙️ Configurar para poner el token de GitHub, el gist y la passphrase.");
    else if (!passSesion) notaSync("Buzón y token listos — falta la passphrase de esta sesión (se pedirá al pulsar Sync).");
    else notaSync("🟢 Listo para sincronizar con el buzón configurado (passphrase en esta sesión).");
  }


  // ---- snapshot local completo (payload v2 del §1: misma forma que merge3 consume) ----
  // REGLA del transporte (2026-10-21): sólo un menú APROBADO viaja — el snapshot lleva el plan
  // aprobado ENTERO (plan + needyFoods = lista de la compra) para que el otro dispositivo lo
  // recupere; el preview no aprobado va como NULL, como ausencia.
  function estadoLocalCompleto() {
    return {
      foods: ctx.foods, recipes: ctx.recipes, innovations: ctx.innovations,
      cooked: ctx.load(ctx.LS.cooked, []),
      weekmenu: ctx.menuSemanal.weekmenuTransportable(ctx.load(ctx.LS.weekmenu, null))
    };
  }

  // Aplicar el estado fusionado que trae el protocolo: persistir TODO, re-asignar las variables en
  // memoria y re-pintar (misma cronología que commitImport del import manual).
  function aplicarEstadoSync(estado) {
    if (!estado || typeof estado !== "object") return;
    ctx.foods = Array.isArray(estado.foods) ? estado.foods : [];
    ctx.recipes = Array.isArray(estado.recipes) ? estado.recipes : [];
    ctx.innovations = Array.isArray(estado.innovations) ? estado.innovations : [];
    ctx.save(ctx.LS.foods, ctx.foods);
    ctx.save(ctx.LS.recipes, ctx.recipes);
    ctx.save(ctx.LS.innov, ctx.innovations);
    if (estado.cooked != null) ctx.save(ctx.LS.cooked, estado.cooked);
    if (estado.weekmenu != null) {
      ctx.weeklyMenu = estado.weekmenu;                     // la variable de Card 2 se reasigna también
      ctx.save(ctx.LS.weekmenu, ctx.weeklyMenu);
      if (ctx.weeklyMenu.approved) {
        // El plan APROBADO recuperado del otro dispositivo nace en su estado final, con la MISMA
        // imagen que tiene al recargar: días pintados abajo, botón de Aprobar bajo el faldón y
        // barra de plegado (petición 2026-10-21: plan + lista de la compra viajan enteros).
        ctx.btnMenuApprove.disabled = true;
        ctx.btnMenuApprove.textContent = "✅ Plan aprobado";
        ctx.menuEmpty.classList.add("hidden");
        ctx.pintaBarraPlan();
      }
    }
    ctx.renderFoods();
    ctx.renderWeeklyAlert();
    ctx.renderRecipes();                                    // ctx.recetasDirty no cuenta: llega contenido nuevo de verdad
    ctx.renderInnovations();
    if (ctx.weeklyMenu && ctx.weeklyMenu.plan) ctx.renderWeeklyMenu(ctx.weeklyMenu.plan);
    if (ctx.weeklyMenu && ctx.weeklyMenu.approved) ctx.renderShoppingList();
  }

  // ---- ctx del protocolo: la ÚNICA unión de app.js con red/localStorage/sessionStorage/cripto ----
  function contextoSync(passphrase) {
    let deviceId = ctx.load(ctx.LS.syncDeviceId, null);
    if (!deviceId) { deviceId = ctx.uid(); ctx.save(ctx.LS.syncDeviceId, deviceId); }
    const cfg = ctx.load(ctx.LS.syncConfig, {}) || {};
    // Inyecciones de TEST (CODING_STANDARDS §6): `mrcheff.sync.iteraciones` baja el coste de
    // PBKDF2 en suite (viaja en el header de la envolvente, sin efecto en producción) y
    // `window.__mrcheffCryptoImpl` aporta la WebCrypto cruda donde el global no trae .subtle (jsdom).
    const iteracionesTest = parseInt(localStorage.getItem("mrcheff.sync.iteraciones") || "", 10);
    const claveLS = (k) => k === "base" ? ctx.LS.syncBase : k === "pendiente" ? ctx.LS.syncPendiente : ctx.LS.syncConsumida;
    return {
      dispositivo: cfg.nombre || deviceId,
      deviceId,
      token: cfg.token, gistId: cfg.gistId, passphrase,
      iteraciones: Number.isFinite(iteracionesTest) && iteracionesTest > 0 ? iteracionesTest : undefined,
      uid: ctx.uid, ahora: () => new Date().toISOString(),
      fetcher: window.fetch.bind(window),
      crypto: syncCryptoApi,
      cryptoImpl: (typeof crypto !== "undefined" && crypto.subtle) ? undefined : window.__mrcheffCryptoImpl,
      snapshotLocal: estadoLocalCompleto,
      fusionar: (base, mio, suyo) => diffMergeApi.merge3(base, mio, suyo),
      almacen: {
        leer: (k) => ctx.load(claveLS(k), null),
        escribir: (k, v) => ctx.save(claveLS(k), v),
        guardarLocal: aplicarEstadoSync
      }
    };
  }

  // ---- Modal de configuración (token + gist + passphrase de sesión) ----
  function abrirModalSyncConfig() {
    const cfg = ctx.load(ctx.LS.syncConfig, null) || {};
    const passSesion = sessionStorage.getItem(SESS_PASS);
    ctx.modalContent.innerHTML = `
      <h2>⚙️ Sync entre dispositivos</h2>
      <p class="muted">Crea un PAT de GitHub con SOLO el scope <code>gist</code> (github.com/settings/tokens)
        y pégalo aquí junto al ID del gist que hace de buzón. El token y el gist se guardan en ESTE
        navegador; la passphrase se recuerda SOLO en esta sesión y debe ser la MISMA en los dos dispositivos.</p>
      <div class="recipe-edit">
        <label for="sync-token">Token (PAT, scope solo gist)
          <input type="password" id="sync-token" autocomplete="off" value="${ctx.escapeHTML(cfg.token || "")}">
        </label>
        <label for="sync-gist">ID del gist (buzón)
          <input type="text" id="sync-gist" autocomplete="off" placeholder="32 hex del gist" value="${ctx.escapeHTML(cfg.gistId || "")}">
        </label>
        <label for="sync-nombre">Nombre de este dispositivo (p. ej. «Móvil», «PC»)
          <input type="text" id="sync-nombre" maxlength="24" placeholder="opcional" value="${ctx.escapeHTML(cfg.nombre || "")}">
        </label>
        <label for="sync-pass">Passphrase compartida${passSesion ? " (ya memorizada en esta sesión)" : ""}
          <input type="password" id="sync-pass" autocomplete="new-password" placeholder="${passSesion ? "no escribir para conservarla" : "la misma en ambos dispositivos"}">
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cerrar</button>
        <button class="btn primary" id="sync-guardar">Guardar configuración</button>
      </div>`;
    ctx.abrirModal("Configuración del sync entre dispositivos");
    ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", ctx.closeModal));
    ctx.$("#sync-token", ctx.modalContent).focus();
    ctx.$("#sync-guardar", ctx.modalContent).addEventListener("click", () => {
      const token = ctx.$("#sync-token", ctx.modalContent).value.trim();
      const gistId = ctx.$("#sync-gist", ctx.modalContent).value.trim();
      const nombre = ctx.$("#sync-nombre", ctx.modalContent).value.trim();
      const pass = ctx.$("#sync-pass", ctx.modalContent).value;
      if (!token || !gistId) { ctx.toast("Token e ID del gist son obligatorios", "error"); return; }
      ctx.save(ctx.LS.syncConfig, { token, gistId, nombre });
      if (pass) sessionStorage.setItem(SESS_PASS, pass);
      ctx.closeModal();
      actualizarSyncUI();
      ctx.toast("Configuración del sync guardada");
    });
  }
  btnSyncConfig.addEventListener("click", abrirModalSyncConfig);

  // ---- Botón Sync: un clic = una pasada de la máquina (nada de auto-sync en background, §6) ----
  btnSync.addEventListener("click", async () => {
    const cfg = ctx.load(ctx.LS.syncConfig, null) || {};
    if (!cfg.token || !cfg.gistId) { abrirModalSyncConfig(); return; }
    const pass = sessionStorage.getItem(SESS_PASS);
    if (!pass) { abrirModalSyncConfig(); ctx.toast("Escribe la passphrase de esta sesión para sincronizar", "error"); return; }
    btnSync.disabled = true;
    notaSync("⏳ Sincronizando con el buzón…");
    const ctxSync = contextoSync(pass);
    const resultado = await syncApi.ejecutar(ctxSync);
    btnSync.disabled = false;
    await encaminarResultado(resultado, ctxSync);
    // SIN actualizarSyncUI() aquí: pisaría el mensaje de la rama con el hint genérico —
    // la nota de resultado manda hasta el próximo clic/config.
  });

  async function encaminarResultado(resultado, ctxSync) {
    if (!resultado) {
      notaSync("No se pudo completar el sync — tus datos locales no han cambiado.");
      ctx.toast("El sync no se completó", "error");
      return;
    }
    notaSync(resultado.mensaje || "");
    if (resultado.rama === "conflictos") {
      abrirModalResolver(resultado, ctxSync);   // §5: nada queda escrito hasta resolver
      return;
    }
    ctx.toast(resultado.mensaje || "Sync completado", resultado.rama === "error" ? "error" : "success");
  }

  // "🧹 Vaciar buzón": PATCH con {"kind":"empty"} (nunca borrar el gist: el id es la config del otro).
  btnSyncVaciar.addEventListener("click", async () => {
    btnSyncVaciar.disabled = true;
    notaSync("⏳ Dejando el buzón vacío…");
    const resultado = await syncApi.crearBuzon(contextoSync(""));
    btnSyncVaciar.disabled = false;
    notaSync(resultado.mensaje || "");
    ctx.toast(resultado.mensaje, resultado.rama === "error" ? "error" : "success");
  });

  // ---- Modal RESOLVER de conflictos (§5): las dos versiones lado a lado; la decisión es por
  // RECETA (quedarse con este dispositivo / el otro / conservar ambas — la copia hereda "duplicada").
  function textoVersion(v) {
    if (Array.isArray(v)) return v.length ? v.join(" · ") : "(vacío)";
    if (v === undefined || v === null || v === "") return "(sin valor)";
    return String(v);
  }

  function abrirModalResolver(resultado, ctxSync) {
    const provisional = resultado.estadoProvisional || {};
    const suyo = (resultado.recibida && resultado.recibida.estadoSuyo) || {};
    const grupos = new Map();
    (resultado.conflictos || []).forEach((c) => {
      if (!grupos.has(c.recetaId)) grupos.set(c.recetaId, []);
      grupos.get(c.recetaId).push(c);
    });
    const tituloPorId = (id) => {
      const enProv = (provisional.recipes || []).find(r => r && r.id === id);
      const enSuyo = (suyo.recipes || []).find(r => r && r.id === id);
      return (enProv && enProv.title) || (enSuyo && enSuyo.title) || "Receta";
    };
    const elecciones = new Map();   // recetaId → "local" | "remota" | "ambas"

    ctx.modalContent.innerHTML = `
      <h2>⇄ Cambios en conflicto</h2>
      <p class="muted">${ctx.escapeHTML(resultado.mensaje || "")}</p>
      ${(resultado.avisos || []).length
        ? `<p class="muted">ℹ️ ${resultado.avisos.length} diferencia(s) menor(es) ya se resolvieron solas (gana la edición más nueva): revisa las recetas tras el sync.</p>`
        : ""}
      ${Array.from(grupos.entries()).map(([id, lista]) => `
        <div class="resolver-receta">
          <h4>${ctx.escapeHTML(tituloPorId(id))} <span class="tag tag-sync-conflicto">⇄ conflicto</span></h4>
          ${lista.map((c) => `
            <div class="resolver-campo">
              <div class="resolver-lado"><span class="resolver-rotulo">Este dispositivo · ${ctx.escapeHTML(c.campo || "campo")}:</span> ${ctx.escapeHTML(textoVersion(c.local))}</div>
              <div class="resolver-lado"><span class="resolver-rotulo">El otro dispositivo:</span> ${ctx.escapeHTML(textoVersion(c.remota))}</div>
            </div>`).join("")}
          <div class="resolver-decision">
            <button type="button" class="btn ghost small" data-decision="local" data-receta="${ctx.escapeHTML(id)}">Quedarme con este</button>
            <button type="button" class="btn ghost small" data-decision="remota" data-receta="${ctx.escapeHTML(id)}">Usar el del otro</button>
            <button type="button" class="btn ghost small" data-decision="ambas" data-receta="${ctx.escapeHTML(id)}">Conservar ambas</button>
          </div>
        </div>`).join("")}
      <div class="modal-footer">
        <button class="btn ghost" data-close>Cancelar (nada se escribe)</button>
        <button class="btn primary" id="resolver-aplicar" disabled title="Marca una decisión por cada receta">Aplicar resolución</button>
      </div>`;
    ctx.abrirModal("Resolver conflictos del sync");
    ctx.$$("[data-close]", ctx.modalContent).forEach(el => el.addEventListener("click", () => {
      ctx.toast("Sync cancelado: tus datos no han cambiado");
      ctx.closeModal();
    }));

    const btnAplicar = ctx.$("#resolver-aplicar", ctx.modalContent);
    ctx.$$(".resolver-decision [data-decision]", ctx.modalContent).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.receta;
        elecciones.set(id, btn.dataset.decision);
        ctx.$$(".resolver-decision [data-decision]", ctx.modalContent)
          .filter(b => b.dataset.receta === id)
          .forEach(b => b.classList.toggle("primary", b === btn));
        btnAplicar.disabled = elecciones.size !== grupos.size;
      });
    });

    btnAplicar.addEventListener("click", async () => {
      const lista = Array.from(elecciones.entries()).map(([recetaId, decision]) => ({ recetaId, decision }));
      const estadoResuelto = diffMergeApi.aplicarResoluciones(provisional, suyo, lista, { uid: ctx.uid });
      ctx.closeModal();
      btnSync.disabled = true;
      notaSync("⏳ Aplicando la resolución y cerrando el sync…");
      const r2 = await syncApi.continuarTrasConflictos(ctxSync, estadoResuelto, resultado.recibida);
      btnSync.disabled = false;
      notaSync((r2 && r2.mensaje) || "");
      if (r2) ctx.toast(r2.mensaje, r2.rama === "error" ? "error" : "success");
    });
  }


  };
})();

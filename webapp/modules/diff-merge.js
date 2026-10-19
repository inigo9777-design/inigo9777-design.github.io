// modules/diff-merge.js — FUSIÓN 3-WAY (FASE 4, plan-sync-buzon.md §4): merge diff3 de snapshots
// completos de Mr Cheff entre 2 dispositivos usando el ANTECESOR COMÚN (base = último estado
// convergecido, mrcheff.sync.base). Política de conflictos del plan: diff3 — la MISMA zona editada
// distinta en ambos es conflicto DECLARADO (nada silencioso); zonas separadas se auto-fusionan y
// NINGUNA versión se descarta jamás (la perdedora queda visible en el resolver, §5 del plan).
//
// Sin DOM ni localStorage ni red: entradas son snapshots planos; ctx inyectable para tests (§6).
//
//   merge3(base, mio, suyo) → { estado, conflictos }
//   aplicarResoluciones(estado, estadoSuyo, elecciones, deps { uid }) → estado final para el ACK
//
// Snapshot (payload v2, FASE 1): { foods, recipes, innovations, cooked, weekmenu }.
// El diff3 FINO se aplica a RECETAS (identidad de FASE 1 + listDiff3 por LCS a mano, CERO
// dependencias); el resto (foods/cooked/innovations) se fusiona por UNIÓN idempotente y weekmenu
// por LWW (generatedOn); decisiones trazadas en CODING_STANDARDS §8 con esta release.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { diffMerge: api });                           // patrón (A): window.MRCheff
})(typeof self !== "undefined" ? self : this, function () {

  // ================= IDENTIDAD DE RECETA (FASE 1) =================
  // id primero; fingerprint de ingredientes para LEGACY sin id fiable (receta idéntica al-menos-en
  // contenido). Réplica EXACTA de la mecánica recipeIngredientKey (innovations/planner/backup:
  // precedente de duplicación idéntica ya aceptado en CODING_STANDARDS §8).
  function claveIngredientes(ingredientes) {
    const partes = (Array.isArray(ingredientes) ? ingredientes : [])
      .map(x => String(x == null ? "" : x)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^0-9a-zA-Z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim())
      .filter(Boolean)
      .sort();
    return partes.join("\u00A6");
  }

  function identidadDe(receta) {
    if (receta && receta.id) return "id:" + String(receta.id);
    const clave = claveIngredientes(receta && receta.ingredients);
    return clave ? "fp:" + clave : null;
  }

  function esReceta(x) { return !!x && typeof x === "object" && !!x.title; }

  // Campos que participan en el diff3 de receta (createdAt NO compite: marca de creación original).
  const CAMPOS_LISTA = ["ingredients", "method", "uses"];
  const CAMPOS_ESCALARES = ["title", "meal", "source", "from", "origen", "editedAt"];

  // ================= LIST-DIFF3 (LCS a mano) =================

  // Bloques coincidentes estilo difflib: (indiceBase, indiceOtro, n) máximos y no solapados,
  // monotónicos (emparejamiento de la LCS dinámica base↔otra).
  function bloquesCoincidentes(baseList, otra) {
    const nb = baseList.length, no = otra.length;
    const dp = Array.from({ length: nb + 1 }, () => new Array(no + 1).fill(0));
    for (let i = nb - 1; i >= 0; i--) {
      for (let j = no - 1; j >= 0; j--) {
        dp[i][j] = baseList[i] === otra[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const emparejados = []; let i = 0, j = 0;
    while (i < nb && j < no) {
      if (baseList[i] === otra[j]) { emparejados.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    // agrupar en bloques contiguos
    const bloques = [];
    for (const [pi, pj] of emparejados) {
      const ultimo = bloques[bloques.length - 1];
      if (ultimo && ultimo[0] + ultimo[2] === pi && ultimo[1] + ultimo[2] === pj) ultimo[2]++;
      else bloques.push([pi, pj, 1]);
    }
    return bloques;
  }

  // Regiones ESTABLES: tramos de base emparejados A LA VEZ por el LCS base↔mio y el LCS base↔suyo
  // (difino clásico: allí donde las TRES coinciden). Monotónicos y sin solapes por construcción.
  function regionesEstables(baseList, mio, suyo) {
    const bm = bloquesCoincidentes(baseList, mio);
    const bs = bloquesCoincidentes(baseList, suyo);
    const regiones = [];
    let i = 0, j = 0;
    while (i < bm.length && j < bs.length) {
      const Mi = bm[i], Su = bs[j];
      const desde = Math.max(Mi[0], Su[0]);
      const hasta = Math.min(Mi[0] + Mi[2], Su[0] + Su[2]);
      if (hasta > desde) {
        regiones.push({
          baseDesde: desde,
          baseHasta: hasta,
          mioDesde: Mi[1] + (desde - Mi[0]),
          suyoDesde: Su[1] + (desde - Su[0]),
          tamano: hasta - desde
        });
      }
      if (Mi[0] + Mi[2] <= Su[0] + Su[2]) i++; else j++;
    }
    return regiones;
  }

  function igualListas(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // listDiff3 COMPLETO: mezcla regiones estables + tramos inestables resueltos/conflictos.
  // Devuelve { lista: [...], conflictos: [{ base, mio, suyo, posicionBase }] }
  function listaDif3(baseList, mio, suyo, opciones = {}) {
    baseList = Array.isArray(baseList) ? baseList : [];
    mio = Array.isArray(mio) ? mio : [];
    suyo = Array.isArray(suyo) ? suyo : [];
    const result = []; const conflictos = [];
    let pcBase = 0, pcMio = 0, pcSuyo = 0;   // punteros de consumo de cada lista
    const regiones = regionesEstables(baseList, mio, suyo);

    for (let r = 0; r <= regiones.length; r++) {
      const region = r < regiones.length ? regiones[r] : null;
      const finBase = region ? region.baseDesde : baseList.length;
      const finMio = region ? region.mioDesde : mio.length;
      const finSuyo = region ? region.suyoDesde : suyo.length;

      // ==== tramo INESTABLE antes de esta región (hasta el final de lista si no hay más regiones) ====
      if (finBase > pcBase || finMio > pcMio || finSuyo > pcSuyo) {
        const tramoBase = baseList.slice(pcBase, finBase);
        const tramoMio = mio.slice(pcMio, finMio);
        const tramoSuyo = suyo.slice(pcSuyo, finSuyo);
        const cambioMio = !igualListas(tramoMio, tramoBase);
        const cambioSuyo = !igualListas(tramoSuyo, tramoBase);
        if (!cambioMio && !cambioSuyo) {
          result.push(...tramoBase);                     // zona sin cambios para ambos
        } else if (!cambioMio) {
          result.push(...tramoSuyo);                     // sólo SUYO tocó la zona
        } else if (!cambioSuyo) {
          result.push(...tramoMio);                      // sólo MIO tocó la zona
        } else if (igualListas(tramoMio, tramoSuyo)) {
          result.push(...tramoMio);                      // ambos dejaron el MISMO texto
        } else {
          result.push(...tramoMio);                      // provisional: valor LOCAL (el resolver decide §5)
          if (opciones.unirSinBase) result.push(...tramoSuyo);   // SIN base: unión literal del plan §4
          conflictos.push({ base: tramoBase, mio: tramoMio, suyo: tramoSuyo, posicionBase: pcBase });
        }
        pcBase = finBase; pcMio = finMio; pcSuyo = finSuyo;
      }

      // ==== región estable ==== (la MISMA secuencia coincide en las tres: se copia tal cual)
      if (region) {
        for (let k = 0; k < region.tamano; k++) {
          result.push(baseList[region.baseDesde + k]);
        }
        pcBase = region.baseHasta;
        pcMio = region.mioDesde + region.tamano;
        pcSuyo = region.suyoDesde + region.tamano;
      }
    }
    return { lista: result, conflictos };
  }

  // ================= merge3 COMPLETO =================

  // Columnas por identidad: { base, mio, suyo } de cada entidad. La primera ocurrencia gana si la
  // misma identidad se repite (no debería: dedup aguas arriba), pero queda defensivo.
  function columnasDe(mapaListas, esValida, clavePropia) {
    const columnas = new Map();
    ["base", "mio", "suyo"].forEach(slot => {
      const tabla = mapaListas[slot] || [];
      tabla.forEach(item => {
        if (!esValida(item)) return;
        const key = clavePropia(item);
        if (!key) return;
        if (!columnas.has(key)) columnas.set(key, {});
        const col = columnas.get(key);
        if (!col[slot]) col[slot] = item;
      });
    });
    return columnas;
  }

  function tieneCamposReceta(r) { return !!r && typeof r === "object" && !!r.title; }

  // ---- escalares de receta (guion del plan §4): gana el lado que cambió respecto a la base;
  //      ambos cambiaron distinto CON base = conflicto bloqueante; SIN base = LWW por editedAt
  //      (aviso NO bloqueante: la versión perdedora no se descarta, va al resolver con flag §4).
  function elegirEscalar(nombreCampo, recetaBase, recetaMio, recetaSuyo, hayBase, idReceta, conflictos, avisos) {
    const valorBase = recetaBase ? recetaBase[nombreCampo] : undefined;
    const valorMio = recetaMio ? recetaMio[nombreCampo] : undefined;
    const valorSuyo = recetaSuyo ? recetaSuyo[nombreCampo] : undefined;

    // editedAt es el ancla del LWW, NO contenido en disputa: gana el más nuevo en silencio
    // (ningún aviso/ningún conflicto por la propia marca de tiempo).
    if (nombreCampo === "editedAt") {
      const anclaMio = String(valorMio || "");
      const anclaSuyo = String(valorSuyo || "");
      if (hayBase) {
        if (valorMio === valorBase) return valorSuyo;
        if (valorSuyo === valorBase) return valorMio;
      }
      return anclaSuyo > anclaMio ? valorSuyo : valorMio;
    }

    if (!hayBase) {
      if (valorMio === valorSuyo) return valorMio;
      const anclaMio = (recetaMio && recetaMio.editedAt) || "";
      const anclaSuyo = (recetaSuyo && recetaSuyo.editedAt) || "";
      if (anclaMio > anclaSuyo) {
        avisos.push({ tipo: "campo", recetaId: idReceta, campo: nombreCampo, elegida: "local", autoResuelto: true, local: valorMio, remota: valorSuyo });
        return valorMio;
      }
      if (anclaSuyo > anclaMio) {
        avisos.push({ tipo: "campo", recetaId: idReceta, campo: nombreCampo, elegida: "remota", autoResuelto: true, local: valorMio, remota: valorSuyo });
        return valorSuyo;
      }
      conflictos.push({ tipo: "campo", recetaId: idReceta, campo: nombreCampo, base: valorBase, local: valorMio, remota: valorSuyo });
      return valorMio;          // provisional LOCAL hasta que el resolver decida
    }

    // CON base: reglas diff3 canónicas del plan §4 (literales)
    if (valorMio === valorBase) return valorSuyo !== undefined ? valorSuyo : valorBase;  // sólo suyo cambió (o nadie)
    if (valorSuyo === valorBase) return valorMio;                                        // sólo mio cambió
    if (valorMio === valorSuyo) return valorMio;                                         // ambos al mismo valor
    conflictos.push({ tipo: "campo", recetaId: idReceta, campo: nombreCampo, base: valorBase, local: valorMio, remota: valorSuyo });
    return valorMio;
  }

  // ---- recetas: columnas por identidad y mezcla fina ----
  // La clave de columna es "id:<id>" por defecto, PERO si a un id le corresponde un fingerprint de
  // ingredientes que también lleva OTRO uid distinto (LEGACY replicado entre dispositivos sin id
  // fiable, FASE 1), la columna se agrupa por fingerprint: es la MISMA receta con ids distintos y
  // el uid LOCAL gana como canónico (mecánica deduplicada del import manual del plan §2).
  function fusionarRecetas(recetasBase, recetasMio, recetasSuyo, conflictos, avisos) {
    const fpDeId = new Map(); const idsPorFp = new Map();
    [recetasBase, recetasMio, recetasSuyo].forEach((tabla) => (tabla || []).forEach((r) => {
      if (!tieneCamposReceta(r) || !r.id) return;
      const fp = claveIngredientes(r.ingredients);
      if (!fp) return;
      fpDeId.set(String(r.id), fp);
      if (!idsPorFp.has(fp)) idsPorFp.set(fp, new Set());
      idsPorFp.get(fp).add(String(r.id));
    }));
    const claveReceta = (r) => {
      if (r && r.id) {
        const fp = fpDeId.get(String(r.id));
        if (fp && idsPorFp.get(fp).size > 1) return "fp:" + fp;   // uids gemelos LEGACY: agrupa por contenido
        return "id:" + String(r.id);
      }
      const fp = claveIngredientes(r && r.ingredients);
      return fp ? "fp:" + fp : null;
    };
    const columnas = columnasDe(
      { base: recetasBase || [], mio: recetasMio || [], suyo: recetasSuyo || [] },
      tieneCamposReceta, claveReceta
    );
    const salida = [];
    columnas.forEach((col, key) => {
      const recetaBase = col.base, recetaMio = col.mio, recetaSuyo = col.suyo;
      const idReceta = (recetaMio || recetaSuyo || recetaBase).id || key;

      // Regla de "vida" del §4 (y el borde documentado): la ausencia en UN lado es un borrado de
      // ese lado, pero la fusión lo RESUCITA (igual que el import manual de hoy); sólo se cae la
      // receta si se borró en ambos lados (presente en base y en ninguno).
      if (recetaBase && !recetaMio && !recetaSuyo) return;
      if (!recetaBase && recetaMio && !recetaSuyo) { salida.push(recetaMio); return; }
      if (!recetaBase && !recetaMio && recetaSuyo) { salida.push(recetaSuyo); return; }

      const hayBase = !!recetaBase;
      const recetaMixto = Object.assign({}, recetaMio || recetaSuyo || recetaBase);
      CAMPOS_ESCALARES.forEach(nombreCampo => {
        recetaMixto[nombreCampo] = elegirEscalar(nombreCampo, recetaBase, recetaMio, recetaSuyo, hayBase, idReceta, conflictos, avisos);
      });
      CAMPOS_LISTA.forEach(nombreCampo => {
        const datoBase = hayBase ? recetaBase[nombreCampo] : null;
        const datoMio = recetaMio ? recetaMio[nombreCampo] : null;
        const datoSuyo = recetaSuyo ? recetaSuyo[nombreCampo] : null;
        const res = listaDif3(datoBase, datoMio || [], datoSuyo || [], { unirSinBase: !hayBase });
        res.conflictos.forEach(conflicto => {
          if (hayBase) {
            conflictos.push({
              tipo: "lista", recetaId: idReceta, campo: nombreCampo,
              posicionBase: conflicto.posicionBase,
              base: conflicto.base, local: conflicto.mio, remota: conflicto.suyo
            });
          } else {
            // SIN base: unión honesta (los dos tramos ya coexisten en la lista fusionada), aviso NO bloqueante
            avisos.push({ tipo: "lista-union", recetaId: idReceta, campo: nombreCampo, local: conflicto.mio, remota: conflicto.suyo });
          }
        });
        recetaMixto[nombreCampo] = res.lista;
      });
      // createdAt NO compite: marca de creación original (base > mio > suyo)
      recetaMixto.createdAt = (recetaBase && recetaBase.createdAt) || (recetaMio && recetaMio.createdAt) || (recetaSuyo && recetaSuyo.createdAt);
      salida.push(recetaMixto);
    });
    return salida;
  }

  // ---- foods / innovations / cooked: unión por identidad honesta. Para campos sin diff3 fino,
  //      si AMBOS cambiaron y difieren gana el LOCAL (fuente de verdad); cuenta trazada en §8.
  function fusionarUniones(mapaListas, esValida, clavePropia) {
    const columnas = columnasDe(mapaListas, esValida, clavePropia);
    const salida = [];
    columnas.forEach(col => {
      if (col.base && !col.mio && !col.suyo) return;      // borrado convergente: fuera
      salida.push(col.mio || col.suyo || col.base);
    });
    return salida;
  }

  function esFood(f) { return !!f && typeof f === "object" && !!f.name; }
  function esIdea(i) { return !!i && typeof i === "object" && !!i.title; }
  function esCocinada(c) { return !!c && typeof c === "object"; }
  function claveFood(f) { return "name:" + String(f.name).toLowerCase(); }
  function claveIdea(i) { return "id:" + (i.id || "") + "|" + claveIngredientes(i.ingredients); }
  function claveCocinada(c) { return (c.keyFingerprint || c.id || "") + "\u00A6" + (c.on || ""); }

  // ---- weekmenu: LWW por generatedOn (snapshot transportado; el siguiente sync reconverge) ----
  function resolverWeekmenu(base, mio, suyo) {
    if (mio == null && suyo == null) return base == null ? null : base;
    if (mio == null) return suyo;
    if (suyo == null) return mio;
    if (JSON.stringify(mio) === JSON.stringify(suyo)) return mio;
    if (base && JSON.stringify(mio) === JSON.stringify(base)) return suyo;   // sólo suyo cambió
    if (base && JSON.stringify(suyo) === JSON.stringify(base)) return mio;   // sólo mio cambió
    const genMio = (mio && mio.generatedOn) || "";
    const genSuyo = (suyo && suyo.generatedOn) || "";
    return genSuyo > genMio ? suyo : mio;
  }

  function merge3(base, mio, suyo) {
    const conflictos = [];    // bloqueantes: al resolver ANTES de escribir (§3/§5 del plan)
    const avisos = [];        // no bloqueantes: LWW del primer sync (badge, sin parar)

    const estado = {
      recipes: fusionarRecetas(base && base.recipes, mio && mio.recipes, suyo && suyo.recipes, conflictos, avisos),
      foods: fusionarUniones({ base: base && base.foods, mio: mio && mio.foods, suyo: suyo && suyo.foods }, esFood, claveFood),
      innovations: fusionarUniones({ base: base && base.innovations, mio: mio && mio.innovations, suyo: suyo && suyo.innovations }, esIdea, claveIdea),
      cooked: fusionarUniones({ base: base && base.cooked, mio: mio && mio.cooked, suyo: suyo && suyo.cooked }, esCocinada, claveCocinada),
      weekmenu: resolverWeekmenu(base && base.weekmenu, mio && mio.weekmenu, suyo && suyo.weekmenu)
    };
    return { estado, conflictos, avisos };
  }

  // ================= RESOLVER (§5): aplicar las decisiones del modal =================
  // Recibe el estado provisional de merge3 + el estado REMOTO (estadoSuyo tal cual llegó del otro
  // dispositivo). elecciones: Array<{ recetaId, decision: "local" | "remota" | "ambas" }> — la
  // decisión es por RECETA (el modal enseña el par del campo, pero la elección es de versión entera).
  function aplicarResoluciones(estado, estadoSuyo, elecciones, deps = {}) {
    const resultado = Object.assign({}, estado, { recipes: (estado.recipes || []).slice() });
    (elecciones || []).forEach(({ recetaId, decision }) => {
      const recetasSuyo = (estadoSuyo && estadoSuyo.recipes) || [];
      // El gemelo LEGACY (FASE 1) puede tener UN id DISTINTO en el otro dispositivo: si ningún id
      // casa, la remota se busca por fingerprint de ingredientes del provisional (misma identidad).
      const idx = resultado.recipes.findIndex(r => r && (r.id === recetaId || identidadDe(r) === "id:" + recetaId));
      const provisional = idx >= 0 ? resultado.recipes[idx] : null;
      let remota = recetasSuyo.find(r => r && (r.id === recetaId || identidadDe(r) === "id:" + recetaId));
      if (!remota && provisional) {
        const fp = claveIngredientes(provisional.ingredients);
        if (fp) remota = recetasSuyo.find(r => r && claveIngredientes(r.ingredients) === fp);
      }
      if (decision === "remota" && remota && idx >= 0) {
        resultado.recipes[idx] = Object.assign({}, remota);            // el otro dispositivo gana ÍNTEGRO
      } else if (decision === "ambas" && remota && idx >= 0) {
        // conservar ambas: la copia remota entra con id NUEVO + marca "duplicada" (limpieza manual, §5)
        const copia = Object.assign({}, remota, { id: deps.uid ? deps.uid() : String(remota.id) + "-copia", duplicada: true });
        resultado.recipes.push(copia);
      }
      // "local": el provisional ya lleva la versión local → nada que mover
    });
    return resultado;
  }

  return { merge3, aplicarResoluciones, claveIngredientes, identidadDe, bloquesCoincidentes, regionesEstables, listaDif3 };
});

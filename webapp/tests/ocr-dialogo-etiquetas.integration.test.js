// tests/ocr-dialogo-etiquetas.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS §6) del
// bugfix 2026-10-21 del diálogo de revisión del escáner en MÓVIL: "las propiedades importancia,
// cantidad, mínimo e incluir están lejos de los inputs y no se entiende" (petición del usuario
// con pantallazo). Rediseño: en estrecho la CABECERA compartida de columnas se ESCONDE (ya no
// calza con nada) y cada control va DENTRO de su propio <label> con un micro-etiqueta (.rev-etiqueta)
// PEGADO encima — Cantidad/Importancia/Mínimo/Incluir leen junto a SU input; en escritorio la
// etiqueta interna va oculta y la cabecera compartida sigue nombrando las columnas. La estructura
// se comprueba EN EL DOM REAL (bootApp): label que contiene SU control + etiqueta que lo nombra.

const { bootApp } = require("./boot");

const TICKET = [
  "TICKET SUPER 20/10/2026",
  "3 Leche entera · 1,29 €",
  "2 x Yogur",
  "1 Pan de pueblo",
  "TOTAL 12,40 €",
  "GRACIAS POR SU VISITA"
].join("\n");

function appConDespensa() {
  return bootApp({
    seed: {
      foods: [
        { id: "a1", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 1 },
        { id: "a2", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 2 }
      ],
      recipes: [], innov: [], cooked: []
    }
  });
}

describe("Diálogo OCR (revisión) — etiqueta PEGADA al campo (bugfix 2026-10-21, integración)", () => {
  const abrirRevision = () => {
    const ctx = appConDespensa();
    ctx.window.__mrcheffProcesarTextoOcr(TICKET);
    ctx.document.querySelector("[data-confirmar-exactos]").click();   // exactos → revisión
    return ctx;
  };

  it("cada campo vive DENTRO de su <label> con SU micro-etiqueta encima (Alimento/Cantidad/Importancia/Mínimo/Incluir)", () => {
    const { document, window } = abrirRevision();

    // FILA NUEVA: cinco celdas, cada una etiqueta + control emparejados
    const nueva = document.querySelector(".rev-fila-nueva");
    const celdas = [...nueva.querySelectorAll(":scope > label.rev-celda")];
    expect(celdas.map(c => c.querySelector(".rev-etiqueta").textContent)).toEqual(
      ["Alimento", "Cantidad", "Importancia", "Mínimo", "Incluir"]
    );
    // el label envuelve SU control (el name input y el include ni siquiera necesitan @for)
    expect(celdas[0].querySelector("input.rev-campo-nombre")).not.toBeNull();
    expect(celdas[1].querySelector("input.rev-campo-qty")).not.toBeNull();
    expect(celdas[2].querySelector("input.rev-campo-score")).not.toBeNull();
    expect(celdas[3].querySelector("input.rev-campo-min")).not.toBeNull();
    expect(celdas[4].querySelector("input[type=checkbox]")).not.toBeNull();
    // clic en la etiqueta = foco en SU campo (asociación implícita del label wrapper)
    expect(celdas[0].getAttribute("for")).toBe(celdas[0].querySelector("input").id);
    expect(celdas[2].getAttribute("for")).toBe(celdas[2].querySelector("input").id);
    // la excribitura final sigue funcionando: lee por id, no por posición
    document.getElementById("rev-nombre-0").value = "Leche descremada";
    document.getElementById("rev-score-0").value = "8";
    document.querySelector("[data-revision-guardar]").click();
    const foods = JSON.parse(window.localStorage.getItem("mrcheff.foods"));
    expect(foods.find(f => f.name === "Leche descremada").score).toBe(8);
  });

  it("en DUDAS el desplegable va dentro de su label ('De tu despensa') y conectaVariante sigue vivo", () => {
    const { document, window } = abrirRevision();
    const duda = document.querySelector(".rev-fila-duda");
    const variante = duda.querySelector(":scope > label.rev-celda-variante");
    expect(variante.querySelector(".rev-etiqueta").textContent).toBe("De tu despensa");
    const sel = variante.querySelector("select#rev-variante-1");
    expect(sel).not.toBeNull();
    expect(sel.getAttribute("for") === null || variante.getAttribute("for") === sel.id).toBe(true);
    // resolvida la variante, los campos de alerta se deshabilitan (máquina intacta tras el re-molde)
    sel.value = "a1";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(document.getElementById("rev-score-1").disabled).toBe(true);
    expect(document.getElementById("rev-min-1").disabled).toBe(true);
    expect(document.getElementById("rev-qty-1").disabled).toBe(false);
  });

  it("el diálogo 1 (exactos) también lleva su etiqueta pegada (Cantidad / Incluir)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    const fila = document.querySelector(".modal-content .ocr-item");
    const celdas = [...fila.querySelectorAll(":scope > label.rev-celda")];
    expect(celdas.map(c => c.querySelector(".rev-etiqueta").textContent)).toEqual(["Cantidad", "Incluir"]);
    expect(celdas[0].querySelector("input.exact-qty").value).toBe("1");       // la qty leída del ticket
    expect(celdas[1].querySelector("input[type=checkbox]").checked).toBe(true);
  });
});

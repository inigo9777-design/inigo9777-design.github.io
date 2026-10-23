// tests/ocr-ticket-parser.test.js — el PARSER ESTRUCTURAL del ticket (requisito 95% de ítems).
// Las LÍNEAS de prueba son el TEXTO REAL que e2e/ocr-inspeccion.mjs volcó de las fotos de
// reports/OCR (corpus descartable): reglas de Mercadona y ALDI fiadas a material verdadero.
const parser = require("../modules/ocr-ticket-parser.js");

const { parsearTicket, detectarOrigen, unidadesDePeso, precioDeTalon, qtyInicial } = parser;
const nombre = it => it.nombre;
// El OCR mete ruido PEGADO al nombre (columnas fantasma: "BEBIDA AVELLANAS MZA", "LOBICHA…"):
// la review por diálogos trabaja sobre nombres EDITABLES, así que los tests fijan el comportamiento
// por FRAGMENTO — lo que el requisito 95% pide es el ÍTEM en la revisión, no la palabra perfecta
// (cido-insens_buscado: los nombres ahora salen en título propio, "Leche entera" ≠ "LECHE ENTERA").
const deNombre = (items, frag) => items.find(i => nombre(i).toLowerCase().includes(frag.toLowerCase()));
// El OCR mete ruido PEGADO al nombre (columnas fantasma: "BEBIDA AVELLANAS MZA", "LOBICHA…"):
// la review por diálogos trabaja sobre nombres EDITABLES, así que los tests fijan el comportamiento
// por FRAGMENTO — lo que el requisito 95% pide es el ÍTEM en la revisión, no la palabra perfecta.
const contiene = (items, frag) => items.some(i => nombre(i).toLowerCase().includes(frag.toLowerCase()));

// ─── Texto del ticket MERCADONA REAL (reports/OCR/IMG_0162.HEIC, variante B del corpus) ───
const MERCADONA = `
2 BEBIDA AVELLANAS       MZA a 2:50
   4 BEBIDA COCO       1,60 6,40 Y
1 SALMON NATURAL               3,55
E     1 ATUN CLARO NATURAL           4,20
     1 LOMO CEBO TBÉRICO          6,21
y     1 Lomo CEBO IBÉRICO            6.721 E
   1 CEBO. TAPAS           7,14 El
.    1 CEBO TAPAS                6.64
-    1 PICADA DE VACUNO            5,40
;    1H. CORDERO AL ROMERO         3,50
y   2 LECHE FRESCA du    Me 2.00
E    1 JAMÓN EXTRAF              2,50
y        1 TOMATE FRITO S/AZUCA         1,10
2 MANTEQUILLA PASIGSIN -— 2,05    4,1€
      1 FUET ESPETEC EXTRA           2,50
E        ue    1 BOQUERONES ALIÑADOS          1,65
e          1 C. CARRILLERA              2,50
,      1 PIMIENTO CHORICERO            1,60
a     3 PAÑUELO       [Aba 4709
      :       1 PAN H BREOENE       E   1,10
                | HIGIÉNICO DOBLE ROLL         4,60
 ,  C  -    a                             7 F      .   -     e.
e         meva — 1%
|         —— MMC UOSS IMPONIBLE (e) —— CUOTA ce)
4%     2,      0,09   o      —
e.    | 10%     63,09      6,31   e ..
           21%       1,15        1,50
.        TOTAL     72,45       7,90    .
       ME ino. BANCARIA: 20% ARA TA gon       -
MU AUT: 968878 ARC; 00 AID: AODOONU,      ——
Importe: 80.35 %             31010
      :       Visa Debiy
  TA    MERCADONA, S-A-    ES Ps
x    "       A-46103834        Eo   o
E      CL ALBERT ELNSTEIN, 13.
e.     11500 EL PUERTO DE SANTA MARÍA
SA AA     _ TELEFONO:   956548217      Me     7
AED NN 20/10/2026 13:17 0P:1485330     E       —
e:   FACTURA SIMPLIFICADA: 3931-017-372431 — Q               -
`;

// ─── Texto del ticket ALDI REAL (reports/OCR/11,00 € 2).HEIC, variante A del corpus) ───
const ALDI = `
ALDI
C/ Albert Einstein, 14, 11500 El Puerto
de Santa María
Horario de apertura:
Lu.-Sa. 9:00 - 21:30 horas
0,680 kg x 13,99 €/kg           A
SPECIAL COSTILLAR          9,51 €3
SPECIAL DELICIA PISTAC       2,43 €3
GUANCIALE                  2,69€3
0,506 kg x 7,58 €/kg            E
PECH.POLLO FILETEADA         3,8€3
0,267 kg x 39,95 €/kg
SOLOMILLO VÁCUNO           10,07 € 3
ESCAMAS DE TORREZNO           2,9 €3
SPECIAL DUD BL FOIE GR       4,49 €3
PAPADA IBERICA              2,99€3
0,330 kg x 23,39 €/kg
LoMO IBERICO ADOBADO         e 3
EX IDA
:               BE LOBICHA NARANJA/F .ROJ      7,16 €4
FILETES MELVA AC. OL.         1,85€3
MASA PIZZA FINA, 230         1,35 €2
| ECO PATATA MALLA 2KG        KO
0,110 kg x 2,39 €/kg
PIMIENTO DULCE ITALIAN       0,26 €?2
0,290 kg x 1,79 €/kg
CALABACIN GRANEL            0,52 €2
Desc.                     -0,19€
LECHE FRESCA ENTERA 1        1,15€2
0,216 kg x 2,79 €/kg
PIMIENTO DULCE ROJO GR        0,60€2
4x2,1€
ECO HUEVOS                11,00 €2
2x 1,43€
PATATAS FRITAS AC. OLI       2,98€3
SPECIAL VIRUTAS DE PAL        4,99€3
2 XADO? €
MINI CHAPATA CRISTAL         0,64 €2
TOTAL   71,34
TARJETA BANCARIA
`;

describe("detectarOrigen", () => {
  test("reconoce Mercadona por su factura/horario y ALDI por su cabecera", () => {
    expect(detectarOrigen("MERCADONA S.A. FACTURA SIMPLIFICADA")).toBe("mercadona");
    expect(detectarOrigen("ALDI\nHorario de apertura")).toBe("aldi");
    expect(detectarOrigen("texto sin cadena conocida")).toBe("generico");
  });
});

describe("unidadesDePeso (lotes de 500 g, petición del usuario)", () => {
  test("1,5 kg → 3 lotes; 0,842 kg → 2; mínimo 1", () => {
    expect(unidadesDePeso(1.5)).toBe(3);
    expect(unidadesDePeso(0.842)).toBe(2);
    expect(unidadesDePeso(0.216)).toBe(1);
    expect(unidadesDePeso(0.0001)).toBe(1);
  });
});

describe("talonario del precio (precios estándar y degradados)", () => {
  test("el ÚLTIMO precio estándar es el total y el penúltimo la unidad", () => {
    expect(precioDeTalon("4 BEBIDA COCO 1,60 6,40 Y")).toMatchObject({ precio: 6.4, unit: 1.6 });
    expect(precioDeTalon("1 SALMON NATURAL 3,55")).toMatchObject({ precio: 3.55, unit: null });
  });
  test("el precio degradado (375eZ→3,75) exige restos del símbolo", () => {
    expect(precioDeTalon("ECO PATATA MALLA 2KG 375eZ")).toMatchObject({ precio: 3.75, degradado: true });
    expect(precioDeTalon("MASA PIZZA FINA, 230 ")).toBe(null);   // la talla 230 NO es precio
  });
});

describe("qty inicial de línea (columna de cantidad de Mercadona)", () => {
  test("2 BEBIDA… / 4 BEBIDA… / 1H. pegado", () => {
    expect(qtyInicial("2 BEBIDA AVELLANAS")).toBe(2);
    expect(qtyInicial("4 BEBIDA COCO")).toBe(4);
    expect(qtyInicial("1H. CORDERO AL ROMERO")).toBe(1);
    expect(qtyInicial("SALMON NATURAL")).toBe(null);
  });
});

describe("MERCADONA real: casi todo el ticket se convierte en ítems", () => {
  const r = parsearTicket(MERCADONA);
  test("origen mercadona", () => expect(r.origen).toBe("mercadona"));
  test("los ítems del ticket salen con su nombre (por fragmento) y cantidad", () => {
    for (const esperado of [
      "BEBIDA AVELLANAS", "BEBIDA COCO", "SALMON NATURAL", "ATUN CLARO NATURAL",
      "LOMO CEBO TBÉRICO", "Lomo CEBO IBÉRICO", "CEBO TAPAS",
      "PICADA DE VACUNO", "CORDERO AL ROMERO", "LECHE FRESCA", "JAMÓN EXTRAF",
      "TOMATE FRITO S/AZUCA", "MANTEQUILLA PASIGSIN", "FUET ESPETEC EXTRA",
      "BOQUERONES ALIÑADOS", "CARRILLERA", "PIMIENTO CHORICERO", "PAÑUELO",
      "PAN BREOENE", "HIGIÉNICO DOBLE ROLL"
    ]) expect(contiene(r.items, esperado)).toBe(true);
    expect(r.items).toHaveLength(21);
  });
  test("las CANTIDADES del ticket viajan (la columna inicial)", () => {
    const de = frag => deNombre(r.items, frag);
    expect(de("BEBIDA AVELLANAS").qty).toBe(2);
    expect(de("BEBIDA COCO").qty).toBe(4);
    expect(de("PAÑUELO").qty).toBe(3);
    expect(de("CORDERO AL ROMERO").qty).toBe(1);
  });
  test("el total de dos columnas es el ÚLTIMO precio (no la unidad)", () => {
    expect(deNombre(r.items, "BEBIDA COCO").precio).toBe(6.4);
    expect(deNombre(r.items, "SALMON NATURAL").precio).toBe(3.55);
  });
  test("la cabecera, el pie y los resúmenes de IVA NO son ítems", () => {
    const nombres = r.items.map(nombre).join(" | ");
    expect(nombres).not.toMatch(/TOTAL|CUOTA|MERCADONA|TELEFONO|FACTURA|BANCARIA/);
    const motivos = r.descartadas.map(d => d.motivo);
    expect(motivos.some(m => m.includes("reservado"))).toBe(true);
  });
});

describe("ALDI real: auxiliares emparejadas y lotes de 500 g", () => {
  const r = parsearTicket(ALDI);
  test("origen aldi", () => expect(r.origen).toBe("aldi"));
  test("los productos con peso entran en lotes de 500 g con el sufijo (500gr)", () => {
    const costillar = deNombre(r.items, "SPECIAL COSTILLAR");
    expect(costillar.nombre).toContain("(500gr)");
    expect(costillar.qty).toBe(1);                      // 0,680 kg → 1,36 → 1 lote
    expect(costillar.pesoKg).toBeCloseTo(0.68, 3);
    expect(deNombre(r.items, "PECH.POLLO FILETEADA").qty).toBe(1);     // 0,506 kg → 1,01 → 1
    // el redondeo NO infla pequeños; 1,5 kg → 3 se cubre en unidadesDePeso
    expect(parser.unidadesDePeso(1.5)).toBe(3);
  });
  test("las líneas '4x …' dan la CANTIDAD del pack al producto siguiente", () => {
    expect(deNombre(r.items, "ECO HUEVOS").qty).toBe(4);
    expect(deNombre(r.items, "PATATAS FRITAS AC OLI").qty).toBe(2);
    // "2 XADO? €" (mangle de "2x 1,5?" — el OCR comió el precio del pack): la cifra y la x BASTAN
    // (PACK_FLOJO, sólo ALDI) → va a MINI CHAPATA, el producto que la precede en el ticket
    expect(deNombre(r.items, "MINI CHAPATA CRISTAL").qty).toBe(2);
  });

  test("PACK_FLOJO exige letra X y respeta la basura larga: '4 x EXTRA' NO es auxiliar de nadie", () => {
    const rf = parsearTicket([
      "ALDI",
      "4 x EXTRA VIRGEN 6,20",     // nombre real de producto con X: precio legible → es un producto
      "SPECIAL ACEITE 6,20",       // la línea de arriba NO le deja qty fantasma
      "2 XADO? €"                  // sí es pack flojo: se apunta para el producto de abajo
    ].join("\n"));
    expect(rf.origen).toBe("aldi");
    const aceite = deNombre(rf.items, "SPECIAL ACEITE");
    expect(aceite.qty).toBe(1);    // el "4 x EXTRA…" murió CON su auxiliar (no viaja)
  });
  test("el resto de productos ALDI salen aunque su IVA-code mangle el precio", () => {
    for (const esperado of [
      "SPECIAL DELICIA PISTAC", "GUANCIALE", "SOLOMILLO VÁCUNO", "ESCAMAS DE TORREZNO",
      "SPECIAL DUD BL FOIE GR", "PAPADA IBERICA", "FILETES MELVA AC OL", "MASA PIZZA FINA",
      "ECO PATATA MALLA", "PIMIENTO DULCE ITALIAN", "CALABACIN GRANEL",
      "LECHE FRESCA ENTERA", "PIMIENTO DULCE ROJO GR", "SPECIAL VIRUTAS DE PAL"
    ]) expect(contiene(r.items, esperado)).toBe(true);
  });
  test("descuentos y líneas sin precio de ALDI no crean ítems", () => {
    const nombres = r.items.map(nombre).join(" | ");
    expect(nombres).not.toMatch(/Desc\.|^XADO|EX IDA/);
    expect(r.descartadas.some(d => d.motivo === "peso del granel (apuntado)")).toBe(true);
    expect(r.descartadas.some(d => d.motivo === "cantidad del pack (apuntada)")).toBe(true);
  });
  test("sólo los productos llegan a la lista de ítems (cuenta saneada)", () => {
    // 21 productos REALES del corpus (contado a mano; el LOMO ADOBADO a granel es compra real
    // aunque su precio el OCR lo muerda — se rescata con el peso) + el eco anulado; el descuento
    // ni el pie cuentan
    expect(r.items).toHaveLength(21);
  });
});

describe("título propio: el ticket impreso EN MAYÚSCULAS sale como 'Gel higiene' (2026-10-23)", () => {
  test("primera letra en mayúscula y el resto en minúscula, nombre completo", () => {
    const r = parsearTicket([
      "MERCADONA",
      "1 GEL HIGIENE 2,90",
      "2 YOGUR NATURAL 1,15"
    ].join("\n"));
    expect(r.items.map(i => i.nombre)).toEqual(["Gel higiene", "Yogur natural"]);
  });

  test("el sufijo de granel se compone DESPUÉS del título ('… (500gr)' en minúscula también)", () => {
    const r = parsearTicket([
      "ALDI",
      "0,680 kg x 13,99 €/kg",
      "SPECIAL COSTILLAR 9,51 €3"
    ].join("\n"));
    expect(deNombre(r.items, "Special costillar").nombre).toMatch(/\(500gr\)$/);
  });

  test("el eco del OCR sigue deduplicando por LÍNEA CRUDA (mayúsculas o no)", () => {
    const r = parsearTicket([
      "1 LOMO ADOBADO 6,21",
      "1 LOMO ADOBADO 6,21"
    ].join("\n"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0].nombre).toBe("Lomo adobado");
  });
});

describe("resiliencia ante texto que NO es ticket", () => {
  test("la foto de una nevera no inventa productos", () => {
    const r = parsearTicket("hola esto es un frasquito\nsin nada de dinero\nvacío");
    expect(r.items).toHaveLength(0);
  });
  test("texto vacío no explota", () => {
    expect(parsearTicket("").items).toHaveLength(0);
    expect(parsearTicket(null).items).toHaveLength(0);
  });
});

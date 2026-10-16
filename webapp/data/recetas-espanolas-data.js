// modules/recetas-espanolas-data.js — Catálogo CURADO de recetas caseras españolas SENCILLAS y cotidianas.
// No es lógica: es CONTENIDO fijo. Lógica PURe en cuanto a DOM/I/O → testeable con Node/Jest sin jsdom, igual que
// classify.js / priority.js. Mismo patrón IIFE + doble-export (window.MRCheff.recetasEspanolas para el navegador y
// module.exports = array como default export CommonJS para require() desde tests), idéntico al ya existente en
// classify.js / priority.js. Ver plan-inovacion-recetas-espanolas.md §4.1.
//
// Schema estricto por registro (5 campos, sin metadato extra — chef/región/procedencia se difieren a Fase 2):
//   { id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }
// - `id` es el tie-breaker DETERMINISTA de orden del ranking (§4.2) y la clave estable para auto-sanidad §3-extra.
// - Las recetas son plato reales plausibles al uso casero español (estilo cocina rápida cotidiana), NO combinaciones
//   inventadas tipo "revuelto de ajos con yogur y cilantro" (caso defecto del plan §1). Es contenido que puede seguir creciendo


// Recetas caseras españolas sencillas. Ver §1 del plan-inovacion-recetas-espanolas.md.
(function (root, factory) {
  const dataset = factory();
  if (typeof module === "object" && module.exports) module.exports = dataset;
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { recetasEspanolas: dataset });
})(typeof self !== 'undefined' ? self : this, function () {

return [
  {
    "id": "tostada-tomate-ajo",
    "title": "Tostada de tomate y ajo",
    "meal": "desayuno",
    "ingredients": ["Pan", "Tomates maduros", "Ajos", "Aceite de oliva virgen extra", "Sal"],
    "method": [
      "Calienta una sartén con un chorrito de aceite de oliva.",
      "Saltea 1-2 dientes de ajo picado fino hasta que queden dorados sin quemar.",
      "Tuesta el pan y frota su superficie caliente con un tomate maduro cortado por la mitad.",
      "Coloca los ajos salteados encima, pincela con un poco más de aceite y una pizca de sal."
    ]
  },
  {
    "id": "pan-con-tomate-catalan",
    "title": "Pan con tomate catalán",
    "meal": "desayuno",
    "ingredients": ["Pan de barra", "Tomates rojos", "Aceite de oliva", "Sal", "Jamón serrano opcional"],
    "method": [
      "Tuesta rebanadas gruesas de pan hasta que estén crujientes.",
      "Corta tomates por la mitad y frota sobre el pan tostado.",
      "Rocía generosamente con aceite de oliva virgen extra.",
      "Añade sal al gusto y jamón serrano si deseas."
    ]
  },
  {
    "id": "huevo-durillo",
    "title": "Huevos revueltos con durillo",
    "meal": "desayuno",
    "ingredients": ["Huevos", "Patatas", "Chorizo", "Cebolla", "Aceite de oliva", "Sal"],
    "method": [
      "Pica las patatas y el chorizo en trozos pequeños.",
      "Sofríe las patatas y el chorizo hasta que estén dorados.",
      "Bate los huevos y viértelos sobre la mezcla.",
      "Revuelve todo junto hasta que los huevos cuajen."
    ]
  },
  {
    "id": "batido-frutas-lacteos",
    "title": "Batido de frutas con lácteos",
    "meal": "desayuno",
    "ingredients": ["Leche", "Yogur natural", "Plátanos", "Fresas", "Miel", "Granola"],
    "method": [
      "Lava y corta las frutas en trozos.",
      "Coloca las frutas, leche y yogur en la batidora.",
      "Mezcla hasta obtener una textura cremosa.",
      "Sirve con miel y granola por encima."
    ]
  },
  {
    "id": "tortita-avena-miel",
    "title": "Tortitas de avena y miel",
    "meal": "desayuno",
    "ingredients": ["Harina de avena", "Huevos", "Leche", "Miel", "Polvo de hornear", "Frutos rojos"],
    "method": [
      "Mezcla avena, huevos, leche y polvo de hornear.",
      "Calienta una sartén antiadherente sin aceite.",
      "Vierte la masa y cocina 2 minutos por lado.",
      "Sirve con miel y frutos rojos frescos."
    ]
  },
  {
    "id": "bowl-yogur-granola",
    "title": "Bowl de yogur con granola",
    "meal": "desayuno",
    "ingredients": ["Yogur griego", "Granola casera", "Miel", "Semillas de chía", "Fruta fresca"],
    "method": [
      "Coloca el yogur en un bol.",
      "Añade granola generosamente.",
      "Decora con fruta fresca picada y semillas.",
      "Termina con un hilo de miel."
    ]
  },
  {
    "id": "huevos-molletes",
    "title": "Huevos en mollete andaluz",
    "meal": "desayuno",
    "ingredients": ["Molletes de Antequera", "Huevos", "Aceite de oliva", "Sal", "Queso fresco"],
    "method": [
      "Tuesta los molletes ligeramente.",
      "Haz huevos fritos o pochados.",
      "Coloca el huevo sobre cada mollete.",
      "Añade queso fresco y rocía con aceite."
    ]
  },
  {
    "id": "torrijas-desayuno",
    "title": "Torrijas ligeras de desayuno",
    "meal": "desayuno",
    "ingredients": ["Pan del día anterior", "Leche", "Miel", "Canela", "Huevo", "Aceite"],
    "method": [
      "Remoja el pan en leche con miel y canela.",
      "Pasa por huevo batido.",
      "Freír rápidamente en aceite caliente.",
      "Escurre y sirve tibio."
    ]
  },
  {
    "id": "cafe-leche-brioche",
    "title": "Café con leche y brioche",
    "meal": "desayuno",
    "ingredients": ["Café con leche", "Brioche", "Mermelada naranjas", "Mantequilla"],
    "method": [
      "Prepara un café con leche abundante.",
      "Tuesta el brioche ligeramente.",
      "Unta con mantequilla y mermelada.",
      "Sirve acompañado del café."
    ]
  },
  {
    "id": "ensalada-rusa-verano",
    "title": "Ensalada rusa clásica",
    "meal": "comida",
    "ingredients": ["Patatas", "Zanahorias", "Guisantes", "Atún", "Huevos duros", "Mayonesa", "Aceitunas"],
    "method": [
      "Hierve patatas y zanahorias hasta que estén tiernas.",
      "Corta en dados uniformes.",
      "Mezcla con guisantes, atún y huevos picados.",
      "Añade mayonesa y decora con aceitunas."
    ]
  },
  {
    "id": "cocido-madrileno",
    "title": "Cocido madrileño completo",
    "meal": "comida",
    "ingredients": ["Garbanzos", "Espinacas", "Morcilla", "Chorizo", "Costilla cerdo", "Verduras", "Pan"],
    "method": [
      "Deja remojando los garbanzos 12 horas antes.",
      "Cocina el caldo con carnes durante 2 horas.",
      "Añade verduras y garbanzos.",
      "Sirve primero el caldo, luego garbanzos y carnes."
    ]
  },
  {
    "id": "paella-valenciana",
    "title": "Paella valenciana tradicional",
    "meal": "comida",
    "ingredients": ["Arroz bomba", "Pollo", "Conejo", "Judías verdes", "Garrofó", "Azafrán", "Caldo"],
    "method": [
      "Sofríe carne troceada en paellera.",
      "Añade verduras y sofríe junto.",
      "Incorpora arroz y caldos hirviendo con azafrán.",
      "Cocina 18 minutos sin remover."
    ]
  },
  {
    "id": "gazpacho-andaluz",
    "title": "Gazpacho andaluz refrescante",
    "meal": "comida",
    "ingredients": ["Tomates", "Pimientos", "Pepino", "Cebolla", "Ajo", "Aceite", "Vinagre", "Pan"],
    "method": [
      "Lava y trocea todas las verduras.",
      "Tritura todo junto en batidora potente.",
      "Cuela para eliminar皮ñas y semillas.",
      "Refrigera mínimo 4 horas antes de servir."
    ]
  },
  {
    "id": "fabada-asturiana",
    "title": "Fabada asturiana auténtica",
    "meal": "comida",
    "ingredients": ["Fabes asturianas", "Fabes", "Morcilla", "Chorizo", "Peladillas", "Aceite", "Sal"],
    "method": [
      "Remoja las fabes toda la noche.",
      "Cocina en olla con agua fría y sal.",
      "Añade morcilla y chorizo cuando hierva.",
      "Deja reposar antes de servir."
    ]
  },
  {
    "id": "croquetas-jamon",
    "title": "Croquetas de jamón ibérico",
    "meal": "comida",
    "ingredients": ["Jamón serrano", "Leche", "Manteca", "Harina", "Huevo", "Pan rallado", "Aceite"],
    "method": [
      "Haz un bechamel con manteca y harina.",
      "Añade leche poco a poco sin parar de remover.",
      "Incorpora jamón picado finamente.",
      "Forma croquetas, empana y fríe."
    ]
  },
  {
    "id": "patatas-bravas",
    "title": "Patatas bravas con salsa picante",
    "meal": "comida",
    "ingredients": ["Patatas", "Tomate", "Pimentón picante", "Harina", "Ajo", "Aceite", "Vinagre"],
    "method": [
      "Corta patatas en cubos irregulares y fríe.",
      "Para la salsa, sofríe ajo y añade tomate.",
      "Espesa con harina y condimenta con pimentón.",
      "Sirve las patatas bañadas en salsa."
    ]
  },
  {
    "id": "pulpo-gallaecia",
    "title": "Pulpo à la gallega",
    "meal": "comida",
    "ingredients": ["Pulpo fresco", "Patatas", "Pimentón dulce", "Pimentón picante", "Aceite", "Sal gorda"],
    "method": [
      "Hierve el pulpo 20-30 minutos según tamaño.",
      "Cuece patatas aparte hasta que estén tiernas.",
      "Trocea el pulpo y coloca sobre patatas.",
      "Espolvorea pimentón y aceite caliente."
    ]
  },
  {
    "id": "bacalao-pil-pil",
    "title": "Bacalao al pil-pil",
    "meal": "comida",
    "ingredients": ["Lomos de bacalao", "Aceite de oliva", "Ajos", "Perejil"],
    "method": [
      "Desala el bacalao 24 horas cambiando agua.",
      "Dora los ajos en aceite suave.",
      "Añade bacalao piel hacia abajo.",
      "Agita la cazuela hasta formar emulsión."
    ]
  },
  {
    "id": "tortilla-espanola",
    "title": "Tortilla de patatas española",
    "meal": "comida",
    "ingredients": ["Patatas", "Huevos", "Cebolla opcional", "Aceite de oliva", "Sal"],
    "method": [
      "Filetea patatas y cebolla finamente.",
      "Fríe en abundante aceite hasta dorar.",
      "Escurre y mezcla con huevos batidos.",
      "Cuaja en sartén 5 minutos por lado."
    ]
  },
  {
    "id": "rabo-toro",
    "title": "Rabo de toro estofado",
    "meal": "comida",
    "ingredients": ["Rabo de toro", "Vino tinto", "Cebolla", "Zanahoria", "Tomate", "Caldo"],
    "method": [
      "Sella el rabo sellado a fuego fuerte.",
      "Dora verduras picadas aparte.",
      "Cocina todo junto con vino y caldo 3 horas.",
      "Deja reducir hasta espesar."
    ]
  },
  {
    "id": "calamares-calamaritos",
    "title": "Calamares a la romana",
    "meal": "comida",
    "ingredients": ["Anillas de calamar", "Harina", "Limón", "Sal", "Aceite", "Ajo opcional"],
    "method": [
      "Lava y seca bien las anillas de calamar.",
      "Pásalas por harina mezclada con sal.",
      "Fríe en aceite muy caliente 2 minutos.",
      "Sirve inmediatamente con rodajas de limón."
    ]
  },
  {
    "id": "gambas-ajo",
    "title": "Gambas al ajillo",
    "meal": "cena",
    "ingredients": ["Gambas peladas", "Ajos", "Pimiento rojo", "Aceite", "Vino blanco", "Perejil"],
    "method": [
      "Calienta aceite en cazuela de barro.",
      "Dora los ajos laminados sin quemar.",
      "Añade gambas y saltea 3 minutos.",
      "Finaliza con vino, perejil y pimiento."
    ]
  },
  {
    "id": "espinacas-aflorones",
    "title": "Espinacas con garbanzos",
    "meal": "cena",
    "ingredients": ["Espinacas", "Garbanzos cocidos", "Ajos", "Pimentón", "Comino", "Aceite"],
    "method": [
      "Saltea ajos hasta dorar suavemente.",
      "Añade espinacas y sofríe 5 minutos.",
      "Mezcla con garbanzos calientes.",
      "Condimenta con pimentón y cominos."
    ]
  },
  {
    "id": "merluza-verdiales",
    "title": "Merluza en salsa verde",
    "meal": "cena",
    "ingredients": ["Lomos de merluza", "Perejil", "Ajos", "Vino blanco", "Caldo", "Harina"],
    "method": [
      "Pasa la merluza por harina ligera.",
      "Dora los ajos en aceite de oliva.",
      "Añade vino y caldo con perejil.",
      "Cocina la merluza 10 minutos en salsa."
    ]
  },
  {
    "id": "crema-calabaza",
    "title": "Crema de calabaza",
    "meal": "cena",
    "ingredients": ["Calabaza", "Puerro", "Patata", "Nata líquida", "Aceite", "Sal"],
    "method": [
      "Trocea calabaza, puerro y patata.",
      "Sofríe ligeramente el puerro.",
      "Añade verduras y cubre con agua.",
      "Tritura, añade nata y rectifica."
    ]
  },
  {
    "id": "sepia-calamar-guisada",
    "title": "Sepia guisada con guisantes",
    "meal": "cena",
    "ingredients": ["Sepia fresca", "Guisantes", "Cebolla", "Ajo", "Tomate", "Caldo"],
    "method": [
      "Trocea la sepia en dados.",
      "Dora cebolla y ajo picados.",
      "Añade sepia y guisantes.",
      "Cocina con tomate y caldo 15 minutos."
    ]
  },
  {
    "id": "boquerones-vinagre",
    "title": "Boquerones en vinagre",
    "meal": "cena",
    "ingredients": ["Boquerones frescos", "Vinagre", "Ajos", "Perejil", "Aceite", "Sal"],
    "method": [
      "Limpia y abre los boquerones.",
      "Marina en vinagre con sal 3 horas.",
      "Escurre y aliña con ajo picado.",
      "Rocía con aceite y perejil fresco."
    ]
  },
  {
    "id": "pimientos-rellenos",
    "title": "Pimientos rellenos de carne",
    "meal": "cena",
    "ingredients": ["Pimientos rojos grandes", "Carne picada", "Arroz", "Tomate", "Queso gratinar"],
    "method": [
      "Asa los pimientos y pélalos.",
      "Saltea carne picada con arroz y tomate.",
      "Rellena los pimientos.",
      "Gratina con queso al horno."
    ]
  },
  {
    "id": "revuelto-setas",
    "title": "Revuelto de setas y gambas",
    "meal": "cena",
    "ingredients": ["Setas variadas", "Gambas peladas", "Huevos", "Ajo", "Aceite", "Sal"],
    "method": [
      "Saltea las setas con ajo hasta dorar.",
      "Añade gambas y cocina 3 minutos más.",
      "Incorpora huevos batidos.",
      "Revuelve hasta cuajar los huevos."
    ]
  },
  {
    "id": "jamon-ibero-queso",
    "title": "Tabla de jamón y queso",
    "meal": "cena",
    "ingredients": ["Jamón ibérico", "Queso manchego", "Queso cabra", "Pan", "Nueces"],
    "method": [
      "Corta el jamón en lonchas finas.",
      "Filetea los quesos a tu gusto.",
      "Coloca todo ordenadamente en tabla.",
      "Acompaña con nueces y pan."
    ]
  },
  {
    "id": "arroz-negro",
    "title": "Arroz negro con sepia",
    "meal": "comida",
    "ingredients": ["Arroz", "Sepia", "Tinta de sepia", "Caldo", "Ajo", "Perejil", "Azafrán"],
    "method": [
      "Sofríe sepia troceada con ajo.",
      "Añade arroz y caldos con tinta.",
      "Cocina 18 minutos sin remover.",
      "Deja reposar 2 minutos antes."
    ]
  },
  {
    "id": "escabeche-pollo",
    "title": "Pollo en escabeche",
    "meal": "comida",
    "ingredients": ["Pollo troceado", "Zanahoria", "Cebolla", "Vinagre", "Vino blanco", " Laurel"],
    "method": [
      "Dora el pollo en todas sus caras.",
      "Sofríe verduras en la misma cazuela.",
      "Añade vinagre, vino y especias.",
      "Cocina lento 1 hora reposa 24h."
    ]
  },
  {
    "id": "caracoles-guisa",
    "title": "Caracoles a la extremeña",
    "meal": "comida",
    "ingredients": ["Caracoles", "Cordero picado", "Pimentón", "Perejil", "Caldo", "Laurel"],
    "method": [
      "Lava y purga los caracoles 2 días.",
      "Precocínalos en agua con hierbas.",
      "Sofríe carne y añade caracoles.",
      "Cocina con caldo y pimentón."
    ]
  },
  {
    "id": "pisto-manchez",
    "title": "Pisto manchego",
    "meal": "comida",
    "ingredients": ["Zucchini", "Pimiento rojo", "Pimiento verde", "Tomate", "Cebolla", "Huevos"],
    "method": [
      "Trocea todas las verduras.",
      "Sofríe cebolla y pimientos primero.",
      "Añade zucchini y finalmente tomate.",
      "Cocina lento 30 minutos y sirve con huevo."
    ]
  },
  {
    "id": "puchero-canarias",
    "title": "Puchero canario",
    "meal": "comida",
    "ingredients": ["Carne ternera", "Gallina", "Patatas", "Boniatos", "Verduras", "Garbanzos"],
    "method": [
      "Cocina carnes en abundante agua.",
      "Añade garbanzos después de 1 hora.",
      "Incorpora verduras y tubérculos.",
      "Sirve el caldo primero y luego sólidos."
    ]
  },
  {
    "id": "albondigas-salsa",
    "title": "Albóndigas en salsa de almendras",
    "meal": "comida",
    "ingredients": ["Carne mixta", "Leche", "Harina", "Almendras", "Vino", "Caldo", "Ajos"],
    "method": [
      "Forma albóndigas y fríe ligeramente.",
      "Hace la salsa con almendras fritas.",
      "Añade vino, caldo y especias.",
      "Cocina albóndigas 30 minutos en salsa."
    ]
  },
  {
    "id": "cordero-asado",
    "title": "Cordero lechal asado",
    "meal": "comida",
    "ingredients": ["Cordero lechal entero", "Romero", "Tomillo", "Ajos", "Aceite", "Sal gorda"],
    "method": [
      "Adorna el cordero con hierbas y ajo.",
      "Prepara horno a 200°C.",
      "Asa 2-3 horas según tamaño.",
      "Bañalo con jugos periódicamente."
    ]
  },
  {
    "id": "sartén-sardin",
    "title": "Sardinas a la plancha",
    "meal": "comida",
    "ingredients": ["Sardinas frescas", "Sal", "Limón", "Aceite"],
    "method": [
      "Limpia y sazona las sardinas.",
      "Calienta plancha hasta muy caliente.",
      "Cocina 3 minutos por lado.",
      "Sirve con rodajas de limón."
    ]
  },
  {
    "id": "ensal-caprese",
    "title": "Ensalada caprese",
    "meal": "comida",
    "ingredients": ["Tomates cherry", "Mozzarella fresca", "Albahaca", "Aceite", "Vinagre balsámico"],
    "method": [
      "Corta tomates y mozzarella en rodajas.",
      "Alterna en plato con hojas de albahaca.",
      "Rocía aceite y un toque de vinagre.",
      "Sazona con sal marina."
    ]
  },
  {
    "id": "avellana-zapato",
    "title": "Wrap de atún rápido",
    "meal": "comida",
    "ingredients": ["Tortilla de trigo", "Atún", "Maíz", "Lechuga", "Tomate", "Yogur"],
    "method": [
      "Mezcla atún con yogurt y maíz.",
      "Extiende sobre tortilla.",
      "Añade vegetales frescos.",
      " enrolla y corta en porciones."
    ]
  },
  {
    "id": "ensalada-quinoa",
    "title": "Ensalada de quinoa y vegetales",
    "meal": "comida",
    "ingredients": ["Quinoa", "Tomate", "Pepino", "Cebolla morada", "Aceitunas", "Aceite"],
    "method": [
      "Cuece quinoa y deja enfriar.",
      "Picar todos los vegetales finos.",
      "Mezcla todo junto.",
      "Aliña con aceite y limón."
    ]
  },
  {
    "id": "sandwich-tomate",
    "title": "Sandwich tostado italiano",
    "meal": "comida",
    "ingredients": ["Pan de molde integral", "Tomate", "Mozzarella", "Orégano", "Aceite"],
    "method": [
      "Coloca tomate y mozzarella entre panes.",
      "Añade orégano y aceite.",
      "Tuesta en sandwichera hasta fundir.",
      "Sirve caliente inmediatamente."
    ]
  },
  {
    "id": "gazpachuelo",
    "title": "Gazpachuelo malagueño",
    "meal": "comida",
    "ingredients": ["Patatas", "Calamares", "Mayonesa", "Ajo", "Aceite", "Perejil"],
    "method": [
      "Cuece patatas hasta tiernas.",
      "Saltea calamares rápidamente.",
      "Emulsiona con mayonesa y ajo.",
      "Mezcla todo y sirve frío."
    ]
  },
  {
    "id": "tacos-espanol",
    "title": "Wraps de pollo español",
    "meal": "comida",
    "ingredients": ["Peito de pollo", "Tortilla wrap", "Lechuga", "Tomate seco", "Queso"],
    "method": [
      "Marina pechuga con especias.",
      "Cocina a la plancha hasta dorar.",
      "Filetea y coloca sobre tortilla.",
      "Agrega vegetales y enrolla."
    ]
  },
  {
    "id": "solomillo-pepper",
    "title": "Solomillo con pimienta",
    "meal": "comida",
    "ingredients": ["Solomillo ternera", "Pimientas negras", "Coñac", "Crema", "Mantequilla"],
    "method": [
      "Sella solomillo a fuego fuerte.",
      "Añade pimientas machacadas.",
      "Desglasa con coñac y crema.",
      "Reduce salsa y sirva."
    ]
  },
  {
    "id": "pollo-rodeo",
    "title": "Pollo al horno con patatas",
    "meal": "comida",
    "ingredients": ["Muslos pollo", "Patatas", "Ajos", "Limón", "Romero", "Aceite"],
    "method": [
      "Marina pollo con ajo y limón.",
      "Coloca con patatas en bandeja.",
      "Hornea 45 minutos a 200°C.",
      "Bañar con jugos constantemente."
    ]
  },
  {
    "id": "ceviche-espanol",
    "title": "Ceviche de pescado español",
    "meal": "comida",
    "ingredients": ["Lenguado o rape", "Limón", "Cebolla", "Cilantro", "Jengibre", "Pimiento"],
    "method": [
      "Fileta pescado en tiras finas.",
      "Marina en zumo de limón 15 min.",
      "Añade cebolla y cilantro.",
      "Sirve muy frío inmediatamente."
    ]
  },
  {
    "id": "lomo-atun",
    "title": "Lomo de atún sellado",
    "meal": "comida",
    "ingredients": ["Lomo atún", "Sésamo", "Aceite", "Soja", "Jengibre", "Huevo"],
    "method": [
      "Seca el lomo de atún bien.",
      "Píntalo y pasa por sésamo.",
      "Sella 1 minuto por lado.",
      "Corta y acompaña con salsa."
    ]
  },
  {
    "id": "huevos-proteinicos",
    "title": "Huevos con espinacas y bacon",
    "meal": "comida",
    "ingredients": ["Huevos", "Espinacas", "Bacon", "Queso", "Sal", "Pimienta"],
    "method": [
      "Dora el bacon hasta crujiente.",
      "Saltea espinacas rápidamente.",
      "Añade huevos y cocina.",
      "Termina con queso fundido."
    ]
  },
  {
    "id": "tarta-casa",
    "title": "Tarta de queso al horno",
    "meal": "comida",
    "ingredients": ["Queso crema", "Huevos", "Azúcar", "Nata", "Base galleta", "Mermelada"],
    "method": [
      "Prepara base de galleta y mantequilla.",
      "Mezcla queso, huevos y azúcar.",
      "Cuece al baño maría 1 hora.",
      "Refrigera y sirve con mermelada."
    ]
  },
  {
    "id": "crema-catalana",
    "title": "Crema catalana tradicional",
    "meal": "comida",
    "ingredients": ["Leche", "Yemas", "Azúcar", "Maicena", "Canela", "Limón"],
    "method": [
      "Infusiona leche con canela y limón.",
      "Mezcla yemas con azúcar y maicena.",
      "Cuece espesando sin parar.",
      "Sirve con azúcar caramelizado."
    ]
  },
  {
    "id": "flan-caramelo",
    "title": "Flan casero de huevo",
    "meal": "comida",
    "ingredients": ["Huevos", "Leche condensada", "Leche entera", "Azúcar caramelo", "Vanilla"],
    "method": [
      "Prepara caramelo líquido en molde.",
      "Mezcla huevos y lácteos.",
      "Cuece al baño maría 50 minutos.",
      "Desmolda y sirve frío."
    ]
  },
  {
    "id": "arroz-crema",
    "title": "Arroz con leche clásico",
    "meal": "comida",
    "ingredients": ["Arroz redondo", "Leche", "Azúcar", "Canela", "Limón", "Nuez moscada"],
    "method": [
      "Lava el arroz varias veces.",
      "Cuece con leche, cáscara de limón.",
      "Añade azúcar y canela en rama.",
      "Servir caliente o frío con canela."
    ]
  },
  {
    "id": "churros-chocolate",
    "title": "Churros con chocolate caliente",
    "meal": "comida",
    "ingredients": ["Harina", "Agua", "Sal", "Azúcar", "Chocolate tableta", "Leche"],
    "method": [
      "Prepara masa con agua hirviendo.",
      "Extruye churros y fríe dorados.",
      "Para chocolate, cuece leche con chocolate.",
      "Sirve junto con churros espolvoreados."
    ]
  },
  {
    "id": "tocino-cielo",
    "title": "Tocino de cielo",
    "meal": "comida",
    "ingredients": ["Yemas", "Azúcar", "Agua", "Caramelo"],
    "method": [
      "Haz caramelo y recubre moldes.",
      "Mezcla yemas con almíbar templado.",
      "Cuece al baño maría lentamente.",
      "Desmolda y refrigera."
    ]
  },
  {
    "id": "buñuelos",
    "title": "Buñuelos de viento",
    "meal": "comida",
    "ingredients": ["Harina", "Agua", "Mantequilla", "Huevos", "Azúcar glass", "Canela"],
    "method": [
      "Hervir agua con mantequilla.",
      "Añade harina y mezcla.",
      "Incorpora huevos uno a uno.",
      "Fríe y espolvorea azúcar glass."
    ]
  },
  {
    "id": "mel-y-melon",
    "title": "Melón con jamón",
    "meal": "comida",
    "ingredients": ["Melón", "Jamón serrano", "Pimienta negra", "Aceite"],
    "method": [
      "Corta melón en trozos.",
      "Envuelve con lonchas de jamón.",
      "Añade pimienta recién molida.",
      "Sirve frío como entrante."
    ]
  },
  {
    "id": "yogur-fresa",
    "title": "Yogur con frutas del bosque",
    "meal": "comida",
    "ingredients": ["Yogur natural", "Fresas", "Arándanos", "Miel", "Menta"],
    "method": [
      "Lava y corta las frutas.",
      "Coloca yogur en copa.",
      "Añade frutas y miel.",
      "Decora con hojas de menta."
    ]
  },
  {
    "id": "ensalada-fruit",
    "title": "Ensalada de frutas tropical",
    "meal": "comida",
    "ingredients": ["Piña", "Mango", "Papaya", "Kiwi", "Miel", "Limón"],
    "method": [
      "Pelar y cortar todas las frutas.",
      "Mezclar en bowl grande.",
      "Rocía con limón y miel.",
      "Refrigera 1 hora antes."
    ]
  },
  {
    "id": "gelatina",
    "title": "Gelatina de frutas",
    "meal": "comida",
    "ingredients": ["Gelatina neutra", "Agua", "Frutas variadas", "Azúcar", "Zumos naturales"],
    "method": [
      "Hidrata gelatina en agua fría.",
      "Calienta jugos con azúcar.",
      "Mezcla gelatina y líquidos.",
      "Añade frutas y refrigera."
    ]
  },
  {
    "id": "peras-vino",
    "title": "Peras cocidas en vino tinto",
    "meal": "comida",
    "ingredients": ["Peras", "Vino tinto", "Azúcar", "Canela", "Clavos", "Cáscara limón"],
    "method": [
      "Pela las peras dejando tallo.",
      "Cuece en vino con especias.",
      "Reduce líquido hasta jarabe.",
      "Sirve frío con el jarabe."
    ]
  },
  {
    "id": "frico-higo",
    "title": "Higos rellenos de queso",
    "meal": "comida",
    "ingredients": ["Higos frescos", "Queso azul", "Nueces", "Miel", "Rúcula"],
    "method": [
      "Abre higos por la mitad.",
      "Rellena con queso y nueces.",
      "Añade rúcula y miel.",
      "Sirve como postre elegante."
    ]
  },
  {
    "id": "tartar-carne",
    "title": "Tartar de atún rojo",
    "meal": "comida",
    "ingredients": ["Atún rojo fresco", "Aguacate", "Sésamo", "Soya", "Wasabi", "Cebollino"],
    "method": [
      "Fileta atún en dados perfectos.",
      "Mezcla con aguacate y sésamo.",
      "Saona con soya y wasabi.",
      "Sirve inmediatamente decorado."
    ]
  },
  {
    "id": "ventreza",
    "title": "Ventrespa de atún",
    "meal": "comida",
    "ingredients": ["Ventresca atún", "Cebolla morada", "Limón", "Aceite", "Eneldo"],
    "method": [
      "Sella ventresca a fuego alto.",
      "Prepara ensalada de cebolla.",
      "Coloca ventresca encima.",
      "Aliña con limón y aceite."
    ]
  },
  {
    "id": "langostinos-gamba",
    "title": "Langostinos al ajillo",
    "meal": "comida",
    "ingredients": ["Langostinos vivos", "Ajos", "Pimentón", "Aceite", "Perifollo", "Pimienta"],
    "method": [
      "Limpia los langostinos.",
      "Sofríe ajos en aceite.",
      "Añade langostinos y saltea.",
      "Termina con perifollo fresco."
    ]
  },
  {
    "id": "lomo-lata",
    "title": "Lomo embuchado casero",
    "meal": "comida",
    "ingredients": ["Lomo cerdo", "Sal", "Pimienta", "Ajo", "Tripa natural"],
    "method": [
      "Sala el lomo curar 3 días.",
      "Embute en tripa limpia.",
      "Ahuma ligeramente según preferencia.",
      "Cura 3 semanas mínimo."
    ]
  },
  {
    "id": "croqueta-boletus",
    "title": "Croquetas de boletus",
    "meal": "comida",
    "ingredients": ["Boletus edulis", "Leche", "Mantequilla", "Harina", "Huevo", "Pan rallado"],
    "method": [
      "Limpia y trocea boletus.",
      "Hace bechamel con mantequilla.",
      "Mezcla hongos con bechamel.",
      "Forma, empana y fríe."
    ]
  },
  {
    "id": "hinojo-merluza",
    "title": "Merluza con hinojo",
    "meal": "comida",
    "ingredients": ["Merluza", "Hinojo bulboso", "Vino blanco", "Ajos", "Nata", "Perejil"],
    "method": [
      "Filetea hinojo en juliana.",
      "Saltea hasta ablandar.",
      "Coloca merluza encima.",
      "Cuece con vino y nata."
    ]
  },
  {
    "id": "pistilo",
    "title": "Pisto de berenjena",
    "meal": "comida",
    "ingredients": ["Berenjena", "Pimiento", "Tomate", "Cebolla", "Aceite", "Huevo"],
    "method": [
      "Filetea berenjena y saltea.",
      "Sofríe pimiento y cebolla.",
      "Añade tomate y cocina.",
      "Sirve con huevo frito."
    ]
  },
  {
    "id": "sopa-ajiaco",
    "title": "Ajiaco canario",
    "meal": "comida",
    "ingredients": ["Patatas", "Papa bonita", "Pepino", "Yuca", "Carne", "Gofio"],
    "method": [
      "Cuece carnes y tubérculos.",
      "Añade papas diferentes.",
      "Espesa con gofio.",
      "Sirve con mojo picón."
    ]
  },
  {
    "id": "mojarra",
    "title": "Mojarra frita",
    "meal": "comida",
    "ingredients": ["Mojarra entera", "Harina", "Sal", "Aceite", "Limón"],
    "method": [
      "Limpia la mojarra completamente.",
      "Pasa por harina y sal.",
      "Fríe en aceite caliente.",
      "Sirve caliente con limón."
    ]
  },
  {
    "id": "lechon",
    "title": "Lechón asado canario",
    "meal": "comida",
    "ingredients": ["Lechón", "Sal", "Comino", "Ajos", "Limón", "Romero"],
    "method": [
      "Adoba lechón 24 horas.",
      "Asa lentamente 4 horas.",
      "Bañar con jugos frecuentemente.",
      "Descansa antes de servir."
    ]
  },
  {
    "id": "gofio-escaldon",
    "title": "Gofio escaldado",
    "meal": "cena",
    "ingredients": ["Gofio", "Caldo pescado", "Pescado", "Patatas", "Aceite", "Sal"],
    "method": [
      "Cuece pescado y patatas.",
      "Disuelve gofio en caldo.",
      "Añade trozos de pescado.",
      "Sirve caliente inmediatamente."
    ]
  },
  {
    "id": "bienmesabe",
    "title": "Bienmesabe canario",
    "meal": "comida",
    "ingredients": ["Mermelada", "Miel", "Almendras", "Huevo", "Coco", "Zumo limón"],
    "method": [
      "Tuesta y muele almendras.",
      "Mezcla con miel y mermelada.",
      "Añade huevo y coco.",
      "Refrigerar 4 horas mínimo."
    ]
  }
];

});

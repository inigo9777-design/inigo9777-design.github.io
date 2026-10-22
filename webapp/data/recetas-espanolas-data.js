// modules/recetas-espanolas-data.js — Catálogo CURADO de recetas caseras SENCILLAS y cotidianas:
// base española (con muchos desayunos desde 2026-10-18) + sección final de recetas ITALIANAS de casa
// (últimos 20 registros, ids tipo "risotto-setas" etc.). No es lógica: es CONTENIDO fijo. Lógica PURe en cuanto a DOM/I/O → testeable con Node/Jest sin jsdom, igual que
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

  // Origen por receta para la etiqueta de UI (Española/Italiana): ids CURADOS del lote italiano
  // (los 20 añadidos 2026-10-18, ver cabecera del fichero). Se adjunta como PROPIEDAD del array
  // (module.exports sigue siendo un array puro: require() de tests/e2e no se ve afectado); el
  // módulo puro modules/origen-recetas.js la consume para decidir la etiqueta de cada vista.
  // Si se añade una receta italiana nueva, meter su id AQUÍ TAMBIÉN.
  dataset.idsItalianas = [
    "torta-mele", "tosta-ricotta-pistachos",
    "frittata-espinacas", "pasta-norma", "bruschetta-tomate", "pasta-pesto-genoves",
    "lasana-carne", "pizza-margarita", "risotto-setas", "pasta-carbonara",
    "pasta-aglio-olio", "pasta-amatriciana", "noquis-tomate-albahaca", "berenjena-parmigiana",
    "ossobuco-milan", "scaloppine-limon", "polenta-parmesano", "minestrone-verduras",
    "saltimbocca-romana", "tiramisu-casero"
  ];
  root.MRCheff.idsRecetasItalianas = dataset.idsItalianas;
})(typeof self !== 'undefined' ? self : this, function () {

return [
  {
    "id": "tostada-tomate-ajo",
    "title": "Tostada de tomate y ajo",
    "meal": "desayuno",
    "ingredients": ["Pan", "Tomates maduros", "Ajos", "Aceite de oliva virgen extra", "Sal"],
    "method": [
      "Tuesta las rebanadas de pan hasta que queden bien crujientes: van a recibir el jugo del tomate y no deben ablandarse por dentro.",
      "Mientras, pela un diente de ajo y córtalo en láminas. Fríelo en un chorrito de aceite a fuego suave 1-2 minutos, hasta que dore sin llegar a oscurecerse (se amarga si se quema).",
      "Frota la cara caliente de cada tostada con la mitad de un tomate maduro, hasta que su jugo penetre en la miga.",
      "Reparte las láminas de ajo dorado, riega con el aceite de freírlas, termina con una pizca de sal y sirve al momento."
    ]
  },
  {
    "id": "pan-con-tomate-catalan",
    "title": "Pan con tomate catalán",
    "meal": "desayuno",
    "ingredients": ["Pan de barra", "Tomates rojos", "Aceite de oliva", "Sal", "Jamón serrano opcional"],
    "method": [
      "Corta rebanadas gruesas de pan de barra y tuéstalas hasta que la corteza cruja.",
      "Frota cada rebanada caliente con la mitad cortada de un tomate maduro — de pera si lo tienes: lo que importa es su jugo, no arrastrar la pulpa entera.",
      "Riega con un buen chorro de aceite de oliva virgen extra al final, así la tostada mantiene su crujiente.",
      "Echa sal fina o en escamas y si quieres, corona con una loncha de jamón serrano al momento de servir."
    ]
  },
  {
    "id": "huevo-durillo",
    "title": "Huevos revueltos con durillo",
    "meal": "desayuno",
    "ingredients": ["Huevos", "Patatas", "Chorizo", "Cebolla", "Aceite de oliva", "Sal"],
    "method": [
      "Pela las patatas y córtalas en dados pequeños; pica también el chorizo en trozos parecidos para que se reparta bien.",
      "Sofríe las patatas en un poco de aceite a fuego medio 10-12 minutos, hasta que estén tiernas y doradas.",
      "Añade el chorizo (y la cebolla picada si usas) y cocina 3-4 minutos más, hasta que suelte su grasa y tintine: esa grasa sazona el revuelto.",
      "Bate los huevos con poca sal — el chorizo ya la aporta —.",
      "Vuelca los huevos sobre la sartén a fuego medio-bajo y remueve suave hasta que cuajen cremosos, retirándolos antes de que sequen.",
      "Sirve enseguida, bien caliente."
    ]
  },
  {
    "id": "batido-frutas-lacteos",
    "title": "Batido de frutas con lácteos",
    "meal": "desayuno",
    "ingredients": ["Leche", "Yogur natural", "Plátanos", "Fresas", "Miel", "Granola"],
    "method": [
      "Pela el plátano y lava las fresas; córtalas en trozos para que la batidora no se esfuerce.",
      "Echa en el vaso la fruta, el yogur y la leche bien fría; añade miel al gusto.",
      "Tritura 30-40 segundos a velocidad alta hasta que quede cremoso y sin trozos; si queda espeso, alarga con un poco más de leche.",
      "Sirve enseguida y termina con un hilo de miel y la granola por encima, justo al momento para que conserve su crujiente."
    ]
  },
  {
    "id": "tortita-avena-miel",
    "title": "Tortitas de avena y miel",
    "meal": "desayuno",
    "ingredients": ["Harina de avena", "Huevos", "Leche", "Miel", "Polvo de hornear", "Frutos rojos"],
    "method": [
      "Mezcla en un bol la harina de avena, los huevos, la leche y el polvo de hornear sin excederte al batir; si la masa reposa 5 minutos, las tortitas quedan más esponjosas.",
      "Calienta una sartén antiadherente a fuego medio-bajo sin aceite; deja caer una gota de masa: si sacude apenas burbujitas, está en su punto.",
      "Vierte porciones de unas tres cucharadas por tortita y cocina 2 minutos, hasta que asomen burbujas por la superficie y el borde se fije.",
      "Dales la vuelta con cuidado y cocina 1-2 minutos más, hasta que se doren.",
      "Sirve en caliente con miel por encima y frutos rojos frescos."
    ]
  },
  {
    "id": "bowl-yogur-granola",
    "title": "Bowl de yogur con granola",
    "meal": "desayuno",
    "ingredients": ["Yogur griego", "Granola casera", "Miel", "Semillas de chía", "Fruta fresca"],
    "method": [
      "Reparte el yogur griego en el fondo del bol, bien frío.",
      "Si usas semillas de chía, déjalas hincharse 5 minutos en el yogur (o en un poco de leche) para que no queden secas al cuchar.",
      "Añade la granola justo al momento de comer, así conserva su crujiente en vez de quedar dura embebida.",
      "Corona con la fruta fresca picada y termina con un hilo de miel."
    ]
  },
  {
    "id": "huevos-molletes",
    "title": "Huevos en mollete andaluz",
    "meal": "desayuno",
    "ingredients": ["Molletes de Antequera", "Huevos", "Aceite de oliva", "Sal", "Queso fresco"],
    "method": [
      "Abre los molletes por la mitad y tuéstalos en plancha o tostadora hasta que queden tostados por fuera y blandos dentro.",
      "Prepara los huevos al gusto: escalfados 3 minutos en agua a borbotones suaves con un chorrito de vinagre, o fritos con la yema jugosa.",
      "Reparte queso fresco en láminas sobre cada mollete y coloca el huevo encima.",
      "Riega con aceite de oliva virgen extra, un punto de sal sobre el huevo, y sirve enseguida mientras la yema corre sobre el pan."
    ]
  },
  {
    "id": "torrijas-desayuno",
    "title": "Torrijas ligeras de desayuno",
    "meal": "desayuno",
    "ingredients": ["Pan del día anterior", "Leche", "Miel", "Canela", "Huevo", "Aceite"],
    "method": [
      "Corta el pan del día anterior en rebanadas gruesas, de unos dos dedos: aguantan el remojo sin deshacerse.",
      "Calienta la leche con la miel y la canela (un trozo de piel de limón le va bien) sin que llegue a hervir, hasta que la miel se disuelva; déjala templar.",
      "Empapa las rebanadas en la leche por ambos lados un buen rato, hasta saturarlas, y déjalas escurrir unos segundos.",
      "Ándaselas por huevo batido cubriendo toda la superficie.",
      "Fríelas en aceite no demasiado caliente, 1-2 minutos por lado, hasta que se doren sin quemarse.",
      "Escúrrelas sobre papel de cocina, espolvorea canela y sirve tibias: del día siguiente también están buenas (mejor aún, frías)."
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
      "Lava patatas y zanahorias y hiérvelas ENTERAS en agua con sal 20-25 minutos, hasta que atraviesen con facilidad; enteras no absorben agua y dan dados limpios.",
      "Cuece los huevos 10 minutos, enfríalos en agua fría y pélalos.",
      "Deja templar las verduras (mejor aún, un rato en la nevera) antes de trocearlas en dados del mismo tamaño.",
      "Mezcla en un bol las patatas, la zanahoria, los guisantes (escaldados 3 minutos si son frescos), el atún escurrido y los huevos picados.",
      "Añade mayonesa poco a poco hasta alcanzar la textura que te gusta; prueba y rectifica de sal.",
      "Refrigera tapado mínimo 1 hora y sirve con aceitunas encima."
    ]
  },
  {
    "id": "cocido-madrileno",
    "title": "Cocido madrileño completo",
    "meal": "comida",
    "ingredients": ["Garbanzos", "Espinacas", "Morcilla", "Chorizo", "Costilla cerdo", "Verduras", "Pan"],
    "method": [
      "Deja los garbanzos en remojo 12 horas antes, en abundante agua fría.",
      "En una olla grande, cubre las carnes con agua fría, lleva apenas al hervor, desespuma y cocina a fuego manso 1 hora.",
      "Añade los garbanzos escurridos, el chorizo y la morcilla, y sigue 1 hora más: el caldo debe apenas borbollar, nunca hervir fuerte.",
      "Los últimos 20-25 minutos incorpora las verduras (espinacas y lo que tengas: zanahoria, puerro, repollo) hasta que estén tiernas.",
      "Saca un buen cazo de caldo y cuécelo ahí con fideos: ese es el primer vuelco, la sopa.",
      "Segundo vuelco: los garbanzos con las verduras por encima (aquí encaja alguna fritura de pan y ajo para el sabor).",
      "Tercer vuelco: las carnes del compango con la morcilla al centro. Al final, pan para untar con la morcilla."
    ]
  },
  {
    "id": "paella-valenciana",
    "title": "Paella valenciana tradicional",
    "meal": "comida",
    "ingredients": ["Arroz bomba", "Pollo", "Conejo", "Judías verdes", "Garrofó", "Azafrán", "Caldo"],
    "method": [
      "Dora el pollo y el conejo troceados en aceite caliente en la paellera, sin remover, 8-10 minutos hasta que queden bien dorados: ahí nace el sabor.",
      "Añade las judías verdes troceadas, el garrofó y sofríelos un par de minutos.",
      "Incorpora el arroz en cruz, remueve un minuto para que el grano se impregne del aceite sin que se dore en exceso.",
      "Vierte el caldo hirviendo con el azafrán — el doble de volumen que el arroz —, repártelo de una vez y no lo toques ya.",
      "Cocina a fuego fuerte 8 minutos; baja a suave 10 más, hasta que el arroz asome sobre el punto del líquido.",
      "Si quieres socarrat, da un golpe de fuego fuerte los últimos 30-60 segundos hasta notar el tostado.",
      "Deja reposar 5 minutos con un trapo encima antes de servir."
    ]
  },
  {
    "id": "gazpacho-andaluz",
    "title": "Gazpacho andaluz refrescante",
    "meal": "comida",
    "ingredients": ["Tomates", "Pimientos", "Pepino", "Cebolla", "Ajo", "Aceite", "Vinagre", "Pan"],
    "method": [
      "Lava los tomates maduros y córtalos en trozos; pela pepino, cebolla, ajo y pimiento.",
      "Tritura todo junto con la mitad del pan remojado, sal y un chorro de vinagre, hasta que quede fino.",
      "Añade el resto del pan remojado y vuelve a batir: queda algo más espeso y con cuerpo.",
      "Cuela con un colador fino para eliminar pieles y semillas: el gazpacho gana sedosidad.",
      "Con la batidora en marcha, añade el aceite en hilo fino: así emulsiona y no se corta.",
      "Prueba y ajusta de vinagre y sal; refrigera mínimo 4 horas y sirve muy frío con menudito de tomate y pepino encima."
    ]
  },
  {
    "id": "fabada-asturiana",
    "title": "Fabada asturiana auténtica",
    "meal": "comida",
    "ingredients": ["Fabes asturianas", "Fabes", "Morcilla", "Chorizo", "Peladillas", "Aceite", "Sal"],
    "method": [
      "Deja las fabes en remojo la noche anterior, 12 horas mínimo, en agua fría.",
      "Ponlas en la olla con agua fría que las cubra dos dedos y añade el chorizo y la morcilla lavados.",
      "Lleva apenas al hervor, baja el fuego al mínimo: deben quedar como si apenas se movieran, unas 2 horas.",
      "Comprueba de vez en cuando que el agua siga cubriendo; si baja, añade SIEMPRE agua caliente, nunca fría.",
      "No remuevas con cuchara: sacude la olla de vez en cuando; así las fabes no se rompen.",
      "Al final, si quieres espesar la salsa, machaca unas fabes contra la pared y mézclalas: engomarán el caldo natural.",
      "Apaga, rectifica de sal al final (el compango ya aporta) y deja reposar 10 minutos antes de servir."
    ]
  },
  {
    "id": "croquetas-jamon",
    "title": "Croquetas de jamón ibérico",
    "meal": "comida",
    "ingredients": ["Jamón serrano", "Leche", "Manteca", "Harina", "Huevo", "Pan rallado", "Aceite"],
    "method": [
      "Derrite la manteca a fuego medio, añade la harina y remueve 2 minutos para que se cueza: es la base de la bechamel.",
      "Añade la leche caliente poco a poco, sin parar de remover, durante unos 10 minutos, hasta una bechamel ESPESA que se vea el fondo de la sartén.",
      "Incorpora el jamón picado fino, prueba la sal (con cuidado, el jamón ya sala), y pasa la masa a una fuente.",
      "Refrigera tapada 3-4 horas (mejor de un día para otro): sólo así la masa forma croquetas limpias.",
      "Forma croquetas con dos cucharas húmedas y empáñalas: huevo batido primero, pan rallado después.",
      "Fríe en tandas pequeñas en aceite a 180 °C (un trozo de pan debe hacer burbujas al caer) 2-3 minutos, hasta que estén doradas por igual.",
      "Escrurre sobre papel de cocina y sirve enseguida, estallando calor."
    ]
  },
  {
    "id": "patatas-bravas",
    "title": "Patatas bravas con salsa picante",
    "meal": "comida",
    "ingredients": ["Patatas", "Tomate", "Pimentón picante", "Harina", "Ajo", "Aceite", "Vinagre"],
    "method": [
      "Pela las patatas y córtalas en cubos grandes e irregulares; sécalos bien con papel para que se doren en vez de hervirse.",
      "Fríe en aceite caliente — o ásalos al horno con un hilo de aceite a 200 °C unos 35 minutos — hasta que queden dorados fuera y blandos dentro; sala ya fuera del aceite.",
      "Para la salsa, sofríe el ajo picado un minuto en un hilo de aceite, sin que tome color fuerte.",
      "Añade el tomate triturado y cocina 10 minutos, hasta que pierda su agua cruda.",
      "Fuera del fuego, añade el pimentón picante (se amarga si se quema) y una cucharada de harina removiendo; vuelve al fuego 2-3 minutos y termina con un chorro de vinagre.",
      "Sirve las patatas bañadas en salsa — o la salsa salpicando encima — al momento."
    ]
  },
  {
    "id": "pulpo-gallaecia",
    "title": "Pulpo à la gallega",
    "meal": "comida",
    "ingredients": ["Pulpo fresco", "Patatas", "Pimentón dulce", "Pimentón picante", "Aceite", "Sal gorda"],
    "method": [
      "Si el pulpo es fresco, congélalo 24-48 horas: ablanda su carne; descongélalo luego en la nevera.",
      "Lleva un cazo grande con agua (sin sal) y dos hojas de laurel a hervor.",
      "Sumerge el pulpo tres veces, sosteniéndolo unos segundos y retirándolo: así no se destroza la piel al hervir.",
      "Cocina 25-40 minutos según tamaño; pincha con una punta de cuchillo: cuando entre con facilidad, ya está.",
      "Deja que repose 10 minutos en su propio agua antes de trocearlo: descansado queda más jugoso.",
      "Cuece las patatas en ese mismo agua y sirve el pulpo sobre ellas, rociado con aceite caliente, espolvoreado de los dos pimentones y sal gorda."
    ]
  },
  {
    "id": "bacalao-pil-pil",
    "title": "Bacalao al pil-pil",
    "meal": "comida",
    "ingredients": ["Lomos de bacalao", "Aceite de oliva", "Ajos", "Perejil"],
    "method": [
      "Desala el bacalao 24 horas cambiando el agua tres veces y sécalo muy bien con papel.",
      "Calienta el aceite frío con los ajos laminados a fuego suave hasta que tomen color; retíralos antes de que oscurezcan.",
      "Coloca los lomos en su aceite con la PIEL ARRIBA y manten el fuego mínimo, apenamente burbujeando, unos 6-8 minutos: la gelatina sale de la piel.",
      "Retira del fuego, saca el bacalao con cuidado y menea la cazuela en movimientos circulares hasta que el aceite se convierta en una emulsión blanca y espesa: eso es el pil-pil.",
      "Si cuesta ligar, añade una cucharadita de agua fría y sigue agitando: jamás a fuego fuerte, se cortaría.",
      "Reparte la salsa por encima, recupera los ajos dorados, espolvorea perejil y sirve enseguida."
    ]
  },
  {
    "id": "tortilla-espanola",
    "title": "Tortilla de patatas española",
    "meal": "comida",
    "ingredients": ["Patatas", "Huevos", "Cebolla opcional", "Aceite de oliva", "Sal"],
    "method": [
      "Lamina las patatas finas (3 mm) y pica la cebolla si la usas; sala la patata.",
      "Fríe a fuego medio en aceite abundante sin que humee, 15-20 minutos, hasta que las patatas quebracen fáciles al pinchar; añade la cebolla a mitad de camino.",
      "Escurre muy bien y mezcla con los huevos batidos y salados; deja reposar la mezcla 5 minutos para integrarla.",
      "Vuelca en una sartén limpia con un hilo de aceite a fuego medio-bajo y cuaja 4-6 minutos, limpiando los bordes con espátula.",
      "Dale la vuelta con ayuda de un plato grande y cuaja 3-4 minutos más, al punto que prefieras: mejor jugos que seca."
    ]
  },
  {
    "id": "rabo-toro",
    "title": "Rabo de toro estofado",
    "meal": "comida",
    "ingredients": ["Rabo de toro", "Vino tinto", "Cebolla", "Zanahoria", "Tomate", "Caldo"],
    "method": [
      "Sazona el rabo en trozos y séllalo por todas sus caras a fuego fuerte, 2-3 minutos por cara, hasta que tome color tostado; reserva.",
      "Sofríe en el mismo aceite cebolla, zanahoria y ajo picados 8-10 minutos, hasta que se ablanden.",
      "Añade el tomate rallado o triturado y cocina 5 minutos para perder el crudo.",
      "Devuelve el rabo, moja con el vino tinto y deja evaporar un minuto rasparando el fondo.",
      "Cubre con caldo hasta rozar la carne, tapa y cocina a fuego manso 2,5-3 horas (en olla exprés, 60-70 minutos).",
      "Al final, destapa y reduce la salsa 10-15 minutos hasta que caiga con densidad de jarabe.",
      "Deja reposar 10 minutos antes de servir; si puedes, hazlo el día antes: mejora en su jugo."
    ]
  },
  {
    "id": "calamares-calamaritos",
    "title": "Calamares a la romana",
    "meal": "comida",
    "ingredients": ["Anillas de calamar", "Harina", "Limón", "Sal", "Aceite", "Ajo opcional"],
    "method": [
      "Seca muy bien las anillas con papel de cocina: la humedad rompe la fritura.",
      "Mezcla la harina con sal (y ajo en polvo si te gusta) y pasa las anillas una a una, sacudiendo el exceso para una bola de harina fina y ligera.",
      "Calienta abundante aceite a 180 °C, hasta que un trozo de pan chispee al caer.",
      "Fríe en tandas pequeñas 90 segundos-2 minutos, hasta que tomen color dorado; si apañas en tandas el aceite no baja de temperatura.",
      "Escurre sobre papel, alterna con sal fina y sirve al momento con rodajas de limón: apenas salen es cuando están en su punto."
    ]
  },
  {
    "id": "gambas-ajo",
    "title": "Gambas al ajillo",
    "meal": "cena",
    "ingredients": ["Gambas peladas", "Ajos", "Pimiento rojo", "Aceite", "Vino blanco", "Perejil"],
    "method": [
      "Calienta el aceite en una cazuela de barro con los ajos laminados a fuego medio-suave; dora 1-2 minutos hasta que levanten aroma, sin que se oscurezcan.",
      "Añade el pimiento rojo picado y, si te gustan, una guindilla.",
      "Incorpora las gambas secas y saladas; saltea 1-2 minutos por lado, hasta que cambien de color justo: màs tiempo seca.",
      "Moja con el vino blanco y deja evaporar 30-45 segundos.",
      "Fuera del fuego, mezcla con perejil picado y sirve en la propia cazuela con pan para mojar."
    ]
  },
  {
    "id": "espinacas-aflorones",
    "title": "Espinacas con garbanzos",
    "meal": "cena",
    "ingredients": ["Espinacas", "Garbanzos cocidos", "Ajos", "Pimentón", "Comino", "Aceite"],
    "method": [
      "Lava y escurre las espinacas; corta los tallos más gruesos.",
      "Dora los ajos laminados en aceite hasta que toquen el dorado; añade el comino machacado un minuto y, FUERA del fuego, el pimentón para que no se queme.",
      "Vierte las espinacas de golpe y saltea 4-5 minutos, hasta que se marchiten y suelten su agua.",
      "Incorpora los garbanzos escurridos y un medio vaso de agua; cuece tapado 10 minutos a fuego suave hasta que liguen.",
      "Prueba de sal al final y deja reposar 5 minutos tapado: las espinacas absorben los aromas."
    ]
  },
  {
    "id": "merluza-verdiales",
    "title": "Merluza en salsa verde",
    "meal": "cena",
    "ingredients": ["Lomos de merluza", "Perejil", "Ajos", "Vino blanco", "Caldo", "Harina"],
    "method": [
      "Seca los lomos de merluza y sálalos; pásalos por harina ligera sacudiendo el exceso.",
      "Dora el ajo picado en aceite de oliva a fuego medio, hasta que suelte aromas sin tomar color.",
      "Coloca la merluza PIEL ABAJO (si la lleva) y séllala 2 minutos sin moverla; dale la vuelta con cuidado.",
      "Moja con el vino blanco y el caldo, añade el perejil picado abundante y deja reducir a fuego suave 6-8 minutos, moviendo la sartén en círculos: así la salsa verde se liga sin batir nada.",
      "Rectifica de sal al final y sirve la merluza bañada con su salsa templada."
    ]
  },
  {
    "id": "crema-calabaza",
    "title": "Crema de calabaza",
    "meal": "cena",
    "ingredients": ["Calabaza", "Puerro", "Patata", "Nata líquida", "Aceite", "Sal"],
    "method": [
      "Trocea la calabaza en cubos; pica el puerro y pela la patata (da cuerpo a la crema).",
      "Sofríe el puerro en un hilo de aceite 5 minutos a fuego medio, hasta que se ablande sin tomar color.",
      "Añade la calabaza y la patata, cubre con agua o caldo hasta casi cubrir y cuece a fuego suave 20-25 minutos, hasta que cedan al pinchar.",
      "Tritura hasta que quede una crema lisa, sin grumos de calabaza.",
      "Regresa al fuego, añade la nata y rectifica de sal y pimienta; si queda espesa, alarga con un poco de agua caliente.",
      "Sirve con un hilo de aceite crudo por encima."
    ]
  },
  {
    "id": "sepia-calamar-guisada",
    "title": "Sepia guisada con guisantes",
    "meal": "cena",
    "ingredients": ["Sepia fresca", "Guisantes", "Cebolla", "Ajo", "Tomate", "Caldo"],
    "method": [
      "Trocea la sepia limpia en dados generosos: se encogen al guisar.",
      "Sofríe la cebolla y el ajo picados en aceite 6-8 minutos, hasta que queden traslúcidos.",
      "Añade la sepia, sube un poco el fuego y saltea 2-3 minutos para sellarla.",
      "Echa el tomate rallado y cocina 5 minutos, hasta que pierda el agua cruda.",
      "Agrega los guisantes y cubre casi con caldo; guisa a fuego suave 15 minutos, hasta que la sepia esté blanda.",
      "Rectifica de sal y deja reposar 5 minutos antes de servir; si quieres salsa más ligada, tritúrale un pedazo de cebolla del guiso."
    ]
  },
  {
    "id": "boquerones-vinagre",
    "title": "Boquerones en vinagre",
    "meal": "cena",
    "ingredients": ["Boquerones frescos", "Vinagre", "Ajos", "Perejil", "Aceite", "Sal"],
    "method": [
      "Abre los boquerones quitando cabeza, espina y tripas, y acláralos brevemente bajo el grifo.",
      "Mezcla vinagre, agua fría y sal generosa en un cuenco y sumerge los filetes hasta que queden cubiertos.",
      "Refrigera 3 horas mínimo: verás cómo la carne pasa a blanca — si prefieres más suaves, hasta 24 horas.",
      "Escurre y aclara un poco con agua para rebajar el ácido; sécalos sin machacarlos.",
      "Añade ajos picados y perejil y cubre con aceite de oliva; conserva refrigerado y consume pronto."
    ]
  },
  {
    "id": "pimientos-rellenos",
    "title": "Pimientos rellenos de carne",
    "meal": "cena",
    "ingredients": ["Pimientos rojos grandes", "Carne picada", "Arroz", "Tomate", "Queso gratinar"],
    "method": [
      "Asa los pimientos enteros al horno a 200 °C durante 25-30 minutos, dándoles media vuelta a mitad de tiempo, hasta que la piel se arrugue.",
      "Mételos tapados 10 minutos al salir (se pelan mejor), pela con cuidado conservando la forma y quita las semillas.",
      "Para el relleno, sofríe cebolla picada, dora la carne picada 5 minutos, añade tomate y cocina 10-15 minutos hasta que ligue; mezcla con arroz ya cocido (así no te quedará crudo dentro).",
      "Rellena los pimientos con la mezcla tibia y colócalos en una fuente.",
      "Cubre con queso rallado y gratina en el horno fuerte 8-10 minutos, hasta que se haga una costra dorada; sirve enseguida."
    ]
  },
  {
    "id": "revuelto-setas",
    "title": "Revuelto de setas y gambas",
    "meal": "cena",
    "ingredients": ["Setas variadas", "Gambas peladas", "Huevos", "Ajo", "Aceite", "Sal"],
    "method": [
      "Limpia las setas con papel húmedo — no las mojes de golpe: se empapan — y trocea las grandes.",
      "Sofríe el ajo picado 30 segundos en aceite y añade las setas a fuego fuerte: así sueltan su agua y se doran en vez de hervirse; cocina 5-6 minutos y sala.",
      "Añade las gambas secas y saltea 2 minutos, hasta que cambien de color apenas.",
      "Bate los huevos con sal y viértelos FUERA del fuego, removiendo suave hasta cuajar cremosos y con cuerpo.",
      "Sirve al momento, con pan tostado si te apetece."
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
      "Sofríe la sepia troceada con el ajo picado en la paellera 3-4 minutos, hasta que cambie de color.",
      "Disuelve la tinta de sepia en un cazo de caldo caliente y añádela: verás cómo se tiñe todo de negro.",
      "Agrega el arroz, remueve un minuto para tostar al grano y vierte el resto del caldo caliente — el doble de volumen — repartido por toda la paellera.",
      "Cocina a fuego fuerte 8 minutos y a suave 10 más, SIN remover más ni mover la paellera.",
      "Al final debe quedar apenas caldoso, no sopa; si te faltase líquido, moja un poco más por los cantos.",
      "Deja reposar 2 minutos tapado y sirve con perejil picado por encima."
    ]
  },
  {
    "id": "escabeche-pollo",
    "title": "Pollo en escabeche",
    "meal": "comida",
    "ingredients": ["Pollo troceado", "Zanahoria", "Cebolla", "Vinagre", "Vino blanco", " Laurel"],
    "method": [
      "Seca el pollo troceado y dóralo por todas sus caras en aceite de oliva, 6-8 minutos; sácalo y reserva.",
      "Sofríe la cebolla y la zanahoria en rodajitas 8 minutos en ese aceite; añade el ajo picado los últimos minutos junto al laurel.",
      "Vuelve el pollo, moja con el vino y un buen chorro de vinagre, y completa con agua casi cubriéndolo.",
      "Cocina a fuego manso 45-60 minutos, tapado, hasta que la carne ceda del hueso.",
      "Rectifica de sal al final (el escabeche se afina frio).",
      "Enfría completo y refrigera mínimo 24 horas: se sirve FRÍO y mejora cada día que pasa."
    ]
  },
  {
    "id": "caracoles-guisa",
    "title": "Caracoles a la extremeña",
    "meal": "comida",
    "ingredients": ["Caracoles", "Cordero picado", "Pimentón", "Perejil", "Caldo", "Laurel"],
    "method": [
      "Purga los caracoles 2 días en agua con sal, cambiando el agua cada día: sueltan la tierra.",
      "Escáldalos 20 minutos en agua hirviendo con laurel; escúrrelos y reserva un poco de ese agua.",
      "Sofríe el cordero picado en aceite a fuego fuerte 6-8 minutos, hasta que dore bien.",
      "Añade el pimentón FUERA del fuego — se quema fácil — y remueve rápido; junta el laurel y el perejil.",
      "Incorpora los caracoles y moja con caldo (o con su agua de cocción) hasta cubrir.",
      "Guisa tapado a fuego bajo 45-60 minutos, hasta que la salsa tome cuerpo sin secarse.",
      "Rectifica de sal y deja reposar 10 minutos antes de servir: los caracoles ganan con el reposo."
    ]
  },
  {
    "id": "pisto-manchez",
    "title": "Pisto manchego",
    "meal": "comida",
    "ingredients": ["Zucchini", "Pimiento rojo", "Pimiento verde", "Tomate", "Cebolla", "Huevos"],
    "method": [
      "Trocea a dados iguales la cebolla, los pimientos y el calabacín, para que todo alcance su punto a la vez.",
      "Sofríe la cebolla en aceite a fuego medio 8-10 minutos, hasta que quede transparente.",
      "Añade los pimientos y cocina 5 minutos más.",
      "Echa el calabacín, sala apenas — suelta agua — y cocina 10 minutos.",
      "Agrega el tomate rallado, tapa y baja a fuego suave 20-25 minutos, removiendo de vez en cuando: el pisto debe quedar denso, brillante de aceite y sin caldo.",
      "Sirve tapado con huevos fritos encima (yema jugosa) o revuelto integrando los huevos batidos al final."
    ]
  },
  {
    "id": "puchero-canarias",
    "title": "Puchero canario",
    "meal": "comida",
    "ingredients": ["Carne ternera", "Gallina", "Patatas", "Boniatos", "Verduras", "Garbanzos"],
    "method": [
      "Deja los garbanzos en remojo la noche anterior (o usa precocidos igualmente).",
      "Cuece las carnes (ternera y gallina) cubiertas de agua fría; desespuma en cuanto burbujea y cocina 1 hora y media a fuego manso.",
      "Añade los garbanzos escurridos y sigue 1 hora a fuego manso.",
      "Los últimos 30-40 minutos añade las patatas, los boniatos y las verduras (col, calabacín, cebolla entera).",
      "Saca un buen cazo de caldo para el primer vuelco (si te gusta, con fideos o gofio).",
      "Segundo vuelco: los tubérculos, las verduras y la carne repartidos con mojo picón y mojo verde para untar."
    ]
  },
  {
    "id": "albondigas-salsa",
    "title": "Albóndigas en salsa de almendras",
    "meal": "comida",
    "ingredients": ["Carne mixta", "Leche", "Harina", "Almendras", "Vino", "Caldo", "Ajos"],
    "method": [
      "Mezcla la carne con el ajo picado, perejil y un chorrito de leche; forma albóndigas pequeñas y refrigera 20 minutos para que se compacten.",
      "Pásalas por harina fina sacudiendo el exceso y dóralas en aceite caliente 2-3 minutos: nada de cocerlas del todo, sólo sellarlas; reserva en su aceite.",
      "En la misma cazuela, sofríe unas almendras (o tostadas previamente) con un diente de ajo y tritúralas con un poca de caldo hasta lograr salsa acristalada.",
      "Vuelca la crema en la cazuela, moja con vino (deja evaporar 1 minuto) y el resto del caldo; lleva a burbujear suavemente.",
      "Introduce las albóndigas y cocínalas TAPADAS 25-30 minutos a fuego suave, hasta que la salsa esté ligada y las albóndigas tiernas.",
      "Rectifica de sal y sirve; si puedes, hazlo el día antes: la salsa se intensifica."
    ]
  },
  {
    "id": "cordero-asado",
    "title": "Cordero lechal asado",
    "meal": "comida",
    "ingredients": ["Cordero lechal entero", "Romero", "Tomillo", "Ajos", "Aceite", "Sal gorda"],
    "method": [
      "Sazona el cordero con sal gorda por toda la piel y la carne; pinta con aceite y reparte los ajos laminados, el romero y el tomillo por encima.",
      "Colócalo en una fuente baja con UN DEDO de agua (o vino blanco) en el fondo del plato: evita que se seque y aporta jugo para bañar.",
      "Precalienta el horno a 200 °C y asa a media altura.",
      "Cuenta unos 60-90 minutos (2 horas si la pieza es grande): deteniendo cada 20 minutos para repasar jugos, y si baja el fondo, añade agua caliente.",
      "Al final, sube a 220 °C o gratína 10 minutos para que la piel quede crocante.",
      "Deja reposar tapado 10 minutos antes de cortar: los jugos se recolocan y la carne queda más ternosa."
    ]
  },
  {
    "id": "sartén-sardin",
    "title": "Sardinas a la plancha",
    "meal": "comida",
    "ingredients": ["Sardinas frescas", "Sal", "Limón", "Aceite"],
    "method": [
      "Lava las sardinas y quita la tripa sacándola por la abertura; sécalas por fuera con papel.",
      "Espolvorea sal por la piel.",
      "Calienta la plancha hasta verla humear: muy caliente, para que no se peguen.",
      "Colócalas una al lado de la otra sin amontonar y cocina 2-3 minutos; dales la vuelta apenas.",
      "Retira al punto, rocía con aceite crudo y sirve con limón al momento."
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
      "Escurre muy bien el atún — el aceite reblandece el wrap — y mezcla en un bol con el yogur, el maíz, sal y pimienta.",
      "Pica el tomate en dados pequeños y añádelos al final, para que su jugo no moje la tortilla.",
      "Calienta cada tortilla 10-15 segundos por lado en plancha (o unos segundos al microondas): así se flexiona sin romperse.",
      "Reparte la mezcla de atún en el centro de cada tortilla y coloca encima las hojas de lechuga.",
      "Enrolla apretando los extremos, corta en porciones diagonales y sirve fresquito."
    ]
  },
  {
    "id": "ensalada-quinoa",
    "title": "Ensalada de quinoa y vegetales",
    "meal": "comida",
    "ingredients": ["Quinoa", "Tomate", "Pepino", "Cebolla morada", "Aceitunas", "Aceite"],
    "method": [
      "Enjuaga la quinoa bajo el grifo y escúrrela: así desaparece el sabor amargo.",
      "Cuece con el doble de agua ya salada 12-15 minutos, hasta que el grano pierda su punto crudo; escurre y deja que se enfríe sin tapar.",
      "Mientras, pica el tomate, el pepino y la cebolla morada en dados pequeños; añade las aceitunas en rodajas.",
      "Une todo en un bol y aliña con aceite de oliva, zumo de limón, sal y pimienta.",
      "Refrigera un rato para servir fresca: el sabor se asienta mejor de lo que parece."
    ]
  },
  {
    "id": "sandwich-tomate",
    "title": "Sandwich tostado italiano",
    "meal": "comida",
    "ingredients": ["Pan de molde integral", "Tomate", "Mozzarella", "Orégano", "Aceite"],
    "method": [
      "Corta las rodajas de tomate y déjalas escurrir 5 minutos sobre papel: si van muy jugosas, el pan se blanquea.",
      "Coloca tomate y láminas de mozzarella entre dos rebanadas de pan.",
      "Añade con un toque de orégano, un chorro de aceite y una pizca de sal.",
      "Tuesta en sandwichera 5-7 minutos, hasta que el queso funda y el pan hornee un poco.",
      "Corta en diagonal y come al momento: en cuanto sale, es cuando está en su punto."
    ]
  },
  {
    "id": "gazpachuelo",
    "title": "Gazpachuelo malagueño",
    "meal": "comida",
    "ingredients": ["Patatas", "Calamares", "Mayonesa", "Ajo", "Aceite", "Perejil"],
    "method": [
      "Pela y corta las patatas en dados y cuece 15-20 minutos en agua con sal, hasta que estén tiernas; deja que sigan en su caldo.",
      "Saltea los calamares limpios 2-3 minutos con el ajo picado en un hilo de aceite y añádelos al caldo de las patatas.",
      "En un cuenco, desliza la mayonesa con medio vaso del mismo caldo CALIENTE, removiendo desde el fondo hasta diluirla sin grumos.",
      "Vierte esa mezcla al caldo y da 5 minutos a fuego bajo removiendo SIEMPRE: espesa sin cortarse; no dejes que hierva de golpe.",
      "Rectifica de sal y sirve BIEN CALIENTE en platos hondos, con perejil picado por encima y pan aparte."
    ]
  },
  {
    "id": "tacos-espanol",
    "title": "Wraps de pollo español",
    "meal": "comida",
    "ingredients": ["Peito de pollo", "Tortilla wrap", "Lechuga", "Tomate seco", "Queso"],
    "method": [
      "Marina la pechuga 30 minutos con sal, pimienta, pimentón y un poco de aceite: gana sabor y queda más tierna.",
      "Hazla a la plancha bien caliente, 3-4 minutos por lado, hasta que se dore sin secarse.",
      "Filetea a favor de la fibra — las tiras quedan más blandas al masticar.",
      "Calienta cada tortilla 10-15 segundos por lado para que se flexione.",
      "Reparte las tiras de pollo y las hojas de lechuga, el tomate seco troceado y el queso; enrolla con los extremos metidos y sirve."
    ]
  },
  {
    "id": "solomillo-pepper",
    "title": "Solomillo con pimienta",
    "meal": "comida",
    "ingredients": ["Solomillo ternera", "Pimientas negras", "Coñac", "Crema", "Mantequilla"],
    "method": [
      "Seca el solomillo y márcalo por todas sus caras en mantequilla con aceite, 2 minutos por cara (5-6 en total); resérvalo si lo quieres rosado al centro.",
      "En la misma sartén añade las pimientas machacadas y espera 30 segundos a que suelten su aroma.",
      "Desglasa con el coñac, rasparando el fondo para el dorado.",
      "Añade la nata y reduce 3-4 minutos a fuego suave, hasta que la salsa cubra la cuchara.",
      "Deja reposar el solomillo 5 minutos antes de cortar; corta medallones y baña con la salsa de coñac y pimienta."
    ]
  },
  {
    "id": "pollo-rodeo",
    "title": "Pollo al horno con patatas",
    "meal": "comida",
    "ingredients": ["Muslos pollo", "Patatas", "Ajos", "Limón", "Romero", "Aceite"],
    "method": [
      "Pon los muslos en un bol con zumo de limón, ajos machacados, romero, sal y un hilo de aceite; marina 30 minutos si puedes.",
      "Reparte las patatas en cuñas en la bandeja con un hilo de aceite; coloca el pollo encima.",
      "Hornea a 200 °C 45-50 minutos; baña con la propia línea cada 15 minutos y, si anda secándose, moja un poco más el fondo.",
      "Comprueba levantando un muslo: la carne cede y el jugo sale claro, no rosado.",
      "Deja reposar 5 minutos antes de llevar a la mesa, para que los jugos se asientan."
    ]
  },
  {
    "id": "ceviche-espanol",
    "title": "Ceviche de pescado español",
    "meal": "comida",
    "ingredients": ["Lenguado o rape", "Limón", "Cebolla", "Cilantro", "Jengibre", "Pimiento"],
    "method": [
      "Corta el pescado — muy fresco, mejor del día — en dados de 1 cm, sin espinas, y sécalos con papel.",
      "Marínalos en la nevera con zumo de limón recién exprimido, justo hasta cubrir, 15-20 minutos: más tiempo lo vuelve gomoso.",
      "Añade la cebolla roja en pluma bien fina, el cilantro picado, el jengibre rallado y el pimiento en daditos; sal y un hilo de aceite.",
      "Mezcla bien y deja asentar 5 minutos.",
      "Sirve EN EL MOMENTO, muy frío, con un poco más de zumo por encima si te gusta el ácido."
    ]
  },
  {
    "id": "lomo-atun",
    "title": "Lomo de atún sellado",
    "meal": "comida",
    "ingredients": ["Lomo atún", "Sésamo", "Aceite", "Soja", "Jengibre", "Huevo"],
    "method": [
      "Seque el lomo de atún con papel; úntalo de soja y presiona el sésamo por los lados para que se pegue.",
      "Calienta la sartén hasta que humee ligeramente; un hilo de aceite neutro ayuda a marcar.",
      "Sella 1 minuto por las dos caras y unos segundos por los bordes: el sésamo tostará sin que el interior cocine.",
      "Deja reposar 2 minutos antes de cortar: interior rojo y jugoso.",
      "Corta en láminas gruesas y sirve con soja y jengibre rallado; wasabi aparte si quieres el punto de atún."
    ]
  },
  {
    "id": "huevos-proteinicos",
    "title": "Huevos con espinacas y bacon",
    "meal": "comida",
    "ingredients": ["Huevos", "Espinacas", "Bacon", "Queso", "Sal", "Pimienta"],
    "method": [
      "Dora el bacon troceado hasta que quede crujiente y saca del sartén; deja su grasa.",
      "Saltea las espinacas en esa grasa 2-3 minutos, hasta que se marchiten; sala apenas (el bacon ya aporta).",
      "Bate los huevos con poca sal y pimienta; revuélvelos a fuego SUAVE, retirando cuando brillen y queden apenas cuajados.",
      "Mezcla con el bacon y termina con el queso rallado por encima para que funda con el calor residual."
    ]
  },
  {
    "id": "tarta-casa",
    "title": "Tarta de queso al horno",
    "meal": "comida",
    "ingredients": ["Queso crema", "Huevos", "Azúcar", "Nata", "Base galleta", "Mermelada"],
    "method": [
      "Prepara una base: las galletas molidas mezcladas con mantequilla fundida, prensándolas en el molde desmontable; hornea 10 minutos a 180 °C y deja enfriar.",
      "Mezcla el queso crema con el azúcar y la nata; añade los huevos uno a uno, envolviendo sin batir en exceso (demasiado aire agrieta la tarta).",
      "Vierte sobre la base y hornea a 160 °C AL BAÑO MARÍA 60-70 minutos: el centro debe seguir temblando, es su punto exacto.",
      "Apaga el horno con la puerta entreabierta y deja la tarta 1 hora dentro: baja enfriándose sin rajarse.",
      "Refrigera mínimo 4 horas (mejor toda la noche): la crema se asienta.",
      "Corona con la mermelada calentita y sirve fría."
    ]
  },
  {
    "id": "crema-catalana",
    "title": "Crema catalana tradicional",
    "meal": "comida",
    "ingredients": ["Leche", "Yemas", "Azúcar", "Maicena", "Canela", "Limón"],
    "method": [
      "Infusiona la leche con canela en rama y piel de limón (sólo lo amarillo) 10 minutos a fuego suave; cuela y deja templar.",
      "Bate las yemas con el azúcar y la maicena.",
      "Agrega la leche infusionada poco a poco, ya tibia, y vuelve al fuego bajo removiendo SIEMPRE: espesará en 5-8 minutos; no dejes que hierva fuerte (se corta).",
      "Reparte en cazuelas de barro y refrigera mínimo 2 horas.",
      "Al momento de servir, espolvorea azúcar y quémala con paleta o hierro caliente hasta formar costra fina: hay que quemarla justamente antes de llevarla a la mesa, si no se humedece."
    ]
  },
  {
    "id": "flan-caramelo",
    "title": "Flan casero de huevo",
    "meal": "comida",
    "ingredients": ["Huevos", "Leche condensada", "Leche entera", "Azúcar caramelo", "Vanilla"],
    "method": [
      "Carameliza el azúcar con un chorro de agua a fuego medio, hasta que tome color ámbar; repártelo cubriendo el molde con cuidado (se quema).",
      "Bate los huevos con la leche condensada, la leche entera y unas gotas de vainilla, sin sobre-batir.",
      "Vierte el batido sobre el caramelo.",
      "Hornea al BAÑO MARÍA a 170 °C 45-50 minutos, hasta que el centro apenas tiemble.",
      "Enfría a temperatura ambiente y refrigera mínimo 4 horas: el flan gana consistencia.",
      "Desmolda pasando un cuchillo por el borde y sacudiendo con suavidad; sirve frío, con el caramelo por encima."
    ]
  },
  {
    "id": "arroz-crema",
    "title": "Arroz con leche clásico",
    "meal": "comida",
    "ingredients": ["Arroz redondo", "Leche", "Azúcar", "Canela", "Limón", "Nuez moscada"],
    "method": [
      "Remoja el arroz 5 minutos y escurre.",
      "Calienta la leche con cáscara de limón (solo lo amarillo) y canela en rama; cuando apenas burbujea, añade el arroz.",
      "Cocina a fuego muy suave 20-25 minutos removiendo CONSTANTE (el arroz con leche se agarra), añade azúcar al final.",
      "Cuando el arroz quede tierno y el conjunto denso, retira la canela y el limón.",
      "Refrigera si lo comes frío; sirve con canela molida y un toque de nuez moscada por encima."
    ]
  },
  {
    "id": "churros-chocolate",
    "title": "Churros con chocolate caliente",
    "meal": "comida",
    "ingredients": ["Harina", "Agua", "Sal", "Azúcar", "Chocolate tableta", "Leche"],
    "method": [
      "Hierve el agua con la sal; FUERA DEL FUEGO añade la harina y mezcla hasta una masa lisa y pegajosa (trabaja con cuchara de palo).",
      "Introduce la masa en una churrera (o manga con boquilla rizada).",
      "Fríe tiras en aceite a 180-190 °C hasta que queden doradas y escúrrelas sobre papel.",
      "Para el chocolate: calienta la leche con la tableta troceada, removiendo hasta fundir y espesar.",
      "Sirve los churros espolvoreados de azúcar junto a las tazas del chocolate para mojar."
    ]
  },
  {
    "id": "tocino-cielo",
    "title": "Tocino de cielo",
    "meal": "comida",
    "ingredients": ["Yemas", "Azúcar", "Agua", "Caramelo"],
    "method": [
      "Haz el caramelo y recubre los moldes.",
      "Prepara un almíbar con el azúcar y el agua hasta punto de bola blanda (115-120 °C; sin termómetro, una gota en agua fría forma una bola que cede); deja templar.",
      "Bate las yemas y añade el almíbar tibio en hilo, removiendo siempre: llegado caliente, cuajaría la yema.",
      "Vierte en los moldes con caramelo y hornea al BAÑO MARÍA 30-40 minutos a 160-170 °C.",
      "Enfría, refrigera mínimo 4 horas y desmolda al momento de servir, con el caramelo por encima."
    ]
  },
  {
    "id": "buñuelos",
    "title": "Buñuelos de viento",
    "meal": "comida",
    "ingredients": ["Harina", "Agua", "Mantequilla", "Huevos", "Azúcar glass", "Canela"],
    "method": [
      "Hierve el agua con la mantequilla y una pizca de sal; añade la harina de golpe y mezcla fuera del fuego hasta que la masa se despegue del recipiente (2-3 minutos): es una masa tipo choux.",
      "Retira del fuego y añade los huevos uno a uno, mezclando con energía hasta que cada absorba el anterior.",
      "Deja reposar la masa 20 minutos tapada: gana volumen al freír.",
      "Fríe montones tomados con dos cucharas en aceite a 180 °C, en tandas pequeñas, hasta que doren por igual.",
      "Escurre sobre papel y espolvorea azúcar glass con canela."
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
      "Pela y corta las frutas en cubos uniformes, retirando bien las pieles duras (piña, mango, papaya) y los huesos del kiwi.",
      "Mezcla en un bowl grande con un hilo de miel y un chorrito de limón: el limón viva la mezcla y retarda la oxidación.",
      "Refrigera tapado mínimo 1 hora y sirve fría; con helado de vainilla si quieres un postre de más continente."
    ]
  },
  {
    "id": "gelatina",
    "title": "Gelatina de frutas",
    "meal": "comida",
    "ingredients": ["Gelatina neutra", "Agua", "Frutas variadas", "Azúcar", "Zumos naturales"],
    "method": [
      "Hidrata la gelatina en agua fría 8-10 minutos, hasta que opaque.",
      "Calienta los zumos con el azúcar SIN hervir fuerte: el hervido debilita la gelatina.",
      "Disuelve la gelatina hidratada en los zumos templados fuera del fuego, revolvendo hasta que no quede rastro.",
      "Reparte las frutas en trozos en el molde o copas y vierte el líquido encima.",
      "Refrigera mínimo 3-4 horas; para desmoldar, moja el molde en agua tibia unos segundos, pasa un cuchillo por el borde y da la vuelta."
    ]
  },
  {
    "id": "peras-vino",
    "title": "Peras cocidas en vino tinto",
    "meal": "comida",
    "ingredients": ["Peras", "Vino tinto", "Azúcar", "Canela", "Clavos", "Cáscara limón"],
    "method": [
      "Pela las peras dejando el tallo, para que queden elegantes al servir.",
      "Colócalas de pie en la olla, lo más juntas posible; cubre con el vino hasta rozar el tallo y añade el azúcar, la canela, los clavos y la cáscara de limón.",
      "Lleva a hervor, baja a fuego suave TAPADAS y cuece 30-40 minutos, girando a mitad de tiempo para que se coloquen por igual; están listas cuando ceden con aguja suave.",
      "Retira las peras y deja el vino a fuego fuerte 10-15 minutos hasta reducir a jarabe espeso.",
      "Sirve las peras frías bañadas de su jarabe — mejor ahora que se han reposado en él unas horas."
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
      "Corta el atún muy frío en dados de 1 cm con cuchillo bien afilado — nada de troceado mecánico.",
      "En un bowl frío, une el atún con el aguacate en daditos, el sésamo, la soja y una punta de wasabi.",
      "Mezcla suave con espátula: los dados deben quedarse enteros.",
      "Prueba y ajusta de soja antes de servir.",
      "Moldea con aro en el plato, corona con cebollino y sirve al momento — el tartar no espera."
    ]
  },
  {
    "id": "ventreza",
    "title": "Ventresca de atún",
    "meal": "comida",
    "ingredients": ["Ventresca atún", "Cebolla morada", "Limón", "Aceite", "Eneldo"],
    "method": [
      "Marca la ventresca en plancha muy caliente, 30-40 segundos por cara: por fuera dorada y por dentro rosada.",
      "Mientras, corta la cebolla morada en pluma fina y déjala macar 10 minutos con zumo de limón y una pizca de sal.",
      "Reparte la cebolla al fondo del plato y coloca la ventresca encima.",
      "Aliña con el zumo del macerado, aceite de oliva y eneldo picado.",
      "Sirve templada, sin esperar: pierde punto en minutos."
    ]
  },
  {
    "id": "langostinos-gamba",
    "title": "Langostinos al ajillo",
    "meal": "comida",
    "ingredients": ["Langostinos vivos", "Ajos", "Pimentón", "Aceite", "Perifollo", "Pimienta"],
    "method": [
      "Limpia los langostinos: retira el aparato digestivo y sécalos bien.",
      "Sofríe los ajos laminados en aceite a fuego medio, 2 minutos, hasta que suelten aroma sin quemarse.",
      "Añade los langostinos secos y saltea 1-2 minutos por lado.",
      "Fuera del fuego, espolvorea el pimentón y el perifollo picado; remueve rápido para aprovechar el calor.",
      "Sirve al momento en cazuela pequeña, con pan y limón al lado."
    ]
  },
  {
    "id": "lomo-lata",
    "title": "Lomo embuchado casero",
    "meal": "comida",
    "ingredients": ["Lomo cerdo", "Sal", "Pimienta", "Ajo", "Tripa natural"],
    "method": [
      "Pesa el lomo: la cura lleva 2,5-3 % de sal (25-30 g por kg), mezclada con pimienta molida y ajo picado.",
      "Emboza el lomo con la mezcla por toda la superficie, densa; refrigera tapado 3 días, girando una vez al día para que la sal reparta bien.",
      "Lava el exceso de sal, sécalo y embute en la tripa natural (limpia y previamente remojada), apretando bien; ata las puntas.",
      "CURA mínimo 3-4 semanas en un sitio frío, seco y ventilado: al presionar debe ceder sin quebrarse.",
      "Si tienes ahumador, añádele un humo suave; guarda envuelto en papel perforado y refrigerado."
    ]
  },
  {
    "id": "patatas-a-la-riojana",
    "title": "Patatas a la riojana",
    "meal": "comida",
    "ingredients": [
      "Patatas",
      "Chorizo",
      "Cebolla",
      "Ajo",
      "Pimiento choricero",
      "Pimentón dulce",
      "Laurel",
      "Aceite de oliva",
      "Sal"
    ],
    "method": [
      "Hidrata el pimiento choricero en agua caliente durante 15 minutos. Retira la pulpa con una cuchara y resérvala.",
      "Pica la cebolla y el ajo. Pela las patatas y córtalas en trozos, chascándolas al final para que suelten almidón.",
      "Calienta un chorrito de aceite en una cazuela y sofríe la cebolla a fuego medio hasta que esté blanda. Añade el ajo y cocina durante 1 minuto.",
      "Incorpora el chorizo en rodajas y rehógalo un par de minutos. Retira la cazuela del fuego, añade el pimentón y remueve para que no se queme.",
      "Agrega las patatas, la pulpa del pimiento choricero y la hoja de laurel. Cubre con agua justo hasta taparlas y sala ligeramente.",
      "Lleva a ebullición y cocina a fuego suave, sin tapar del todo, durante 25–30 minutos, hasta que las patatas estén tiernas y el caldo algo ligado.",
      "Prueba y ajusta de sal. Deja reposar 5 minutos antes de servir."
    ]
  },
  {
    "id": "croqueta-boletus",
    "title": "Croquetas de boletus",
    "meal": "comida",
    "ingredients": ["Boletus edulis", "Leche", "Mantequilla", "Harina", "Huevo", "Pan rallado"],
    "method": [
      "Limpia los boletus sin mojarlos (papel húmedo para la tierra); trocea y saltea a fuego fuerte 4-5 minutos hasta que pierdan su agua y doren; reserva con su jugo colado.",
      "Prepara una bechamel ESPESA con la mantequilla y la harina, cocinando en crudo 2 minutos antes de añadir la leche caliente poco a poco; remueve unos 10 minutos.",
      "Incorpora los boletus (y su jugo colado) a la bechamel; prueba la sal.",
      "Deja refrigerar la masa 3-4 horas tapada (mejor toda la noche).",
      "Forma croquetas con dos cucharas húmedas y empáñalas en huevo batido y pan rallado.",
      "Fríe en tandas pequeñas en aceite a 180 °C, 2-3 minutos, hasta que queden doradas.",
      "Escurre sobre papel y sirve enseguida calientes."
    ]
  },
  {
    "id": "hinojo-merluza",
    "title": "Merluza con hinojo",
    "meal": "comida",
    "ingredients": ["Merluza", "Hinojo bulboso", "Vino blanco", "Ajos", "Nata", "Perejil"],
    "method": [
      "Filetea el hinojo en juliana fina (hasta con los tallos verdes).",
      "Sofríelo con el ajo picado 5-8 minutos a fuego medio, hasta que quede blando; sala apenas.",
      "Coloca los lomos de merluza encima, salados.",
      "Moja con el vino blanco, tapa y cuece a fuego suave 6-8 minutos.",
      "Añade la nata, deja reducir un minuto y sirve con perejil picado: el aroma del hinojo acomaña la merluza de manera suave."
    ]
  },
  {
    "id": "pistilo",
    "title": "Pisto de berenjena",
    "meal": "comida",
    "ingredients": ["Berenjena", "Pimiento", "Tomate", "Cebolla", "Aceite", "Huevo"],
    "method": [
      "Corta la berenjena en dados y sala; déjala sudar 15 minutos y sécala bien — así absorbe menos aceite.",
      "Sofríe la cebolla y el pimiento picados 8-10 minutos a fuego medio.",
      "Incorpora la berenjena y saltea 8 minutos, hasta que quede tierna.",
      "Añade el tomate rallado, tapa y baja a fuego suave 15 minutos, hasta que todo se funda y brille de aceite.",
      "Sirve con huevo frito encima, yema jugosa, y pan para mojar."
    ]
  },
  {
    "id": "sopa-ajiaco",
    "title": "Ajiaco canario",
    "meal": "comida",
    "ingredients": ["Patatas", "Papa bonita", "Pepino", "Yuca", "Carne", "Gofio"],
    "method": [
      "Cuece la carne cubierta de agua fría; desespuma al hervir y cocina 30 minutos a fuego medio.",
      "Añade los tubérculos — las patatas con la papa bonita, que conserva mejor su forma —, la yuca y el pepino o calabaza en trozos; sigue 25-30 minutos.",
      "Disuelve el gofio en un poco de caldo ya templado, sin grumos.",
      "Vierte el gofio en la olla removiendo y cuece 10 minutos más: debe quedar un guiso denso, casi de masa.",
      "Rectifica sal y sirve caliente, con mojo picón para acompañar."
    ]
  },
  {
    "id": "mojarra",
    "title": "Mojarra frita",
    "meal": "comida",
    "ingredients": ["Mojarra entera", "Harina", "Sal", "Aceite", "Limón"],
    "method": [
      "Limpia la mojarra por completo (escamas, tripas y agalla) y hazle dos cortes diagonales por los lados; sécala.",
      "Sala por dentro y por fuera 10 minutos antes.",
      "Pasa por harina sacudiendo el exceso: una capa fina y ligera.",
      "Fríe en aceite caliente — unas burbujas al caer — 3-4 minutos por lado, sin voltearla antes de tiempo: es alto el riesgo de que se rompa.",
      "Escurre sobre papel y sirve con limón, calientita."
    ]
  },
  {
    "id": "lechon",
    "title": "Lechón asado canario",
    "meal": "comida",
    "ingredients": ["Lechón", "Sal", "Comino", "Ajos", "Limón", "Romero"],
    "method": [
      "Adoba el lechón la noche antes: machaca los ajos con el comino, la sal, el zumo de limón, un hilo de aceite y el romero, y pinta así toda la pieza.",
      "Precalienta el horno a 140-150 °C; coloca la pieza en una bandeja con un dedo de agua.",
      "Asa a esa temperatura suave 3 horas, humedeciendo con sus jugos cada 30 minutos.",
      "Sube a 200 °C, destapa y dora los últimos 30-40 minutos hasta que el cuero quede crocante (cruje al tocar).",
      "Deja descansar 15 minutos tapado antes de trocear: los jugos se reparten."
    ]
  },
  {
    "id": "gofio-escaldon",
    "title": "Gofio escaldado",
    "meal": "cena",
    "ingredients": ["Gofio", "Caldo pescado", "Pescado", "Patatas", "Aceite", "Sal"],
    "method": [
      "Cuece el pescado y las patatas en el caldo hasta que estén tiernos; sácalos y guarda el caldo caliente.",
      "En un lebrillo o bol, vierte el gofio en montículo.",
      "Escalda añadiendo el caldo caliente poco a poco sobre el gofio, removiendo con una cuchara de palo con fuerza, hasta que quede una masa densa y homogénea.",
      "Incorpora el pescado desmenuzado, remata con aceite crudo y rectifica de sal.",
      "Sirve caliente, para comer con cuchara."
    ]
  },
  {
    "id": "bienmesabe",
    "title": "Bienmesabe canario",
    "meal": "comida",
    "ingredients": ["Mermelada", "Miel", "Almendras", "Huevo", "Coco", "Zumo limón"],
    "method": [
      "Tuesta las almendras en el horno a 180 °C unos 8-10 minutos; muélelas finas sin que suelten aceite.",
      "Haz un almíbar con agua y azúcar, cociendo 5-8 minutos hasta punto de hilo flojo; incorpora la miel y la mermelada fuera del fuego.",
      "Añade el huevo batido al almíbar templado, a fuego suave, removiendo SIEMPRE sin dejar que hierva fuerte: debe espesar como crema.",
      "Añade las almendras molidas y el zumo de limón; deja templar por completo.",
      "Refrigera mínimo 4 horas tapado; sirve en copas con coco espolvoreado y bizcocho o helado de acompañante."
    ]
  },
  {
    "id": "lengua-bistec",
    "title": "Lengua a la bisteca",
    "meal": "comida",
    "ingredients": ["Lengua de ternera", "Cebolla", "Tomate triturado", "Vino blanco", "Caldo", "Pimienta"],
    "method": [
      "Cuece la lengua en agua con sal y pimienta 2 horas a fuego medio, hasta que la piel ceda; añade agua caliente si hace falta.",
      "Cuando esté tierna, pásala por agua fría unos minutos: pélala tibia, cuando la piel sale entera con facilidad.",
      "Corta en tiras gruesas.",
      "Dora la cebolla picada en aceite 8-10 minutos; añade el tomate triturado y cocina 5 minutos.",
      "Incorpora la lengua, moja con vino blanco y caldo hasta rozar, y deja reducir a fuego suave 20-30 minutos, hasta que la salsa espese.",
      "Rectifica sal y sirve templada."
    ]
  },
  {
    "id": "solomillo-pepitoria",
    "title": "Solomillo en pepitoria",
    "meal": "comida",
    "ingredients": ["Solomillo cerdo", "Leche", "Amarillos huevo", "Almendras tostadas", "Azafrán", "Pan frito"],
    "method": [
      "Dora el solomillo troceado en aceite caliente, por todas sus caras; retíralo apenas dorado (terminará de cocinarse en la salsa).",
      "Con mortero, machaca las almendras tostadas y la rebanada de pan frito hasta pasta; disuélvela con un poco de leche caliente.",
      "Vuelva la pasta a la cazuela con el jugo del dorado; moja con el resto de la leche y el azafrán; cuece a fuego suave removiendo hasta que levante la salsa.",
      "Aparte, bate las yemas con un cazo de la salsa; vuelve al guiso FUERA DEL FUEGO removiendo — las yemas ligan sin cuajarse.",
      "Regresa el solomillo, cocina 3-5 minutos y sirve templado."
    ]
  },
  {
    "id": "hamburguesa-sevilla",
    "title": "Hamburguesa de carne sevillana",
    "meal": "comida",
    "ingredients": ["Carne vacuno picada", "Huevo", "Pan rallado", "Ajo", "Perejil", "Aceite oliva"],
    "method": [
      "Mezcla apenas con las manos: carne, huevo, pan rallado, ajo y perejil picados y sal. Trabaja poco: demasiada pasta endurece la carne.",
      "Forma hamburguesas con las manos humedecidas y haz un hueco al centro con el pulgar (evita que se infle).",
      "Fríe en sartén con un hilo de aceite a fuego fuerte SIN tocarlas los primeros 3-4 minutos, hasta que asome su costra tostada; da la vuelta y repite.",
      "Reposa 2 minutos tapadas y sirve al momento."
    ]
  },
  {
    "id": "trucha-río",
    "title": "Trucha al horno con limón",
    "meal": "cena",
    "ingredients": ["Truchas frescas", "Limones", "Ajos", "Perejil", "Vino blanco", "Aceite"],
    "method": [
      "Limpia las truchas (tripa y escamas fuera) y sécalas; sala.",
      "Rellena el interior con rodajas de limón, pinta con aceite y espolvorea ajos y perejil; moja la bandeja con un chorro de vino blanco.",
      "Hornea a 180 °C unos 15-20 minutos, según tamaño.",
      "Comprueba con una punta: la carne se desprende del hueso con facilidad.",
      "Sirve con el jugo de la bandeja y limón al lado."
    ]
  },
  {
    "id": "conejo-salsa",
    "title": "Conejo a la cazuela",
    "meal": "comida",
    "ingredients": ["Conejo troceado", "Zanahorias", "Cebolla", "Vino tinto", "Tomate", "Laurel"],
    "method": [
      "Sazona el conejo y dóralo por todas sus caras en aceite, 5-6 minutos por cara; sácalo a un plato.",
      "Sofríe la cebolla y las zanahorias picadas 8 minutos en ese aceite; junta el laurel los últimos minutos.",
      "Devuelve el conejo, moja con el vino tinto (deja evaporar un minuto raspar del fondo) y añade el tomate triturado.",
      "Cubre casi del todo con caldo, tapa y cocina a fuego manso 1 hora-1 y cuarto, hasta que la carne se desprenda del hueso.",
      "Rectifica de sal y sirve; si puedes, hazlo el día antes: mejora en su salsa."
    ]
  },
  {
    "id": "lubina-papel",
    "title": "Lubina en papillote",
    "meal": "cena",
    "ingredients": ["Lubina filetes", "Pimiento rojo", "Pimiento verde", "Cebolla", "Limón", "Eneldo"],
    "method": [
      "Corta los pimientos y la cebolla en juliana fina; reparte el lecho sobre el papel de aluminio, en bandejas individuales o un único paquete grande.",
      "Coloca los filetes de lubina encima, sala, añade rodajitas de limón y eneldo.",
      "Cierra el paquete doblando los bordes con pliegues firmes, hermético pero con aire: se cocina a vapor.",
      "Hornea a 200 °C unos 12-15 minutos.",
      "Abre cada paquete en la mesa con cuidado (saldrá vapor) y sirve en su papel."
    ]
  },
  {
    "id": "sextuple-omelette",
    "title": "Huevos rotos con jamón",
    "meal": "comida",
    "ingredients": ["Patatas", "Huevos", "Jamón serrano", "Aceite oliva", "Sal"],
    "method": [
      "Pela las patatas y córtalas en láminas de 3-4 mm; fríe a fuego medio en aceite 15-20 minutos hasta que queden doradas con los bordes crujientes; escurre.",
      "Fríe los huevos en aceite caliente hasta que los bordes de la Clara burbujen y se doren, sin cuajar la yema: debe quedar líquida dentro.",
      "Reparte las patatas en el plato, coloca los huevos encima y sala.",
      "Cubre con taquitos de jamón serrano y rompe todo con tenedor en la mesa: mezclar es parte del plato."
    ]
  },
  {
    "id": "bacalao-albahaca",
    "title": "Bacalao con tomate y albahaca",
    "meal": "cena",
    "ingredients": ["Lomos bacalao", "Tomates maduros", "Albahaca fresca", "Ajo", "Aceite", "Vinagre"],
    "method": [
      "Desala el bacalao 24 horas cambiando el agua tres veces; sécalo bien.",
      "Tuesta los tomates enteros en aceite a fuego medio 10-15 minutos, hasta que se arruguen; pégalos y tritúralos.",
      "Vierte la salsa de tomate en la sartén con el ajo picado y un punto de vinagre; cocina 5 minutos.",
      "Coloca los lomos de bacalao PIEL ARRIBA, moja con un poco de agua o caldo caliente y cuece a fuego suave 8-10 minutos sin que hierva, moviendo la sartén en círculos: la gelatina liga la salsa.",
      "Fuera del fuego, espolvorea albahaca fresca troceada y sirve."
    ]
  },
  {
    "id": "filete-marsala",
    "title": "Filete de ternera al marsala",
    "meal": "comida",
    "ingredients": ["Filetes ternera", "Vino marsala", "Setas", "Mantequilla", "Perejil", "Harina"],
    "method": [
      "Pasa los filetes por harina sacudiendo el exceso.",
      "Dóralos en mantequilla 1-2 minutos por cara — son finos, se sellan rápido — y resérvalos.",
      "En la misma sartén saltea las setas 4-5 minutos, hasta que pierdan el agua.",
      "Desglasa con el marsala y deja reducir 2-3 minutos.",
      "Devuelve los filetes 2 minutos para impregnarse y termina fuera del fuego con una nuez de mantequilla fría que ligará la salsa.",
      "Sirve con perejil picado por encima."
    ]
  },
  {
    "id": "salmón-plancha",
    "title": "Salmón con mantequilla cítrica",
    "meal": "cena",
    "ingredients": ["Filetes salmón", "Mantequilla", "Limón", "Eneldo", "Pimienta negra", "Sal"],
    "method": [
      "Seca el salmón con papel y sala 10 minutos antes de cocinarlo: retiene mejor su jugo.",
      "Calienta una plancha o sartén a fuego medio-fuerte, hasta que casi humee.",
      "Coloca el salmón PIEL ABAJO y no lo muevas 4 minutos: la piel se dora y suelta sola de la sartén.",
      "Gira con espátula y cocina 2-3 minutos más, según el grosor.",
      "Deja reposar 2 minutos fuera del fuego y termina con mantequilla derretida con limón, una pizca de pimienta y eneldo."
    ]
  },
  {
    "id": "pollo-estofado",
    "title": "Pollo estofado con verduras",
    "meal": "comida",
    "ingredients": ["Pollo troceado", "Pimientos", "Zanahoria", "Cebolla", "Vino blanco", "Tomate"],
    "method": [
      "Seca y sala el pollo troceado; dóralo por todas sus caras en aceite, 5-7 minutos en total dando vueltas, y resérvalo.",
      "Sofríe la cebolla picada 6 minutos, añade los pimientos 5 más y, al final, el ajo picado un minuto.",
      "Devuelve el pollo, moja con el vino blanco y deja evaporar 1-2 minutos; incorpora el tomate rallado.",
      "Cubre apenas con agua o caldo, tapa y guisa a fuego suave 40-45 minutos, hasta que la carne quede tierna.",
      "Rectifica de sal y sirve; si puedes, hazlo el día antes: mejora en su salsa."
    ]
  },
  {
    "id": "huevos-huevo",
    "title": "Huevos rellenos de atún",
    "meal": "cena",
    "ingredients": ["Huevos duros", "Atún en conserva", "Mayonesa", "Cebolleta", "Pimentón", "Aceite"],
    "method": [
      "Cuece los huevos 10 minutos y enfríalos de golpe en agua fría: así se pelen en un momento.",
      "Córtalos por la mitad, saca las yemas y aplástalas con un tenedor.",
      "Mezcla las yemas con el atún escurrido, mayonesa, la cebolleta picada y un punto de sal; la pasta debe quedar cremosa, no reseca.",
      "Rellena las claras con la pasta y corona espolvoreando pimentón y un hilo de aceite.",
      "Sirve fríos; también quedan bien hechos el día antes."
    ]
  },
  {
    "id": "carnes-asadas",
    "title": "Carne asada a la brasa",
    "meal": "comida",
    "ingredients": ["Costillar cerdo", "Romero", "Tomillo", "Ajo", "Sal gorda", "Aceite"],
    "method": [
      "Marina el costillar 2 horas con las hierbas, el ajo machacado, la sal gorda y un hilo de aceite; gira a mitad de tiempo.",
      "Sácalo del marinado y sécalo por fuera: la brasa carameliza mejor con la superficie seca.",
      "Precalienta la parrilla muy caliente; si el corte es grueso, termina con brasa indirecta: mueve la pieza a la zona sin llama y deja que acabe tranquila.",
      "Asa 20-25 minutos girando cada pocos minutos; comprueba el punto apretando con los dedos — sin pinchar, que pierde jugo.",
      "Deja reposar 5-10 minutos envuelto en papel antes de cortar."
    ]
  },
  {
    "id": "mejillones-vapor",
    "title": "Mejillones al vapor",
    "meal": "cena",
    "ingredients": ["Mejillones vivos", "Vino blanco", "Cebolla", "Ajos", "Perejil", "Tomates"],
    "method": [
      "Raspa y lava los mejillones bien fríos; quita las barbas; descarta el que esté abierto y no se cierre al tocarlo.",
      "Dora la cebolla picada y los ajos laminados en una olla con aceite, 5-6 minutos a fuego medio.",
      "Moja con el vino blanco y deja hervir 1 minuto para evaporar el alcohol.",
      "Echa los mejillones, tapa y cocina a fuego fuerte 4-6 minutos, sacudiendo la olla: ya basta cuando se van abriendo.",
      "Saca los abiertos con una espumadera y filtra el caldo que dejaron; sirve los mejillones rociados con ese caldo, aceite crudo y perejil picado.",
      "Los pocos que no se hayan abierto, descártalos: cerrados no se comen."
    ]
  },
  {
    "id": "cigala-salsa",
    "title": "Cigalas en salsa marinera",
    "meal": "comida",
    "ingredients": ["Cigalas", "Vino blanco", "Cebolla", "Tomate", "Ajos", "Perejil"],
    "method": [
      "Sofríe la cebolla y el ajo picados en aceite 6-8 minutos a fuego medio, sin que tomen color fuerte.",
      "Añade el tomate rallado y cocina 10 minutos, hasta que pierda el agua cruda.",
      "Moja con el vino blanco y deja evaporar 1-2 minutos.",
      "Incorpora las cigalas secas y cocina en la salsa 6-8 minutos: retíralas apenas la carne quede firme y roja.",
      "Rectifica de sal, espolvorea perejil picado y deja reposar 5 minutos antes de servir."
    ]
  },
  {
    "id": "cerdo-lomo",
    "title": "Lomo de cerdo a la mostaza",
    "meal": "comida",
    "ingredients": ["Lomo cerdo entero", "Mostaza antigua", "Vino blanco", "Nata", "Pimienta negra"],
    "method": [
      "Sella el lomo por todas sus caras a fuego fuerte, 2 minutos por cara, sin que se queme; reserva.",
      "En la misma sartén, fuera del fuego, disuelve la mostaza con el vino blanco, raspando el fondo para recoger los jugos del dorado.",
      "Devuelve el lomo, tapa y cuece a fuego suave 40 minutos (menos si es una pieza pequeña), girando de vez en cuando.",
      "Saca el lomo y deja la salsa reducir 5 minutos; añade la nata a fuego mínimo SIN volver a hervir, para que no se corte.",
      "Deja reposar el lomo 5 minutos, corta medallones y sirve bañado con la salsa."
    ]
  },
  {
    "id": "huevos-costra",
    "title": "Huevos a la costra",
    "meal": "comida",
    "ingredients": ["Huevos", "Jamón york", "Queso fundir", "Pimiento", "Cebolla", "Aceite"],
    "method": [
      "Saltea el pimiento y la cebolla en dados con un hilo de aceite 8-10 minutos a fuego medio, hasta que queden tiernos y con algún punto dorado.",
      "Añade el jamón York en tiras y cocina 2 minutos.",
      "Fuera del fuego, incorpora los huevos batidos y salpimentados; remueve hasta que cuajen cremosos.",
      "Reparte la mezcla en cazuelitas individuales (o en una única fuente) y cubre con el queso de fundir.",
      "Gratina con el horno fuerte o el grill, 3-5 minutos, hasta costra dorada; sirve enseguida."
    ]
  },
  {
    "id": "dorada-horno",
    "title": "Dorada al horno estilo griego",
    "meal": "cena",
    "ingredients": ["Doradas enteras", "Tomates cherry", "Aceitunas negras", "Orégano", "Limón", "Aceite"],
    "method": [
      "Limpia las doradas — tripa y escamas fuera — y haz 2-3 cortes diagonales por cada lado: el calor llega mejor al hueso.",
      "Sala por dentro y por fuera y rellena el vientre con rodajas de limón.",
      "Colócalas en la bandeja rodeadas de tomates cherry y aceitunas; riega con aceite y espolvorea orégano.",
      "Hornea a 190 °C unos 25 minutos según el tamaño, regando con su propio jugo a mitad de cocción.",
      "Están listas cuando la carne se separa del hueso con facilidad; deja reposar 5 minutos antes de servir."
    ]
  },
  {
    "id": "huevos-perdidos",
    "title": "Huevos perdidos con morcilla",
    "meal": "cena",
    "ingredients": ["Huevos", "Morcilla asturiana", "Pan casero", "Cebolla", "Aceite", "Sal"],
    "method": [
      "Corta el pan casero en dados y fríelos en aceite hasta que queden crujientes; escurre sobre papel.",
      "Saltea la cebolla picada a fuego medio 10 minutos, hasta que caramelice.",
      "Añade la morcilla sin piel y desmíguala 3-4 minutos: se funde con su propia grasa y se une a la cebolla.",
      "Poche los huevos 3 minutos en agua a borbotones suaves con un chorrito de vinagre: clara cuajada, yema que corre.",
      "Monta al momento: los dados de pan, la mezcla de morcilla encima y el huevo pochado como corona; sala."
    ]
  },
  {
    "id": "tortilla-campos",
    "title": "Tortilla francesa con salmón",
    "meal": "desayuno",
    "ingredients": ["Huevos", "Salmón ahumado", "Queso crema", "Cebollino", "Mantequilla", "Pimienta"],
    "method": [
      "Bate los huevos con sal y una pizca de pimienta.",
      "Funde la mantequilla en una sartén antiadherente a fuego medio-bajo, sin que llegue a tomar color.",
      "Vierte los huevos y empuja los bordes con una espátula: cuando apenas cuaje el exterior y el centro siga brillante, es el momento.",
      "Reparte el salmón ahumado en tiras y el queso crema sobre la mitad de la tortilla, dobla la otra mitad encima y apaga el fuego.",
      "Desliza al plato y corona con cebollino picado."
    ]
  },
  {
    "id": "chuletillas-cordero-brasa",
    "title": "Chuletillas de cordero a la brasa",
    "meal": "comida",
    "ingredients": ["Chuletillas de cordero", "Ajos", "Perejil", "Aceite de oliva", "Sal gorda", "Limón"],
    "method": [
      "Machaca ajos y perejil con aceite y pinta las chuletillas.",
      "Calienta la parrilla o plancha hasta que humee.",
      "Asa 3-4 minutos por cada lado según grosor.",
      "Reposa un minuto y sirve con sal gorda y limón."
    ]
  },
  {
    "id": "pollo-ajillo",
    "title": "Pollo al ajillo",
    "meal": "comida",
    "ingredients": ["Pollo troceado", "Ajos", "Vino blanco", "Laurel", "Aceite de oliva", "Sal"],
    "method": [
      "Dora el pollo en aceite con los ajos laminados.",
      "Retira los ajos cuando estén dorados para que no amarguen.",
      "Añade vino blanco y una hoja de laurel.",
      "Cocina 25 minutos hasta que reduzca la salsa."
    ]
  },
  {
    "id": "merluza-romana",
    "title": "Merluza a la romana",
    "meal": "cena",
    "ingredients": ["Lomos de merluza", "Harina", "Huevos", "Aceite de oliva", "Limón", "Sal"],
    "method": [
      "Seca bien los lomos de merluza y sálalos.",
      "Pásalos por harina y luego por huevo batido.",
      "Fríe en aceite bien caliente hasta dorar.",
      "Escurre sobre papel y sirve con limón."
    ]
  },
  {
    "id": "revuelto-ajetes",
    "title": "Revuelto de ajetes tiernos",
    "meal": "cena",
    "ingredients": ["Ajetes tiernos", "Huevos", "Aceite de oliva", "Sal", "Pan tostado"],
    "method": [
      "Limpia y trocea los ajetes.",
      "Sofríe en aceite hasta que estén tiernos.",
      "Añade los huevos batidos y remueve a fuego suave.",
      "Retira cuando cuaje y sirve con pan tostado."
    ]
  },
  {
    "id": "empanadillas-atun",
    "title": "Empanadillas de atún",
    "meal": "comida",
    "ingredients": ["Obleas de empanadilla", "Atún en aceite", "Cebolla", "Tomate frito", "Huevo", "Aceite"],
    "method": [
      "Pocha la cebolla picada fina hasta que esté transparente.",
      "Añade tomate frito y atún escurrido, y cocina 5 minutos.",
      "Rellena las obleas y ciérralas con un tenedor.",
      "Fríe en aceite caliente o hornea 15 minutos a 200°C."
    ]
  },
  {
    "id": "san-jacobo",
    "title": "San Jacobos de jamón y queso",
    "meal": "comida",
    "ingredients": ["Filetes finos de cerdo", "Jamón cocido", "Queso en lonchas", "Harina", "Huevo", "Pan rallado"],
    "method": [
      "Coloca jamón y queso entre dos filetes finos.",
      "Presiona los bordes para que queden bien cerrados.",
      "Empana pasando por harina, huevo y pan rallado.",
      "Fríe en aceite caliente hasta que estén dorados."
    ]
  },
  {
    "id": "pechuga-empanada",
    "title": "Pechuga de pollo empanada",
    "meal": "comida",
    "ingredients": ["Pechugas de pollo", "Harina", "Huevos", "Pan rallado", "Aceite de oliva", "Sal", "Pimienta"],
    "method": [
      "Abre las pechugas en filetes finos y salpimiéntalas.",
      "Pasa cada filete por harina, huevo y pan rallado.",
      "Fríe 3 minutos por lado en aceite caliente.",
      "Escurre sobre papel absorbente y sirve."
    ]
  },
  {
    "id": "pollo-cerveza",
    "title": "Pollo guisado a la cerveza",
    "meal": "comida",
    "ingredients": ["Muslos de pollo", "Cerveza", "Cebolla", "Ajos", "Laurel", "Aceite de oliva"],
    "method": [
      "Dora los muslos de pollo por todas sus caras.",
      "Sofríe la cebolla y los ajos picados en la misma cazuela.",
      "Añade la cerveza y el laurel, y lleva a ebullición.",
      "Cocina a fuego lento 30 minutos hasta espesar."
    ]
  },
  {
    "id": "huevos-plato-tomate",
    "title": "Huevos al plato con tomate",
    "meal": "cena",
    "ingredients": ["Huevos", "Tomates maduros", "Cebolla", "Ajo", "Aceite de oliva", "Perejil"],
    "method": [
      "Sofríe cebolla y ajo picados hasta dorar.",
      "Añade tomate triturado y cocina 15 minutos.",
      "Casca los huevos sobre la salsa y tapa la sartén.",
      "Cocina 5 minutos hasta que cuajen y espolvorea perejil."
    ]
  },
  {
    "id": "chipirones-tinta",
    "title": "Chipirones en su tinta",
    "meal": "comida",
    "ingredients": ["Chipirones", "Cebolla", "Ajos", "Tinta de calamar", "Caldo de pescado", "Harina", "Aceite"],
    "method": [
      "Sofríe cebolla y ajo picados muy finos.",
      "Añade los chipirones limpios y enteros.",
      "Disuelve la tinta en caldo y añádela.",
      "Cocina 30 minutos y espesa con un poco de harina."
    ]
  },
  {
    "id": "boquerones-fritos",
    "title": "Boquerones fritos",
    "meal": "cena",
    "ingredients": ["Boquerones frescos", "Harina", "Aceite de oliva", "Limón", "Sal"],
    "method": [
      "Limpia los boquerones quitando cabeza y tripas.",
      "Pásalos por harina sacudiendo el exceso.",
      "Fríe en aceite muy caliente en tandas pequeñas.",
      "Escurre y sirve con unas gotas de limón."
    ]
  },
  {
    "id": "carne-guisada-patatas",
    "title": "Carne guisada con patatas",
    "meal": "comida",
    "ingredients": ["Ternera para guisar", "Patatas", "Cebolla", "Zanahoria", "Vino tinto", "Caldo", "Aceite"],
    "method": [
      "Dora la carne troceada en aceite caliente.",
      "Sofríe cebolla y zanahoria picadas.",
      "Añade vino, caldo y cocina 1 hora y media.",
      "Incorpora las patatas y cuece 25 minutos más."
    ]
  },
  {
    "id": "salchichas-sidra",
    "title": "Salchichas a la sidra",
    "meal": "cena",
    "ingredients": ["Salchichas frescas", "Sidra", "Cebolla", "Ajos", "Aceite de oliva", "Pimienta"],
    "method": [
      "Dora las salchichas enteras en una sartén.",
      "Retíralas y pocha cebolla y ajo en el mismo aceite.",
      "Devuélvelas a la sartén y cubre con sidra.",
      "Cocina 15 minutos hasta que la salsa reduzca."
    ]
  },
  {
    "id": "gambas-gabardina",
    "title": "Gambas a la gabardina",
    "meal": "cena",
    "ingredients": ["Gambas peladas", "Harina", "Huevo", "Cerveza fría", "Levadura", "Aceite", "Sal"],
    "method": [
      "Prepara una masa ligera con harina, cerveza y levadura.",
      "Seca bien las gambas y sálalas.",
      "Pásalas por la masa dejando que escurra el exceso.",
      "Fríe en aceite muy caliente hasta que doren."
    ]
  },
  {
    "id": "paletilla-cordero-horno",
    "title": "Paletilla de cordero al horno",
    "meal": "comida",
    "ingredients": ["Paletilla de cordero", "Ajos", "Romero", "Vino blanco", "Aceite de oliva", "Sal"],
    "method": [
      "Adoba la paletilla con ajo, romero, aceite y sal.",
      "Colócala en bandeja con un chorro de vino blanco.",
      "Hornea tapada con papel a 170°C durante 2 horas.",
      "Destapa los últimos 20 minutos para dorar la superficie."
    ]
  },
  {
    "id": "sepia-plancha",
    "title": "Sepia a la plancha con alioli",
    "meal": "cena",
    "ingredients": ["Sepia limpia", "Ajos", "Perejil", "Aceite de oliva", "Limón", "Alioli"],
    "method": [
      "Seca bien la sepia y córtala en tiras gruesas.",
      "Calienta la plancha a fuego muy fuerte.",
      "Marca 3 minutos por lado sin moverla.",
      "Sirve con alioli, perejil picado y limón."
    ]
  },
  {
    "id": "bacalao-dorado",
    "title": "Bacalao dorado con patatas paja",
    "meal": "comida",
    "ingredients": ["Lomos de bacalao desalado", "Patatas", "Cebolla", "Huevos", "Aceite de oliva", "Aceitunas negras"],
    "method": [
      "Desmiga el bacalao desalado y resérvalo.",
      "Fríe las patatas en tiras muy finas y escurre.",
      "Pocha la cebolla y añade bacalao, patatas y huevos batidos.",
      "Remueve a fuego suave hasta cuajar y decora con aceitunas."
    ]
  },
  {
    "id": "pinchos-morunos",
    "title": "Pinchos morunos",
    "meal": "cena",
    "ingredients": ["Lomo de cerdo", "Pimentón dulce", "Comino", "Orégano", "Ajos", "Aceite de oliva", "Limón"],
    "method": [
      "Corta el lomo en dados regulares.",
      "Marina con pimentón, comino, orégano, ajo y aceite 2 horas.",
      "Ensarta los dados en brochetas apretados.",
      "Hazlos a la plancha 8 minutos girando continuamente."
    ]
  },
  {
    "id": "trucha-navarra",
    "title": "Trucha a la navarra con jamón",
    "meal": "cena",
    "ingredients": ["Truchas", "Jamón serrano", "Harina", "Aceite de oliva", "Limón", "Sal"],
    "method": [
      "Abre las truchas en mariposa y sazónalas.",
      "Coloca una loncha de jamón dentro de cada una.",
      "Pásalas por harina y dóralas en aceite caliente.",
      "Cocina 4 minutos por lado y sirve con limón."
    ]
  },
  {
    "id": "huevos-plato-chorizo",
    "title": "Huevos al plato con chorizo",
    "meal": "desayuno",
    "ingredients": ["Huevos", "Chorizo", "Pimentón dulce", "Aceite de oliva", "Pan de pueblo", "Sal"],
    "method": [
      "Corta el chorizo en rodajas y dóralas en cazuelita de barro.",
      "Casca los huevos encima del chorizo.",
      "Hornea 8 minutos a 200°C hasta que cuajen las claras.",
      "Espolvorea pimentón y sirve con pan para mojar."
    ]
  },
  { id: "tostadas-aceite-salgorda", title: "Tostadas con aceite de oliva y sal gorda", meal: "desayuno",
    ingredients: ["Pan", "Aceite de oliva virgen extra", "Sal gorda"],
    method: [
      "Tuesta el pan al gusto.",
      "Riega con un buen chorro de aceite de oliva virgen extra.",
      "Espolvorea la sal gorda por encima y sirve."
    ]
  },
  { id: "tostada-sobrasada-miel", title: "Tostada de sobrasada con miel", meal: "desayuno",
    ingredients: ["Pan", "Sobrasada", "Miel"],
    method: [
      "Tuesta el pan.",
      "Unta una capa fina de sobrasada.",
      "Riega con hilos de miel y sirve templado."
    ]
  },
  { id: "tostada-jamon-tomate", title: "Tostada de jamón serrano con tomate", meal: "desayuno",
    ingredients: ["Pan", "Tomates maduros", "Jamón serrano", "Aceite de oliva virgen extra"],
    method: [
      "Tuesta el pan y ralla el tomate maduro encima.",
      "Añade un chorrito de aceite de oliva.",
      "Coloca las lonchas de jamón serrano al momento."
    ]
  },
  { id: "tostada-aguacate-tomate", title: "Tostada de aguacate con tomate", meal: "desayuno",
    ingredients: ["Pan", "Aguacate", "Tomates", "Sal", "Aceite de oliva virgen extra"],
    method: [
      "Machaca el aguacate con un tenedor y una pizca de sal.",
      "Unta sobre el pan tostado.",
      "Corona con rodajas de tomate y un hilo de aceite."
    ]
  },
  { id: "magdalenas-caseras", title: "Magdalenas caseras", meal: "desayuno",
    ingredients: ["Harina", "Huevos", "Azúcar", "Aceite de oliva", "Leche", "Levadura química", "Ralladura de limón"],
    method: [
      "Bate los huevos con el azúcar hasta blanquear.",
      "Añade el aceite, la leche y la ralladura de limón.",
      "Incorpora la harina con la levadura y mezcla sin pasarse.",
      "Rellena los moldes y hornea 15-18 minutos a 180°C."
    ]
  },
  { id: "churros-caseros", title: "Churros caseros", meal: "desayuno",
    ingredients: ["Harina", "Agua", "Sal", "Azúcar", "Aceite de oliva para freír"],
    method: [
      "Hierve el agua con la sal y añade la harina fuera del fuego.",
      "Trabaja la masa hasta que quede lisa y sin grumos.",
      "Introdúcela en la churrera y fríe tiras en aceite bien caliente.",
      "Escurre y espolvorea azúcar al gusto."
    ]
  },
  { id: "porras-caseras", title: "Porras caseras", meal: "desayuno",
    ingredients: ["Harina", "Agua", "Sal", "Levadura química", "Azúcar", "Aceite de oliva para freír"],
    method: [
      "Amasa harina, agua, levadura, sal y azúcar hasta una masa pegajosa.",
      "Deja reposar media hora tapada.",
      "Fríe porras gruesas en aceite muy caliente.",
      "Escurre sobre papel y sirve recién hechas."
    ]
  },
  { id: "gachas-canela", title: "Gachas dulces de canela", meal: "desayuno",
    ingredients: ["Leche", "Harina", "Azúcar", "Canela"],
    method: [
      "Disuelve la harina en un poco de leche fría.",
      "Calienta el resto de la leche y añade la mezcla removiendo sin parar.",
      "Cuece hasta espesar, endulza y espolvorea canela."
    ]
  },
  { id: "leche-galletas", title: "Leche fría con galletas María", meal: "desayuno",
    ingredients: ["Leche", "Galletas María"],
    method: [
      "Calienta o enfría la leche al gusto.",
      "Sumerge las galletas unos segundos para que se empapen sin romperse.",
      "Desayuna mojando galleta a galleta."
    ]
  },
  { id: "torrijas-leche", title: "Torrijas de leche caseras", meal: "desayuno",
    ingredients: ["Pan del día anterior", "Leche", "Huevos", "Azúcar", "Canela", "Aceite de oliva para freír"],
    method: [
      "Infusiona la leche con canela y azúcar.",
      "Empapa las rebanadas de pan del día anterior.",
      "Pásalas por huevo batido y fríelas en aceite caliente.",
      "Espolvorea azúcar con canela al salir."
    ]
  },
  { id: "bikini-jamon", title: "Bikini de jamón y queso", meal: "desayuno",
    ingredients: ["Pan de molde", "Jamón cocido", "Queso", "Mantequilla"],
    method: [
      "Monta el sándwich con jamón y queso.",
      "Úntalo por fuera con mantequilla y pásalo por la plancha.",
      "Corta en triangulitos y sirve bien caliente."
    ]
  },
  { id: "bocadillo-lomo-queso", title: "Bocadillo caliente de lomo con queso", meal: "desayuno",
    ingredients: ["Pan", "Lomo adobado", "Queso"],
    method: [
      "Corta el lomo adobado en filetes finos.",
      "Hazlo en la sartén a fuego fuerte.",
      "Monta el bocadillo con queso encima del lomo caliente."
    ]
  },
  { id: "revuelto-champinones", title: "Revuelto de champiñones", meal: "desayuno",
    ingredients: ["Huevos", "Champiñones", "Ajos", "Perejil", "Aceite de oliva"],
    method: [
      "Dora los champiñones laminados con ajo en aceite.",
      "Bate los huevos y añádelos fuera del fuego removiendo suave.",
      "Termina con perejil picado y puntita de sal."
    ]
  },
  { id: "revuelto-espinacas-pinones", title: "Revuelto de espinacas y piñones", meal: "desayuno",
    ingredients: ["Huevos", "Espinacas", "Piñones", "Aceite de oliva", "Sal"],
    method: [
      "Saltea las espinacas hasta que marchiten.",
      "Tuesta los piñones en la misma sartén.",
      "Añade los huevos batidos, remueve fuera del fuego y sala."
    ]
  },
  { id: "tortilla-francesa-queso", title: "Tortilla francesa de queso", meal: "desayuno",
    ingredients: ["Huevos", "Queso", "Aceite de oliva", "Sal"],
    method: [
      "Bate los huevos con sal.",
      "Cuaja la tortilla en sartén baja con poco aceite.",
      "Reparte el queso, dobla y sirve jugosa."
    ]
  },
  { id: "mollete-chocolate-aceite", title: "Mollete con chocolate negro y aceite", meal: "desayuno",
    ingredients: ["Molletes", "Chocolate negro", "Aceite de oliva virgen extra"],
    method: [
      "Abre el mollete y tóstalo ligeramente.",
      "Coloca trozos de chocolate negro sobre el calor.",
      "Añade un hilillo de aceite de oliva y sirve."
    ]
  },
  { id: "rosquillas-anis", title: "Rosquillas caseras de anís", meal: "desayuno",
    ingredients: ["Harina", "Huevos", "Azúcar", "Anís (licor)", "Aceite de oliva para freír"],
    method: [
      "Mezcla harina, huevos, azúcar y el anís hasta una masa blanda; deja que repose 30 minutos tapada: la masa más reposada es más manejable.",
      "Forma las rosquillas dándoles anillo con los dedos — o corta tiras de masa y únelas por el extremo.",
      "Calienta el aceite a unos 175-180 °C: ni humo ni burbujas lentas; un trozo de masa debe subir dorado al caer.",
      "Fríe en tandas pequeñas 1-2 minutos por lado, hasta que se inflen y doren parejas.",
      "Escúrrelos sobre papel y pásalos por azúcar mientras estén calientes: así se les pega bien."
    ]
  },
  { id: "fartons-horchata", title: "Fartons con horchata", meal: "desayuno",
    ingredients: ["Fartons", "Horchata"],
    method: [
      "Sirve la horchata bien fría.",
      "Acompaña con los fartons para mojar, como en Valencia.",
      "Desayuna sin prisa."
    ]
  },
  { id: "tostada-pavo-queso", title: "Tostada de pavo con queso fresco", meal: "desayuno",
    ingredients: ["Pan", "Pavo en filetes", "Queso fresco", "Tomates"],
    method: [
      "Tuesta el pan y úntalo con queso fresco.",
      "Coloca los filetes de pavo encima.",
      "Termina con rodajas de tomate."
    ]
  },
  { id: "torta-aceite-queso", title: "Torta de aceite con queso batido y mermelada de higos", meal: "desayuno",
    ingredients: ["Torta de aceite", "Queso batido", "Mermelada de higos"],
    method: [
      "Reparte el queso batido sobre la torta de aceite.",
      "Corona con una cucharada de mermelada de higos.",
      "Sirve acompañada de café."
    ]
  },
  { id: "bikini-sobrasada", title: "Bikini de sobrasada y queso", meal: "desayuno",
    ingredients: ["Pan de molde", "Sobrasada", "Queso", "Mantequilla"],
    method: [
      "Unta la sobrasada en una rebanada y pon queso en la otra.",
      "Monta el sándwich y úntalo por fuera con mantequilla.",
      "Pásalo por la plancha hasta fundir el queso."
    ]
  },
  { id: "tostada-queso-tomillo", title: "Tostada de queso fresco con tomillo", meal: "desayuno",
    ingredients: ["Pan", "Queso fresco", "Tomillo", "Aceite de oliva"],
    method: [
      "Tuesta el pan y extiende el queso fresco.",
      "Espolvorea tomillo seco y un punto de sal.",
      "Riega con un hilo de aceite de oliva."
    ]
  },
  { id: "migas-chorizo", title: "Migas de pan con chorizo", meal: "desayuno",
    ingredients: ["Pan del día anterior", "Chorizo", "Ajos", "Aceite de oliva", "Pimentón dulce"],
    method: [
      "Desmenuza el pan del día anterior humedecido la noche antes.",
      "Dora los ajos y el chorizo en aceite.",
      "Añade el pan y trabaja a fuego medio unos 10 minutos.",
      "Pon pimentón fuera del fuego y mezcla."
    ]
  },
  { id: "bollos-prenaos", title: "Bollos preñaos de chorizo", meal: "desayuno",
    ingredients: ["Pan de bollo", "Chorizos", "Aceite de oliva"],
    method: [
      "Reserva bollos recién amasados o de panadería.",
      "Encaja un chorizo crudo en el centro de cada bollo.",
      "Hornea a 180°C unos 15 minutos hasta que el chorizo sude grasa."
    ]
  },
  { id: "ensaimada-sobrasada", title: "Ensaimada tostada con sobrasada y queso", meal: "desayuno",
    ingredients: ["Ensaimada", "Sobrasada", "Queso"],
    method: [
      "Abre la ensaimada por la mitad y tóstala en la plancha.",
      "Unta la sobrasada en la mitad caliente.",
      "Termina con dados de queso fundidos encima del calor y sirve."
    ]
  },
  { id: "tostada-morcilla-huevo", title: "Tostada de morcilla con huevo frito", meal: "desayuno",
    ingredients: ["Pan", "Morcilla", "Huevos", "Aceite de oliva"],
    method: [
      "Fríe la morcilla desmenuzada en su propia grasa.",
      "Prepara un huevo frito con la yema jugosa.",
      "Monta la tostada con la morcilla y el huevo encima."
    ]
  },
  { id: "tostada-queso-burgos", title: "Tostada de queso de Burgos con tomate", meal: "desayuno",
    ingredients: ["Molletes", "Queso de Burgos", "Tomates maduros", "Aceite de oliva"],
    method: [
      "Tosta los molletes y ralla el tomate encima.",
      "Reparte el queso de Burgos fresco troceado.",
      "Riega con aceite de oliva y sal."
    ]
  },
  { id: "revuelto-gulas", title: "Revuelto de gulas con ajos", meal: "desayuno",
    ingredients: ["Huevos", "Gulas", "Ajos", "Guindilla", "Aceite de oliva"],
    method: [
      "Sofríe los ajos fileteados y la guindilla en aceite.",
      "Añade las gulas y saltea al momento.",
      "Fuera del fuego, mezcla los huevos batidos hasta cuajar cremosos."
    ]
  },
  { id: "revuelto-gambas-ajos", title: "Revuelto de gambas con ajos tiernos", meal: "desayuno",
    ingredients: ["Huevos", "Gambas", "Ajos tiernos", "Aceite de oliva", "Sal"],
    method: [
      "Saltea las gambas con los ajos tiernos picados.",
      "Bate los huevos y añádelos fuera del fuego.",
      "Remueve hasta cuajar y sirve al momento."
    ]
  },
  { id: "macedonia-frutas", title: "Macedonia de frutas", meal: "desayuno",
    ingredients: ["Plátanos", "Manzanas", "Naranjas", "Uvas", "Zumo de naranja"],
    method: [
      "Pela y trocea las frutas en dados regulares.",
      "Mezcla en un bol grande.",
      "Riega con zumo de naranja y deja enfriar."
    ]
  },
  { id: "leche-merengada", title: "Leche merengada casera", meal: "desayuno",
    ingredients: ["Leche", "Azúcar", "Canela en rama", "Piel de limón", "Clara de huevo"],
    method: [
      "Infusiona la leche con canela y piel de limón.",
      "Endulza y deja enfriar del todo.",
      "Bate la clara semi montada, mézclala con la leche y sirve bien fría."
    ]
  },
  { id: "cuajada-miel", title: "Cuajada con miel y nueces", meal: "desayuno",
    ingredients: ["Cuajada", "Miel", "Nueces"],
    method: [
      "Sirve la cuajada bien fría en cuencos.",
      "Riega con miel a hilo.",
      "Termina con nueces troceadas."
    ]
  },
  { id: "tostada-membrillo-queso", title: "Tostada de membrillo con queso manchego", meal: "desayuno",
    ingredients: ["Pan", "Membrillo", "Queso manchego"],
    method: [
      "Tuesta el pan con buen color.",
      "Corta láminas de membrillo y de queso manchego.",
      "Monta la tostada y gratina un minuto si te apetece."
    ]
  },
  { id: "tostada-anchoas", title: "Tostada de anchoas del Cantábrico", meal: "desayuno",
    ingredients: ["Pan", "Anchoas del Cantábrico", "Tomates maduros", "Aceite de oliva"],
    method: [
      "Tuesta el pan y frota con tomate maduro rallado.",
      "Coloca las anchoas bien escurridas.",
      "Riega con aceite de oliva al momento de servir."
    ]
  },
  { id: "huevos-escalfados-espinacas", title: "Huevos escalfados sobre espinacas", meal: "desayuno",
    ingredients: ["Huevos", "Espinacas", "Ajos", "Vino blanco", "Aceite de oliva", "Sal"],
    method: [
      "Saltea las espinacas con ajo en aceite.",
      "Añade un chorrito de vino blanco y deja reducir.",
      "Escalfa los huevos 3 minutos y colócalos encima."
    ]
  },
  { id: "batido-platano", title: "Batido de plátano con leche", meal: "desayuno",
    ingredients: ["Plátanos", "Leche", "Canela"],
    method: [
      "Pela y trocea los plátanos maduros.",
      "Tritura con leche fría hasta cremoso.",
      "Espolvorea canela y sirve al momento."
    ]
  },
  { id: "batido-fresas", title: "Batido de fresas", meal: "desayuno",
    ingredients: ["Fresas", "Leche", "Azúcar", "Hielo"],
    method: [
      "Lava las fresas y quítale los rabitos.",
      "Tritura con leche, azúcar y un puñado de hielo.",
      "Sirve inmediatamente bien frío."
    ]
  },
  { id: "pan-chocolate-negro", title: "Pan con chocolate negro", meal: "desayuno",
    ingredients: ["Pan", "Chocolate negro", "Mantequilla"],
    method: [
      "Tuesta el pan y úntalo con mantequilla.",
      "Funde el chocolate negro al baño maría o en microondas.",
      "Unta el chocolate caliente y sirve."
    ]
  },
  { id: "bocadillo-chorizo-caliente", title: "Bocadillo caliente de chorizo", meal: "desayuno",
    ingredients: ["Pan", "Chorizo"],
    method: [
      "Corta el chorizo en lonchas finas.",
      "Dóralo un momento en la sartén para que suelte su grasa.",
      "Monta el bocadillo con el pan templado."
    ]
  },
  { id: "tostada-cabra-miel", title: "Tostada de queso de cabra con miel y nueces", meal: "desayuno",
    ingredients: ["Pan", "Queso de cabra", "Miel", "Nueces"],
    method: [
      "Tuesta el pan y reparte rodajas de queso de cabra.",
      "Gratina hasta fundir ligeramente.",
      "Riega con miel y corona con nueces picadas."
    ]
  },
  { id: "arroz-a-banda", title: "Arroz a banda", meal: "comida",
    ingredients: ["Arroz", "Calamares", "Fondo de pescado", "Ajos", "Pimentón dulce", "Azafrán"],
    method: [
      "Sofríe los calamares en dados con los ajos picados en la paellera 3-4 minutos, hasta que cambien de color.",
      "Fuera del fuego, añade el pimentón — se quema rápido — y remueve de golpe.",
      "Incorpora el arroz y dale un minuto de tostado en el aceite.",
      "Vierte el doble de fondo de pescado BIEN CALIENTE con el azafrán disuelto; reparte por toda la paellera y ya no la toques.",
      "Cocina a fuego fuerte los primeros 8 minutos y a suave 8-10 más, siempre sin remover.",
      "Reposa 5 minutos tapado con un trapo y sirve con los calamares repartidos por encima."
    ]
  },
  { id: "arroz-negro-calamares", title: "Arroz negro con calamares", meal: "comida",
    ingredients: ["Arroz", "Calamares", "Tinta de calamar", "Fondo de pescado", "Cebolla", "Alioli"],
    method: [
      "Sofríe la cebolla picada 8 minutos hasta que quede transparente; añade los calamares en dados y saltéalos 3 minutos.",
      "Disuelve la tinta en un cazo de fondo caliente y viértela: verás cómo todo se tiñe de negro.",
      "Añade el arroz, remueve 1 minuto para tostarlo y cubre con el doble de fondo CALIENTE.",
      "Cocina a fuego fuerte 8 minutos y a suave 10 más, sin remover más.",
      "Reposa 2-3 minutos tapado y sirve con alioli por encima, que es obligatorio al arroz negro."
    ]
  },
  { id: "fideua-marisco", title: "Fideuà de marisco", meal: "comida",
    ingredients: ["Fideos gordos", "Gambas", "Almejas", "Calamares", "Fondo de pescado", "Tomates"],
    method: [
      "Sofríe las gambas y las almejas limpias en la fideuera con un hilo de aceite; sácalas en cuanto se abren y reserva.",
      "Saltea los calamares en dados 2-3 minutos, añade el tomate triturado y cocina 3 minutos más.",
      "Incorpora los fideos GORDOS y tóstalos moviendo 1 minuto, hasta que suelten su aroma a tostado.",
      "Cubre con el doble de fondo caliente, reparte, devuelve el marisco por encima y ya no toques la fideuera.",
      "Cuece a fuego fuerte 3 minutos y a suave 6-7 más, siempre sin remover: los cuidados de una fideuà van por ahí.",
      "Reposa 2-3 minutos tapada y sirve con alioli aparte."
    ]
  },
  { id: "marmitako-bonito", title: "Marmitako de bonito", meal: "comida",
    ingredients: ["Bonito", "Patatas", "Pimientos", "Cebolla", "Tomates", "Guindilla"],
    method: [
      "Haz un sofrito de cebolla, pimiento y tomate con guindilla.",
      "Chasca las patatas y añádelas con agua hasta cubrir.",
      "Cuando estén tiernas, reparte el bonito en dados.",
      "Cuece justo 5 minutos para que quede jugoso."
    ]
  },
  { id: "espinacas-garbanzos", title: "Espinacas con garbanzos al estilo sevillano", meal: "comida",
    ingredients: ["Garbanzos cocidos", "Espinacas", "Comino", "Ajos", "Pimentón dulce", "Vinagre"],
    method: [
      "Dora los ajos con comino en aceite.",
      "Añade el pimentón fuera del fuego y un chorrito de vinagre.",
      "Incorpora las espinacas y los garbanzos.",
      "Estofa 10 minutos hasta que ligue."
    ]
  },
  { id: "judias-blancas-chorizo", title: "Judías blancas con chorizo", meal: "comida",
    ingredients: ["Judías blancas cocidas", "Chorizo", "Cebolla", "Laurel", "Tomates"],
    method: [
      "Sofríe la cebolla con laurel.",
      "Añade el chorizo en rodajas y el tomate rallado.",
      "Incorpora las judías con algo de su caldo.",
      "Estofa 15 minutos tapadas y repasa sal."
    ]
  },
  { id: "alubias-rojas-chorizo", title: "Alubias rojas con chorizo", meal: "comida",
    ingredients: ["Alubias rojas cocidas", "Chorizo", "Cebolla", "Pimentón dulce", "Laurel"],
    method: [
      "Sofríe cebolla y chorizo en rodajas.",
      "Añade el pimentón fuera del fuego.",
      "Incorpora las alubias con su caldo y el laurel.",
      "Cuece 20 minutos a fuego manso."
    ]
  },
  { id: "potaje-vigilia", title: "Potaje de vigilia", meal: "comida",
    ingredients: ["Garbanzos cocidos", "Bacalao desalado", "Espinacas", "Cebolla", "Azafrán", "Huevos"],
    method: [
      "Sofríe la cebolla picada con azafrán.",
      "Añade garbanzos, espinacas y bacalao en trozos.",
      "Cuece 15 minutos hasta que el bacalao se desmenuce.",
      "Termina con huevo duro en rodajas."
    ]
  },
  { id: "tortilla-bacalao", title: "Tortilla de bacalao", meal: "comida",
    ingredients: ["Huevos", "Bacalao desalado", "Cebolla", "Perejil", "Aceite de oliva"],
    method: [
      "Sofríe la cebolla hasta translúcida.",
      "Añade el bacalao desmigado un par de minutos.",
      "Mezcla con los huevos batidos y perejil.",
      "Cuaja la tortilla jugosa en poco aceite."
    ]
  },
  { id: "bacalao-vizcaino", title: "Bacalao a la vizcaína", meal: "comida",
    ingredients: ["Bacalao desalado", "Pimientos choriceros", "Cebolla", "Ajos", "Aceite de oliva"],
    method: [
      "Rehidrata la piel de los pimientos choriceros y tritúrala.",
      "Pocha cebolla y ajo hasta tener un sofrito fino.",
      "Coloca el bacalao con la piel arriba a fuego bajo.",
      "Baña con la salsa sin que hierva fuerte 8 minutos."
    ]
  },
  { id: "pollo-chilindron", title: "Pollo al chilindrón", meal: "comida",
    ingredients: ["Pollo", "Pimiento rojo", "Tomates", "Ajos", "Vino blanco", "Laurel"],
    method: [
      "Dora el pollo troceado en aceite.",
      "Añade cinta de pimiento rojo, ajo y tomate.",
      "Baña con vino blanco y añade laurel.",
      "Estofa tapado 30 minutos."
    ]
  },
  { id: "conejo-ajillo", title: "Conejo al ajillo", meal: "comida",
    ingredients: ["Conejo", "Ajos", "Vino blanco", "Romero", "Aceite de oliva", "Sal"],
    method: [
      "Dora el conejo troceado con cabezas de ajo enteras.",
      "Añade vino blanco y romero.",
      "Estofa tapado 35 minutos hasta tiernizar.",
      "Sirve calentito, mojando pan en la salsa."
    ]
  },
  { id: "sopa-fideos-albondiguillas", title: "Sopa de fideos con albóndiguillas", meal: "cena",
    ingredients: ["Fideos", "Carne picada", "Cebolla", "Tomates", "Caldo"],
    method: [
      "Mezcla la carne picada con especias y forma albóndiguillas pequeñas.",
      "Dóralas y resérvalas.",
      "Haz un sofrito cebolla-tomate y moja con caldo.",
      "Cuece los fideos 8 minutos y añade las albóndiguillas."
    ]
  },
  { id: "salmorejo-cordobes", title: "Salmorejo cordobés", meal: "cena",
    ingredients: ["Tomates maduros", "Pan del día anterior", "Ajos", "Aceite de oliva virgen extra", "Huevos", "Jamón serrano"],
    method: [
      "Tritura los tomates maduros con el pan remojado y el ajo.",
      "Emulsiona con aceite de oliva hasta que quede espeso y rosado.",
      "Sirve bien frío con huevo duro picado y taquitos de jamón."
    ]
  },
  { id: "ajo-blanco-uvas", title: "Ajo blanco con uvas", meal: "cena",
    ingredients: ["Pan", "Ajos", "Almendras molidas", "Aceite de oliva", "Vinagre", "Uvas"],
    method: [
      "Tritura almendras, ajos y pan remojado.",
      "Emulsiona con aceite y vinagre.",
      "Ajusta con agua fría hasta consistencia de crema ligera.",
      "Sirve bien frío con uvas peladas."
    ]
  },
  { id: "tosta-cabra-cebolla", title: "Tosta de queso de cabra con cebolla caramelizada", meal: "cena",
    ingredients: ["Pan", "Queso de cabra", "Cebolla", "Azúcar", "Vino blanco"],
    method: [
      "Carameliza la cebolla en juliana con azúcar y vino blanco.",
      "Tuesta el pan.",
      "Coloca el queso de cabra y gratínalo.",
      "Corona con la cebolla caramelizada caliente."
    ]
  },
  { id: "montadito-anchoa-piparra", title: "Montadito de anchoa y piparra", meal: "cena",
    ingredients: ["Pan", "Anchoas del Cantábrico", "Piparras", "Aceite de oliva"],
    method: [
      "Tuesta el pan en rebanadas pequeñas.",
      "Coloca una anchoa y una piparra cruzadas.",
      "Riega con aceite de oliva y sirve."
    ]
  },
  { id: "piquillos-bacalao-bechamel", title: "Pimientos del piquillo rellenos de bacalao", meal: "cena",
    ingredients: ["Pimientos del piquillo", "Bacalao desalado", "Leche", "Harina", "Mantequilla"],
    method: [
      "Haz una bechamel espesa con mantequilla, harina y leche.",
      "Mezcla con bacalao desmigado y deja enfriar.",
      "Rellena los pimientos del piquillo.",
      "Cubre con la bechamel restante y gratina al momento."
    ]
  },
  { id: "ensaladilla-rusa", title: "Ensaladilla rusa", meal: "cena",
    ingredients: ["Patatas", "Huevos", "Atún en lata", "Judías verdes", "Zanahorias", "Mayonesa"],
    method: [
      "Cuece las patatas y las zanahorias troceadas junto a los huevos.",
      "Añade las judías verdes los últimos minutos.",
      "Mezcla todo en dados con el atún escurrido y mayonesa.",
      "Enfría un rato antes de servir."
    ]
  },
  { id: "gambas-plancha-salgorda", title: "Gambas a la plancha con sal gorda", meal: "cena",
    ingredients: ["Gambas", "Sal gorda", "Aceite de oliva", "Perejil"],
    method: [
      "Pon una base de sal gorda en plancha o sartén fuerte.",
      "Asa las gambas 2 minutos por cara.",
      "Sirve con perejil y un hilo de aceite."
    ]
  },
  { id: "chipirones-encebollados", title: "Chipirones encebollados", meal: "cena",
    ingredients: ["Chipirones", "Cebolla", "Vino blanco", "Laurel", "Aceite de oliva"],
    method: [
      "Pocha la cebolla en juliana a fuego manso 15 minutos.",
      "Añade los chipirones limpios.",
      "Añade vino blanco y laurel.",
      "Estofa tapado 20 minutos."
    ]
  },
  { id: "sardinas-espeto", title: "Sardinas al espeto", meal: "cena",
    ingredients: ["Sardinas", "Sal gorda", "Limones"],
    method: [
      "Ensarta las sardinas por la espina en espeto o las hornea en bandeja.",
      "Sazona con sal gorda.",
      "Sirve justo al salir con limón al momento."
    ]
  },
  { id: "berenjenas-rellenas-carne", title: "Berenjenas rellenas de carne", meal: "cena",
    ingredients: ["Berenjenas", "Carne picada", "Tomates", "Cebolla", "Queso rallado"],
    method: [
      "Hornea las berenjenas por la mitad 25 minutos.",
      "Vacía la pulpa y saltéala con cebolla y carne picada.",
      "Rellena las mitades con la mezcla.",
      "Cubre con queso rallado y gratina."
    ]
  },
  { id: "solomillo-whisky", title: "Solomillo al whisky", meal: "cena",
    ingredients: ["Solomillo de cerdo", "Whisky", "Ajos", "Aceite de oliva", "Sal"],
    method: [
      "Sella el solomillo en plancha fuerte y resérvalo.",
      "En la misma sartén, machaca ajos con sal y vierte el whisky.",
      "Termina la salsa reducida un minuto.",
      "Corta el solomillo en medallones y baña con la salsa."
    ]
  },
  { id: "fritura-malaguena", title: "Fritura de pescado malagueña", meal: "cena",
    ingredients: ["Merluza", "Anillas de calamar", "Boquerones", "Harina", "Aceite de oliva para freír", "Limones"],
    method: [
      "Reboza el pescado limpio en harina con sal.",
      "Fríe en aceite bien caliente por tandas cortas.",
      "Escurre sobre papel de cocina y sazona.",
      "Sirve tan pronto con limón."
    ]
  },
  { id: "torta-mele", title: "Torta di mele (tarta de manzana italiana)", meal: "desayuno",
    ingredients: ["Manzanas", "Harina", "Huevos", "Azúcar", "Mantequilla", "Levadura química", "Canela"],
    method: [
      "Monta huevos y azúcar con mantequilla fundida.",
      "Incorpora harina, levadura y canela.",
      "Reparte la manzana en láminas por toda la masa.",
      "Hornea 40 minutos a 180°C."
    ]
  },
  { id: "tosta-ricotta-pistachos", title: "Tostada de ricotta con miel y pistachos", meal: "desayuno",
    ingredients: ["Pan", "Ricotta", "Miel", "Pistachos"],
    method: [
      "Tuesta el pan y úntalo con ricotta.",
      "Riega con miel a hilo.",
      "Termina con pistachos troceados."
    ]
  },
  { id: "frittata-espinacas", title: "Frittata de espinacas y parmesano", meal: "comida",
    ingredients: ["Huevos", "Espinacas", "Parmesano", "Cebolla", "Aceite de oliva"],
    method: [
      "Pocha la cebolla y añade las espinacas hasta marchitar.",
      "Mezcla con los huevos batidos y el parmesano.",
      "Cuaja a fuego medio tapada.",
      "Termina un minuto bajo el gratinador."
    ]
  },
  { id: "pasta-norma", title: "Pasta alla norma", meal: "comida",
    ingredients: ["Pasta", "Berenjenas", "Tomates", "Ricotta salada", "Albahaca"],
    method: [
      "Asa o fríe las berenjenas en dados.",
      "Rehoga el tomate y mezcla con las berenjenas.",
      "Saltea la pasta en la salsa fuera del fuego.",
      "Termina con ricotta salada rallada y albahaca."
    ]
  },
  { id: "bruschetta-tomate", title: "Bruschetta de tomate", meal: "comida",
    ingredients: ["Pan", "Tomates", "Ajos", "Albahaca", "Aceite de oliva", "Sal"],
    method: [
      "Tuesta el pan y frótalo con ajo.",
      "Mezcla tomate en dados con albahaca, aceite y sal.",
      "Reparte encima al momento de servir."
    ]
  },
  { id: "pasta-pesto-genoves", title: "Pasta al pesto genovés", meal: "comida",
    ingredients: ["Pasta", "Pesto", "Parmesano", "Piñones"],
    method: [
      "Cuece la pasta en agua con sal.",
      "Reserva agua de cocción.",
      "Mezcla el pesto con un chorro de agua de la pasta.",
      "Termina con parmesano y piñones tostados."
    ]
  },
  { id: "lasana-carne", title: "Lasaña de carne clásica", meal: "comida",
    ingredients: ["Láminas de lasaña", "Carne picada", "Tomates", "Bechamel", "Queso rallado"],
    method: [
      "Para el ragú, dora la carne picada en aceite 5-6 minutos hasta que pierda el rosa; añade el tomate triturado y cocina a fuego suave 20 minutos, hasta que espese y pierda el ácido.",
      "Monta alternando capas: láminas de lasaña, ragú (capa fina, no un río) y bechamel; remata con bechamel abundante y queso rallado.",
      "Si el paquete lo pide, escáldalas un minuto primero; las láminas para horno seco van tal cual.",
      "Hornea a 200 °C 35-40 minutos, hasta que burbujee por los bordes y se gratine el queso.",
      "Deja reposar 10 minutos antes de cortar: cortará limpio y sostendrá la ración."
    ]
  },
  { id: "pizza-margarita", title: "Pizza margarita casera", meal: "comida",
    ingredients: ["Harina", "Tomates triturados", "Mozzarella", "Albahaca", "Aceite de oliva", "Levadura"],
    method: [
      "Amasa harina, agua, levadura y sal; deja levar una hora.",
      "Estira la base fina y cubre con tomate triturado.",
      "Reparte la mozzarella y hornea al máximo 10 minutos.",
      "Termina con albahaca fresca y aceite crudo."
    ]
  },
  { id: "risotto-setas", title: "Risotto de setas", meal: "comida",
    ingredients: ["Arroz arborio", "Setas", "Caldo", "Cebolla", "Mantequilla", "Parmesano"],
    method: [
      "Pocha la cebolla y tosta ligeramente el arroz.",
      "Moja el arroz con caldo caliente, poco a poco, 18 minutos.",
      "Añade las setas salteadas a mitad de la cocción.",
      "Termina con mantequilla y parmesano."
    ]
  },
  { id: "pasta-carbonara", title: "Pasta a la carbonara italiana", meal: "comida",
    ingredients: ["Espaguetis", "Panceta", "Huevos", "Parmesano", "Pimienta negra"],
    method: [
      "Dora la panceta en dados sin añadir aceite.",
      "Mezcla huevos con parmesano y pimienta.",
      "Fuera del fuego, saltea la pasta con la panceta y la mezcla.",
      "Ajusta con agua de cocción hasta que quede cremosa (sin nata)."
    ]
  },
  { id: "pasta-aglio-olio", title: "Espaguetis aglio e olio", meal: "cena",
    ingredients: ["Espaguetis", "Ajos", "Aceite de oliva", "Guindilla", "Perejil"],
    method: [
      "Funde los ajos laminados con la guindilla en aceite.",
      "Cuece la pasta al dente y reserva agua.",
      "Saltea la pasta en el aceite con un chorro de agua de cocción.",
      "Termina con perejil picado."
    ]
  },
  { id: "pasta-amatriciana", title: "Espaguetis a la amatriciana", meal: "cena",
    ingredients: ["Espaguetis", "Panceta", "Tomates", "Pecorino", "Guindilla"],
    method: [
      "Dora la panceta con un poco de guindilla.",
      "Añade el tomate triturado y reduce 10 minutos.",
      "Mezcla la pasta con la salsa fuera del fuego.",
      "Termina con pecorino rallado."
    ]
  },
  { id: "noquis-tomate-albahaca", title: "Ñoquis con tomate y albahaca", meal: "cena",
    ingredients: ["Ñoquis", "Tomates", "Albahaca", "Parmesano", "Ajos"],
    method: [
      "Haz una salsa de tomate con ajo y albahaca.",
      "Saltea los ñoquis en la salsa hasta que doren ligeramente.",
      "Termina con parmesano y albahaca fresca."
    ]
  },
  { id: "berenjena-parmigiana", title: "Berenjena a la parmigiana", meal: "cena",
    ingredients: ["Berenjenas", "Tomates", "Mozzarella", "Parmesano", "Albahaca"],
    method: [
      "Corta las berenjenas en láminas de medio centímetro, sal, déjalas sudar 30 minutos en un colador y sécalas: soltarán la amargura.",
      "Ásalas en el horno a 200 °C con un hilo de aceite, 10-12 minutos por lado — menos aceite que la fritura y salen igualmente sedosas.",
      "Mientras, cocina el tomate triturado con ajo y un chorrito de aceite 15 minutos, hasta que espese y no cunda ácido.",
      "Monta capas alternas en una fuente: tomate, berenjena, mozzarella troceada y parmesano; alarga 2-3 pisos y remata con parmesano.",
      "Hornea a 180 °C 30-35 minutos, hasta que burbujee y se gratine.",
      "Deja reposar 15 minutos antes de cortar: los sabores se asientan y no se derrama al servir."
    ]
  },
  { id: "ossobuco-milan", title: "Osso buco a la milanesa", meal: "cena",
    ingredients: ["Jarretes de ternera", "Cebolla", "Zanahorias", "Apio", "Vino blanco", "Tomates"],
    method: [
      "Sella los jarretes de ternera en aceite caliente.",
      "Añade el sofrito de cebolla, zanahoria y apio.",
      "Moja con vino blanco y añade tomate.",
      "Estofa tapado 2 horas a fuego suave hasta tiernizar."
    ]
  },
  { id: "scaloppine-limon", title: "Scaloppine al limón", meal: "cena",
    ingredients: ["Filetes finos de ternera", "Limones", "Mantequilla", "Harina", "Vino blanco"],
    method: [
      "Pasa los filetes finos por harina y dóralos en mantequilla.",
      "Retíralos y desglasa con zumo de limón y vino blanco.",
      "Termina la salsa con mantequilla fría.",
      "Baña los scaloppine con la salsa al servir."
    ]
  },
  { id: "polenta-parmesano", title: "Polenta cremosa con parmesano", meal: "cena",
    ingredients: ["Harina de maíz", "Caldo", "Mantequilla", "Parmesano"],
    method: [
      "Hierve el caldo y vierte la harina de maíz en lluvia, removiendo sin parar.",
      "Remueve 30 minutos a fuego bajo.",
      "Termina con mantequilla y parmesano hasta quedar cremosa.",
      "Sirve en plato hondo."
    ]
  },
  { id: "minestrone-verduras", title: "Minestrone de verduras", meal: "cena",
    ingredients: ["Zanahorias", "Apio", "Cebolla", "Judías blancas cocidas", "Tomates", "Pasta pequeña", "Caldo"],
    method: [
      "Pocha el trío de zanahoria, apio y cebolla.",
      "Añade tomate, judías y caldo.",
      "Cuece 20 minutos y añade la pasta pequeña.",
      "Termina cuando la pasta esté al dente."
    ]
  },
  { id: "saltimbocca-romana", title: "Saltimbocca a la romana", meal: "cena",
    ingredients: ["Filetes finos de ternera", "Salvia", "Jamón cocido en lonchas", "Mantequilla", "Vino blanco"],
    method: [
      "Coloca salvia y una loncha de jamón sobre cada filete.",
      "Sujeta con palillo y dóralos en mantequilla.",
      "Desglasa con vino blanco.",
      "Sirve calentito bañado con la salsa."
    ]
  },
  { id: "tiramisu-casero", title: "Tiramisú casero", meal: "cena",
    ingredients: ["Mascarpone", "Huevos", "Soletillas", "Café", "Cacao en polvo", "Azúcar"],
    method: [
      "Monta yemas con azúcar y mezcla con mascarpone.",
      "Monta las claras y integra con movimientos suaves.",
      "Moja las soletillas en café y monta capas alternas.",
      "Enfriar 4 horas y espolvorea cacao justo antes de servir."
    ]
  }
];

});

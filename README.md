# 🍳 Mr Cheff

Tu asistente de cocina inteligente en tu bolsillo

`Web App (vanilla JS, sin framework)` · `📱 PWA instalable` · `100% local — sin servidor`

## 📦 Control de Alimentos en Casa

Mantén un inventario actualizado de los alimentos que tienes en casa. La aplicación te envía un **recordatorio semanal** indicando qué productos faltan.

- Cada alimento tiene una `puntuación de 1 a 10` que indica qué tan indispensable es.
- Basándose en esa puntuación, Mr Cheff te avisa **cuándo es necesario ir a reponer** un alimento.
- Control sencillo para saber siempre qué tienes y qué necesitas comprar.
- Los productos **no alimentarios** (detergente, higiene…) viven aparte, fuera de todo lo de cocina, con su propia sección 🏠.
- **🎫 Escáner del ticket de la compra**: fotografía el ticket del súper y los productos se confirman en dos diálogos dentro de la misma pestaña — los que ya están en tu inventario **suman lo comprado** y lo nuevo se define al momento (nombre, cantidad, importancia y mínimo). La foto nunca sale de tu dispositivo.

## 📝 Recetas Estructuradas + Buscador del Catálogo

Cada vez que cocines algo, descríbelo con tus palabras y Mr Cheff lo convierte en una **receta estructurada** con ingredientes y método de preparación — sin perder ingredientes ni pasos, aunque las escribas como te salga.

- Etiqueta cada receta como `Desayuno`, `Comida` o `Cena`, revisa el modal antes de guardarla y **✏️ Edita** cualquier receta guardada (título, ingredientes, pasos) cuando cambie tu costumbre.
- Se almacenan de forma permanente para consultarlas en el futuro.
- **🔎 Buscador del catálogo**: además, hay un catálogo curado de **200 platos españoles e italianos** — busca por `título` y basta con las primeras letras: «croqu», «gamb» o «tortill» ya sacan Croquetas, Gambas al ajillo o Tortilla, sin escribir la palabra completa. Abre el detalle en el modal con un click.
- **⚠️ Falta / ✅ en casa**: cada tarjeta de receta (Mis Recetas, buscador, Innovación y la Sugerencia de hoy) y el modal de detalle te avisan al instante de qué ingredientes **no tienes** — comprar lo que faltaba quita el aviso en el momento.
- **Badge de origen**: toda receta que se vea en la app (catálogo, plan, modal) lleva su sello `Receta española` / `Receta italiana`. Si guardas una copia (⭐ o ✏️), el origen se **sella en el momento del guardado** y no cambia si luego renombras.

## 🗓️ Sugerencias y Menú Semanal

La pestaña `Sugerencias y menú` turna un **lote rotado de recetas** que puedes cocinar HOY con lo que ya tienes, y compone un **plan semanal de 7 días × 3 comidas** (desayuno, comida y cena) según la despensa y tus recetas.

- **Aprobar el plan** fija cada receta a su día: cada cocinada entra en un `cooldown de 7 días` para no repetir platos a las pocas horas; además, las recetas guardadas en `Mis Recetas` quedan fuera de los huecos hasta que las borres.
- Por cada hueco del plan: **🍳 Cocinar** anota la cocción y cambia ese slot (sin regenerar el plan entero) o **🔄 Cambiar** recorre el ranking sin oscilar.
- El botón **🍳 Cocinar hoy** del detalle de la receta es el único que lleva **consejo del chef**: en móvil manténlo pulsado un momento y suéltalo sin cocinar, o pásale el ratón en escritorio, y aparecerá una **píldora de consejo** con pistas antes de poner los fogones.
- La **lista de la compra** se dedup por ingredientes y el **color de cada fila lo manda la prioridad del alimento en tu inventario**: `rojo` indispensable, `naranja` importante, `verde` se puede esperar (sin registro, la fila sale neutral al final). Y solo desaparece cuando hay en casa **más unidades que el mínimo necesario**: lo que se vuelve a gastar reaparece.
- Al marcar **✅ comprado**, pregunta cuánto has comprado, su importancia y el mínimo para la alerta: nada se cuela sin datos; si el alimento ya estaba, se actualiza con lo nuevo.
- Y si un ingrediente de la lista ya lo tienes en casa con **otro nombre** («Jamón serrano» frente a «Jamón ibérico»), aparece el botón **🛒 Despensa?**: eliges la variante (o nada) y la compra se anota **en ese alimento de tu despensa**, sin crear uno nuevo.

## 💡 Sección de Innovación

Descubre **platos reales del catálogo curado** rankeados para tu despensa: se prioriza lo que más ingredientes tienes, con rotación (las ya sugeridas quedan excluidas) para que no se pegue siempre lo mismo.

- Vienen **en el mismo formato** en que se guardan tus recetas: con ingredientes, cantidades y método paso a paso.
- Puedes **guardarlas para siempre** si te gustan.
- Si no las guardas, se eliminan automáticamente **al acabar el día**.

> Ideal para evitar el aburrimiento en la cocina y aprovechar los ingredientes que ya tienes.

## 🥦 Buscador de Temporada

Consulta qué **fruta y verdura de temporada** está disponible.

- Busca cualquier producto y descubre cuándo está en su mejor momento.
- Perfecto para comprar productos frescos y de calidad al mejor precio.

## 📱 Instalable como App (PWA)

Sin tiendas de aplicaciones: la webapp es una **PWA completa** — manifest, service worker y **funciona sin conexión** — instalable directamente desde el navegador.

- **Escritorio** (Brave / Chrome / Edge): ⋮ → `Guardar y compartir` → **Instalar página como aplicación…**
- **iPhone**: Safari → Compartir → **Añadir a pantalla de inicio**.
- **En móvil**, desliza a los lados para cambiar de pestaña: cada vista **recuerda dónde te quedaste** al volver; pulsar la categoría del menú superior, en cambio, te sube arriba con una animación suave.
- **La primera vez**, una visita guiada por dentro de la app te enseña lo esencial (anotar alimentos, escanear un ticket en demo, guardar recetas, aprobar tu semana); se puede revisar cuando quieras con el botón 🎓 de la cabecera.
- Una vez instalada, abre a pantalla completa con icono y nombre propios, y funciona **sin internet** (el app-shell y tus datos están en el dispositivo; la importación/exportación de copias te permite mover el estado entre ellos).

> Todo vive en tu dispositivo: una vez instalada no necesita conexión para nada de lo esencial.

## 🗄️ Copia de Seguridad

Los datos se guardan en **este navegador**. Como cada navegador los guarda por separado, para que también aparezcan en **otro navegador o dispositivo** los exportas a un archivo y los vuelves a importar allí.

- En la pestaña `Copia de seguridad` pulsa **⬇️ Exportar**: se descarga un archivo `.json` con fecha/hora reales, con tus alimentos, recetas e ideas.
- Para llevarlo a otro lugar, abre la app en ese navegador o dispositivo y pulsa **⬆️ Importar** eligiendo el archivo.
- Al importar, los alimentos se suman **sin duplicar** por nombre y las recetas se añaden: no se borra nada de lo que ya había.
- **Sincronización directa entre dispositivos**: en la misma pestaña, la tarjeta `⇄ Sync entre dispositivos` une tu móvil PWA y tu escritorio usando un **gist privado de GitHub** como buzón. Todo viaja **cifrado de extremo a extremo** con tu passphrase, que **nunca se guarda** — solo vive en la sesión y se vuelve a pedir al reabrir la app. Un clic en **🔄 Sync** hace una única pasada (nada automático en segundo plano) y si ambos dispositivos editaron lo mismo, un modal **lado a lado** te deja elegir qué conservar.

---

Mr Cheff · Tu asistente de cocina, 100% en tu navegador

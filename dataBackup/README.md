# Copia de seguridad de Mr Cheff

Guarda aquí los archivos de copia de seguridad de la app.

## Cómo funciona

1. Abre `webapp/index.html` en el navegador y ve a la pestaña **Alimentos**.
2. Pulsa **⬇️ Exportar**: se descargará `mrcheff-backup-AAAA-MM-DD.json`. Guárdalo en
   esta carpeta `dataBackup/`.
3. Para llevar los datos a **otro navegador o dispositivo**, abre `index.html` allí y pulsa
   **⬆️ Importar**, eligiendo ese archivo `.json`.

## Notas

- La app es una **página web estática**: el navegador descarga el archivo a tu carpeta de
  *Descargas*; no puede escribir por sí sola en esta carpeta. Mover el archivo aquí es opcional.
- Los datos se guardan **en cada navegador por separado** (`localStorage`). Por eso, para
  compartir entre navegarios o dispositivos hay que exportar e importar. No hay una base de
  datos local que comparta los datos entre navegadores sola.
- El archivo incluye **alimentos, recetas e ideas de innovación**.
- Al **importar**, los alimentos se suman sin duplicar por nombre y las recetas se añaden; no se
  borra nada de lo que ya había.
- `ejemplo.json` es una copia de muestra lista para probar el botón **Importar**.

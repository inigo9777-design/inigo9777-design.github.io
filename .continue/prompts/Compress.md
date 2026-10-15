---
name: Compress
description: Resume esta conversación en un resumen autocontenido y sin repeticiones, para pasarle un resumen en markdown a una nueva sesión
invokable: true
---

Resume esta conversación en un bloque autocontenido con EXACTAMENTE estas secciones y nada más, en markdown plano (sin frontmatter):

# Contexto de tarea — [nombre corto]
_Fecha: hoy · Modelo: qwen3.8:27b-mlx_

## Objetivo
## Estado actual
## Siguiente paso
## Archivos relevantes  (con rutas)
## Decisiones y restricciones
## Pendiente / sin resolver

Formato: bullet points densos. Este texto se pegará en un chat nuevo para seguir sin perder contexto.

Acciones: Si puedes ejecutar tu mismo la copia del resumen, iniciar un chat nuevo y pasarle el contexto resumido, hazlo, sino imprimelo por pantalla. 
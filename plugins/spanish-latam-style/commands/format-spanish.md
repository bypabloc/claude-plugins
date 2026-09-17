---
description: Reescribe un texto o archivo asegurando español neutro latinoamericano estándar (tuteo profesional, sin voseo ni peninsularismos).
argument-hint: <ruta_archivo | texto>
allowed-tools: [Read, Write, Edit]
---

# Formateo y Conversión a Español Neutro

El usuario ha invocado este comando con el argumento: `$ARGUMENTS`

## Instrucciones de Ejecución

1. **Obtener el contenido:**
   - Si `$ARGUMENTS` es una ruta de archivo existente, lee su contenido.
   - Si `$ARGUMENTS` es texto proporcionado en la línea de comando, utilízalo como entrada.

2. **Transformación:**
   Reescribe el contenido aplicando de forma rigurosa:
   - Tuteo estándar formal (*tú tienes, mira, haz, dime, puedes*).
   - Sustitución de todo voseo morfológico y pronominal.
   - Corrección de enclíticos graves a esdrújulas acentuadas (*avísame*, *muéstrame*, *explícame*).
   - Conversión de terminología peninsular (*archivo* en vez de *fichero*, *computadora* en vez de *ordenador*).
   - Reemplazo de modismos informales por equivalentes profesionales y directos.
   - Preservación de bloques de código, nombres de funciones y variables, y términos técnicos estándar en inglés.

3. **Aplicación / Presentación:**
   - Si se indicó un archivo y el usuario solicitó editarlo, aplica los cambios mediante la herramienta adecuada.
   - De lo contrario, muestra el texto formateado en un bloque de código o sección clara para revisión del usuario.

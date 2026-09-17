---
description: Audita un archivo, fragmento de texto o mensaje para detectar voseo, peninsularismos o modismos regionales en español.
argument-hint: [ruta_archivo | texto]
allowed-tools: [Read, Grep, Glob, Bash]
---

# Auditoría de Estilo en Español Neutro

El usuario ha invocado este comando con el argumento: `$ARGUMENTS`

## Instrucciones de Ejecución

1. **Analizar el argumento:**
   - Si `$ARGUMENTS` corresponde a una ruta de archivo existente, lee su contenido con la herramienta `Read`.
   - Si `$ARGUMENTS` es un fragmento de texto directo, analízalo directamente.
   - Si no se proporcionó ningún argumento, audita los últimos mensajes de commit (`git log -n 5 --oneline`) o el archivo `README.md` del proyecto.

2. **Detección de desviaciones:**
   Examina el texto buscando:
   - **Voseo verbal:** formas como *tenés, hacés, podés, mirá, hacé, decime, avisame, probá*.
   - **Voseo o pronombre peninsular:** *vos, a vos, vosotros, os*.
   - **Peninsularismos léxicos:** *fichero, ordenador, vale*.
   - **Modismos rioplatenses:** *che, laburo, pibe, bárbaro, dale, posta, acá*.
   - **Barbarismos verbales:** *buildear, deployar, debuggear, commitear, mergear*.

3. **Reporte de resultados:**
   Entrega un informe estructurado en formato Markdown con:
   - Resumen del estado general (Aprobado o Requiere corrección).
   - Tabla detallada de hallazgos con: línea/ubicación, término detectado, categoría y reemplazo sugerido en español neutro.
   - Versión corregida lista para aplicar si se detectaron problemas.

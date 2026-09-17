---
name: audit-spanish-style
description: Este skill debe usarse cuando el usuario solicite "auditar español", "revisar estilo de idioma", "buscar voseos", "verificar español neutro", o requiera analizar archivos, commits o textos para detectar desviaciones dialectales o modismos no estándar.
version: 1.0.0
---

# Auditoría y Corrección de Estilo en Español Neutro

## Propósito

Este skill proporciona un procedimiento sistemático para analizar textos, archivos de documentación, comentarios de código o mensajes de git, identificando expresiones en voseo, peninsularismos y términos informales regionales, y entregando una propuesta de reemplazo alineada con el estándar latinoamericano neutro.

## Procedimiento de Auditoría

1. **Revisión de Formas Verbales (Voseo Morfológico):**
   - Localiza terminaciones agudas en segunda persona (*-ás*, *-és*, *-ís* con valor de presente, o imperativos agudos terminados en vocal tónica: *mirá, tené, hacé, probá*).
   - Localiza imperativos enclíticos con acentuación grave en lugar de esdrújula (*decime, avisame, mostrame, contame*).
2. **Revisión Pronominal:**
   - Detecta apariciones de *vos*, *con vos*, o de *vosotros*, *os*.
3. **Revisión Léxica Regional:**
   - Identifica términos peninsulares (*fichero, ordenador, móvil, vale*).
   - Identifica jerga rioplatense (*che, laburo, pibe, bárbaro, dale, posta*).
4. **Revisión de Anglicismos y Barbarismos:**
   - Detecta verbalizaciones forzadas (*buildear, deployar, debuggear, commitear, mergear*).
5. **Generación del Reporte:**
   - Presenta las ocurrencias encontradas con número de línea, texto original, explicación del desvío y texto corregido sugerido.

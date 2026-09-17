---
description: Instala o actualiza la regla language-style.md en el proyecto actual (.claude/rules/) o a nivel de usuario global (~/.claude/rules/).
argument-hint: [project | global]
allowed-tools: [Read, Write, Bash]
---

# Instalación de Regla de Estilo de Idioma

El usuario ha invocado este comando con el argumento: `$ARGUMENTS`

## Instrucciones de Ejecución

1. **Determinar el destino:**
   - Si `$ARGUMENTS` contiene `global` o `-g`: el destino será `~/.claude/rules/language-style.md` (o `%USERPROFILE%\.claude\rules\language-style.md` en Windows).
   - De forma predeterminada o si contiene `project`: el destino será `.claude/rules/language-style.md` en el directorio raíz del proyecto actual (`$CLAUDE_PROJECT_DIR`).

2. **Copiar la regla:**
   - Lee el contenido de la regla reforzada ubicada en `${CLAUDE_PLUGIN_ROOT}/rules/language-style.md`.
   - Crea el directorio de destino si no existe.
   - Escribe el archivo en la ruta de destino.

3. **Confirmación:**
   - Informa al usuario la ruta exacta donde se instaló la regla.
   - Explica que Claude Code cargará automáticamente esta regla a partir de ese momento.

# Claude Code Plugin: Spanish LATAM Style (`spanish-latam-style`)

Plugin oficial para **Claude Code** que aplica, refuerza y audita de manera continua el uso de **español neutro latinoamericano estándar** (registro profesional, tuteo técnico, sin voseo ni modismos regionales) en interacciones de terminal, documentación, commits y código.

---

## 1. Investigación Exhaustiva: Arquitectura de Plugins en Claude Code

### ¿Qué es un plugin en Claude Code?
En Claude Code (CLI oficial de Anthropic), un plugin es una unidad autónoma y versionada de extensión que permite empaquetar y distribuir capacidades avanzadas sin depender de configuraciones manuales en cada repositorio. A diferencia de `CLAUDE.md` (que es específico de un proyecto) o las reglas locales en `.claude/rules/`, un plugin puede instalarse globalmente, compartirse entre equipos o publicarse en marketplaces.

### Estructura canónica de un plugin
Claude Code utiliza un modelo de **auto-descubrimiento por convención de directorios**:

```
claude-plugin-spanish-latam/
├── .claude-plugin/
│   └── plugin.json          # Manifiesto obligatorio del plugin (metadatos e identidad)
├── rules/                    # Reglas modulares (.md) para guiar el comportamiento
│   └── language-style.md
├── skills/                   # Habilidades activadas autónomamente por el modelo
│   ├── spanish-latam-style/
│   │   └── SKILL.md
│   └── audit-spanish-style/
│       └── SKILL.md
├── commands/                 # Slash commands invocados explícitamente por el usuario
│   ├── audit-spanish.md      # /audit-spanish
│   ├── format-spanish.md     # /format-spanish
│   └── install-rule.md       # /install-rule
├── hooks/                    # Automatizaciones y guardas deterministas por eventos
│   └── hooks.json
├── scripts/                  # Scripts ejecutables y herramientas utilitarias
│   ├── check_spanish_style.py
│   ├── install_rule.py
│   ├── session-start.py
│   └── session-start.sh
├── tests/                    # Pruebas unitarias automatizadas
│   ├── test_hook.py
│   ├── test_linter.py
│   └── test_manifest.py
├── LICENSE                   # Licencia de código abierto (MIT)
└── README.md                 # Documentación completa
```

### Reglas críticas de arquitectura en Claude Code
1. **Ubicación del manifiesto:** El archivo `plugin.json` debe residir estrictamente en `.claude-plugin/plugin.json`.
2. **Nivel raíz de componentes:** Los directorios `skills/`, `commands/`, `hooks/`, `agents/` y `rules/` deben situarse en la raíz del plugin, nunca anidados dentro de `.claude-plugin/`.
3. **Portabilidad con `${CLAUDE_PLUGIN_ROOT}`:** Toda ruta interna utilizada en hooks, scripts o configuraciones debe referenciar `${CLAUDE_PLUGIN_ROOT}` para garantizar que funcione sin importar si el usuario instala el plugin desde un marketplace, mediante git o en disco local.
4. **Validación formal:** Claude Code proporciona el comando `claude plugin validate --strict <path>` para verificar la integridad del esquema antes de distribución.

---

## 2. La Regla Reforzada de Idioma (`language-style.md`)

### Justificación lingüística y de ingeniería de prompts
Los modelos de lenguaje grande (LLM) tienden a sufrir dos fenómenos en conversaciones prolongadas:
1. **Deriva contextual (*Context Drift*):** A medida que la ventana de contexto crece, las instrucciones iniciales de estilo pierden peso relativo, provocando que el modelo alterne entre tuteo, voseo o conjugaciones peninsulares.
2. **Reflejo dialectal (*Mirroring*):** Si el usuario escribe preguntas con voseo (*"mirá"*, *"fijate"*, *"decime"*, *"tenés"*), el modelo suele imitar ese dialecto involuntariamente.

Para neutralizar ambos problemas, la regla fue reforzada con:
- **Etiquetas semánticas XML** (`<language_guidelines>`, `<prohibiciones_estrictas>`, `<tabla_conjugaciones_obligatorias>`, `<principio_anti_espejo>`) que maximizan la atención de Claude.
- **Principio anti-espejo explícito:** Instrucción directa de mantener español neutro sin importar la variedad lingüística empleada por el usuario.
- **Inyección por ciclo de vida (`SessionStart` hook):** La regla se inyecta programáticamente mediante `hookSpecificOutput` (`additionalContext`) en cada inicio de sesión, impidiendo la deriva de memoria.
- **Lista de verificación previa a la emisión:** Protocolo de autoevaluación reflexiva para corregir acentuación enclítica y terminaciones agudas antes de emitir texto.

### Tabla de equivalencias clave

| Categoría | Expresión Prohibida (Voseo / Peninsular) | Expresión Obligatoria (Español Neutro Estándar) |
| :--- | :--- | :--- |
| **Imperativo** | *mirá* / *fijate* | **mira** / **revisa** / **observa** |
| **Imperativo** | *hacé* | **haz** |
| **Imperativo** | *decí* / *decime* | **di** / **dime** |
| **Imperativo** | *avisame* / *mostrame* / *explicame* | **avísame** / **muéstrame** / **explícame** |
| **Imperativo** | *probá* / *usá* / *ejecutá* | **prueba** / **usa** / **ejecuta** |
| **Presente indicativo** | *sos* / *tenés* / *podés* / *hacés* | **eres** / **tienes** / **puedes** / **haces** |
| **Pronombres** | *vos* / *a vos* / *con vos* | **tú** / **a ti** / **contigo** |
| **Pronombres plurales** | *vosotros* / *os* / *vuestro* | **ustedes** / **les** / **su** |
| **Léxico técnico** | *fichero* | **archivo** |
| **Léxico técnico** | *ordenador* | **computadora** o **equipo** |
| **Léxico cotidiano** | *acá* / *laburo* / *bárbaro* / *che* | **aquí** / **trabajo** / **excelente** / *(omitir)* |
| **Barbarismos verbales** | *buildear* / *deployar* / *commitear* | **compilar** / **desplegar** / **hacer commit** |

---

## 3. Componentes del Plugin

### A. Skills
- **`spanish-latam-style`:** Se activa automáticamente cada vez que Claude Code responde, documenta, redacta commits o añade comentarios en código en español, forzando las pautas de tuteo neutro.
- **`audit-spanish-style`:** Procedimiento especializado para revisar y auditar fragmentos de texto o repositorios completos.

### B. Slash Commands
- **`/audit-spanish [archivo | texto]`:** Escanea un archivo o texto buscando voseo, peninsularismos o barbarismos y muestra un reporte detallado con sugerencias.
- **`/format-spanish <archivo | texto>`:** Transforma texto o código normalizando cualquier término regional al estándar neutro latinoamericano.
- **`/install-rule [project | global]`:** Copia la regla directamente en `.claude/rules/language-style.md` del repositorio activo o en `~/.claude/rules/` del usuario.

### C. Lifecycle Hooks
- **`SessionStart`:** Ejecuta `session-start.sh` (o `session-start.py`), inyectando el contenido de la regla en el contexto inicial de la sesión de Claude Code mediante `hookSpecificOutput` (`additionalContext`).

### D. Herramientas CLI Independientes
- **`check_spanish_style.py`:** Linter léxico escrito en Python 3 con soporte de salida estándar en consola y formato estructurado con `--json`:
  ```bash
  # Escanear un texto directo
  python scripts/check_spanish_style.py -t "Che, mirá este fichero y decime si podés buildearlo."

  # Escanear archivos o directorios
  python scripts/check_spanish_style.py --dir . --extensions .md,.py,.ts
  ```

---

## 4. Instalación y Uso

### Opción 1: Probar en modo desarrollo (Recomendado)
Puedes cargar el plugin directamente en cualquier sesión de Claude Code pasando el parámetro `--plugin-dir`:

```bash
claude --plugin-dir "D:/Users/pacg1/projects/bypabloc/claude-plugin-spanish-latam"
```

### Opción 2: Instalar la regla en el proyecto actual
Si deseas que la regla quede grabada permanentemente en un repositorio sin requerir el plugin activo:

```bash
python "D:/Users/pacg1/projects/bypabloc/claude-plugin-spanish-latam/scripts/install_rule.py"
```

O para instalarla de manera global en tu perfil de usuario:

```bash
python "D:/Users/pacg1/projects/bypabloc/claude-plugin-spanish-latam/scripts/install_rule.py" --global
```

### Opción 3: Validación del plugin con el CLI oficial
Para comprobar que el plugin cumple al 100% con los estándares de Anthropic:

```bash
claude plugin validate --strict "D:/Users/pacg1/projects/bypabloc/claude-plugin-spanish-latam"
```

---

## 5. Ejecución de Pruebas Automatizadas

El proyecto incluye una suite completa de pruebas unitarias:

```bash
# Ejecutar todas las pruebas
python -m unittest discover -s tests -p "test_*.py"
```

Pruebas cubiertas:
- `test_linter.py`: Verificación exhaustiva de detección de voseo, enclíticos llanos, peninsularismos, modismos y barbarismos verbales.
- `test_hook.py`: Validación del esquema JSON devuelto por el hook `SessionStart`.
- `test_manifest.py`: Verificación del archivo `plugin.json`, carpetas requeridas y metadatos.

---

## 6. Licencia

Este proyecto está distribuido bajo la licencia [MIT](LICENSE).

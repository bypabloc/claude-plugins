# Claude Code Plugin: Spanish LATAM Style (`spanish-latam-style`)

[![Claude Code Compatible](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet)](https://github.com/anthropics/claude-plugins-official)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Marketplace Ready](https://img.shields.io/badge/Marketplace-Verified-success)](https://github.com/bypabloc/claude-plugins)
[![Tests: 100%](https://img.shields.io/badge/Tests-Passing-brightgreen)](tests/)

> **Plugin oficial para Claude Code** que aplica, refuerza y audita de manera continua el uso de **español neutro latinoamericano estándar** (registro profesional, tuteo técnico, sin voseo ni modismos regionales) en respuestas de terminal, documentación técnica, mensajes de commit y comentarios de código.

---

## 1. ¿Para qué sirve y cuál es el objetivo?

Cuando trabajas en equipos de desarrollo internacionales en América Latina o en proyectos de código abierto en español, la consistencia lingüística es fundamental. El objetivo de este plugin es:

1. **Eliminar la inconsistencia dialectal:** Garantizar que todas las explicaciones, respuestas en terminal, commits y documentación se generen en **español neutro latinoamericano estándar** con **tuteo formal (`tú`)**.
2. **Proteger la documentación y el código:** Evitar que se filtren en tus repositorios términos coloquiales o regionalismos (como *fichero*, *ordenador*, *laburo*, *mirá*, *decime*, *che*).
3. **Estandarizar el vocabulario técnico:** Mantener los términos estándar de la industria en inglés (`commit`, `branch`, `endpoint`, `pull request`) sin caer en barbarismos verbales forzados (*buildear*, *deployar*, *commitear*).
4. **Automatización transparente:** Una vez instalado, el plugin opera en segundo plano mediante *lifecycle hooks* sin requerir configuración manual por proyecto.

---

## 2. ¿Por qué Claude habla con voseo o expresiones peninsulares?

Es común notar que Claude (e interactores de IA en general) a menudo utiliza formas de **voseo rioplatense** (*"mirá"*, *"fijate"*, *"decime"*, *"tenés"*) o **peninsularismos de España** (*"fichero"*, *"ordenador"*, *"vale"*). Esto ocurre por cuatro fenómenos de los modelos de lenguaje:

### A. Sobrerrepresentación en el corpus de entrenamiento
Gran parte del contenido técnico en español publicado en foros, blogs de programación y documentación de librerías proviene históricamente de España y de la región rioplatense (Argentina/Uruguay). El modelo asocia los contextos de software con estas variedades lingüísticas por probabilidad estadística.

### B. El fenómeno del "espejo dialectal" (*Dialectal Mirroring*)
Los modelos como Claude están entrenados para sintonizar con el estilo del usuario. Si formulas una consulta con un giro informal o regional (*"Che, fijate cómo arreglás esto"*), Claude tiende a reflejar o imitar ese dialecto involuntariamente, respondiendo con voseo (*"Mirá, acá tenés la solución..."*).

### C. Deriva contextual (*Context Drift*)
En sesiones de desarrollo extensas con miles de tokens de contexto, las instrucciones iniciales de estilo pierden peso relativo frente al historial de la conversación. Sin guardas deterministas, el modelo relaja sus pautas gramaticales a lo largo de la sesión.

### D. Ambigüedad morfológica en los imperativos enclíticos
El desliz más sutil ocurre en verbos con pronombre enclítico: en lugar de la forma esdrújula estándar con tilde (*dime*, *avísame*, *muéstrame*), el modelo suele emitir la forma llana grave propia del voseo (*decime*, *avisame*, *mostrame*).

---

## 3. ¿Qué hace la regla reforzada (`language-style.md`)?

Este plugin introduce una regla reforzada construida con técnicas avanzadas de ingeniería de prompts y guardas de ciclo de vida:

1. **Estructura XML de Máxima Adhesión:** Directrices jerarquizadas (`<language_guidelines>`, `<norma_principal>`, `<tratamiento_gramatical>`, `<principio_anti_espejo>`, `<prohibiciones_estrictas>`) que Claude interpreta como restricciones inviolables.
2. **Principio Anti-Espejo Expreso:** Instrucción taxativa para que Claude **nunca imite el dialecto del usuario**. Aunque el usuario consulte con modismos o voseo, Claude responde invariable y naturalmente en español neutro con tuteo formal.
3. **Inyección en Tiempo de Ejecución (`SessionStart` y `UserPromptSubmit` hooks):** Los hooks programáticos en Node.js inyectan las directrices en el contexto de cada sesión y consulta de forma transparente, eliminando la deriva contextual.
4. **Tabla de Conjugaciones Obligatorias:** Mapeo contrastivo de imperativos, presentes, subjuntivos y pronombres.
5. **Protocolo de Autoverificación Previa:** Protocolo mental reflexivo de 4 pasos que el modelo procesa antes de emitir cada mensaje.

### Tabla de Equivalencias Rápidas

| Categoría | Incorrecto (Voseo / Peninsular) | Correcto (Español Neutro Estándar) |
| :--- | :--- | :--- |
| **Imperativo** | *mirá* / *fijate* | **mira** / **revisa** / **observa** |
| **Imperativo** | *hacé* | **haz** |
| **Imperativo** | *decí* / *decime* | **di** / **dime** |
| **Imperativo** | *avisame* / *mostrame* / *explicame* | **avísame** / **muéstrame** / **explícame** |
| **Imperativo** | *usá* / *probá* / *ejecutá* | **usa** / **prueba** / **ejecuta** |
| **Presente indicativo** | *sos* / *tenés* / *podés* / *hacés* | **eres** / **tienes** / **puedes** / **haces** |
| **Pronombres** | *vos* / *a vos* / *con vos* | **tú** / **a ti** / **contigo** |
| **Pronombres plurales** | *vosotros* / *os* / *vuestro* | **ustedes** / **les** / **su** |
| **Léxico técnico** | *fichero* | **archivo** |
| **Léxico técnico** | *ordenador* | **computadora** o **equipo** |
| **Léxico cotidiano** | *acá* / *laburo* / *bárbaro* / *che* | **aquí** / **trabajo** / **excelente** / *(omitir)* |
| **Barbarismos verbales** | *buildear* / *deployar* / *commitear* | **compilar** / **desplegar** / **hacer commit** |

---

## 4. Guía de Instalación Rápida (2 Comandos)

Cualquier usuario puede instalar y activar el plugin en Claude Code ejecutando estos dos comandos en su terminal:

```bash
# 1. Registrar el marketplace público de bypabloc (solo una vez)
claude plugin marketplace add bypabloc/claude-plugins

# 2. Instalar y habilitar el plugin
claude plugin install spanish-latam-style@bypabloc
```

> [!NOTE]
> Si en tu terminal no tienes configuradas llaves SSH para GitHub, puedes utilizar alternativamente la URL HTTPS pública en el primer comando:
> ```bash
> claude plugin marketplace add https://github.com/bypabloc/claude-plugins
> claude plugin install spanish-latam-style@bypabloc
> ```

### Comprobar la instalación:
Para verificar que el plugin está activo y ver el inventario de componentes (5 skills, 1 lifecycle hook):

```bash
claude plugin list
claude plugin details spanish-latam-style
```

¡Listo! A partir de ese momento, Claude Code aplicará la regla en todas tus sesiones automáticamente.

---

### Método B: Probar en Modo Desarrollo (Sin Instalar)

Si deseas probar el plugin directamente desde el repositorio clonado:

```bash
git clone https://github.com/bypabloc/claude-plugin-spanish-latam.git
claude --plugin-dir "./claude-plugin-spanish-latam"
```

---

### Método C: Instalar únicamente la Regla en un Repositorio o Global

Si prefieres usar la regla sin instalar el plugin completo, puedes copiarla directamente:

```bash
# En el proyecto actual (.claude/rules/language-style.md)
python scripts/install_rule.py

# A nivel global de usuario (~/.claude/rules/language-style.md)
python scripts/install_rule.py --global
```

---

## 5. Comandos y Herramientas Incluidas

Una vez instalado el plugin, dispones de los siguientes comandos dentro de Claude Code:

| Comando | Descripción |
| :--- | :--- |
| `/audit-spanish [archivo \| texto]` | Escanea un archivo o texto buscando voseos, peninsularismos y barbarismos con un reporte detallado. |
| `/format-spanish <archivo \| texto>` | Reescribe o corrige un texto o archivo normalizándolo al estándar neutro latinoamericano. |
| `/install-rule [project \| global]` | Instala la regla `language-style.md` en el repositorio actual o en tu perfil global. |

### Linter CLI Independiente (`check_spanish_style.py`)

Incluye un analizador léxico en Python 3 ideal para pre-commit hooks o pipelines de CI/CD:

```bash
# Analizar una cadena de texto
python scripts/check_spanish_style.py -t "Hola, revisa si puedes compilar el proyecto."

# Salida estructurada en JSON
python scripts/check_spanish_style.py --json -t "Che decime si lo podés buildear"

# Escanear archivos de un directorio
python scripts/check_spanish_style.py --dir src/ --extensions .md,.py,.ts
```

---

## 6. ¿Cómo comprobar que funciona?

Puedes realizar una prueba headless automatizada ejecutando el CLI de Claude con un prompt que intente forzar voseo:

```bash
claude --permission-mode bypassPermissions \
  --disallowedTools "WebSearch" "WebFetch" \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --output-format json \
  -p "Che decime como haces para ejecutar los tests de este proyecto y fijate si me podes explicar que componentes tiene"
```

### Comprobación del resultado:
- Claude **no** imitará el *"Che"*, *"decime"*, *"haces"* con valor voseante ni *"fijate"*.
- Responderá usando tuteo formal neutro: *"Para ejecutar las pruebas... aquí tienes el detalle... dime si necesitas ayuda..."*.
- Puedes pasar la salida por el linter para confirmar 0 violaciones:
  ```bash
  python scripts/check_spanish_style.py -t "<respuesta de claude>"
  # Salida esperada: ✔ [OK] Estilo validado: No se detectaron expresiones de voseo, peninsularismos ni modismos regionales.
  ```

---

## 7. Verificación de Calidad y Pruebas

El plugin cuenta con validación oficial estricta de Anthropic y 100% de cobertura en sus pruebas unitarias:

```bash
# Validación formal de manifiesto
claude plugin validate --strict .

# Ejecución de la suite de pruebas unitarias
python -m unittest discover -s tests -p "test_*.py"
```

---

## 8. Licencia

Este proyecto está bajo la licencia [MIT](LICENSE). Creado y mantenido por [Pablo Contreras (@bypabloc)](https://github.com/bypabloc).

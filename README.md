# Claude Plugins Marketplace by @bypabloc

Marketplace oficial de plugins para Claude Code desarrollado y mantenido por Pablo Contreras ([@bypabloc](https://github.com/bypabloc)).

## Plugins Disponibles

### 1. `spanish-latam-style`
Aplica y refuerza el uso estricto de **español neutro latinoamericano estándar** (tuteo profesional, sin voseo ni modismos regionales) en interacciones, documentación técnica, mensajes de commit y comentarios de código en Claude Code.

- **Repositorio:** [https://github.com/bypabloc/claude-plugin-spanish-latam](https://github.com/bypabloc/claude-plugin-spanish-latam)

### 2. `session-handoff`
Handoff de sesión en disco (`tmp/handoff/<trabajo>/`) para **sesiones largas y trabajo con varios agentes**: lo reinyecta al iniciar, reanudar y compactar, no deja cerrar el turno mientras quede un siguiente paso, compacta sin pedirle un resumen al modelo y muestra sobre el prompt el estado del trabajo y las métricas de la sesión (costo estimado, tokens, tiempo, caché, pruebas y límites). Es un mod en TypeScript, sin dependencias externas, y funciona en cualquier proyecto; lo específico de cada uno va en un `.claude/session-handoff.json` opcional.

- **Repositorio:** [bypabloc/agent-plugin-session-handoff](https://github.com/bypabloc/agent-plugin-session-handoff) (espejo; el código vive en [bypabloc/agent-plugins](https://github.com/bypabloc/agent-plugins))
- **Instalar:** `claude plugin install session-handoff@bypabloc`
- Multi-agente desde 0.5.0: también Codex, Antigravity y OpenCode.

### 3. `synapse`
Guardrails de seguridad antes de cada tool: comandos destructivos, escrituras fuera del proyecto, lectura de `.env`, secretos y archivos protegidos (reglas deterministas + Laya System 1). Multi-agente desde 1.7.0: Claude Code, Codex, Antigravity y OpenCode.

- **Repositorio:** [bypabloc/agent-plugin-synapse](https://github.com/bypabloc/agent-plugin-synapse) (espejo; el código vive en [bypabloc/agent-plugins](https://github.com/bypabloc/agent-plugins))
- **Instalar:** `claude plugin install synapse@bypabloc`

> Para Codex, el marketplace multi-agente es [bypabloc/agent-plugins](https://github.com/bypabloc/agent-plugins) (`bypabloc-agents`): este catálogo usa fuentes `url` que Codex también lee.

---

## Guía Rápida de Instalación (2 Comandos)

Cualquier usuario puede instalar el plugin en Claude Code ejecutando:

```bash
# 1. Registrar el marketplace (solo una vez)
claude plugin marketplace add bypabloc/claude-plugins

# 2. Instalar el plugin
claude plugin install spanish-latam-style@bypabloc
```

> [!NOTE]
> Si no tienes llaves SSH de GitHub configuradas en tu terminal, puedes utilizar la URL HTTPS pública en el primer comando:
> ```bash
> claude plugin marketplace add https://github.com/bypabloc/claude-plugins
> claude plugin install spanish-latam-style@bypabloc
> ```

### Comprobar la instalación
```bash
claude plugin list
claude plugin details spanish-latam-style
```


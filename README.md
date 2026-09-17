# Claude Plugins Marketplace by @bypabloc

Marketplace oficial de plugins para Claude Code desarrollado y mantenido por Pablo Contreras ([@bypabloc](https://github.com/bypabloc)).

## Plugins Disponibles

### 1. `spanish-latam-style`
Aplica y refuerza el uso estricto de **español neutro latinoamericano estándar** (tuteo profesional, sin voseo ni modismos regionales) en interacciones, documentación técnica, mensajes de commit y comentarios de código en Claude Code.

- **Repositorio:** [https://github.com/bypabloc/claude-plugin-spanish-latam](https://github.com/bypabloc/claude-plugin-spanish-latam)

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


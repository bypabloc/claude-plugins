#!/usr/bin/env bash
set -e

# Obtener la ruta del directorio del plugin
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
RULE_FILE="${PLUGIN_ROOT}/rules/language-style.md"

if [ -f "$RULE_FILE" ]; then
  # Leer y escapar la regla en JSON
  RULE_CONTENT=$(cat "$RULE_FILE")
  python3 -c "
import json, sys, os
rule_path = sys.argv[1]
try:
    with open(rule_path, 'r', encoding='utf-8') as f:
        content = f.read()
except Exception:
    content = 'Comunícate siempre en español neutro latinoamericano estándar (tuteo estricto tú). Prohibido voseo y peninsularismos.'

output = {
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': content
    }
}
print(json.dumps(output, ensure_ascii=False))
" "$RULE_FILE" 2>/dev/null || python -c "
import json, sys, os
rule_path = sys.argv[1]
try:
    with open(rule_path, 'r', encoding='utf-8') as f:
        content = f.read()
except Exception:
    content = 'Comunícate siempre en español neutro latinoamericano estándar (tuteo estricto tú). Prohibido voseo y peninsularismos.'

output = {
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': content
    }
}
print(json.dumps(output, ensure_ascii=False))
" "$RULE_FILE" 2>/dev/null || cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "IDIOMA Y ESTILO OBLIGATORIO: Comunícate siempre en español neutro latinoamericano estándar (tuteo estricto tú). Prohibido el voseo morfológico y pronominal (vos, tenés, hacés, podés, mirá, decime, avisame), peninsularismos (fichero, ordenador, vale) y modismos rioplatenses (che, laburo, bárbaro). Consulta la regla language-style.md para más detalles."
  }
}
EOF
else
  cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "IDIOMA Y ESTILO OBLIGATORIO: Comunícate siempre en español neutro latinoamericano estándar (tuteo estricto tú). Prohibido el voseo morfológico y pronominal (vos, tenés, hacés, podés, mirá, decime, avisame), peninsularismos (fichero, ordenador, vale) y modismos rioplatenses (che, laburo, bárbaro). Consulta la regla language-style.md para más detalles."
  }
}
EOF
fi

exit 0

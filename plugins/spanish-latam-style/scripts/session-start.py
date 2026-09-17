#!/usr/bin/env python3
"""
SessionStart hook para Claude Code.
Inyecta las directrices de espanol neutro latinoamericano en el contexto de la sesion.
"""

import json
import os
import sys

def main():
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if not plugin_root:
        plugin_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    rule_file = os.path.join(plugin_root, "rules", "language-style.md")
    additional_context = ""

    if os.path.isfile(rule_file):
        try:
            with open(rule_file, "r", encoding="utf-8") as f:
                additional_context = f.read()
        except Exception as e:
            sys.stderr.write(f"Error al leer {rule_file}: {e}\n")

    if not additional_context:
        additional_context = (
            "IDIOMA Y ESTILO OBLIGATORIO: Comunícate siempre en español neutro "
            "latinoamericano estándar (tuteo profesional tú). Prohibido terminantemente "
            "el voseo (vos, tenés, podés, mirá, hacé, decime, avisame) y giros peninsulares "
            "(fichero, ordenador, vale). Revisa la regla language-style.md."
        )

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": additional_context
        }
    }

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    # Salida obligatoria en stdout con exit 0
    try:
        payload = json.dumps(output, ensure_ascii=False)
        sys.stdout.write(payload + "\n")
    except UnicodeEncodeError:
        payload = json.dumps(output, ensure_ascii=True)
        sys.stdout.write(payload + "\n")

    sys.stdout.flush()
    sys.exit(0)

if __name__ == "__main__":
    main()

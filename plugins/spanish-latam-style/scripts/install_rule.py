#!/usr/bin/env python3
"""
Script utilitario para instalar la regla language-style.md
en el proyecto actual (.claude/rules/) o a nivel global (~/.claude/rules/).
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Instala la regla language-style.md para Claude Code.")
    parser.add_argument("--global", "-g", dest="is_global", action="store_true", help="Instalar en el directorio global del usuario (~/.claude/rules/).")
    parser.add_argument("--target-dir", help="Directorio destino personalizado donde crear .claude/rules/.")

    args = parser.parse_args()

    # Encontrar la regla en el plugin
    script_dir = Path(__file__).resolve().parent
    plugin_root = script_dir.parent
    source_rule = plugin_root / "rules" / "language-style.md"

    if not source_rule.exists():
        try:
            print(f"✖ Error: No se encontró el archivo fuente en {source_rule}")
        except UnicodeEncodeError:
            print(f"[X] Error: No se encontró el archivo fuente en {source_rule}")
        sys.exit(1)

    if args.is_global:
        dest_dir = Path.home() / ".claude" / "rules"
    elif args.target_dir:
        dest_dir = Path(args.target_dir) / ".claude" / "rules"
    else:
        # Usar CLAUDE_PROJECT_DIR si existe, o el directorio actual de trabajo
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
        dest_dir = Path(project_dir) / ".claude" / "rules"

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / "language-style.md"

    shutil.copy2(source_rule, dest_file)
    try:
        print(f"✔ Regla language-style.md instalada correctamente en:")
    except UnicodeEncodeError:
        print(f"[OK] Regla language-style.md instalada correctamente en:")
    print(f"  {dest_file}")
    print("\nClaude Code cargará automáticamente esta regla a partir de la próxima interacción.")

if __name__ == "__main__":
    main()

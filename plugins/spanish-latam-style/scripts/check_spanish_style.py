#!/usr/bin/env python3
"""
Linter y analizador léxico de estilo en español para Claude Code.
Detecta formas de voseo, peninsularismos, modismos regionales y barbarismos verbales.
"""

import argparse
import json
import os
import re
import sys
from typing import Dict, List, Tuple

# Reglas de detección con categoría, patrón regex y sugerencias de reemplazo
STYLE_RULES: List[Dict[str, any]] = [
    {
        "category": "voseo_imperativo_agudo",
        "description": "Imperativo agudo característico de voseo",
        "patterns": [
            (r"\b(mirá)\b", "mira / revisa"),
            (r"\b(fijate)\b", "revisa / observa"),
            (r"\b(hacé)\b", "haz"),
            (r"\b(decí)\b", "di / dime"),
            (r"\b(tené)\b", "ten"),
            (r"\b(andá)\b", "ve / anda"),
            (r"\b(usá)\b", "usa"),
            (r"\b(probá)\b", "prueba"),
            (r"\b(ejecutá)\b", "ejecuta"),
            (r"\b(llamá)\b", "llama"),
            (r"\b(creá)\b", "crea"),
            (r"\b(cambiá)\b", "cambia"),
            (r"\b(borrá)\b", "borra / elimina"),
            (r"\b(guardá)\b", "guarda"),
            (r"\b(mostrá)\b", "muestra"),
            (r"\b(agregá)\b", "agrega / añade"),
            (r"\b(salí)\b", "sal"),
            (r"\b(vení)\b", "ven"),
            (r"\b(poné)\b", "pon"),
        ]
    },
    {
        "category": "voseo_enclitico_llano",
        "description": "Imperativo con enclítico grave/llano propio de voseo (debe ser esdrújulo con tilde)",
        "patterns": [
            (r"\b(decime)\b", "dime"),
            (r"\b(avisame)\b", "avísame"),
            (r"\b(mostrame)\b", "muéstrame"),
            (r"\b(explicame)\b", "explícame"),
            (r"\b(pasame)\b", "pásame"),
            (r"\b(contame)\b", "cuéntame"),
            (r"\b(ayudame)\b", "ayúdame"),
            (r"\b(mandame)\b", "mándame"),
            (r"\b(escribime)\b", "escríbeme"),
            (r"\b(llamame)\b", "llámame"),
            (r"\b(dejame)\b", "déjame"),
        ]
    },
    {
        "category": "voseo_presente_indicativo",
        "description": "Forma verbal de presente indicativo con voseo",
        "patterns": [
            (r"\b(sos)\b", "eres"),
            (r"\b(tenés)\b", "tienes"),
            (r"\b(podés)\b", "puedes"),
            (r"\b(hacés)\b", "haces"),
            (r"\b(sabés)\b", "sabes"),
            (r"\b(decís)\b", "dices"),
            (r"\b(querés)\b", "quieres"),
            (r"\b(entendés)\b", "entiendes"),
            (r"\b(sentís)\b", "sientes"),
        ]
    },
    {
        "category": "voseo_presente_subjuntivo",
        "description": "Forma de subjuntivo con inflexión de voseo",
        "patterns": [
            (r"\b(olvidés)\b", "olvides"),
            (r"\b(hagás)\b", "hagas"),
            (r"\b(digás)\b", "digas"),
            (r"\b(tengás)\b", "tengas"),
            (r"\b(podás)\b", "puedas"),
            (r"\b(sepás)\b", "sepas"),
        ]
    },
    {
        "category": "voseo_pronominal",
        "description": "Pronombre de voseo",
        "patterns": [
            (r"\b(vos)\b", "tú / te / ti"),
            (r"\b(a vos)\b", "a ti"),
            (r"\b(con vos)\b", "contigo"),
        ]
    },
    {
        "category": "peninsularismos_gramaticales",
        "description": "Formas pronominales de segunda persona plural de España",
        "patterns": [
            (r"\b(vosotros|vosotras)\b", "ustedes"),
            (r"\b(os)\b", "les / se"),
            (r"\b(vuestro|vuestra|vuestros|vuestras)\b", "su / sus"),
        ]
    },
    {
        "category": "peninsularismos_lexicos",
        "description": "Léxico propio del español peninsular en contextos técnicos",
        "patterns": [
            (r"\b(ficheros?)\b", "archivo / archivos"),
            (r"\b(ordenador(?:es)?)\b", "computadora / computadoras / equipo"),
            (r"\b(vale)\b", "de acuerdo / entendido / listo"),
            (r"\b(venga)\b", "vamos / de acuerdo"),
            (r"\b(chaval(es)?|tío|tía)\b", "amigo / persona / desarrollador"),
        ]
    },
    {
        "category": "modismos_regionales_rioplatenses",
        "description": "Jerga y modismos coloquiales de la región rioplatense",
        "patterns": [
            (r"\b(che)\b", "(evitar modismo)"),
            (r"\b(laburo|laburos)\b", "trabajo / tarea"),
            (r"\b(pibe|pibes)\b", "joven / desarrollador / persona"),
            (r"\b(bárbaro|bárbara)\b", "excelente / formidable"),
            (r"\b(posta)\b", "de verdad / cierto"),
            (r"\b(acá)\b", "aquí"),
            (r"\b(quilombo|quilombos)\b", "conflicto / desorden / problema"),
            (r"\b(zafar)\b", "superar / salir adelante"),
        ]
    },
    {
        "category": "barbarismos_verbales",
        "description": "Anglicismos verbalizados toscos en español",
        "patterns": [
            (r"\b(buildear|buildeo|buildea|buildeas|buildeando|buildeado)\b", "compilar / construir"),
            (r"\b(deployar|deployo|deploya|deployas|deployando|deployado)\b", "desplegar"),
            (r"\b(debuggear|debuggeo|debuggea|debuggeas|debuggeando|debuggeado)\b", "depurar"),
            (r"\b(commitear|commiteo|commitea|commiteas|commiteando|commiteado)\b", "confirmar cambios / hacer commit"),
            (r"\b(mergear|mergeo|mergea|mergeas|mergeando|mergeado)\b", "fusionar / hacer merge"),
            (r"\b(teste(?:ar|o|a|as|ando|ado))\b", "probar / ejecutar pruebas"),
        ]
    }
]

class Violation:
    def __init__(self, file_path: str, line_number: int, column: int, match_text: str, category: str, description: str, suggestion: str, line_snippet: str):
        self.file_path = file_path
        self.line_number = line_number
        self.column = column
        self.match_text = match_text
        self.category = category
        self.description = description
        self.suggestion = suggestion
        self.line_snippet = line_snippet

    def to_dict(self) -> dict:
        return {
            "file": self.file_path,
            "line": self.line_number,
            "column": self.column,
            "match": self.match_text,
            "category": self.category,
            "description": self.description,
            "suggestion": self.suggestion,
            "snippet": self.line_snippet.strip()
        }

def check_text(text: str, file_path: str = "<stdin>") -> List[Violation]:
    """Analiza una cadena de texto y retorna la lista de infracciones detectadas."""
    violations: List[Violation] = []
    lines = text.splitlines()

    for line_idx, line in enumerate(lines, start=1):
        # Omitir líneas de comentarios de reglas o citas donde se señale como incorrecto
        line_clean = line
        for rule_group in STYLE_RULES:
            category = rule_group["category"]
            desc = rule_group["description"]
            for pattern, suggestion in rule_group["patterns"]:
                regex = re.compile(pattern, re.IGNORECASE)
                for match in regex.finditer(line_clean):
                    matched_word = match.group(1)
                    col = match.start() + 1
                    violations.append(
                        Violation(
                            file_path=file_path,
                            line_number=line_idx,
                            column=col,
                            match_text=matched_word,
                            category=category,
                            description=desc,
                            suggestion=suggestion,
                            line_snippet=line
                        )
                    )
    return violations

def check_file(file_path: str) -> List[Violation]:
    """Lee y analiza un archivo específico."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return check_text(content, file_path=file_path)
    except Exception as e:
        sys.stderr.write(f"Error al leer {file_path}: {e}\n")
        return []

def main():
    parser = argparse.ArgumentParser(description="Analizador de estilo en espanol neutro para Claude Code.")
    parser.add_argument("files", nargs="*", help="Archivos a analizar.")
    parser.add_argument("-t", "--text", help="Cadena de texto directa a analizar.")
    parser.add_argument("--json", action="store_true", help="Emitir resultados en formato JSON.")
    parser.add_argument("--dir", help="Escanear directorio recursivamente.")
    parser.add_argument("--extensions", default=".md,.txt,.py,.js,.ts", help="Extensiones a revisar con --dir (separadas por coma).")

    args = parser.parse_args()
    all_violations: List[Violation] = []

    if args.text:
        all_violations.extend(check_text(args.text, file_path="<argumento -t>"))

    if args.files:
        for f in args.files:
            if os.path.isfile(f):
                all_violations.extend(check_file(f))

    if args.dir and os.path.isdir(args.dir):
        exts = tuple(ext.strip().lower() for ext in args.extensions.split(","))
        for root, _, filenames in os.walk(args.dir):
            # Omitir carpetas ocultas o de entornos virtuales
            if any(part.startswith(".") or part in ("venv", ".venv", "node_modules", "__pycache__") for part in root.split(os.sep)):
                continue
            for fname in filenames:
                if fname.lower().endswith(exts):
                    fpath = os.path.join(root, fname)
                    all_violations.extend(check_file(fpath))

    if not args.text and not args.files and not args.dir:
        # Si no se pasan argumentos, leer de stdin
        stdin_content = sys.stdin.read()
        if stdin_content:
            all_violations.extend(check_text(stdin_content, file_path="<stdin>"))

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    if args.json:
        output_data = {
            "total_violations": len(all_violations),
            "status": "clean" if not all_violations else "violations_found",
            "violations": [v.to_dict() for v in all_violations]
        }
        try:
            print(json.dumps(output_data, ensure_ascii=False, indent=2))
        except UnicodeEncodeError:
            print(json.dumps(output_data, ensure_ascii=True, indent=2))
    else:
        if not all_violations:
            try:
                print("✔ [OK] Estilo validado: No se detectaron expresiones de voseo, peninsularismos ni modismos regionales.")
            except UnicodeEncodeError:
                print("[OK] Estilo validado: No se detectaron expresiones de voseo, peninsularismos ni modismos regionales.")
            sys.exit(0)
        else:
            try:
                print(f"✖ Se encontraron {len(all_violations)} desviaciones del estándar de español neutro:\n")
            except UnicodeEncodeError:
                print(f"[X] Se encontraron {len(all_violations)} desviaciones del estándar de español neutro:\n")
            for v in all_violations:
                print(f"  [{v.file_path}:{v.line_number}:{v.column}] [{v.category}]")
                print(f"    Término: \"{v.match_text}\"")
                print(f"    Sugerencia: {v.suggestion}")
                print(f"    Línea: {v.line_snippet.strip()}\n")
            sys.exit(1)

if __name__ == "__main__":
    main()

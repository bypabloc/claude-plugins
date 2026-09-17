#!/usr/bin/env python3
"""
Pruebas unitarias para el analizador de estilo de español neutro.
"""

import os
import sys
import unittest

# Agregar el directorio scripts al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))
from check_spanish_style import check_text

class TestSpanishStyleLinter(unittest.TestCase):

    def test_clean_neutral_spanish(self):
        """Verifica que un texto redactado en espanol neutro estandar no arroje infracciones."""
        text = (
            "Hola. Aquí tienes la solución solicitada. "
            "Revisa el archivo de configuración y ejecuta las pruebas necesarias. "
            "Dime si puedes compilar el proyecto sin inconvenientes y avísame si requieres ayuda."
        )
        violations = check_text(text)
        self.assertEqual(len(violations), 0, f"Se encontraron infracciones inesperadas: {[v.match_text for v in violations]}")

    def test_voseo_imperativo(self):
        """Verifica la deteccion de imperativos agudos de voseo."""
        text = "Mirá el log, hacé el cambio y probá si funciona."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("mirá", detected_words)
        self.assertIn("hacé", detected_words)
        self.assertIn("probá", detected_words)

    def test_voseo_encliticos_graves(self):
        """Verifica la deteccion de encliticos llanos rioplatenses sin tilde."""
        text = "Decime qué opinas y avisame cuando termines de revisar."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("decime", detected_words)
        self.assertIn("avisame", detected_words)

    def test_voseo_presente_indicativo(self):
        """Verifica la deteccion de presentes en voseo."""
        text = "Si vos tenés tiempo, podés ayudar con esto. Sos muy capaz."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("vos", detected_words)
        self.assertIn("tenés", detected_words)
        self.assertIn("podés", detected_words)
        self.assertIn("sos", detected_words)

    def test_peninsularismos(self):
        """Verifica la deteccion de expresiones peninsulares comunes."""
        text = "Vale, he guardado el fichero en el ordenador para vosotros."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("vale", detected_words)
        self.assertIn("fichero", detected_words)
        self.assertIn("ordenador", detected_words)
        self.assertIn("vosotros", detected_words)

    def test_modismos_rioplatenses(self):
        """Verifica la deteccion de modismos locales rioplatenses."""
        text = "Che, qué buen laburo hiciste acá, quedó bárbaro."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("che", detected_words)
        self.assertIn("laburo", detected_words)
        self.assertIn("acá", detected_words)
        self.assertIn("bárbaro", detected_words)

    def test_barbarismos_verbales(self):
        """Verifica la deteccion de barbarismos tecnicos verbalizados."""
        text = "Vamos a buildear la aplicacion, luego deployar y commitear."
        violations = check_text(text)
        detected_words = [v.match_text.lower() for v in violations]
        self.assertIn("buildear", detected_words)
        self.assertIn("deployar", detected_words)
        self.assertIn("commitear", detected_words)

if __name__ == "__main__":
    unittest.main()

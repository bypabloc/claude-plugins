#!/usr/bin/env python3
"""
Pruebas unitarias para el hook SessionStart.
"""

import json
import os
import subprocess
import sys
import unittest

class TestSessionStartHook(unittest.TestCase):

    def test_session_start_output_schema(self):
        """Verifica que session-start.py genere JSON valido con el formato esperado por Claude Code."""
        script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts", "session-start.py"))
        result = subprocess.run([sys.executable, script_path], capture_output=True, text=True, encoding="utf-8")

        self.assertEqual(result.returncode, 0, f"El script falló con código {result.returncode}: {result.stderr}")

        data = json.loads(result.stdout)
        self.assertIn("hookSpecificOutput", data)
        hso = data["hookSpecificOutput"]
        self.assertEqual(hso.get("hookEventName"), "SessionStart")
        self.assertIn("additionalContext", hso)
        self.assertTrue(len(hso["additionalContext"]) > 50)
        self.assertIn("español", hso["additionalContext"].lower())

if __name__ == "__main__":
    unittest.main()

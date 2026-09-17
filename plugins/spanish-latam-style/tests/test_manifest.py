#!/usr/bin/env python3
"""
Pruebas unitarias para validar la estructura del plugin y su manifiesto.
"""

import json
import os
import unittest

class TestPluginManifest(unittest.TestCase):

    def setUp(self):
        self.plugin_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.manifest_path = os.path.join(self.plugin_root, ".claude-plugin", "plugin.json")

    def test_manifest_exists_and_valid_json(self):
        """Verifica que el archivo .claude-plugin/plugin.json exista y sea JSON válido."""
        self.assertTrue(os.path.isfile(self.manifest_path), f"No se encontró {self.manifest_path}")

        with open(self.manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("name", data)
        self.assertEqual(data["name"], "spanish-latam-style")
        self.assertIn("version", data)
        self.assertIn("description", data)

    def test_skills_exist(self):
        """Verifica que los skills requeridos existan y contengan SKILL.md."""
        skills_dir = os.path.join(self.plugin_root, "skills")
        self.assertTrue(os.path.isdir(skills_dir))

        latam_skill = os.path.join(skills_dir, "spanish-latam-style", "SKILL.md")
        self.assertTrue(os.path.isfile(latam_skill))

        with open(latam_skill, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertTrue(content.startswith("---"))
        self.assertIn("name: spanish-latam-style", content)

    def test_rules_exist(self):
        """Verifica que la regla language-style.md exista."""
        rule_path = os.path.join(self.plugin_root, "rules", "language-style.md")
        self.assertTrue(os.path.isfile(rule_path))

    def test_hooks_exist(self):
        """Verifica que hooks/hooks.json exista y sea válido."""
        hooks_path = os.path.join(self.plugin_root, "hooks", "hooks.json")
        self.assertTrue(os.path.isfile(hooks_path))
        with open(hooks_path, "r", encoding="utf-8") as f:
            hooks_data = json.load(f)
        self.assertIn("hooks", hooks_data)

if __name__ == "__main__":
    unittest.main()

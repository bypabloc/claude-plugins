const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const ruleFile = path.join(pluginRoot, 'rules', 'language-style.md');

let content = '';
try {
  if (fs.existsSync(ruleFile)) {
    content = fs.readFileSync(ruleFile, 'utf8');
  }
} catch (e) {
  // Manejo silencioso de error
}

if (!content) {
  content = "IDIOMA Y ESTILO OBLIGATORIO: Comunícate siempre en español neutro latinoamericano estándar (tuteo profesional tú). Prohibido terminantemente cualquier voseo (vos, tenés, podés, mirá, hacé, decime, avisame) y giros peninsulares (fichero, ordenador, vale). Revisa la regla language-style.md.";
}

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: content
  }
};

process.stdout.write(JSON.stringify(output) + '\n');
process.exit(0);

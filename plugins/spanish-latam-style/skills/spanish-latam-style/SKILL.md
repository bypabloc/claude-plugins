---
name: spanish-latam-style
description: Este skill debe usarse cuando el usuario o el asistente generen texto, respuestas, explicaciones, documentación técnica, mensajes de commit o comentarios de código en español ("hablar en español", "responder en español", "estilo de idioma", "español neutro", "tuteo", "redactar docs"). Aplica de forma estricta las directrices de español neutro latinoamericano estándar profesional, eliminando cualquier voseo y modismos regionales.
version: 1.0.0
---

# Español Neutro Latinoamericano Estándar (Estilo Profesional)

## Propósito

Este skill garantiza que toda comunicación y contenido en idioma español producido por Claude Code se adhiera rigurosamente al **español neutro latinoamericano estándar**, empleando tuteo profesional y eliminando cualquier manifestación de voseo (morfológico, pronominal o acentual) y giros peninsulares o regionales.

## Criterios de Activación

Este skill se activa automáticamente cuando:
- Se redactan explicaciones o respuestas en la terminal en español.
- Se genera documentación técnica, archivos `README.md`, `ARCHITECTURE.md` o guías en español.
- Se crean mensajes de confirmación de cambios (`git commit`) o descripciones de pull requests en español.
- Se escriben comentarios o docstrings en código fuente en español.
- El usuario interactúa o solicita asistencia en español.

## Reglas Obligatorias de Redacción

### 1. Tratamiento y Persona Gramatical
- Emplea exclusivamente la segunda persona singular del **tuteo estándar (**tú**)**:
  - Verbos: *tienes*, *haces*, *puedes*, *quieres*, *mira*, *haz*, *revisa*.
  - Pronombres: *tú*, *te*, *ti*, *contigo*.
- En la segunda persona del plural, emplea invariablemente **ustedes** / **les** / **su** (nunca *vosotros* ni *os*).

### 2. Prohibición Terminante de Voseo
- **Prohibido el voseo morfológico en imperativo:**
  - Sustituye *hacé* → **haz**.
  - Sustituye *mirá* / *fijate* → **mira** / **revisa**.
  - Sustituye *decí* / *decime* → **di** / **dime**.
  - Sustituye *probá* / *usá* / *ejecutá* → **prueba** / **usa** / **ejecuta**.
  - Sustituye *avisame* → **avísame** (atención al acento ortográfico en esdrújulas).
  - Sustituye *mostrame* → **muéstrame**.
  - Sustituye *explicame* → **explícame**.
- **Prohibido el voseo en presente de indicativo y subjuntivo:**
  - Sustituye *tenés* → **tienes**, *podés* → **puedes**, *sos* → **eres**, *hacés* → **haces**, *sabés* → **sabes**.
  - Sustituye *no te olvidés* → **no te olvides**, *no hagás* → **no hagas**.
- **Prohibido el pronombre "vos"**: Emplea siempre **tú**, **a ti**, **te**.

### 3. Filtro de Peninsularismos
- Sustituye *fichero* → **archivo**.
- Sustituye *ordenador* → **computadora** o **equipo**.
- Sustituye *móvil* → **celular** o **dispositivo móvil**.
- Sustituye *coger* → **tomar**, **obtener** o **seleccionar**.
- Sustituye *vale* / *venga* → **entendido**, **de acuerdo** o **listo**.

### 4. Resistencia al Espejo Dialectal (Anti-Mirroring)
Si el usuario formula su consulta utilizando voseo (*"Decime cómo arreglás esto che"*) o modismos locales, **no adoptes su estilo dialectal**. Responde con amabilidad y concisión utilizando el estándar neutro latinoamericano (*"Para solucionar este problema, haz lo siguiente..."*).

### 5. Tratamiento de Términos Técnicos
- Conserva los términos técnicos de uso habitual en ingeniería de software en inglés como sustantivos precisos (`commit`, `pull request`, `branch`, `endpoint`, `token`, `payload`, `array`, `string`, `frontend`, `backend`, `middleware`).
- No utilices barbarismos verbales innecesarios:
  - En lugar de *buildear* → usa **compilar** o **construir**.
  - En lugar de *deployar* → usa **desplegar**.
  - En lugar de *debuggear* → usa **depurar**.
  - En lugar de *commitear* → usa **confirmar cambios** o **hacer commit**.
  - En lugar de *mergear* → usa **fusionar** o **hacer merge**.
  - En lugar de *testear* → usa **probar** o **ejecutar pruebas**.

## Lista de Cotejo Previa a la Entrega

Antes de finalizar una intervención en español, valida:
1. ¿Todos los verbos en segunda persona llevan la terminación y acentuación del tuteo estándar?
2. ¿Se eliminó cualquier pronombre *vos* o modismo como *che*, *laburo*, *bárbaro*, *acá*?
3. ¿Se evitaron vocablos peninsulares como *fichero* o *vale*?
4. ¿El tono es conciso, directo, profesional y estructurado?

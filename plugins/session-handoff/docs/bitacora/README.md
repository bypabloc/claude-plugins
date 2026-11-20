# Bitácora de session-handoff

Registro versionado de cómo evoluciona el plugin: qué se cambió en cada versión y por qué, cómo se vigila en
sesiones reales y qué se aprendió en el camino. Es el changelog largo; el corto sigue en la sección
[Versiones del README](../../README.md#versiones).

| Archivo | Qué guarda |
| :--- | :--- |
| [versiones/](versiones/) | Un archivo por versión: síntoma, causa, cambio, prueba que lo cubre y lección. |
| [vigilancia.md](vigilancia.md) | Cómo se vigila el plugin en sesiones reales y qué mirar en cada revisión. |
| [aprendizajes.md](aprendizajes.md) | Lecciones de operación que no son código: falsos positivos, trampas del entorno. |
| [mejoras-pendientes.md](mejoras-pendientes.md) | Ideas detectadas que todavía no se implementaron, con su motivo. |

## Versiones

| Versión | Fecha | Commit | Resumen |
| :--- | :--- | :--- | :--- |
| [0.4.5](versiones/0.4.5.md) | 2026-11-20 | ver el tag `session-handoff-v0.4.5` | Una sesión cuyo trabajo tomó otra ya no es empujada a seguir. |
| [0.4.4](versiones/0.4.4.md) | 2026-11-20 | `f2fe629` | Una línea `Status`, `Phase` o `Next step` repetida se nombra al escribir. |
| [0.4.3](versiones/0.4.3.md) | 2026-11-19 | `e90e03d` | La nota de `Phase:` cuenta para el máximo de 120 caracteres. |
| [0.4.2](versiones/0.4.2.md) | 2026-11-19 | `5f404ef` | Los hashes pendientes sobreviven a `/reload-plugins` y `--resume`. |
| [0.4.1](versiones/0.4.1.md) | 2026-11-19 | `24b7785` | Un commit en un Bash en segundo plano pide su hash. |
| [0.4.0](versiones/0.4.0.md) | 2026-11-19 | `892979f` | Métricas de la sesión sobre la línea de estado. |
| [0.3.5](versiones/0.3.5.md) | 2026-11-19 | `c8cfd4f` | Cada evento de la bitácora lleva la versión del plugin (`v`). |
| [0.3.4](versiones/0.3.4.md) | 2026-11-19 | `239f0f6` | Una fase no válida se nombra al escribir `PROGRESS.md`. |
| [0.3.3](versiones/0.3.3.md) | 2026-11-19 | `c072ba9` | La línea `Phase:` admite una nota después de la fase. |
| [0.3.2](versiones/0.3.2.md) | 2026-11-19 | `1641749` | El tope de `Stop` no se reinicia con paradas rápidas. |
| [0.3.1](versiones/0.3.1.md) | 2026-11-19 | `6828c31` | Una espera vieja en `external-wait` pide comprobarse. |
| [0.3.0](versiones/0.3.0.md) | 2026-11-19 | `e9772fd` | Instrucción por fase configurable y guía de escritura del handoff. |
| [0.2.0](versiones/0.2.0.md) | 2026-11-19 | `0c9c45a` | Los hashes que faltan se recuerdan hasta que estén. |
| [0.1.0](versiones/0.1.0.md) | 2026-11-19 | `373afd9` | Recordatorio del hash tras cada commit; un lote es un solo handoff. |
| [0.0.1](versiones/0.0.1.md) | 2026-11-18 | `154cc40` | Primera versión. |

## Cómo añadir una versión

1. Copia la plantilla de abajo en `versiones/X.Y.Z.md`.
2. Escribe el síntoma tal como se vio en una sesión real (evento, patrón, cifra), no la solución.
3. Nombra el test que lo reproduce: debe haber fallado antes del cambio.
4. Añade la fila a la tabla de arriba y, si la lección sirve más allá de esta versión, súmala a
   [aprendizajes.md](aprendizajes.md).

```markdown
# X.Y.Z — <título corto>

- **Fecha**: AAAA-MM-DD · **Commit**: `abc1234` · **Tipo**: fix | feat
- **Visto en**: <proyecto y sesión, o "diseño">

## Síntoma
## Causa
## Cambio
## Prueba
## Lección
```

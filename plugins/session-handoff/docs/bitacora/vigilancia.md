# Vigilancia del plugin en sesiones reales

El plugin se valida con `claude plugin test`, pero los bugs que importan aparecen en sesiones largas de verdad:
lotes de specs, compactaciones, tareas en segundo plano, recargas. Esta es la revisión que se corre (a mano o con
un cron de la sesión cada 30 min) sobre los proyectos que usan el plugin.

## Fuentes

| Fuente | Dónde | Para qué |
| :--- | :--- | :--- |
| Bitácora | `tmp/handoff/.log/events.jsonl` del proyecto | Qué hizo el plugin y con qué versión (`v`). |
| Vínculos | `tmp/handoff/.sessions/<session-id>` | Qué trabajo tiene cada sesión. |
| Handoff | `tmp/handoff/<trabajo>/PROGRESS.md` | Estado que el plugin reinyecta y que `Stop` evalúa. |
| Transcript | `$CLAUDE_CONFIG_DIR/projects/<cwd codificado>/<session-id>.jsonl` | Qué vio y qué hizo el agente entre eventos. |
| Tareas | `<tmp de Claude>/<proyecto>/<session-id>/tasks/<id>.output` | Si la corrida esperada en `external-wait` sigue viva. |
| Versión instalada | `claude plugin list` en cada entorno (Windows, WSL) | Comparar con `v`; ver también el scope `project`. |

## Revisión, paso a paso

1. **Sesiones activas**: vínculos de `.sessions/` más las sesiones con eventos en las últimas 2 h.
2. **PROGRESS.md de cada una**:
   - Líneas de estado (`Status`, `Phase`, `Done`, `Current`, `Remaining`, `ETA`, `Next step`) de 120 caracteres
     o menos **sin contar la etiqueta** (es lo que mide el plugin; la nota de `Phase` cuenta desde 0.4.3).
   - `Phase` válida: `implementation`, `verification`, `integration`, `external-wait` o `closing`.
   - Hashes recientes: cada commit de la rama de la sesión debe aparecer en algún lugar del archivo.
   - `Next step` al día con lo que muestra el transcript.
3. **Eventos desde la revisión anterior**: `inject`, `stop.block`, `stop.release`, `stop.recheck`, `stop.commits`,
   `ask.deny`, `compact.kept`, `compact.fallback`, `commit.remind`.
4. **Antes de llamar bug a un síntoma**, compara `v` con la versión instalada. Sin `v` es anterior a 0.3.5. Si la
   sesión corre una versión vieja que ya lo corrige, no es bug: pide `/reload-plugins` en esa sesión.

## Síntomas y cómo leerlos

| Síntoma | Patrón en la bitácora | Qué comprobar |
| :--- | :--- | :--- |
| Bucle de `Stop` | `stop.block` 1,2,3,1,2,3 o hasta `reason: cap` | Versión (0.3.2 lo corrige); si persiste, el texto del bloqueo. |
| `external-wait` falso | `stop.release` `external-wait` repetidos | Que la tarea siga viva (output sin `[exited`), stack o candado ocupados. |
| Hash que no llega | `commit.remind` sin que el hash aparezca después | Commit en segundo plano (0.4.1), recarga del plugin (0.4.2). |
| Inyección grande | `inject` con `chars` alto | Líneas de estado largas o notas que crecen (0.4.3). |
| `compact.fallback` | Frecuente en una sesión | Mensajes que no caben en el presupuesto de la cola. |
| `ask.deny` injustificado | Con un `Status: blocked` de motivo válido | `blockReasons` del proyecto. |
| Sesión detenida | Sin eventos y transcript sin escribir | Proceso vivo y última entrada: un permiso o un hook colgado no es del plugin. |

## Cuando hay un bug

1. Test que lo reproduce, visto en rojo; luego el cambio; `claude plugin validate .` y `claude plugin test .`.
2. Versión patch en los cuatro sitios: `.claude-plugin/plugin.json`, `marketplace-entry.json`, README (Versiones)
   y `VERSION` en `hooks/handoff.ts`.
3. Commit y push; sincronizar el marketplace (`plugins/session-handoff/` y su `marketplace.json`).
4. Actualizar en cada entorno (scope `user` **y** cualquier scope `project` del proyecto) y pedir
   `/reload-plugins` en las sesiones abiertas.
5. Archivo nuevo en [versiones/](versiones/) y, si aplica, una entrada en [aprendizajes.md](aprendizajes.md).

# session-handoff

Plugin de Claude Code para **sesiones largas y trabajo con varios agentes**. Guarda el estado de cada trabajo en disco (`tmp/handoff/<trabajo>/`), lo vuelve a inyectar al iniciar, reanudar y compactar, no deja cerrar el turno mientras quede un siguiente paso y compacta sin pedirle un resumen al modelo. El estado del trabajo se ve en el spinner y en una banda sobre el prompt.

Es un mod de Claude Code escrito en TypeScript: **no necesita Python, Node ni nada instalado**, funciona igual en Windows, macOS y Linux, y en cualquier proyecto con git (sin git también, tomando la carpeta actual como raíz). Nació en dos proyectos propios (klinikae y content-studio) y se separó de ellos para usarlo en cualquiera.

## Instalación

```bash
claude plugin marketplace add bypabloc/claude-plugins
claude plugin install session-handoff@bypabloc
```

Requiere Claude Code 2.1.287 o posterior. Para un solo proyecto, `--scope project`. Comprobar: `claude plugin list`.

## Cómo se usa

Un trabajo es una carpeta en `tmp/handoff/<trabajo>/` del **checkout principal** (también desde un worktree: todos comparten la misma) con tres archivos que escribe el agente:

| Archivo | Qué guarda |
| :--- | :--- |
| `PROGRESS.md` | Líneas de estado arriba y, debajo, objetivo, lo hecho (con hash) y lo pendiente |
| `DECISIONS.md` | Una decisión por línea, con su motivo |
| `NOTES.md` | Hallazgos, trampas, rutas y comandos que costó encontrar |

Las líneas de estado de `PROGRESS.md`, una por línea y de 120 caracteres como máximo:

```text
Status: in-progress | done | blocked — <categoría>: <motivo>
Phase: implementation | verification | integration | external-wait | closing
Done: …   Current: …   Remaining: …   ETA: ~2 h
Next step: …
```

Un **lote** (varias specs seguidas) es un solo trabajo con un solo handoff: las specs no crean el suyo, cada spec cerrada se suma a `Done`, `Next step` pasa a la siguiente y `Status: done` va solo tras la última. Con `Status: done`, el cierre borra la carpeta del trabajo y sus vínculos.

Una sesión se vincula a un trabajo escribiendo su nombre en `tmp/handoff/.sessions/<session_id>` (el plugin le dice su id al iniciar), o sola si la rama lleva el mismo número que el trabajo (`feature/012-x` ↔ `tmp/handoff/012-x/`). Agrega `tmp/` a tu `.gitignore`.

## Qué hace

| Evento | Comportamiento |
| :--- | :--- |
| Inicio, reanudación, `/clear`, compactación | Inyecta el trabajo vinculado (PROGRESS, DECISIONS, NOTES, la instrucción de su fase y su spec) o, sin vínculo, el id de la sesión y los trabajos activos |
| Fin del turno (`Stop`) | Lo bloquea mientras haya `Next step` sin `Status: done` o un `blocked` válido. Deja parar en `external-wait` (la tercera parada seguida sin cambios en `PROGRESS.md` pide antes comprobar la espera) y tras 3 bloqueos seguidos sin cambios en `PROGRESS.md` |
| `AskUserQuestion` con una spec en curso | Lo rechaza salvo con un `blocked` de una categoría del proyecto: el resto de las decisiones las toma el agente y las anota |
| Escribir `PROGRESS.md` | Nombra en el acto las líneas de estado demasiado largas |
| `git commit` en Bash | Si `PROGRESS.md` del trabajo vinculado no cita el hash, pide anotarlo en esa misma respuesta, junto con los de commits anteriores de la sesión que sigan faltando (con `-q` lee el hash en el repo del `cd` o `git -C`) |
| Mensaje nuevo (`UserPromptSubmit`) y fin del turno (`Stop`) | Mientras falte un hash de la sesión en `PROGRESS.md`, lo recuerda: una interrupción (el usuario, un cron) no lo deja perder |
| Compactación (`/compact` o el umbral automático) | Con un trabajo vinculado, no llama al modelo: conserva los mensajes recientes que caben en ~20k tokens, cortados en un punto seguro, y el handoff entra después. Sin trabajo, compacta como siempre |
| Spinner y banda | `<Phase> · <Current> · ETA` mientras trabaja; sobre el prompt, la fila de métricas entre divisores y, debajo, estado, fase, ETA y `ctx <n>%` (ámbar desde 70 %, rojo desde 85 %), con los botones `Less`/`More` y `Hide` |

Cada decisión queda en `tmp/handoff/.log/events.jsonl`, con la versión del plugin en `v` (`inject`, `stop.block`, `stop.release`, `stop.recheck`, `ask.deny`, `compact.kept`, `compact.fallback`, `commit.remind`, `stop.commits`).

## Métricas sobre el prompt

```text
────────────────────────────────────────────────────────────────────────────────────────────
cost (est.)            tokens        agent time       cache reuse   tests              limits            handoff
$22.86                 67.6M         1h 6m            91%           456 passed         5h 82%            1 hash due
last $0.50 · ⌀ $1.20   19 turns · ↓ 1.5M  ⌀ 3m 30s / turn  60M read  after last change   7d 18% · resets 2h  2 compact · 6 held · 1 cap
────────────────────────────────────────────────────────────────────────────────────────────
● in-progress · implementation · ETA ~2 h · ctx 47%  Less  Hide
```

| Columna | De dónde sale |
| :--- | :--- |
| `cost (est.)` | El total de `/cost` (`session.measure`), el costo del último turno y el promedio por turno. Es la estimación local de Claude Code, no la factura; con suscripción, el uso dentro del plan no se cobra |
| `tokens` | Entrada, salida y caché de cada turno (`turn.complete`), subagentes incluidos; turnos del loop principal y tokens generados (`↓`) |
| `agent time` | Duración de los turnos del loop principal y su promedio |
| `cache reuse` | Parte de la entrada que sirvió la caché de prompts; en ámbar bajo 50 % (una caché que se pierde encarece cada turno) |
| `tests` | La última corrida de pruebas en Bash (bun, vitest, jest, pytest, playwright, mocha, cargo, `claude plugin test`): pasadas o falladas, y si hubo ediciones de archivos después (`3 edits since`, en ámbar) |
| `limits` | Las ventanas de rate limit de la suscripción (5 h, 7 d) con su reinicio; ámbar desde 75 %, rojo desde 90 %. Sin suscripción, el burn rate en $/h sobre el tiempo de la sesión |
| `handoff` | Solo con un trabajo vinculado: hashes que faltan en `PROGRESS.md`, compactaciones, turnos que `Stop` retuvo y veces que soltó por el tope (varias seguidas indican un agente en bucle) |

`Less` deja solo la línea de estado; `Hide` oculta la banda. Los totales se guardan por sesión en el almacén del plugin, así que un `--resume` los conserva.

## Configuración por proyecto (opcional)

`.claude/session-handoff.json` en la raíz del proyecto. Todo es opcional; sin el archivo, el plugin usa los valores por defecto.

```json
{
  "blockReasons": {
    "user-data": "borrar o cambiar datos existentes del usuario",
    "cost": "gastar dinero",
    "credentials": "un acceso que solo tiene el usuario",
    "user-stop": "el usuario pidió parar",
    "taste": "elegir entre opciones que solo el usuario puede juzgar"
  },
  "context": ["Turno de la GPU: un modelo a la vez; usa `turno-gpu run`."],
  "specsDir": "docs/specs",
  "decisionsDir": "docs/process/WARNING",
  "pendingDir": "docs/process/PENDING",
  "closing": "Status es done: confirma el merge y cierra el worktree con `devtools worktree close`.",
  "phases": {
    "verification": "Fase verification: corre la batería de 03-verificacion-final.md de la spec."
  }
}
```

| Campo | Por defecto | Qué cambia |
| :--- | :--- | :--- |
| `blockReasons` | `user-data`, `cost`, `credentials`, `user-stop` | Las únicas categorías de `blocked` que dejan parar o preguntar |
| `context` | ninguna | Líneas que se inyectan con cada mensaje (un recurso compartido, un comando del proyecto) |
| `specsDir` | `docs/specs` | Dónde busca la spec del trabajo (`<NN>-…/`, también dentro de un lote) |
| `decisionsDir` / `pendingDir` | `DECISIONS.md` / `NOTES.md` del handoff | Dónde pide anotar las decisiones y lo diferido |
| `closing` | texto genérico | La instrucción de cierre con `Status: done` |
| `phases` | texto genérico por fase | Reemplaza la instrucción de una fase (`implementation`, `verification`, `integration`, `external-wait`, `closing`) |

Con cada mensaje, el plugin recuerda cómo escribir el handoff: con la herramienta de archivos (no con `echo` ni `cat`), al empezar, tras cada commit o decisión y antes de una corrida larga, breve (menos de 60 líneas por archivo), con la spec enlazada y sin secretos ni datos personales.

## Límites

* Solo Claude Code: usa la API de mods (`hooks/register.tsx`). Codex o Antigravity necesitan su propio hook de handoff.
* El tamaño del tramo que se conserva se estima en caracteres (~4 por token). Lo que no esté en el handoff ni en ese tramo se pierde: mantén `PROGRESS.md` al día.
* Con `--resume`, los resultados de herramientas pueden volver a traer mensajes previos a la compactación.

## Desarrollo

```bash
claude plugin validate .
claude plugin test .          # handoff, store, register (eventos), tail, status y metrics
claude --plugin-dir .         # probarlo en una sesión sin instalarlo
```

## Versiones

* **0.4.2**: los hashes que PROGRESS.md aún no nombra sobreviven a `/reload-plugins` y a `--resume`: se guardan también en el store de la sesión, y el aviso del siguiente mensaje y de `Stop` los sigue pidiendo (antes, recargar el plugin los borraba y `Stop` soltaba sin ellos).
* **0.4.1**: un `git commit` lanzado en un Bash en segundo plano ya pide su hash: antes `git log -1` leía el HEAD previo al commit y el hash nuevo nunca llegaba a Done. Se guarda el HEAD del arranque y el siguiente aviso, mensaje o fin de turno pide los commits propios de la rama desde ahí (sin merges ni commits traídos de dev).
* **0.4.0**: fila de métricas sobre la línea de estado, entre divisores: costo estimado (total, último turno y promedio), tokens y turnos, tiempo del agente, reuso de caché, última corrida de pruebas y si hubo cambios después, rate limits o burn rate, y salud del handoff (hashes pendientes, compactaciones, `Stop` retenidos y topes). `ctx` cambia de color al acercarse a la compactación; botones `Less`/`More` y `Hide`; los totales sobreviven a `--resume`.
* **0.3.5**: cada línea de `events.jsonl` lleva `v`, la versión del plugin que la escribió: una sesión que no recargó el plugin se ve en la bitácora sin adivinar por su comportamiento.
* **0.3.4**: al escribir `PROGRESS.md`, una línea `Phase:` que no empieza con una fase válida se nombra en el acto (sin fase válida, `Stop` no reconoce `external-wait`).
* **0.3.3**: la línea `Phase:` admite una nota después de la fase (`external-wait (commit en segundo plano)`); antes se descartaba y `Stop` bloqueaba hasta el tope en cada despertar.
* **0.3.2**: una parada menos de 60 s después de un bloqueo cuenta para el tope de 3 aunque `PROGRESS.md` haya cambiado (un agente que esperaba una tarea en segundo plano tocaba el archivo en cada último aviso y quedaba en bucle); el primer aviso dice que, para esperar una tarea, un check o un aviso, se pone `Phase: external-wait`.
* **0.3.1**: tras 3 paradas seguidas en `external-wait` sin cambios en `PROGRESS.md`, `Stop` bloquea una vez y pide comprobar que la espera sigue en pie (evento `stop.recheck`): una espera cuya corrida ya murió ya no deja la sesión parada indefinidamente.
* **0.3.0**: `phases` en la configuración para reemplazar la instrucción de una fase; el mensaje inyectado incluye cómo escribir el handoff (herramienta de archivos, cuándo, breve y sin secretos); los tests de eventos pasan también en Linux y macOS.
* **0.2.0**: los hashes que faltan en `PROGRESS.md` se recuerdan en cada commit, mensaje nuevo y fin de turno hasta que estén; con `git commit -q`, el hash sale del repo del `cd` o `git -C`.
* **0.1.0**: recordatorio del hash en `PROGRESS.md` tras cada `git commit`; un lote es un solo trabajo que termina tras su última spec; con `Status: done` el cierre siempre borra el handoff (también con un `closing` propio).
* **0.0.1**: primera versión: handoff en disco, Stop, AskUserQuestion, aviso de líneas largas, compactación sin resumen, banda y spinner, configuración por proyecto.

## Licencia

MIT. Autor: Pablo Contreras ([@bypabloc](https://github.com/bypabloc)).

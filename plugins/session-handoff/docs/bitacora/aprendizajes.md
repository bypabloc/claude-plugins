# Aprendizajes de operación

Lo que se aprendió vigilando el plugin en sesiones reales y que no vive en el código. Cada entrada dice cuándo se
vio y qué hacer.

## Instalación y versiones

- **Un scope `project` tapa al de `user`.** Un proyecto tenía su propia instalación fijada en 0.2.0 y sus sesiones
  escribían eventos sin `v` aunque la global estaba en 0.4.0. `claude plugin update -s user` no la toca: hay que
  correr `claude plugin update session-handoff@bypabloc -s project` desde la carpeta del proyecto. Revisa
  `installed_plugins.json` del perfil para ver todos los scopes. (2026-11-19)
- **Instalar no es cargar.** Tras actualizar, cada sesión abierta sigue con la versión vieja hasta
  `/reload-plugins`; el campo `v` de sus eventos lo confirma. (2026-11-19)
- **Una política de organización puede bloquear el marketplace.** En una cuenta de organización,
  `claude plugin marketplace update` respondió `Marketplace source ... is blocked by enterprise policy` y la sesión
  quedó en la versión anterior. No se evade: se avisa y se espera a que la política lo permita. (2026-11-20)
- **El perfil cambia las rutas.** Con `CLAUDE_CONFIG_DIR` distinto del predeterminado, los transcripts y la caché de
  plugins viven bajo ese directorio, no en `~/.claude/`. (2026-11-19)

## Lectura de la bitácora

- **No todo `external-wait` repetido es falso.** Esperar notificaciones de subagentes asíncronos, un gate o un e2e
  en segundo plano produce muchas liberaciones seguidas y es correcto. Es falso solo si la tarea esperada ya
  terminó o murió y la sesión sigue parada. (2026-11-20)
- **Una `Phase` vieja durante un turno largo no hace daño todavía.** Si la sesión sigue trabajando tras la
  notificación, no hay `Stop` que suelte en falso; el riesgo aparece si para sin actualizarla. La comprobación de
  hashes (`stop.commits`) corre antes que la de la fase. (2026-11-20)
- **`external-wait` no es para esperar al usuario.** Algunas sesiones lo usan para «el usuario prueba la app»;
  lo que corresponde es `Status: blocked — <motivo del proyecto>`. (2026-11-20)
- **Las líneas se miden sin etiqueta.** Una línea `Next step: …` de 126 caracteres totales tiene 115 de valor y
  está bien; contar la línea completa da falsos positivos. (2026-11-19)
- **Muchos `inject` de arranque juntos son sesiones de una sola pregunta** (evaluaciones o subagentes en
  worktrees). Cada una recibe el aviso de «sin trabajo vinculado», de unos 1.300 a 1.800 caracteres. (2026-11-19)

## Hábitos de las sesiones

- **Resumir `Done` puede borrar hashes ya anotados.** Para acortar la línea, una sesión cambió hashes por
  etiquetas («T0, I-5, I-12…») o por el merge del PR. El plugin no lo detecta porque ya los dio por anotados: el
  hash puede quedar en el cuerpo de `PROGRESS.md`. (2026-11-20)
- **Un recordatorio de hash puede ignorarse durante varios commits** si la sesión está en mitad de un turno largo;
  `Stop` lo frena al final con `stop.commits`. (2026-11-20)
- **Una sesión detenida sin eventos no es del plugin.** Una quedó 80 minutos parada en un `Write` sin resultado,
  con el proceso vivo: un permiso o un hook ajeno. Se ve en la última línea del transcript. (2026-11-20)

## Entorno

- **WSL puede no responder** (`Wsl/Service/0x8007274c`); un reintento suele bastar. (2026-11-20)
- **El shell de login de WSL cambia comandos**: con zsh, `grep` puede ser un alias de `rg`. Para scripts de
  revisión, usa `bash script.sh` en vez de comandos inline. (2026-11-20)

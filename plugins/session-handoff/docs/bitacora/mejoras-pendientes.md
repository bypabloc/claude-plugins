# Mejoras pendientes

Ideas detectadas al vigilar el plugin que aún no se implementaron. Cada una dice qué se vio y por qué no se hizo
todavía. Al implementarla, muévela a su archivo de [versiones/](versiones/).

| Idea | Qué se vio | Por qué espera |
| :--- | :--- | :--- |
| Aviso de arranque más corto para sesiones de una sola pregunta | Decenas de sesiones cortas en worktrees recibían el aviso «sin trabajo vinculado» (unos 1.300 a 1.800 caracteres cada una). | Al iniciar no se sabe si la sesión será de una vuelta; recortarlo para todas empeora el caso normal. |
| Detectar `external-wait` sobre una tarea ya terminada | Una sesión siguió con la fase en `external-wait` sobre una tarea que había terminado; no llegó a soltar en falso. | `stop.recheck` (0.3.1) ya lo frena tras 3 paradas; detectarlo antes exige leer las notificaciones de tareas. |
| Avisar cuando un hash anotado desaparece de `PROGRESS.md` | Al resumir `Done`, una sesión quitó hashes que ya estaban anotados. | El plugin deja de seguir un hash en cuanto aparece; recordarlos todos exige guardar el historial de la sesión. |
| Sugerir `blocked` cuando `external-wait` espera al usuario | Sesiones con `Phase: external-wait` para «el usuario prueba la app». | Distinguirlo exige entender la nota; hoy funciona igual porque la sesión para. |

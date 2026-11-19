/**
 * Pure logic of the session handoff: the status lines of PROGRESS.md, the project config and every text the
 * plugin hands to the model. No I/O here: `store.ts` reads the disk, `register.tsx` wires the events.
 */

import type { HandoffConfig, WorkStatus } from '../types'

/** The plugin version; equal to `.claude-plugin/plugin.json` (checked on every release). Each log line carries it. */
export const VERSION = '0.3.5'

export const FILES =['PROGRESS.md', 'DECISIONS.md', 'NOTES.md'] as const
export const PHASES = ['implementation', 'verification', 'integration', 'external-wait', 'closing'] as const
export const LINE_MAX = 120
export const MAX_BLOCKS = 3
export const EXCERPT_MAX = 6000
const LABELS = {
  status: 'Status',
  phase: 'Phase',
  done: 'Done',
  current: 'Current',
  remaining: 'Remaining',
  eta: 'ETA',
  next_step: 'Next step',
} as const
type Key = keyof typeof LABELS

/** The causes only the user can resolve, when the project sets none: the one kind of `blocked` that may stop. */
export const DEFAULT_BLOCK_REASONS: Record<string, string> = {
  'user-data': 'cambiar o borrar datos existentes del usuario o de producción',
  cost: 'gastar dinero o contratar un servicio pago',
  credentials: 'falta un acceso que solo tiene el usuario',
  'user-stop': 'el usuario pidió parar',
}

/** The resolved config: the project's `.claude/session-handoff.json` over the defaults. */
export type Config = Required<Pick<HandoffConfig, 'blockReasons' | 'context' | 'specsDir' | 'phases'>> &
  Pick<HandoffConfig, 'decisionsDir' | 'pendingDir' | 'closing'>

/** Reads the project config; a missing file, bad JSON or a field of the wrong type falls back to the default. */
export function parseConfig(text: string | null): Config {
  let raw: Record<string, unknown> = {}
  try {
    const parsed: unknown = text ? JSON.parse(text) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>
  } catch {
    raw = {}
  }
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const reasons = raw.blockReasons
  const isReasons =
    reasons && typeof reasons === 'object' && !Array.isArray(reasons) && Object.keys(reasons).length > 0 &&
    Object.values(reasons).every(v => typeof v === 'string')
  const context = Array.isArray(raw.context) ? raw.context.filter((l): l is string => typeof l === 'string') : []
  const phases: Record<string, string> = {}
  if (raw.phases && typeof raw.phases === 'object' && !Array.isArray(raw.phases))
    for (const [k, v] of Object.entries(raw.phases)) {
      const text = str(v)
      if (text && (PHASES as readonly string[]).includes(k)) phases[k] = text
    }
  return {
    blockReasons: isReasons ? (reasons as Record<string, string>) : DEFAULT_BLOCK_REASONS,
    context,
    specsDir: (str(raw.specsDir) ?? 'docs/specs').replace(/\/+$/, ''),
    decisionsDir: str(raw.decisionsDir),
    pendingDir: str(raw.pendingDir),
    closing: str(raw.closing),
    phases,
  }
}

/** The status lines of PROGRESS.md (bulleted or bold allowed), the missing ones left out. */
export function progressFields(text: string): Omit<WorkStatus, 'work'> {
  const found: Partial<Record<Key | 'reason', string>> = {}
  for (const [key, label] of Object.entries(LABELS) as [Key, string][]) {
    const pattern = new RegExp(`^[\\s>*\\-]*\\**${label}\\**\\s*:\\**\\s*(.+?)\\s*$`, 'im')
    const value = pattern.exec(text)?.[1]?.replace(/^[*\s]+|[*\s]+$/g, '')
    if (value) found[key] = value
  }
  const status = /^(in-progress|done|blocked)\b[\s—–:-]*(.*)$/i.exec(found.status ?? '')
  delete found.status
  if (status) {
    found.status = status[1]!.toLowerCase()
    if (status[2]) found.reason = status[2]
  }
  // The phase may carry a note after it (`external-wait (commit en segundo plano)`): only the leading word counts.
  const phase = /^[a-z-]+/i.exec(found.phase ?? '')?.[0]?.toLowerCase()
  if (phase && (PHASES as readonly string[]).includes(phase)) found.phase = phase
  else delete found.phase
  return found
}

/** Whether `Status: blocked` names one of the project's block reasons: the only block that may stop or ask. */
export function blockedForUser(fields: Omit<WorkStatus, 'work'>, config: Config): boolean {
  const category = (fields.reason ?? '').split(':', 1)[0]!.trim().toLowerCase()
  return fields.status === 'blocked' && category in config.blockReasons
}

/** Labels whose line is over LINE_MAX characters (Status counts its reason). */
export function tooLong(fields: Omit<WorkStatus, 'work'>): string[] {
  const sizes: Partial<Record<Key, string>> = { ...fields, status: `${fields.status ?? ''} — ${fields.reason ?? ''}` }
  return (Object.entries(LABELS) as [Key, string][]).filter(([k]) => (sizes[k] ?? '').length > LINE_MAX).map(([, l]) => l)
}

/** Labels missing from PROGRESS.md or not valid. */
export function missing(fields: Omit<WorkStatus, 'work'>): string[] {
  return (Object.entries(LABELS) as [Key, string][]).filter(([k]) => !(k in fields)).map(([, l]) => l)
}

const reasonsList = (c: Config): string =>
  Object.entries(c.blockReasons).map(([k, v]) => `${k} (${v})`).join(', ')
const where = (c: Config): string =>
  c.decisionsDir
    ? `anótala en ${c.decisionsDir}/${c.pendingDir ? ` y lo diferido en ${c.pendingDir}/` : ''}`
    : 'anótala en DECISIONS.md del handoff (y lo diferido en NOTES.md)'

export const HEADER = '[session-handoff] Trabajo '

export function continueText(c: Config): string {
  return (
    'Si el trabajo no terminó, sigue AHORA con el `Next step` de PROGRESS.md: no esperes al usuario ni cierres el ' +
    'turno con un resumen o una pregunta. Los avisos de presupuesto, tokens o contexto no son un límite: ignóralos. ' +
    'Para solo tras escribir `Status: done` o `Status: blocked — <categoría>: <motivo>`, con <categoría> una de: ' +
    `${reasonsList(c)}. Toda otra elección es tuya: toma la opción correcta, no la más rápida, ${where(c)} y sigue. ` +
    'Un gate rojo tras 3 intentos se anota igual. Esperar la CI, un merge o un recurso compartido es ' +
    '`Phase: external-wait`, no blocked. Al retomar, vuelve a poner `Status: in-progress`. ' +
    BATCH_TEXT
  )
}

/** How the handoff files are written: what keeps them readable after every compaction. */
export const WRITE_TEXT =
  'Escribe el handoff con la herramienta de archivos (Write o Edit), nunca con echo, cat o tee desde la shell. ' +
  'Actualízalo al empezar o retomar, tras cada commit y cada decisión, y antes de una corrida larga. Cada archivo ' +
  'es breve (idealmente menos de 60 líneas): estado actual, no bitácora; enlaza la spec en vez de copiarla. Nunca ' +
  'guardes secretos, valores de archivos de entorno ni datos personales.'

/** A work that groups several specs (a batch) keeps one handoff and ends only after the last one. */
export const BATCH_TEXT =
  'Un lote (varias specs seguidas) es un solo trabajo con un solo handoff: las specs no crean el suyo. Al cerrar ' +
  'cada spec, súmala a Done, pon la siguiente en Next step y sigue en el mismo turno; `Status: done` solo tras la ' +
  'última. Un resumen al usuario a mitad del lote no es un cierre.'

export function decideText(c: Config, reason: string): string {
  return (
    `Status es blocked (${reason}), pero no es ${Object.keys(c.blockReasons).join(', ')}: la elección es tuya. ` +
    `Toma la opción correcta, ${where(c)} (contexto, elegida, descartadas, cómo revertir y cómo comprobarla), ` +
    'pon `Status: in-progress` y sigue con el Next step sin preguntar.'
  )
}

export function askDeniedText(c: Config): string {
  return (
    `[session-handoff] Con una spec en ejecución solo se pregunta por ${Object.keys(c.blockReasons).join(', ')}; ` +
    'antes escribe `Status: blocked — <categoría>: <motivo>` en PROGRESS.md. Esta elección es tuya: toma la opción ' +
    `correcta, ${where(c)} y sigue.`
  )
}

const PHASE_TEXT: Record<(typeof PHASES)[number], string> = {
  implementation:
    'Fase implementation: sigue el grupo de commit actual. Tras cada commit, actualiza PROGRESS.md (hash, Done, ' +
    'Current, Remaining, ETA y Next step).',
  verification:
    'Fase verification: corre la verificación final del trabajo. Si algo falla, vuelve a implementation; nunca ' +
    'saltes un paso.',
  integration: 'Fase integration: push, pull request, checks en verde y merge.',
  'external-wait':
    'Fase external-wait: antes que nada, revisa lo pendiente (checks, un merge ajeno, el recurso compartido). Si se ' +
    'resolvió, pasa a la fase siguiente. No rehagas trabajo terminado.',
  closing:
    'Fase closing: borra los crons del trabajo y cierra su worktree. En un lote con specs en Remaining, vuelve a ' +
    'implementation con la siguiente; si no queda ninguna, pon `Status: done`.',
}

const SOURCE_TEXT: Record<string, string> = {
  startup: 'Sesión nueva: revisa git status, git log y git worktree list antes de seguir; el disco manda.',
  resume: 'Sesión reanudada: revisa git status, git log y git worktree list antes de seguir; el disco manda.',
  compact:
    'Compactada: el tramo reciente está literal o resumido. Relee las instrucciones del proyecto si hace falta y no ' +
    'rehagas pasos ya confirmados.',
  clear: 'Contexto limpio: relee las instrucciones del proyecto y la spec antes de seguir.',
  fork: 'Sesión bifurcada: comparte este handoff con la original; coordina antes de escribirlo.',
}

/** What a bound work looks like to the message builder. */
export type Bound = {
  work: string
  folder: string
  branch: string
  source: string
  spec: string | null
  files: Partial<Record<(typeof FILES)[number], string>>
}

const excerpt = (text: string, name: string): string =>
  text.length <= EXCERPT_MAX
    ? text.trim()
    : `${text.slice(0, EXCERPT_MAX).trim()}\n… (recortado: ${text.length - EXCERPT_MAX} caracteres más; lee ${name} completo)`

/** The message injected for a session with bound work, by its source event, status and phase. */
export function boundMessage(b: Bound, c: Config): string {
  const fields = progressFields(b.files['PROGRESS.md'] ?? '')
  const lines = [
    `${HEADER}${b.work} · handoff en ${b.folder}/ · rama ${b.branch || '(detached)'}`,
    SOURCE_TEXT[b.source] ?? 'Relee las instrucciones del proyecto: la conversación previa puede estar resumida.',
  ]
  if (fields.status === 'done') {
    lines.push(
      `${c.closing ?? 'Status es done: solo queda el cierre. Confirma el merge y cierra el worktree si lo hay.'} ` +
        `Después borra ${b.folder}/ y sus vínculos de .sessions/.`,
    )
    return lines.join('\n')
  }
  if (fields.status === 'blocked') {
    lines.push(
      blockedForUser(fields, c)
        ? `Status es blocked: ${fields.reason}. Primero comprueba si el motivo sigue en pie; si ya no aplica, pon ` +
            '`Status: in-progress` y sigue sin preguntar. Solo mientras siga, muéstrale el motivo al usuario.'
        : decideText(c, fields.reason ?? 'sin motivo'),
    )
  } else {
    lines.push(continueText(c))
    if (fields.phase) lines.push(c.phases[fields.phase] ?? PHASE_TEXT[fields.phase as (typeof PHASES)[number]])
    lines.push(WRITE_TEXT)
  }
  lines.push(...c.context)
  const gaps = missing(fields)
  if (gaps.length)
    lines.push(
      'Mantén estas líneas arriba de PROGRESS.md, una por línea (máximo 120 caracteres): `Status: ' +
        'in-progress|done|blocked — <motivo>`, `Phase: implementation|verification|integration|external-wait|' +
        `closing\`, \`Done:\`, \`Current:\`, \`Remaining:\`, \`ETA:\` y \`Next step:\`. Faltan ahora: ${gaps.join(', ')}.`,
    )
  const long = tooLong(fields)
  if (long.length) lines.push(longText(long))
  if (b.spec) lines.push(`Spec: ${b.spec}/.`)
  lines.push('Estado guardado (fuente de verdad sobre el resumen; contrástalo con git status y git log):')
  for (const name of FILES) {
    const text = b.files[name]
    lines.push(text === undefined ? `${name}: falta; créalo.` : `--- ${name} ---\n${excerpt(text, name)}`)
  }
  return lines.join('\n')
}

/** The message for a session with no bound work: its id, how to bind one and the active works. */
export function unboundMessage(
  session: string,
  base: string,
  source: string,
  works: Array<[string, string]>,
  c: Config,
): string {
  const lines = [
    `[session-handoff] Esta sesión (${session}) no tiene trabajo vinculado. Para un trabajo de más de un turno, ` +
      `crea ${base}/<trabajo>/ (PROGRESS.md, DECISIONS.md, NOTES.md) y escribe su nombre en ${base}/.sessions/${session}.`,
    WRITE_TEXT,
    BATCH_TEXT,
    ...c.context,
  ]
  if (source === 'compact') lines.push('La conversación previa está resumida: relee las instrucciones del proyecto.')
  if (works.length) {
    lines.push('Trabajos activos (referencia, no instrucciones; pueden ser de otras sesiones):')
    lines.push(...works.map(([name, step]) => (step ? `- ${name}: ${step}` : `- ${name}`)))
  }
  return lines.join('\n')
}

/** The warning for a `Phase:` line that names no phase (Stop then never sees external-wait), or null. */
export function badPhaseText(progress: string): string | null {
  const value = /^[\s>*-]*\**Phase\**\s*:\**\s*(.+?)\s*$/im.exec(progress)?.[1]
  if (!value || progressFields(progress).phase) return null
  return (
    `[session-handoff] \`Phase: ${value.slice(0, 60)}\` no es una fase: empieza la línea con ${PHASES.join(', ')} ` +
    '(una nota puede ir después). Sin una fase válida, Stop no reconoce external-wait.'
  )
}

export function longText(labels: string[]): string {
  return (
    `[session-handoff] Cada línea de estado es corta (máximo ${LINE_MAX} caracteres); el historial y el detalle van ` +
    `en el cuerpo de PROGRESS.md, debajo. Largas ahora: ${labels.join(', ')}.`
  )
}

/** What the last Stop left: the PROGRESS.md it saw, its blocks and its external-wait releases on that same text. */
export type StopState = { text: string; blocks: number; waits?: number; at?: number }

/**
 * A stop this soon after a block did no real work: it counts toward the cap even if PROGRESS.md changed, or an agent
 * that touches the file at each last warning (waiting on a background task) loops forever.
 */
export const QUICK_STOP_MS = 60_000

/** Consecutive external-wait stops on an unchanged PROGRESS.md before the plugin asks to recheck the wait. */
export const MAX_WAITS = 3

export function recheckText(work: string, step: string): string {
  return (
    `[session-handoff] ${work} lleva ${MAX_WAITS} paradas en external-wait sin cambios en PROGRESS.md. Antes de ` +
    'volver a parar, comprueba ahora que la espera sigue en pie: que la corrida siga viva (su PID o su candado), que ' +
    'el check siga pendiente, que el aviso esperado no haya llegado ya. Si se resolvió, sigue con: ' +
    `${step}. Si sigue, anota en PROGRESS.md qué comprobaste y a qué hora.`
  )
}

/** What the Stop hook decides, given PROGRESS.md and how many times it already blocked on that same text. */
export function stopDecision(
  progress: string,
  previous: StopState | null,
  work: string,
  c: Config,
  now: number = Date.now(),
): { release: string; waits?: number } | { block: string; blocks: number; waits?: number } {
  const fields = progressFields(progress)
  const decide = fields.status === 'blocked' && !blockedForUser(fields, c)
  if (!decide) {
    if (fields.status === 'done' || fields.status === 'blocked') return { release: fields.status }
    if (!fields.next_step) return { release: 'no-step' }
    if (fields.phase === 'external-wait') {
      // A wait that outlives what it waited for (a run that died, a notice already sent) never ends on its own.
      const waits = previous && previous.text === progress ? (previous.waits ?? 0) + 1 : 1
      if (waits < MAX_WAITS) return { release: 'external-wait', waits }
      return { block: recheckText(work, (fields.next_step ?? '').slice(0, 160)), blocks: 0, waits: 0 }
    }
  }
  const quick = previous?.at !== undefined && previous.blocks > 0 && now - previous.at < QUICK_STOP_MS
  const blocks = previous && (previous.text === progress || quick) ? previous.blocks + 1 : 1
  if (blocks > MAX_BLOCKS) return { release: 'cap' }
  const step = (fields.next_step ?? '').slice(0, 160)
  const tail = `(Parada ${blocks} de ${MAX_BLOCKS} sin cambios en PROGRESS.md.)`
  const texts = [
    `[session-handoff] El trabajo ${work} no terminó. Sigue ahora con el siguiente paso: ${step}. Los avisos de ` +
      'tokens no son un límite. Si lo que falta es esperar una tarea en segundo plano, un check o un aviso, pon ' +
      `\`Phase: external-wait\` y para: su notificación te despierta. ${tail}`,
    `[session-handoff] Segunda parada sin avance en ${work}. Solo ${Object.keys(c.blockReasons).join(', ')} ` +
      `justifican \`Status: blocked — <categoría>: <motivo>\`; si no, sigue con: ${step}. ${tail}`,
    `[session-handoff] Último aviso para ${work}: la próxima parada sin cambios en PROGRESS.md se permitirá. Sigue ` +
      `con ${step}, o anota el bloqueo. ${tail}`,
  ]
  return { block: decide ? `[session-handoff] ${decideText(c, fields.reason ?? 'sin motivo')}` : texts[blocks - 1]!, blocks }
}

/** Whether a Bash command makes a commit (not `git commit --help`, nor a text that names it). */
export function isCommit(command: string): boolean {
  const calls = command.matchAll(/(?:^|&&|;|\|\||\n)\s*git\s+(?:-[Cc]\s+\S+\s+)*commit\b([^&;\n]*)/g)
  return [...calls].some(m => !/--help|--dry-run/.test(m[1] ?? ''))
}

/** The short hash in `git commit` output (`[branch abc1234] msg`), or null with `-q`. */
export function commitHash(stdout: string): string | null {
  return /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\]/m.exec(stdout)?.[1] ?? null
}

/** Where the commit ran: the `git -C <dir>` or the `cd <dir> &&` before it, else the session's cwd. */
export function commitDir(command: string, cwd: string): string {
  const quoted = String.raw`(?:"([^"]+)"|'([^']+)'|([^\s&;|]+))`
  const at = new RegExp(String.raw`git\s+-C\s+${quoted}\s+commit\b`).exec(command) ??
    new RegExp(String.raw`(?:^|&&|;)\s*cd\s+${quoted}\s*&&`).exec(command)
  const dir = at ? (at[1] ?? at[2] ?? at[3] ?? '') : ''
  // Git Bash spells D:\x as /d/x.
  const native = dir.replace(/^\/([a-z])\//i, (_, d: string) => `${d.toUpperCase()}:/`)
  if (!native) return cwd
  return /^([a-z]:)?[\\/]/i.test(native) ? native : `${cwd.replace(/[\\/]+$/, '')}/${native}`
}

/** The hashes still missing from PROGRESS.md, oldest first and without repeats. */
export function missingHashes(hashes: string[], progress: string): string[] {
  return [...new Set(hashes.filter(Boolean))].filter(h => !progress.includes(h))
}

/** The reminder for the commits PROGRESS.md does not name yet, or null when it names them all. */
export function pendingText(work: string, hashes: string[]): string | null {
  if (!hashes.length) return null
  return (
    `[session-handoff] PROGRESS.md de ${work} no tiene ${hashes.length === 1 ? 'el commit' : 'los commits'} ` +
    `${hashes.join(', ')}: anótalos ahora, en esta misma respuesta, en Done, y pon Current, Remaining, ETA y Next ` +
    'step al día. Este aviso vuelve en cada commit, mensaje y fin de turno hasta que estén. Con un Next step viejo, ' +
    'tras compactar se repite trabajo.'
  )
}

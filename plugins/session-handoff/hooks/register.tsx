import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Meter, WorkStatus } from '../types'
import { askDeniedText, badPhaseText, blockedForUser, boundMessage, commitDir, commitHash, duplicateText, isCommit, longText, missingHashes,
  pendingText, progressFields, stopDecision, tooLong, unboundMessage } from './handoff' // fmt: skip
import { addTurn, type Cell, cells, contextTone, emptyMeter, testCounts } from './metrics'
import { bandText, keepsMessage, spinnerWord, STATUS_COLOR } from './status'
import { activeWorks, boundOf, configOf, currentWork, handoffDir, type Io, logEvent, type Place, placeOf,
  progressOf, specOf, statusOf } from './store' // fmt: skip
import { keepTail, slim } from './tail'

// ponytail: chars/4 ≈ tokens; ~20k tokens kept verbatim. Thinking and nested rules ride along unseen.
const TAIL_BUDGET = 80_000
// Newest messages handed back whole, with their thinking; the older ones are rebuilt without it.
const WHOLE = 4
const MARKER =
  '[session-handoff] Conversation compacted without a summary. The session handoff comes separately ' +
  '(SessionStart compact) and wins over what follows; check it against git status and git log. ' +
  'What follows are the newest messages, unsummarized. If the work is not finished, continue now ' +
  'with the next step: budget or token warnings are not a limit.'
const ACK = 'Understood.'
const HANDOFF_PATH = /(?:^|\/)tmp\/handoff\//
const PROGRESS_PATH = /(?:^|\/)tmp\/handoff\/[^/]+\/PROGRESS\.md$/

const status = atom({ plugin: 'session-handoff', key: 'status' } as const, null)
const isHidden = atom({ plugin: 'session-handoff', key: 'isHidden' } as const, false)
const contextPercent = atom({ plugin: 'session-handoff', key: 'contextPercent' } as const, null)
const lastStop = atom({ plugin: 'session-handoff', key: 'lastStop' } as const, null)
const pendingCommits = atom({ plugin: 'session-handoff', key: 'pendingCommits' } as const, [] as string[])
// A commit launched in a background Bash has not run when PostToolUse fires: where and at which HEAD it started.
const backgroundCommits = atom({ plugin: 'session-handoff', key: 'backgroundCommits' } as const,
  [] as { dir: string; base: string }[]) // fmt: skip
const BACKGROUND_KEPT = 5
const meterState = atom({ plugin: 'session-handoff', key: 'meter' } as const, null)
const isCompact = atom({ plugin: 'session-handoff', key: 'isCompact' } as const, false)

// The meter is kept in $.store too, so a resumed session keeps its turns, tokens and tests.
const METER_KEY = 'meter/'
const METERS_KEPT = 20

/** The session's meter: the one in state, else the one stored for it, else a fresh one. */
async function meterOf($: EngineInterface): Promise<Meter> {
  const session = await $.session.id()
  const current = await read($, meterState)
  if (current?.session === session) return current
  const stored = (await $.store.get(METER_KEY + session).catch(() => undefined)) as Meter | undefined
  if (stored?.session === session) return { ...emptyMeter(session, stored.startedAt), ...stored }
  const startedAt = (await $.session.usage().catch(() => null))?.startedAt ?? (await $.clock.now())
  return emptyMeter(session, startedAt)
}

/** Applies `fn` to the session's meter. A broken meter must not break the session. */
async function bump($: EngineInterface, fn: (m: Meter) => Meter): Promise<void> {
  try {
    const base = await meterOf($)
    await update($, meterState, m => fn(m?.session === base.session ? m : base))
  } catch {
    // The rows stay as they were.
  }
}

/** Writes the meter to $.store, keeping the newest sessions only. */
async function saveMeter($: EngineInterface): Promise<void> {
  try {
    const meter = await read($, meterState)
    if (!meter) return
    await $.store.set(METER_KEY + meter.session, meter)
    const keys = (await $.store.keys()).filter(k => k.startsWith(METER_KEY))
    for (const old of keys.slice(0, Math.max(0, keys.length - METERS_KEPT))) await $.store.delete(old)
  } catch {
    // Only a resume would miss it.
  }
}

/** The engine's disk and git as the store's Io. */
function ioOf($: EngineInterface): Io {
  return {
    read: path => $.fs.read(path).then(t => t as string, () => null),
    write: (path, text) => $.fs.write(path, text),
    list: path => $.fs.list(path),
    git: async (cwd, args) => {
      const run = await $.process.run(['git', ...args], { cwd }).catch(() => null)
      return run?.exitCode === 0 ? run.stdout.trim() : ''
    },
  }
}

async function here($: EngineInterface, cwd?: string): Promise<{ io: Io; place: Place; session: string }> {
  const io = ioOf($)
  return { io, place: await placeOf(io, cwd || (await $.session.cwd())), session: await $.session.id() }
}

/** The text SessionStart injects: the bound work's handoff, or how to bind one. */
async function messageFor(io: Io, place: Place, session: string, source: string): Promise<string> {
  const config = await configOf(io, place.root)
  const work = await currentWork(io, place, session)
  if (work) return boundMessage(await boundOf(io, place, work, source, config), config)
  return session ? unboundMessage(session, handoffDir(place.store), source, await activeWorks(io, place), config) : ''
}

/** Rereads the bound work's status lines into the state the band and spinner draw. */
async function refresh($: EngineInterface): Promise<void> {
  try {
    const { io, place, session } = await here($)
    const next: WorkStatus | null = await statusOf(io, place, session)
    await update($, status, () => next)
  } catch {
    // A broken status line must not break the session: the band just stays as it was.
  }
}

/** The bound work and the commits of this session its PROGRESS.md does not name yet (the state is pruned). */
async function pending($: EngineInterface, session: string, add: string[] = []) {
  const { io, place } = await here($)
  const work = await currentWork(io, place, session)
  if (!work) return null
  const landed = await landedCommits($, io)
  const known = [...(await read($, pendingCommits)), ...(await storedPending($, session))]
  const missing = missingHashes([...known, ...landed, ...add], await progressOf(io, place, work))
  await update($, pendingCommits, () => missing)
  await keepPending($, session, missing)
  return { io, place, work, missing }
}

// The hashes still missing are kept in $.store too: /reload-plugins and --resume start the state empty.
const PENDING_KEY = 'pending/'

async function storedPending($: EngineInterface, session: string): Promise<string[]> {
  const stored = await $.store.get(PENDING_KEY + session).catch(() => undefined)
  return Array.isArray(stored) ? stored.filter((h): h is string => typeof h === 'string') : []
}

async function keepPending($: EngineInterface, session: string, hashes: string[]): Promise<void> {
  try {
    if (hashes.length) await $.store.set(PENDING_KEY + session, hashes)
    else if ((await storedPending($, session)).length) await $.store.delete(PENDING_KEY + session)
  } catch {
    // Only a reload would miss them.
  }
}

/**
 * The commits background Bash commits have made since they started. Only the branch's own commits count (first
 * parent, no merges), so a merge of dev brings in nobody else's; a commit that has not landed yet keeps waiting.
 */
async function landedCommits($: EngineInterface, io: Io): Promise<string[]> {
  const watched = await read($, backgroundCommits)
  if (!watched.length) return []
  const landed: string[] = []
  const waiting: typeof watched = []
  for (const w of watched) {
    const own = await io.git(w.dir, ['log', '--first-parent', '--no-merges', '--format=%h', `${w.base}..HEAD`])
    const hashes = own.split('\n').map(h => h.trim()).filter(Boolean).reverse()
    if (hashes.length) landed.push(...hashes)
    else waiting.push(w)
  }
  await update($, backgroundCommits, () => waiting)
  return landed
}

/** After a `git commit` in Bash, asks for every hash PROGRESS.md of the bound work still lacks, this one included. */
async function afterCommit<R extends { block?: string }>(
  $: EngineInterface,
  e: { tool_input?: unknown; tool_response?: unknown; session_id: string; cwd?: string },
  result: R,
): Promise<R> {
  const command = (e.tool_input as { command?: unknown } | undefined)?.command
  const response = e.tool_response as { stdout?: unknown; stderr?: unknown } | undefined
  const stdout = response?.stdout
  if (typeof command === 'string') await recordTests($, command, [stdout, response?.stderr])
  if (result.block || typeof command !== 'string' || !isCommit(command)) return result
  const cwd = e.cwd || (await $.session.cwd())
  if ((e.tool_input as { run_in_background?: unknown }).run_in_background === true) {
    // `git log -1` now would name the HEAD before the commit: the next hook reads what it made.
    const dir = commitDir(command, cwd)
    const base = await ioOf($).git(dir, ['rev-parse', 'HEAD'])
    if (base) await update($, backgroundCommits, w => [...w, { dir, base }].slice(-BACKGROUND_KEPT))
    return result
  }
  const sha = commitHash(typeof stdout === 'string' ? stdout : '') ??
    ((await ioOf($).git(commitDir(command, cwd), ['log', '-1', '--format=%h'])) || null)
  const state = await pending($, e.session_id, sha ? [sha] : [])
  const text = state && pendingText(state.work, state.missing)
  if (!state || !text) return result
  await logEvent(state.io, state.place.store, { event: 'commit.remind', session: e.session_id, work: state.work })
  return { ...result, block: text }
}

/** A test command's counts become the meter's last run, and the edits since it start over. */
async function recordTests($: EngineInterface, command: string, outputs: unknown[]): Promise<void> {
  const counts = testCounts(command, outputs.filter(o => typeof o === 'string').join('\n'))
  if (!counts) return
  // A meter that fails must not cost the commit reminder its hook.
  const at = await $.clock.now().catch(() => 0)
  await bump($, m => ({ ...m, tests: { ...counts, at }, editsSinceTests: 0 }))
}

/** The rate-limit windows as plain data the meter keeps. */
const limitsOf = (windows: readonly { kind: string; percentUsed: number; resetsAt?: string }[]) =>
  windows.map(({ kind, percentUsed, resetsAt }) => (resetsAt ? { kind, percentUsed, resetsAt } : { kind, percentUsed }))

const built = (role: SessionMessage['role'], text: string): SessionMessage => ({ role, text, toolUses: [] })

/**
 * The session handoff on disk (tmp/handoff/<work>/): injected at every session start, resume and compaction;
 * the turn may not end while the work has a next step; compaction keeps the newest messages instead of a model
 * summary; and the work's status shows in the spinner and in a band above the prompt.
 */
export const register: Register = on => {
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const { io, place } = await here($, e.cwd)
    const text = await messageFor(io, place, e.session_id, e.source)
    await refresh($)
    if (!text) return result
    await logEvent(io, place.store, { event: 'inject', session: e.session_id, source: e.source, chars: text.length })
    return { ...result, additionalContext: [...(result.additionalContext ?? []), text] }
  })

  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (result.block) return result
    const { io, place } = await here($, e.cwd)
    const work = await currentWork(io, place, e.session_id)
    if (!work) return result
    const unnoted = e.stop_hook_active ? null : await pending($, e.session_id)
    const reminder = unnoted && pendingText(unnoted.work, unnoted.missing)
    if (reminder) {
      await bump($, m => ({ ...m, stopBlocks: m.stopBlocks + 1 }))
      await logEvent(io, place.store, { event: 'stop.commits', session: e.session_id, work })
      return { ...result, block: reminder }
    }
    const config = await configOf(io, place.root)
    const progress = await progressOf(io, place, work)
    const now = Date.now()
    const decision = stopDecision(progress, await read($, lastStop), work, config, now)
    if ('release' in decision) {
      await update($, lastStop, () => (decision.waits ? { text: progress, blocks: 0, waits: decision.waits } : null))
      if (decision.release === 'cap') await bump($, m => ({ ...m, stopCaps: m.stopCaps + 1 }))
      await logEvent(io, place.store, { event: 'stop.release', session: e.session_id, reason: decision.release })
      return result
    }
    await update($, lastStop, () => ({ text: progress, blocks: decision.blocks, waits: decision.waits, at: now }))
    await bump($, m => ({ ...m, stopBlocks: m.stopBlocks + 1 }))
    const event = decision.waits === 0 ? 'stop.recheck' : 'stop.block'
    await logEvent(io, place.store, { event, session: e.session_id, blocks: decision.blocks, work })
    return { ...result, block: decision.block }
  })

  // While a spec runs, the user is asked only for one of the project's block reasons.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const { io, place, session } = await here($)
    const work = await currentWork(io, place, session)
    if (!work) return next(e)
    const config = await configOf(io, place.root)
    if (!(await specOf(io, place, work, config))) return next(e)
    if (blockedForUser(progressFields(await progressOf(io, place, work)), config)) return next(e)
    await logEvent(io, place.store, { event: 'ask.deny', session, work })
    return { deny: askDeniedText(config) }
  })

  // A status line written too long is named right away, not at the next reinjection; a commit asks for its hash.
  on('classic.PostToolUse', async ($, e, next) => {
    const result = await next(e)
    if (e.tool_name === 'Bash') return afterCommit($, e, result)
    const input = e.tool_input as { file_path?: unknown } | undefined
    const path = typeof input?.file_path === 'string' ? input.file_path.replace(/\\/g, '/') : ''
    const isEdit = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(e.tool_name)
    if (isEdit && path && !HANDOFF_PATH.test(path)) await bump($, m => ({ ...m, editsSinceTests: m.editsSinceTests + 1 }))
    if (!['Write', 'Edit'].includes(e.tool_name) || !PROGRESS_PATH.test(path)) return result
    await refresh($)
    await pending($, e.session_id)
    const text = await $.fs.read(path).then(t => t as string, () => '')
    const long = tooLong(progressFields(text))
    const notes = [long.length ? longText(long) : null, badPhaseText(text), duplicateText(text)]
      .filter(Boolean).join('\n') // fmt: skip
    return notes ? { ...result, block: notes } : result
  })

  on('session.compact', async ($, e, next) => {
    if (e.trigger === 'precompute') return { skip: `${$.plugin.name}: compacts on demand from the handoff` }
    if (e.agentId === undefined) await bump($, m => ({ ...m, compactions: m.compactions + 1 }))
    const { io, place, session } = await here($)
    const base = { trigger: e.trigger, total: e.messages.length, session }
    const fallback = async (reason: string) => {
      await logEvent(io, place.store, { event: 'compact.fallback', reason, ...base })
      return next(e)
    }
    if (e.agentId !== undefined) return fallback('subagent')
    if (!(await currentWork(io, place, session))) return fallback('no-handoff')
    const tail = keepTail(e.messages, TAIL_BUDGET, WHOLE)
    if (!tail) return fallback('tail-too-big')
    const kept = slim(tail, WHOLE)
    const whole = kept.filter(m => m.handle !== undefined).length
    await logEvent(io, place.store, { event: 'compact.kept', kept: kept.length, whole, ...base })
    $.ui.toast(`${$.plugin.name}: ${kept.length} of ${e.messages.length} messages kept (${whole} whole), no summary`)
    // Roles must alternate: an assistant-led tail follows the marker directly.
    const ack = kept[0]?.role === 'assistant' ? [] : [built('assistant', ACK)]
    return { messages: [built('user', MARKER), ...ack, ...kept] }
  })

  // An interruption (the user, a cron) must not make a commit's hash slip from PROGRESS.md.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const result = await next(e)
    const state = await pending($, e.session_id)
    const text = state && pendingText(state.work, state.missing)
    return text ? { ...result, additionalContext: [...(result.additionalContext ?? []), text] } : result
  })

  on('session.start', async ($, e, next) => {
    await refresh($)
    const usage = await $.session.usage().catch(() => null)
    await bump($, m => ({ ...m, costUsd: usage?.cost?.usd ?? m.costUsd, limits: usage ? limitsOf(usage.rateLimits) : m.limits }))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const usd = (await $.session.usage().catch(() => null))?.cost?.usd ?? null
      await bump($, m => ({ ...m, costAtTurnStart: usd ?? m.costUsd }))
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const main = e.agentId === undefined
    const usd = main ? ((await $.session.usage().catch(() => null))?.cost?.usd ?? null) : null
    await bump($, m => {
      const added = addTurn(m, e.usage, e.durationMs, main)
      if (!main || usd === null) return added
      const start = m.costAtTurnStart
      return { ...added, costUsd: usd, lastTurnUsd: start === null ? null : usd - start, costAtTurnStart: null }
    })
    if (main) await saveMeter($)
    await refresh($)
    return next(e)
  })

  // The engine measures after each response; the band redraws only when the whole percent moves.
  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent ?? null
    if ((await read($, contextPercent)) !== percent) await update($, contextPercent, () => percent)
    if (e.changed.includes('cost') || e.changed.includes('rateLimits')) {
      const cost = e.cost
      await bump($, m => ({ ...m, costUsd: cost?.usd ?? m.costUsd, hasUnknownPrice: cost?.hasUnknownPrice ?? m.hasUnknownPrice,
        limits: limitsOf(e.rateLimits) })) // fmt: skip
    }
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const current = await read($, status)
    const word = current && !keepsMessage(e.props.message) ? spinnerWord(current) : null
    return next(word ? ({ ...e, props: { ...e.props, word, message: null } } as typeof e) : e)
  })

  // Above the prompt: the metrics row between rules, then the work's status line with its buttons.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const current = await read($, status)
    const percent = await read($, contextPercent)
    const meter = await read($, meterState)
    const head = bandText(current, null)
    const hasMeter = meter !== null && (meter.turns > 0 || meter.costUsd !== null)
    if (head === null && percent === null && !hasMeter) return next(e)
    const compact = await read($, isCompact)
    const { Box, Button, Text } = $.ui.resolve(e)
    const columns = Math.max(20, e.props.bodyColumns)
    const work = { isBound: current !== null, pending: (await read($, pendingCommits)).length }
    const row: Cell[] = meter && hasMeter && !compact ? cells(meter, await $.clock.now(), work) : []
    // Every column as wide as the widest, so the row lines up and wraps whole columns on a narrow terminal.
    const widest = Math.max(0, ...row.map(c => Math.max(c.label.length, c.value.length, c.sub.length)))
    const width = Math.min(columns, widest + 3)
    const rule = '─'.repeat(Math.min(columns, 240))
    const tone = contextTone(percent)
    const metrics = row.length > 0 && (
      <Box key="metrics" flexDirection="column">
        <Text dimColor wrap="truncate-end">{rule}</Text>
        <Box flexDirection="row" flexWrap="wrap">
          {row.map(cell => (
            <Box key={cell.key} flexDirection="column" width={width}>
              <Text dimColor wrap="truncate-end">{cell.label}</Text>
              <Text bold wrap="truncate-end" color={cell.tone ?? 'text'}>{cell.value}</Text>
              {cell.subTone ? (
                <Text wrap="truncate-end" color={cell.subTone}>{cell.sub}</Text>
              ) : (
                <Text dimColor wrap="truncate-end">{cell.sub}</Text>
              )}
            </Box>
          ))}
        </Box>
        <Text dimColor wrap="truncate-end">{rule}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column">
        {metrics}
        <Box flexDirection="row">
          <Text bold wrap="truncate-end" color={STATUS_COLOR[current?.status ?? ''] ?? 'text'}>
            ● {head ?? ''}
          </Text>
          {percent !== null &&
            (tone ? (
              <Text bold wrap="truncate-end" color={tone}>{head ? ' · ' : ''}ctx {percent}%</Text>
            ) : (
              <Text dimColor wrap="truncate-end">{head ? ' · ' : ''}ctx {percent}%</Text>
            ))}
          <Text> </Text>
          {hasMeter && (
            <Button key="compact" label={compact ? 'More' : 'Less'} onPress={() => update($, isCompact, v => !v)} />
          )}
          {hasMeter && <Text> </Text>}
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
      </Box>
    )
  })
}

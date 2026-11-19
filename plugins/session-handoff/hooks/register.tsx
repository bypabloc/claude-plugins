import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { WorkStatus } from '../types'
import { askDeniedText, blockedForUser, boundMessage, commitDir, commitHash, isCommit, longText, missingHashes,
  pendingText, progressFields, stopDecision, tooLong, unboundMessage } from './handoff' // fmt: skip
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
const PROGRESS_PATH = /(?:^|\/)tmp\/handoff\/[^/]+\/PROGRESS\.md$/

const status = atom({ plugin: 'session-handoff', key: 'status' } as const, null)
const isHidden = atom({ plugin: 'session-handoff', key: 'isHidden' } as const, false)
const contextPercent = atom({ plugin: 'session-handoff', key: 'contextPercent' } as const, null)
const lastStop = atom({ plugin: 'session-handoff', key: 'lastStop' } as const, null)
const pendingCommits = atom({ plugin: 'session-handoff', key: 'pendingCommits' } as const, [] as string[])

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
  const missing = missingHashes([...(await read($, pendingCommits)), ...add], await progressOf(io, place, work))
  await update($, pendingCommits, () => missing)
  return { io, place, work, missing }
}

/** After a `git commit` in Bash, asks for every hash PROGRESS.md of the bound work still lacks, this one included. */
async function afterCommit<R extends { block?: string }>(
  $: EngineInterface,
  e: { tool_input?: unknown; tool_response?: unknown; session_id: string; cwd?: string },
  result: R,
): Promise<R> {
  const command = (e.tool_input as { command?: unknown } | undefined)?.command
  if (result.block || typeof command !== 'string' || !isCommit(command)) return result
  const stdout = (e.tool_response as { stdout?: unknown } | undefined)?.stdout
  const cwd = e.cwd || (await $.session.cwd())
  const sha = commitHash(typeof stdout === 'string' ? stdout : '') ??
    ((await ioOf($).git(commitDir(command, cwd), ['log', '-1', '--format=%h'])) || null)
  const state = await pending($, e.session_id, sha ? [sha] : [])
  const text = state && pendingText(state.work, state.missing)
  if (!state || !text) return result
  await logEvent(state.io, state.place.store, { event: 'commit.remind', session: e.session_id, work: state.work })
  return { ...result, block: text }
}

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
      await logEvent(io, place.store, { event: 'stop.commits', session: e.session_id, work })
      return { ...result, block: reminder }
    }
    const config = await configOf(io, place.root)
    const progress = await progressOf(io, place, work)
    const now = Date.now()
    const decision = stopDecision(progress, await read($, lastStop), work, config, now)
    if ('release' in decision) {
      await update($, lastStop, () => (decision.waits ? { text: progress, blocks: 0, waits: decision.waits } : null))
      await logEvent(io, place.store, { event: 'stop.release', session: e.session_id, reason: decision.release })
      return result
    }
    await update($, lastStop, () => ({ text: progress, blocks: decision.blocks, waits: decision.waits, at: now }))
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
    if (!['Write', 'Edit'].includes(e.tool_name) || !PROGRESS_PATH.test(path)) return result
    await refresh($)
    await pending($, e.session_id)
    const text = await $.fs.read(path).then(t => t as string, () => '')
    const long = tooLong(progressFields(text))
    return long.length ? { ...result, block: longText(long) } : result
  })

  on('session.compact', async ($, e, next) => {
    if (e.trigger === 'precompute') return { skip: `${$.plugin.name}: compacts on demand from the handoff` }
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
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  // The engine measures after each response; the band redraws only when the whole percent moves.
  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent ?? null
    if ((await read($, contextPercent)) !== percent) await update($, contextPercent, () => percent)
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const current = await read($, status)
    const word = current && !keepsMessage(e.props.message) ? spinnerWord(current) : null
    return next(word ? ({ ...e, props: { ...e.props, word, message: null } } as typeof e) : e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, status)
    const text = bandText(current, await read($, contextPercent))
    if (e.props.hasSurvey || text === null || (await read($, isHidden))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text bold wrap="truncate-end" color={STATUS_COLOR[current?.status ?? ''] ?? 'text'}>
          ● {text}{' '}
        </Text>
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}

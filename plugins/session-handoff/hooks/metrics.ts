import type { LimitWindow, Meter, TestRun, TokenTotals } from '../types'

/** Theme colors a cell may take; none draws as plain text. */
export type Tone = 'success' | 'warning' | 'error' | 'suggestion'

/** One column of the metrics row: a dim label, a bold value and a dim line beneath. */
export type Cell = { key: string; label: string; value: string; sub: string; tone?: Tone; subTone?: Tone }

/** The token counts a turn reports (ModelUsage). */
export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const ZERO: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** A fresh meter for a session, before any turn ended. */
export function emptyMeter(session: string, startedAt: number): Meter {
  return {
    session,
    startedAt,
    turns: 0,
    agentMs: 0,
    lastTurnMs: null,
    tokens: { ...ZERO },
    costUsd: null,
    costAtTurnStart: null,
    lastTurnUsd: null,
    limits: [],
    tests: null,
    editsSinceTests: 0,
    compactions: 0,
    stopBlocks: 0,
    stopCaps: 0,
  }
}

/** The meter with one turn's tokens added; `main` also counts the turn and its time. */
export function addTurn(meter: Meter, usage: Usage | undefined, durationMs: number, main: boolean): Meter {
  const t = meter.tokens
  const tokens = usage
    ? {
        input: t.input + usage.input_tokens,
        output: t.output + usage.output_tokens,
        cacheRead: t.cacheRead + usage.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + usage.cache_creation_input_tokens,
      }
    : t
  if (!main) return { ...meter, tokens }
  return { ...meter, tokens, turns: meter.turns + 1, agentMs: meter.agentMs + durationMs, lastTurnMs: durationMs }
}

export const totalTokens = (t: TokenTotals): number => t.input + t.output + t.cacheRead + t.cacheWrite

/** Share of the input the prompt cache served, 0–100; null before any input. */
export function cacheReuse(t: TokenTotals): number | null {
  const input = t.input + t.cacheRead + t.cacheWrite
  return input === 0 ? null : Math.round((t.cacheRead / input) * 100)
}

/** `$22.86`; null as an em dash. */
export const usd = (n: number | null): string => (n === null ? '—' : `$${Math.max(0, n).toFixed(2)}`)

const trim = (n: number): string => n.toFixed(1).replace(/\.0$/, '')

/** `950`, `3.2k`, `67.6M`. */
export function tokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${trim(n / 1000)}k`
  return `${trim(n / 1_000_000)}M`
}

/** `42s`, `3m 30s`, `1h 6m`. */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s % 60}s`
  return `${s}s`
}

// A command that runs a test suite; its output then holds the summary counts.
const TEST_COMMAND = /\b(test|tests|pytest|vitest|jest|playwright|mocha|spec|e2e)\b/i
// Jest's and Vitest's per-file lines repeat the totals in other units.
const PER_FILE = /^\s*Test (Suites|Files)\b/i
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/**
 * The passed and failed counts of a test command's output, summed over every summary line (bun, vitest, jest,
 * pytest, playwright, mocha, cargo); null when the command runs no tests or its output names no count.
 */
export function testCounts(command: string, output: string): Omit<TestRun, 'at'> | null {
  if (!TEST_COMMAND.test(command) || /\bgit\s+commit\b/.test(command)) return null
  let passed = 0
  let failed = 0
  let seen = false
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.replace(ANSI, '')
    if (PER_FILE.test(line)) continue
    for (const m of line.matchAll(/(\d+)\s+(?:passed|pass|passing)\b/gi)) {
      passed += Number(m[1])
      seen = true
    }
    for (const m of line.matchAll(/(\d+)\s+(?:failed|fail|failing)\b/gi)) {
      failed += Number(m[1])
      seen = true
    }
  }
  return seen ? { passed, failed } : null
}

const LIMIT_NAME: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const limitTone = (p: number): Tone | undefined => (p >= 90 ? 'error' : p >= 75 ? 'warning' : undefined)

function limitsCell(meter: Meter, now: number): Cell {
  const [first, ...rest] = [...meter.limits].sort((a, b) => b.percentUsed - a.percentUsed)
  if (!first) {
    // Off a subscription: the burn rate over the session's wall clock, as the community status lines show it.
    const hours = (now - meter.startedAt) / 3_600_000
    const rate = meter.costUsd !== null && hours > 0.02 ? `${usd(meter.costUsd / hours)}/h` : '—'
    return { key: 'rate', label: 'burn rate', value: rate, sub: `session ${duration(now - meter.startedAt)}` }
  }
  const name = (w: LimitWindow) => LIMIT_NAME[w.kind] ?? w.kind
  const reset = first.resetsAt ? Date.parse(first.resetsAt) - now : NaN
  const sub = [
    ...rest.map(w => `${name(w)} ${w.percentUsed}%`),
    Number.isFinite(reset) && reset > 0 ? `resets ${duration(reset).replace(/ \d+s$/, '')}` : '',
  ].filter(Boolean)
  return { key: 'limits', label: 'limits', value: `${name(first)} ${first.percentUsed}%`, sub: sub.join(' · '),
    tone: limitTone(first.percentUsed) } // fmt: skip
}

function testsCell(meter: Meter): Cell {
  const run = meter.tests
  if (!run) return { key: 'tests', label: 'tests', value: '—', sub: 'no run yet' }
  const value = run.failed ? `${run.failed} failed` : `${run.passed} passed`
  const edits = meter.editsSinceTests
  const sub = edits ? `${edits} edit${edits === 1 ? '' : 's'} since` : 'after last change'
  return { key: 'tests', label: 'tests', value, sub, tone: run.failed ? 'error' : 'success',
    subTone: edits ? 'warning' : undefined } // fmt: skip
}

function handoffCell(meter: Meter, pending: number): Cell {
  const value = pending ? `${pending} hash${pending === 1 ? '' : 'es'} due` : `${meter.compactions} compact`
  const sub = [pending ? `${meter.compactions} compact` : '', `${meter.stopBlocks} held`,
    meter.stopCaps ? `${meter.stopCaps} cap` : ''].filter(Boolean).join(' · ') // fmt: skip
  return { key: 'handoff', label: 'handoff', value, sub, tone: pending ? 'warning' : undefined,
    subTone: meter.stopCaps ? 'warning' : undefined } // fmt: skip
}

/**
 * The metrics row: cost, tokens, agent time, cache reuse, tests, limits (or burn rate) and, with bound work,
 * the handoff's health. The cost is `/cost`'s client-side estimate, not the bill.
 */
export function cells(meter: Meter, now: number, work: { isBound: boolean; pending: number }): Cell[] {
  const avgUsd = meter.costUsd !== null && meter.turns ? meter.costUsd / meter.turns : null
  const reuse = cacheReuse(meter.tokens)
  const out: Cell[] = [
    {
      key: 'cost',
      label: meter.hasUnknownPrice ? 'cost ~ (est.)' : 'cost (est.)',
      value: usd(meter.costUsd),
      sub: `last ${usd(meter.lastTurnUsd)} · ⌀ ${usd(avgUsd)}`,
    },
    {
      key: 'tokens',
      label: 'tokens',
      value: tokens(totalTokens(meter.tokens)),
      sub: `${meter.turns} turn${meter.turns === 1 ? '' : 's'} · ↓ ${tokens(meter.tokens.output)}`,
    },
    {
      key: 'time',
      label: 'agent time',
      value: duration(meter.agentMs),
      sub: meter.turns ? `⌀ ${duration(meter.agentMs / meter.turns)} / turn` : '—',
    },
    {
      key: 'reuse',
      label: 'cache reuse',
      value: reuse === null ? '—' : `${reuse}%`,
      sub: `${tokens(meter.tokens.cacheRead)} read`,
      tone: reuse !== null && reuse < 50 && meter.turns > 1 ? 'warning' : undefined,
    },
    testsCell(meter),
    limitsCell(meter, now),
  ]
  return work.isBound ? [...out, handoffCell(meter, work.pending)] : out
}

/** Color of the context fill: amber from 70 %, red from 85 % (auto-compaction is near). */
export const contextTone = (percent: number | null): Tone | undefined =>
  percent === null ? undefined : percent >= 85 ? 'error' : percent >= 70 ? 'warning' : undefined

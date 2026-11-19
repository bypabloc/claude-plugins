/** Status lines of the bound work's PROGRESS.md. */
export type WorkStatus = {
  work: string
  status?: string
  reason?: string
  phase?: string
  done?: string
  current?: string
  remaining?: string
  eta?: string
  next_step?: string
}

/** `.claude/session-handoff.json` of a project: every field optional. */
export type HandoffConfig = {
  /** Category → description of the only `blocked` reasons that may stop the turn or ask the user. */
  blockReasons?: Record<string, string>
  /** Extra lines injected with every handoff message (a shared resource, a project command). */
  context?: string[]
  /** Folder of the specs: a work or branch named `<NN>-…` binds to `<specsDir>/<NN>-…/`. Default `docs/specs`. */
  specsDir?: string
  /** Where the agent records the choices it makes alone; default the handoff's DECISIONS.md. */
  decisionsDir?: string
  /** Where the agent records deferred work; default the handoff's NOTES.md. */
  pendingDir?: string
  /** Replaces the closing instruction shown once `Status: done`. */
  closing?: string
  /** Phase → text that replaces the plugin's instruction for that phase (`implementation`, `verification`, …). */
  phases?: Record<string, string>
}

/** Counts of the last test run read from a Bash command's output. */
export type TestRun = { passed: number; failed: number; at: number }

/** Token counts summed over the session's turns, subagents included. */
export type TokenTotals = { input: number; output: number; cacheRead: number; cacheWrite: number }

/** A rate-limit window as the last response reported it. */
export type LimitWindow = { kind: string; percentUsed: number; resetsAt?: string }

/** What the metrics rows draw: the session's cost, tokens, time, tests and handoff health. */
export type Meter = {
  session: string
  /** When the session began (`$.session.usage().startedAt`). */
  startedAt: number
  /** Main-loop turns that ended. */
  turns: number
  /** Wall-clock time of the main-loop turns, summed. */
  agentMs: number
  lastTurnMs: number | null
  tokens: TokenTotals
  /** The session's cost as `/cost` totals it: an estimate, not the bill. */
  costUsd: number | null
  hasUnknownPrice?: boolean
  /** The cost when the running main-loop turn began, to price it at its end. */
  costAtTurnStart: number | null
  lastTurnUsd: number | null
  limits: LimitWindow[]
  tests: TestRun | null
  /** Files written or edited (outside tmp/handoff) since the last test run. */
  editsSinceTests: number
  compactions: number
  /** Turns the Stop hook held back, and the times its cap of 3 let one go. */
  stopBlocks: number
  stopCaps: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-handoff': {
      status: WorkStatus | null
      isHidden: boolean
      /** The metrics rows collapsed to the status line alone. */
      isCompact: boolean
      meter: Meter | null
      contextPercent: number | null
      /** The PROGRESS.md the last Stop saw, its blocks and its external-wait releases on that same text. */
      lastStop: { text: string; blocks: number; waits?: number; at?: number } | null
      /** Hashes of the commits made in this session that PROGRESS.md does not name yet. */
      pendingCommits: string[]
    }
  }
}

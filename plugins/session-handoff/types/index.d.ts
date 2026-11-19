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

declare module 'claude-code' {
  interface PluginState {
    'session-handoff': {
      status: WorkStatus | null
      isHidden: boolean
      contextPercent: number | null
      lastStop: { text: string; blocks: number } | null
      /** Hashes of the commits made in this session that PROGRESS.md does not name yet. */
      pendingCommits: string[]
    }
  }
}

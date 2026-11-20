import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROOT = 'D:/r'
const SESSION = 's1'
const PENDING = 'Status: in-progress\nPhase: implementation\nNext step: commit group 2\n'

/** Answers the engine's disk, git and session from memory, beneath the plugin. */
function world(on: On, files: Record<string, string>, git: Record<string, string> = {}): void {
  // The engine hands the paths over as the OS writes them: backslashes on Windows, and on Linux or macOS
  // `D:/r` is relative, so it arrives resolved against the cwd (`/cwd/D:/r/...`).
  const at = (path: string): string => {
    const slashed = path.replace(/\\/g, '/')
    return slashed.slice(Math.max(0, slashed.indexOf(ROOT)))
  }
  on('fs.read', (_, e) => {
    const text = files[at(e.path)]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_, e) => {
    files[at(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.list', (_, e) => {
    const dir = at(e.path)
    const names = new Set<string>()
    for (const p of Object.keys(files)) if (p.startsWith(`${dir}/`)) names.add(p.slice(dir.length + 1).split('/')[0]!)
    const kind = (name: string) => (files[`${dir}/${name}`] === undefined ? 'dir' : 'file') as 'dir' | 'file'
    return { value: [...names].map(name => ({ name, kind: kind(name), size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('process.run', (_, e) => {
    const out: Record<string, string> = {
      'rev-parse --show-toplevel': ROOT,
      'rev-parse --path-format=absolute --git-common-dir': `${ROOT}/.git`,
      'branch --show-current': 'feature/012-x',
      'log -1 --format=%h': 'b0c1d2e',
    }
    const key = e.argv.slice(1).join(' ')
    const stdout = git[key] ?? out[key]
    const code = stdout === undefined ? 1 : 0
    return { value: { exitCode: code, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: SESSION }))
  on('session.cwd', () => ({ value: ROOT }))
  // What the engine answers beneath every plugin: nothing to add, and a tool that ran.
  on('classic.SessionStart', () => ({}))
  on('classic.Stop', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostToolUse', () => ({}))
  on('tool.call', () => ({ result: { answers: {} } }) as never)
}

const bound = (extra: Record<string, string> = {}): Record<string, string> => ({
  [`${ROOT}/tmp/handoff/012-x/PROGRESS.md`]: PENDING,
  [`${ROOT}/tmp/handoff/.sessions/${SESSION}`]: '012-x',
  ...extra,
})

test('SessionStart injects the bound handoff with the project context', async ($, on) => {
  world(on, bound({ [`${ROOT}/.claude/session-handoff.json`]: '{"context": ["Un modelo a la vez en la GPU."]}' }))
  const result = await $.classic.SessionStart({ source: 'compact', cwd: ROOT, session_id: SESSION })
  const text = (result.additionalContext ?? []).join('\n')
  expect(text).toContain('[session-handoff] Trabajo 012-x')
  expect(text).toContain('Un modelo a la vez en la GPU.')
  expect(text).toContain('--- PROGRESS.md ---')
})

test('SessionStart without bound work gives the session id to bind one', async ($, on) => {
  world(on, {})
  const result = await $.classic.SessionStart({ source: 'startup', cwd: ROOT, session_id: SESSION })
  expect((result.additionalContext ?? []).join('\n')).toContain(`${ROOT}/tmp/handoff/.sessions/${SESSION}`)
})

test('Stop blocks while the next step is pending and lets go once done', async ($, on) => {
  const files = bound()
  world(on, files)
  expect((await $.classic.Stop({ stop_hook_active: false, cwd: ROOT, session_id: SESSION })).block).toContain('commit group 2')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = 'Status: done\nNext step: none'
  expect((await $.classic.Stop({ stop_hook_active: true, cwd: ROOT, session_id: SESSION })).block).toBeUndefined()
  expect(files[`${ROOT}/tmp/handoff/.log/events.jsonl`]).toContain('"stop.release"')
})

test('touching PROGRESS.md between quick stops does not reset the cap', async ($, on) => {
  const path = `${ROOT}/tmp/handoff/012-x/PROGRESS.md`
  const files = bound()
  world(on, files)
  const stop = () => $.classic.Stop({ stop_hook_active: true, cwd: ROOT, session_id: SESSION })
  for (let i = 1; i <= 3; i++) {
    expect((await stop()).block).toContain('012-x')
    files[path] = `${PENDING}Current: still waiting ${i}\n`
  }
  expect((await stop()).block).toBeUndefined()
  expect(files[`${ROOT}/tmp/handoff/.log/events.jsonl`]).toContain('"reason":"cap"')
})

test('a stale external-wait is released twice, then the third Stop asks to recheck the wait', async ($, on) => {
  const files = bound({ [`${ROOT}/tmp/handoff/012-x/PROGRESS.md`]: 'Status: in-progress\nPhase: external-wait\nNext step: CI\n' })
  world(on, files)
  const stop = () => $.classic.Stop({ stop_hook_active: false, cwd: ROOT, session_id: SESSION })
  expect((await stop()).block).toBeUndefined()
  expect((await stop()).block).toBeUndefined()
  expect((await stop()).block).toContain('comprueba ahora')
  expect(files[`${ROOT}/tmp/handoff/.log/events.jsonl`]).toContain('"stop.recheck"')
  expect((await stop()).block).toBeUndefined()
})

test('with a spec running, AskUserQuestion is denied unless a user block reason is set', async ($, on) => {
  const files = bound({ [`${ROOT}/docs/specs/012-x/README.md`]: '#' })
  world(on, files)
  const options = [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }]
  const ask = { tool: 'AskUserQuestion' as const, questions: [{ question: '¿Cuál?', header: 'x', multiSelect: false, options }] }
  const denied = await $.tool.call(ask)
  expect(denied.deny).toContain('Con una spec en ejecución')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = 'Status: blocked — cost: cloud GPU\nNext step: wait'
  expect((await $.tool.call(ask)).deny).toBeUndefined()
})

test('a PROGRESS.md written with a phase that is not one is named right away', async ($, on) => {
  const path = `${ROOT}/tmp/handoff/012-x/PROGRESS.md`
  const files = bound({ [path]: 'Status: in-progress\nPhase: api-record tras merge de dev\nNext step: y' })
  world(on, files)
  const write = () => $.classic.PostToolUse({ tool_name: 'Edit', tool_input: { file_path: path }, tool_response: {},
    tool_use_id: 't1', session_id: SESSION }) // fmt: skip
  expect((await write()).block).toContain('no es una fase')
  files[path] = 'Status: in-progress\nPhase: external-wait (api-record)\nNext step: y'
  expect((await write()).block).toBeUndefined()
})

test('a PROGRESS.md written with a long status line is named right away', async ($, on) => {
  const path = `${ROOT}/tmp/handoff/012-x/PROGRESS.md`
  world(on, bound({ [path]: `Status: in-progress\nCurrent: ${'x'.repeat(130)}\nNext step: y` }))
  const result = await $.classic.PostToolUse({ tool_name: 'Write', tool_input: { file_path: path }, tool_response: {},
    tool_use_id: 't1', session_id: SESSION }) // fmt: skip
  expect(result.block).toContain('Current')
})

test('a git commit in Bash asks for its hash in PROGRESS.md until it is there', async ($, on) => {
  const files = bound()
  world(on, files)
  const commit = (stdout: string) =>
    $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, tool_response: { stdout },
      tool_use_id: 't2', session_id: SESSION }) // fmt: skip
  expect((await commit('[feature/012-x 70ff3be] feat: y')).block).toContain('70ff3be')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = `${PENDING}Done: grupo 1 (70ff3be)\n`
  expect((await commit('[feature/012-x 70ff3be] feat: y')).block).toBeUndefined()
})

test('a hash left out survives an interruption: the next prompt and the Stop ask for it', async ($, on) => {
  const files = bound()
  world(on, files)
  const quiet = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'cd /d/r && git commit -q -m x' },
    tool_response: { stdout: '' }, tool_use_id: 't3', session_id: SESSION }) // fmt: skip
  expect(quiet.block).toContain('b0c1d2e')
  const prompt = await $.classic.UserPromptSubmit({ prompt: 'reporte', session_id: SESSION, cwd: ROOT })
  expect((prompt.additionalContext ?? []).join('\n')).toContain('b0c1d2e')
  expect((await $.classic.Stop({ stop_hook_active: false, cwd: ROOT, session_id: SESSION })).block).toContain('b0c1d2e')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = `${PENDING}Done: grupo 1 (b0c1d2e)\n`
  const after = await $.classic.UserPromptSubmit({ prompt: 'sigue', session_id: SESSION, cwd: ROOT })
  expect((after.additionalContext ?? []).join('\n')).not.toContain('b0c1d2e')
})

test('a hash left out survives /reload-plugins: the store keeps it once the state is gone', async ($, on) => {
  const files = bound()
  world(on, files)
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('store.keys', () => ({ value: [...kept.keys()] }))
  on('store.delete', (_, e) => (kept.delete(e.key), { value: undefined }))
  // What a reload does: the plugin's state starts empty again.
  let reloaded = false
  on('state.get', (_, e, next) => {
    if (reloaded && e.key === 'pendingCommits') return (reloaded = false), { value: [] as string[] } as never
    return next(e)
  })
  const commit = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'git commit -m e2e' },
    tool_response: { stdout: '[feature/012-x 72cfd25] test: e2e' }, tool_use_id: 't6', session_id: SESSION }) // fmt: skip
  expect(commit.block).toContain('72cfd25')
  reloaded = true
  const prompt = await $.classic.UserPromptSubmit({ prompt: 'continue', session_id: SESSION, cwd: ROOT })
  expect((prompt.additionalContext ?? []).join('\n')).toContain('72cfd25')
  expect((await $.classic.Stop({ stop_hook_active: false, cwd: ROOT, session_id: SESSION })).block).toContain('72cfd25')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = `${PENDING}Done: e2e (72cfd25)\n`
  await $.classic.UserPromptSubmit({ prompt: 'sigue', session_id: SESSION, cwd: ROOT })
  expect([...kept.keys()].filter(k => k.startsWith('pending/'))).toEqual([])
})

test('a git commit in a background Bash asks for its own hash once it lands, not the old HEAD', async ($, on) => {
  const files = bound()
  const git: Record<string, string> = { 'rev-parse HEAD': 'a0a0a0a0' }
  world(on, files, git)
  const launch = await $.classic.PostToolUse({ tool_name: 'Bash',
    tool_input: { command: 'git commit -m docs', run_in_background: true }, tool_response: {}, tool_use_id: 't5',
    session_id: SESSION }) // fmt: skip
  expect(launch.block).toBeUndefined()
  const stop = () => $.classic.Stop({ stop_hook_active: false, cwd: ROOT, session_id: SESSION })
  expect((await stop()).block ?? '').not.toContain('b0c1d2e')
  // The merge of dev and its commits stay out: only the branch's own commits since the launch count.
  git['log --first-parent --no-merges --format=%h a0a0a0a0..HEAD'] = '9dcf124'
  expect((await stop()).block).toContain('9dcf124')
  files[`${ROOT}/tmp/handoff/012-x/PROGRESS.md`] = `${PENDING}Done: docs (9dcf124)\n`
  const after = await $.classic.UserPromptSubmit({ prompt: 'sigue', session_id: SESSION, cwd: ROOT })
  expect((after.additionalContext ?? []).join('\n')).not.toContain('9dcf124')
})

const BAND = {
  plugin: 'session-handoff',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const // fmt: skip

test('a test run and a finished turn draw the metrics row above the status line', async ($, on) => {
  const files = bound()
  world(on, files)
  let usd = 1.25
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [], cost: { usd } } }) as never)
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('store.keys', () => ({ value: [...kept.keys()] }))
  on('store.delete', (_, e) => (kept.delete(e.key), { value: undefined }))
  on('clock.now', () => ({ value: 5_000 }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.turn.start({ text: 'sigue', turnId: 't1' })
  await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'bun test' },
    tool_response: { stdout: '', stderr: ' 54 pass\n 0 fail\n' }, tool_use_id: 't4', session_id: SESSION }) // fmt: skip
  usd = 2
  const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 8000, cache_creation_input_tokens: 500,
    model: 'claude-opus-5-5' } // fmt: skip
  await $.turn.complete({ answer: 'ok', durationMs: 90_000, isAborted: false, turnId: 't1', reason: 'answer', usage })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /passed/ }))?.text).toBe('54 passed')
    expect((await ui.find({ type: 'Text', text: /^last / }))?.text).toBe('last $0.75 · ⌀ $2.00')
    expect((await ui.find({ type: 'Text', text: /turn/ }))?.text).toBe('1 turn · ↓ 500')
    await ui.press({ key: 'compact' })
    expect(await ui.find({ type: 'Text', text: /passed/ })).toBeUndefined()
    await ui.press({ key: 'compact' })
    await ui.unmount()
  }
})

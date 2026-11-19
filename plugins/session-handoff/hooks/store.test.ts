import { expect, test } from 'claude-code/testing'
import { parseConfig } from './handoff'
import { activeWorks, boundOf, configOf, currentWork, type Io, logEvent, placeOf, specOf, statusOf } from './store'

/** An in-memory disk: paths to texts; a folder exists while some file is under it. */
function disk(files: Record<string, string>, git: Record<string, string> = {}): Io & { files: typeof files } {
  return {
    files,
    read: async p => files[p] ?? null,
    write: async (p, t) => {
      files[p] = t
    },
    list: async dir => {
      const names = new Set<string>()
      for (const p of Object.keys(files)) if (p.startsWith(`${dir}/`)) names.add(p.slice(dir.length + 1).split('/')[0]!)
      return [...names].map(name => ({ name, kind: files[`${dir}/${name}`] === undefined ? 'dir' : 'file' }))
    },
    git: async (_cwd, args) => git[args.join(' ')] ?? '',
  }
}

const GIT = {
  'rev-parse --show-toplevel': 'D:/w/repo-worktrees/012-x',
  'rev-parse --path-format=absolute --git-common-dir': 'D:/w/repo/.git',
  'branch --show-current': 'feature/012-x',
}

test('from a worktree, tmp/handoff/ lives in the main checkout', async () => {
  const place = await placeOf(disk({}, GIT), 'D:\\w\\repo-worktrees\\012-x')
  expect(place).toEqual({ root: 'D:/w/repo-worktrees/012-x', store: 'D:/w/repo', branch: 'feature/012-x' })
})

test('outside git the cwd is the root and the store', async () => {
  expect(await placeOf(disk({}), '/tmp/x')).toEqual({ root: '/tmp/x', store: '/tmp/x', branch: '' })
})

test('a session binds by its link, or else by the number of its branch', async () => {
  const io = disk({
    'D:/w/repo/tmp/handoff/012-x/PROGRESS.md': 'Status: in-progress\nNext step: go',
    'D:/w/repo/tmp/handoff/other/PROGRESS.md': 'Next step: later',
    'D:/w/repo/tmp/handoff/.sessions/s1': 'other\n',
    'D:/w/repo/tmp/handoff/.sessions/s2': '../escape',
  })
  const place = await placeOf(io, 'x').then(() => ({ root: 'D:/w/repo', store: 'D:/w/repo', branch: 'dev' }))
  expect(await currentWork(io, place, 's1')).toBe('other')
  expect(await currentWork(io, place, 's2')).toBeNull()
  expect(await currentWork(io, { ...place, branch: 'feature/012-x' }, 'nobody')).toBe('012-x')
  expect(await currentWork(io, place, '../s1')).toBeNull()
  expect(await activeWorks(io, place)).toEqual([['012-x', 'go'], ['other', 'later']])
  expect(await statusOf(io, place, 's1')).toEqual({ work: 'other', next_step: 'later' })
})

test('the spec folder is found by number, also inside a batch', async () => {
  const io = disk({
    'D:/r/docs/specs/012-x/README.md': '#',
    'D:/r/docs/specs/020-022-batch/021-y/README.md': '#',
  })
  const place = { root: 'D:/r', store: 'D:/r', branch: '' }
  const c = parseConfig(null)
  expect(await specOf(io, place, '012-x', c)).toBe('docs/specs/012-x')
  expect(await specOf(io, place, '021-y', c)).toBe('docs/specs/020-022-batch/021-y')
  expect(await specOf(io, place, 'no-number', c)).toBeNull()
})

test('the config and the bound files are read from the checkout', async () => {
  const io = disk({
    'D:/r/.claude/session-handoff.json': '{"context": ["extra"]}',
    'D:/r/tmp/handoff/w/PROGRESS.md': 'p',
    'D:/r/tmp/handoff/w/NOTES.md': 'n',
  })
  const place = { root: 'D:/r', store: 'D:/r', branch: 'b' }
  expect((await configOf(io, 'D:/r')).context).toEqual(['extra'])
  const bound = await boundOf(io, place, 'w', 'startup', parseConfig(null))
  expect(bound.files).toEqual({ 'PROGRESS.md': 'p', 'NOTES.md': 'n' })
  expect(bound.folder).toBe('D:/r/tmp/handoff/w')
})

test('the log appends one JSON line per event and never throws', async () => {
  const io = disk({})
  await logEvent(io, 'D:/r', { event: 'a' })
  await logEvent(io, 'D:/r', { event: 'b' })
  const lines = io.files['D:/r/tmp/handoff/.log/events.jsonl']!.trim().split('\n').map(l => JSON.parse(l))
  expect(lines.map(l => l.event)).toEqual(['a', 'b'])
  await logEvent({ ...io, write: async () => Promise.reject(new Error('disk')) }, 'D:/r', { event: 'c' })
})

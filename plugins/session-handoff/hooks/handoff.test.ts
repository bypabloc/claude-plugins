import { expect, test } from 'claude-code/testing'
import { BATCH_TEXT, blockedForUser, boundMessage, commitDir, commitHash, DEFAULT_BLOCK_REASONS, isCommit,
  missingHashes, pendingText, HEADER, MAX_BLOCKS, missing, parseConfig,
  progressFields, stopDecision, tooLong, unboundMessage, WRITE_TEXT } from './handoff' // fmt: skip

const PENDING = 'Status: in-progress\nPhase: implementation\nNext step: commit group 2\n'
const defaults = parseConfig(null)

test('reads the status lines, bulleted or bold, and splits the status reason', () => {
  expect(progressFields('- **Status:** blocked — cost: cloud GPU\nPhase: nope\nNext step: x')).toEqual({
    status: 'blocked',
    reason: 'cost: cloud GPU',
    next_step: 'x',
  })
  expect(progressFields(PENDING).phase).toBe('implementation')
  expect(missing(progressFields(PENDING))).toEqual(['Done', 'Current', 'Remaining', 'ETA'])
})

test('the config falls back field by field to the defaults', () => {
  expect(defaults.blockReasons).toEqual(DEFAULT_BLOCK_REASONS)
  expect(defaults.specsDir).toBe('docs/specs')
  expect(parseConfig('not json').context).toEqual([])
  const c = parseConfig('{"blockReasons": {"taste": "solo el oído del usuario"}, "context": ["GPU: one model"], "specsDir": "plans/"}')
  expect(Object.keys(c.blockReasons)).toEqual(['taste'])
  expect(c.context).toEqual(['GPU: one model'])
  expect(c.specsDir).toBe('plans')
  expect(parseConfig('{"blockReasons": {"x": 3}}').blockReasons).toEqual(DEFAULT_BLOCK_REASONS)
})

test('only a block reason of the project lets the work stop', () => {
  const taste = parseConfig('{"blockReasons": {"taste": "elegir entre audios"}}')
  expect(blockedForUser({ status: 'blocked', reason: 'taste: pick a take' }, taste)).toBe(true)
  expect(blockedForUser({ status: 'blocked', reason: 'cost: money' }, taste)).toBe(false)
  expect(blockedForUser({ status: 'blocked', reason: 'cost: money' }, defaults)).toBe(true)
  expect(blockedForUser({ status: 'in-progress' }, defaults)).toBe(false)
})

test('a status line over 120 characters is named', () => {
  expect(tooLong({ status: 'in-progress', current: 'x'.repeat(130) })).toEqual(['Current'])
  expect(tooLong(progressFields(PENDING))).toEqual([])
})

test('Stop blocks up to the cap while the next step is pending, then lets the turn end', () => {
  let previous: { text: string; blocks: number } | null = null
  for (let i = 1; i <= MAX_BLOCKS; i++) {
    const d = stopDecision(PENDING, previous, 'w', defaults)
    expect('block' in d && d.blocks).toBe(i)
    previous = { text: PENDING, blocks: i }
  }
  expect(stopDecision(PENDING, previous, 'w', defaults)).toEqual({ release: 'cap' })
  expect(stopDecision(`${PENDING}Done: more`, previous, 'w', defaults)).toHaveProperty('blocks', 1)
})

test('Stop lets the turn end on done, a user block, external-wait or no next step', () => {
  expect(stopDecision('Status: done\nNext step: x', null, 'w', defaults)).toEqual({ release: 'done' })
  expect(stopDecision('Status: blocked — credentials: token\nNext step: x', null, 'w', defaults)).toEqual({
    release: 'blocked',
  })
  expect(stopDecision('Status: in-progress\nPhase: external-wait\nNext step: CI', null, 'w', defaults)).toEqual({
    release: 'external-wait',
  })
  expect(stopDecision('Status: in-progress', null, 'w', defaults)).toEqual({ release: 'no-step' })
  const decide = stopDecision('Status: blocked — no sé qué módulo usar\nNext step: x', null, 'w', defaults)
  expect('block' in decide && decide.block).toContain('la elección es tuya')
})

test('the bound message carries the files, the project context and the spec', () => {
  const c = parseConfig('{"context": ["Turno de la GPU: un modelo a la vez."]}')
  const text = boundMessage(
    { work: '012-x', folder: '/r/tmp/handoff/012-x', branch: 'feature/012-x', source: 'compact',
      spec: 'docs/specs/012-x', files: { 'PROGRESS.md': PENDING } }, // fmt: skip
    c,
  )
  expect(text.startsWith(`${HEADER}012-x`)).toBe(true)
  expect(text).toContain('Turno de la GPU')
  expect(text).toContain('Spec: docs/specs/012-x/.')
  expect(text).toContain('--- PROGRESS.md ---')
  expect(text).toContain('DECISIONS.md: falta')
  expect(text).toContain('Fase implementation')
})

test('a done work only gets the closing, the project one if it sets it', () => {
  const b = { work: 'w', folder: '/r/tmp/handoff/w', branch: 'b', source: 'startup', spec: null,
    files: { 'PROGRESS.md': 'Status: done' } } // fmt: skip
  expect(boundMessage(b, defaults)).toContain('solo queda el cierre')
  expect(boundMessage(b, parseConfig('{"closing": "Corre worktree close."}'))).toContain('Corre worktree close.')
  expect(boundMessage(b, defaults)).not.toContain('--- PROGRESS.md ---')
})

test('the unbound message gives the session id and lists the active works', () => {
  const text = unboundMessage('s1', '/r/tmp/handoff', 'compact', [['other', 'step 3']], defaults)
  expect(text).toContain('/r/tmp/handoff/.sessions/s1')
  expect(text).toContain('- other: step 3')
  expect(text).toContain('resumida')
})

test('a commit is detected in a compound command and its hash read from the output', () => {
  expect(isCommit('cd ../wt && git add -A && git commit -q -F - <<EOF')).toBe(true)
  expect(isCommit('git -C ../wt commit -m "x"')).toBe(true)
  expect([isCommit('git log -1'), isCommit('echo "git commit"'), isCommit('git commit --help')]).toEqual([false, false, false])
  expect(commitHash('[chore/003-x 70ff3be] chore: y\n 2 files changed')).toBe('70ff3be')
  expect(commitHash('')).toBeNull()
})

test('the reminder lists every hash PROGRESS.md lacks and stays quiet once all are there', () => {
  expect(missingHashes(['abc1234', '70ff3be', '70ff3be', ''], 'Done: 001 (abc1234)')).toEqual(['70ff3be'])
  expect(pendingText('lote', ['70ff3be', 'a233899'])).toContain('70ff3be, a233899')
  expect(pendingText('lote', [])).toBeNull()
})

test('the commit runs where its git -C or cd points, Git Bash paths included', () => {
  expect(commitDir('cd /d/Users/x/wt && git add -A && git commit -q -m y', 'D:/r')).toBe('D:/Users/x/wt')
  expect(commitDir('git -C "../wt" commit -m y', 'D:/r')).toBe('D:/r/../wt')
  expect(commitDir('git commit -m y', 'D:/r')).toBe('D:/r')
})

test('a batch ends only after its last spec, and done always deletes the handoff', () => {
  const b = { work: 'lote', folder: 'R/tmp/handoff/lote', branch: 'x', source: 'startup', spec: null, files: {} }
  expect(boundMessage({ ...b, files: { 'PROGRESS.md': PENDING } }, defaults)).toContain(BATCH_TEXT)
  const done = boundMessage({ ...b, files: { 'PROGRESS.md': 'Status: done' } }, parseConfig('{"closing": "Cierra."}'))
  expect(done).toContain('Cierra. Después borra R/tmp/handoff/lote/')
})

test('a project phase text replaces the default one, and the writing rules ride along', () => {
  const c = parseConfig('{"phases": {"verification": "Corre 03-verificacion-final.md", "nope": "x", "closing": 3}}')
  expect(c.phases).toEqual({ verification: 'Corre 03-verificacion-final.md' })
  expect(defaults.phases).toEqual({})
  const b = { work: 'w', folder: 'tmp/handoff/w', branch: 'b', source: 'startup', spec: null, files: {} }
  const text = boundMessage({ ...b, files: { 'PROGRESS.md': 'Status: in-progress\nPhase: verification\nNext step: x' } }, c)
  expect(text).toContain('Corre 03-verificacion-final.md')
  expect(text).toContain(WRITE_TEXT)
  expect(unboundMessage('s', 'tmp/handoff', 'startup', [], defaults)).toContain(WRITE_TEXT)
})

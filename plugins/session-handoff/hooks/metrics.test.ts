import { expect, test } from 'claude-code/testing'
import { addTurn, cacheReuse, cells, contextTone, duration, emptyMeter, testCounts, tokens, usd } from './metrics'

test('numbers read as the status lines write them', () => {
  expect(usd(22.857)).toBe('$22.86')
  expect(usd(null)).toBe('—')
  expect(tokens(950)).toBe('950')
  expect(tokens(3200)).toBe('3.2k')
  expect(tokens(67_600_000)).toBe('67.6M')
  expect(tokens(2_000_000)).toBe('2M')
  expect(duration(42_000)).toBe('42s')
  expect(duration(210_000)).toBe('3m 30s')
  expect(duration(3_960_000)).toBe('1h 6m')
})

test('test summaries of bun, vitest, jest, pytest, playwright and cargo are counted', () => {
  expect(testCounts('claude plugin test .', ' 54 pass\n 0 fail\nRan 54 tests across 5 files.')).toEqual({ passed: 54, failed: 0 })
  expect(testCounts('bunx vitest run', ' Test Files  1 failed | 3 passed (4)\n      Tests  2 failed | 15 passed (17)')).toEqual({
    passed: 15,
    failed: 2,
  })
  expect(testCounts('npx jest', 'Test Suites: 1 failed, 2 passed, 3 total\nTests:       1 failed, 16 passed, 17 total')).toEqual({
    passed: 16,
    failed: 1,
  })
  expect(testCounts('uv run pytest -q', '==== 2 failed, 17 passed in 1.20s ====')).toEqual({ passed: 17, failed: 2 })
  expect(testCounts('bunx playwright test', '  \u001b[32m17 passed\u001b[39m (3.2s)')).toEqual({ passed: 17, failed: 0 })
  expect(testCounts('cargo test', 'test result: ok. 9 passed; 0 failed;\ntest result: ok. 2 passed; 0 failed;')).toEqual({
    passed: 11,
    failed: 0,
  })
})

test('a command that runs no tests, or names no count, is not a test run', () => {
  expect(testCounts('ls -la', '3 passed')).toBeNull()
  expect(testCounts('git commit -m "add tests"', '1 file changed, 3 passed')).toBeNull()
  expect(testCounts('bun test --watch &', '')).toBeNull()
})

test('turns add tokens; only the main loop counts the turn and its time', () => {
  const usage = { input_tokens: 10, output_tokens: 90, cache_read_input_tokens: 900, cache_creation_input_tokens: 90 }
  const main = addTurn(emptyMeter('s', 0), usage, 60_000, true)
  const sub = addTurn(main, usage, 30_000, false)
  expect(main.turns).toBe(1)
  expect(sub.turns).toBe(1)
  expect(sub.agentMs).toBe(60_000)
  expect(sub.tokens.output).toBe(180)
  expect(cacheReuse(sub.tokens)).toBe(90)
  expect(cacheReuse(emptyMeter('s', 0).tokens)).toBeNull()
})

test('the row shows cost, tokens, time, reuse, tests and limits; the handoff only with bound work', () => {
  const meter = {
    ...emptyMeter('s', 0),
    turns: 19,
    agentMs: 19 * 210_000,
    costUsd: 22.86,
    lastTurnUsd: 0.5,
    tokens: { input: 100_000, output: 1_500_000, cacheRead: 60_000_000, cacheWrite: 6_000_000 },
    tests: { passed: 456, failed: 0, at: 1 },
    limits: [
      { kind: 'seven_day', percentUsed: 18 },
      { kind: 'five_hour', percentUsed: 82, resetsAt: new Date(3_600_000 * 3).toISOString() },
    ],
  }
  const row = cells(meter, 3_600_000, { isBound: false, pending: 0 })
  const by = Object.fromEntries(row.map(c => [c.key, c]))
  expect(row.map(c => c.key)).toEqual(['cost', 'tokens', 'time', 'reuse', 'tests', 'limits'])
  expect(by.cost).toMatchObject({ value: '$22.86', sub: 'last $0.50 · ⌀ $1.20' })
  expect(by.tokens).toMatchObject({ value: '67.6M', sub: '19 turns · ↓ 1.5M' })
  expect(by.time).toMatchObject({ value: '1h 6m', sub: '⌀ 3m 30s / turn' })
  expect(by.reuse?.value).toBe('91%')
  expect(by.tests).toMatchObject({ value: '456 passed', sub: 'after last change', tone: 'success' })
  expect(by.limits).toMatchObject({ value: '5h 82%', sub: '7d 18% · resets 2h 0m', tone: 'warning' })
  const bound = cells({ ...meter, compactions: 2, stopBlocks: 6, stopCaps: 1 }, 0, { isBound: true, pending: 1 })
  expect(bound.at(-1)).toMatchObject({ key: 'handoff', value: '1 hash due', sub: '2 compact · 6 held · 1 cap' })
})

test('edits after the last run and failures are flagged; no limits shows the burn rate', () => {
  const meter = { ...emptyMeter('s', 0), costUsd: 6, tests: { passed: 15, failed: 2, at: 1 }, editsSinceTests: 3 }
  const by = Object.fromEntries(cells(meter, 7_200_000, { isBound: false, pending: 0 }).map(c => [c.key, c]))
  expect(by.tests).toMatchObject({ value: '2 failed', sub: '3 edits since', tone: 'error', subTone: 'warning' })
  expect(by.rate).toMatchObject({ value: '$3.00/h', sub: 'session 2h 0m' })
})

test('the context fill turns amber at 70 % and red at 85 %', () => {
  expect(contextTone(null)).toBeUndefined()
  expect(contextTone(47)).toBeUndefined()
  expect(contextTone(72)).toBe('warning')
  expect(contextTone(90)).toBe('error')
})

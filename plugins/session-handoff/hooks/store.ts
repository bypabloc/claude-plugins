/**
 * The handoff on disk: which work a session is bound to, its files, its spec and the main checkout that holds
 * tmp/handoff/ (shared by every worktree). Everything outside goes through `Io`, so tests use an in-memory disk.
 */

import type { WorkStatus } from '../types'
import { type Bound, type Config, FILES, parseConfig, progressFields, VERSION } from './handoff'

/** What the store needs from the engine: `$.fs` and `$.process` in a session, a map in a test. */
export type Io = {
  read: (path: string) => Promise<string | null>
  write: (path: string, text: string) => Promise<void>
  list: (path: string) => Promise<Array<{ name: string; kind: string; mtimeMs?: number }>>
  git: (cwd: string, args: string[]) => Promise<string>
}

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SPEC_NUMBER = /(?:^|\/)(\d{2,3}(?:\.\d+)?)-/

/** Where one checkout stands: its root, the main checkout (store of tmp/handoff/) and its branch. */
export type Place = { root: string; store: string; branch: string }

const clean = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '')

/** The session's checkout, the main one (parent of the common `.git`, also from a worktree) and the branch. */
export async function placeOf(io: Io, cwd: string): Promise<Place> {
  const root = clean((await io.git(cwd, ['rev-parse', '--show-toplevel'])) || cwd)
  const common = clean(await io.git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']))
  const store = common.endsWith('/.git') ? common.slice(0, -'/.git'.length) : root
  return { root, store, branch: await io.git(root, ['branch', '--show-current']) }
}

export const handoffDir = (store: string): string => `${store}/tmp/handoff`

/** The project config, `.claude/session-handoff.json` of the session's checkout. */
export async function configOf(io: Io, root: string): Promise<Config> {
  return parseConfig(await io.read(`${root}/.claude/session-handoff.json`))
}

const dirs = async (io: Io, path: string): Promise<string[]> =>
  (await io.list(path).catch(() => [])).filter(e => e.kind === 'dir').map(e => e.name).sort()

/** The session's work: its link in .sessions/, or else the folder whose number matches the branch's. */
export async function currentWork(io: Io, place: Place, session: string): Promise<string | null> {
  const base = handoffDir(place.store)
  const works = await dirs(io, base)
  if (SAFE.test(session)) {
    const linked = (await io.read(`${base}/.sessions/${session}`))?.trim()
    if (linked && SAFE.test(linked) && works.includes(linked)) return linked
  }
  const number = SPEC_NUMBER.exec(place.branch)?.[1]
  return (number && works.find(w => w.startsWith(`${number}-`))) || null
}

/**
 * The session that bound itself to the same work after this one, or null. The newest link owns the work: the
 * older session is not pushed to go on, or two agents edit the same tree.
 */
export async function takenOverBy(io: Io, place: Place, session: string, work: string): Promise<string | null> {
  const dir = `${handoffDir(place.store)}/.sessions`
  const links = await io.list(dir).catch(() => [])
  const mine = links.find(l => l.name === session)?.mtimeMs
  if (mine === undefined) return null
  for (const link of links) {
    if (link.name === session || link.kind !== 'file' || (link.mtimeMs ?? 0) <= mine) continue
    if ((await io.read(`${dir}/${link.name}`))?.trim() === work) return link.name
  }
  return null
}

/** The spec folder whose number matches the work's or the branch's, relative to the root. */
export async function specOf(io: Io, place: Place, work: string, config: Config): Promise<string | null> {
  const number = SPEC_NUMBER.exec(work)?.[1] ?? SPEC_NUMBER.exec(place.branch)?.[1]
  if (!number) return null
  const specs = `${place.root}/${config.specsDir}`
  for (const name of await dirs(io, specs)) {
    if (name.startsWith(`${number}-`)) return `${config.specsDir}/${name}`
    for (const inner of await dirs(io, `${specs}/${name}`))
      if (inner.startsWith(`${number}-`)) return `${config.specsDir}/${name}/${inner}`
  }
  return null
}

export const progressOf = async (io: Io, place: Place, work: string): Promise<string> =>
  (await io.read(`${handoffDir(place.store)}/${work}/PROGRESS.md`)) ?? ''

/** What the message builder needs about a bound work. */
export async function boundOf(io: Io, place: Place, work: string, source: string, config: Config): Promise<Bound> {
  const folder = `${handoffDir(place.store)}/${work}`
  const files: Bound['files'] = {}
  for (const name of FILES) {
    const text = await io.read(`${folder}/${name}`)
    if (text !== null) files[name] = text
  }
  return { work, folder, branch: place.branch, source, spec: await specOf(io, place, work, config), files }
}

/** Works with a folder in tmp/handoff/ and the next step of each. */
export async function activeWorks(io: Io, place: Place): Promise<Array<[string, string]>> {
  const out: Array<[string, string]> = []
  for (const name of await dirs(io, handoffDir(place.store))) {
    if (name.startsWith('.')) continue
    out.push([name, (progressFields(await progressOf(io, place, name)).next_step ?? '').slice(0, 160)])
  }
  return out
}

/** The band's state: the bound work's status lines, or null. */
export async function statusOf(io: Io, place: Place, session: string): Promise<WorkStatus | null> {
  const work = await currentWork(io, place, session)
  return work ? { work, ...progressFields(await progressOf(io, place, work)) } : null
}

/** Appends one event to tmp/handoff/.log/events.jsonl; never throws (the log is evidence, not a gate). */
export async function logEvent(io: Io, store: string, event: Record<string, unknown>): Promise<void> {
  // ponytail: rewrites the whole file; keeps the newest ~512 KB. A real append if the log ever matters more.
  try {
    const path = `${handoffDir(store)}/.log/events.jsonl`
    const before = (await io.read(path)) ?? ''
    const line = `${JSON.stringify({ ts: new Date().toISOString().slice(0, 19) + 'Z', v: VERSION, ...event })}\n`
    const kept = before.length > 512_000 ? before.slice(before.indexOf('\n', before.length - 256_000) + 1) : before
    await io.write(path, kept + line)
  } catch {
    // a disk error must not break a hook
  }
}

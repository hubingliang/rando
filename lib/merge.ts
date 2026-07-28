import {
  LEGACY_TS,
  sortOrdered,
  type AppSnapshot,
  type DailyPlan,
  type DailyPlanHistory,
  type DailyPlanItem,
  type Pool,
  type ShuffleConfig,
  type ShuffleSetting,
  type Task,
} from "@/lib/snapshot"

/**
 * Merging is content-addressed and order-independent: `merge(a, b)` and
 * `merge(b, a)` must produce the same snapshot, and `merge(x, x)` must return
 * `x`. That is what lets two devices converge without a server arbitrating.
 */

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) {
      if (src[key] === undefined) continue
      out[key] = canonicalize(src[key])
    }
    return out
  }
  return value
}

/** JSON with object keys sorted, so equal content always yields an equal string. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

/** Break a timestamp tie by content, so every device lands on the same record. */
function tieBreak<T>(a: T, b: T): T {
  return canonicalJson(a) <= canonicalJson(b) ? a : b
}

function pickNewer<T extends { updatedAt: string }>(a: T, b: T): T {
  if (a.updatedAt > b.updatedAt) return a
  if (b.updatedAt > a.updatedAt) return b
  return tieBreak(a, b)
}

function mergeTasks(a: Task[], b: Task[]): Task[] {
  const byId = new Map<string, Task>()
  for (const t of a) byId.set(t.id, t)
  for (const t of b) {
    const prev = byId.get(t.id)
    byId.set(t.id, prev ? pickNewer(prev, t) : t)
  }
  return sortOrdered([...byId.values()])
}

function mergePool(a: Pool, b: Pool): Pool {
  return { ...pickNewer(a, b), tasks: mergeTasks(a.tasks, b.tasks) }
}

function mergePools(a: Pool[], b: Pool[]): Pool[] {
  const byId = new Map<string, Pool>()
  for (const p of a) byId.set(p.id, p)
  for (const p of b) {
    const prev = byId.get(p.id)
    byId.set(p.id, prev ? mergePool(prev, p) : p)
  }
  return sortOrdered([...byId.values()])
}

function mergeShuffleConfig(a: ShuffleConfig, b: ShuffleConfig): ShuffleConfig {
  const out: ShuffleConfig = {}
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const key of keys) {
    const x = a[key]
    const y = b[key]
    if (x && y) {
      out[key] = pickNewer(
        { ...x, updatedAt: x.updatedAt ?? LEGACY_TS },
        { ...y, updatedAt: y.updatedAt ?? LEGACY_TS },
      ) satisfies ShuffleSetting
    } else {
      out[key] = (x ?? y)!
    }
  }
  return out
}

/**
 * Two devices can each draw for the same day while offline. The earliest draw
 * is the real one, so the later duplicate is discarded rather than kept
 * alongside it.
 */
function pickBasePlan(a: DailyPlan, b: DailyPlan): DailyPlan {
  if (a.items.length === 0 && b.items.length > 0) return b
  if (b.items.length === 0 && a.items.length > 0) return a
  const ca = a.createdAt ?? LEGACY_TS
  const cb = b.createdAt ?? LEGACY_TS
  if (ca !== cb) return ca < cb ? a : b
  if (a.items.length !== b.items.length) {
    return a.items.length > b.items.length ? a : b
  }
  return tieBreak(a, b)
}

function mergeDone(base: DailyPlanItem, other: DailyPlanItem): DailyPlanItem {
  const baseAt = base.doneAt ?? LEGACY_TS
  const otherAt = other.doneAt ?? LEGACY_TS
  if (otherAt > baseAt) {
    return { ...base, done: other.done, doneAt: otherAt }
  }
  if (baseAt > otherAt) return base
  if (base.done === other.done) return base
  // Same stamp, different state: a tick is deliberate, an untouched item is not.
  return { ...base, done: true }
}

export function mergePlans(a: DailyPlan, b: DailyPlan): DailyPlan {
  const base = pickBasePlan(a, b)
  const other = base === a ? b : a
  if (base === other) return base
  const otherByTask = new Map(other.items.map((i) => [i.taskId, i]))
  return {
    ...base,
    items: base.items.map((item) => {
      const match = otherByTask.get(item.taskId)
      return match ? mergeDone(item, match) : item
    }),
  }
}

function mergeHistory(
  a: DailyPlanHistory,
  b: DailyPlanHistory,
): DailyPlanHistory {
  const out: DailyPlanHistory = {}
  const dates = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const date of dates) {
    const x = a[date]
    const y = b[date]
    out[date] = x && y ? mergePlans(x, y) : (x ?? y)!
  }
  return out
}

export function mergeSnapshots(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  return {
    pools: mergePools(a.pools, b.pools),
    shuffleConfig: mergeShuffleConfig(a.shuffleConfig, b.shuffleConfig),
    dailyPlanHistory: mergeHistory(a.dailyPlanHistory, b.dailyPlanHistory),
  }
}

/**
 * Stable content identity. Equal fingerprints mean two snapshots carry the same
 * data, which is how the sync engine decides whether a push is needed at all.
 */
export function snapshotFingerprint(snapshot: AppSnapshot): string {
  return canonicalJson({
    pools: sortOrdered(snapshot.pools).map((p) => ({
      ...p,
      tasks: sortOrdered(p.tasks),
    })),
    shuffleConfig: snapshot.shuffleConfig,
    dailyPlanHistory: snapshot.dailyPlanHistory,
  })
}

/** Days a tombstone is kept. Long enough that a rarely-used device still sees the delete. */
export const TOMBSTONE_TTL_DAYS = 120

/**
 * Drop tombstones older than the TTL so the synced file does not grow forever.
 * Anything still within the window keeps propagating the delete.
 */
export function pruneTombstones(
  snapshot: AppSnapshot,
  now: Date = new Date(),
): AppSnapshot {
  const cutoff = new Date(
    now.getTime() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const expired = (r: { deletedAt?: string }) =>
    r.deletedAt != null && r.deletedAt < cutoff
  return {
    ...snapshot,
    pools: snapshot.pools
      .filter((p) => !expired(p))
      .map((p) => ({ ...p, tasks: p.tasks.filter((t) => !expired(t)) })),
  }
}

export const STORAGE_KEY = "random-daily-v1"
/** ISO time of the last successful Gist push. Displayed only; never used to resolve conflicts. */
export const LAST_EXPORT_AT_KEY = "random-daily-last-export-at"
export const GIST_FILE_NAME = "random-daily-v1.json" as const
export const GITHUB_CREDS_KEY = "random-daily-github"

/**
 * Stamp handed to records that predate merge-based sync. Every real edit sorts
 * after it, so migrated data can never win a conflict by accident.
 */
export const LEGACY_TS = "1970-01-01T00:00:00.000Z"

export function nowIso(): string {
  return new Date().toISOString()
}

/** Normalize to `YYYY-MM-DDTHH:mm:ss.sssZ` so timestamps stay safe to compare as plain strings. */
export function toIso(value: unknown, fallback: string = LEGACY_TS): string {
  if (typeof value !== "string") return fallback
  const t = Date.parse(value)
  if (Number.isNaN(t)) return fallback
  return new Date(t).toISOString()
}

/** Task role by priority / dot color: 1 green archive, 2 yellow random pick pool, 3 red mandatory daily. */
export type TaskPriority = 1 | 2 | 3

export type Task = {
  id: string
  text: string
  priority: TaskPriority
  /** Optional longer context; omitted when empty. */
  notes?: string
  /** Stable sort key, so list position survives a merge. */
  order: number
  /** ISO time of the last edit; drives last-write-wins merging across devices. */
  updatedAt: string
  /** ISO tombstone. Deleted tasks stay in the snapshot so the delete propagates. */
  deletedAt?: string
}

export type Pool = {
  id: string
  name: string
  tasks: Task[]
  order: number
  updatedAt: string
  deletedAt?: string
}

export type DailyPlanItem = {
  id: string
  poolId: string
  taskId: string
  text: string
  priority?: TaskPriority
  notes?: string
  done: boolean
  /** ISO time `done` last flipped, so two devices can merge their check marks. */
  doneAt?: string
}

export type DailyPlan = {
  date: string
  items: DailyPlanItem[]
  /** ISO time the draw was generated. On conflict the earliest draw wins. */
  createdAt?: string
}

export type ShuffleSetting = {
  include: boolean
  count: number
  updatedAt?: string
}
export type ShuffleConfig = Record<string, ShuffleSetting>
export type DailyPlanHistory = Record<string, DailyPlan>

/**
 * Everything that syncs. There is no separate "current plan": today's draw is
 * just `dailyPlanHistory[today]`, which removes a whole class of desync between
 * the two. Exports still carry a `dailyPlan` field for older readers.
 */
export type AppSnapshot = {
  pools: Pool[]
  shuffleConfig: ShuffleConfig
  dailyPlanHistory: DailyPlanHistory
}

export type GistFilePayload = AppSnapshot & {
  exportedAt: string
  version: 1
}

export function emptySnapshot(): AppSnapshot {
  return { pools: [], shuffleConfig: {}, dailyPlanHistory: {} }
}

export function isLive(record: { deletedAt?: string }): boolean {
  return record.deletedAt == null
}

function compareOrdered(
  a: { order: number; id: string },
  b: { order: number; id: string },
): number {
  if (a.order !== b.order) return a.order - b.order
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortOrdered<T extends { order: number; id: string }>(
  list: T[],
): T[] {
  return [...list].sort(compareOrdered)
}

/** Pools and tasks as the UI should see them: tombstones dropped, order deterministic. */
export function livePools(pools: Pool[]): Pool[] {
  return sortOrdered(pools.filter(isLive)).map((p) => ({
    ...p,
    tasks: sortOrdered(p.tasks.filter(isLive)),
  }))
}

export function nextOrder(list: { order: number }[]): number {
  let max = -1
  for (const r of list) {
    if (r.order > max) max = r.order
  }
  return max + 1
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function normalizeTask(raw: unknown, index: number): Task | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== "string" || o.id === "") return null
  const p = o.priority
  const priority: TaskPriority = p === 1 || p === 2 || p === 3 ? p : 1
  const notes =
    typeof o.notes === "string" && o.notes.trim() !== "" ? o.notes : undefined
  return {
    id: o.id,
    text: typeof o.text === "string" ? o.text : "",
    priority,
    order:
      typeof o.order === "number" && Number.isFinite(o.order) ? o.order : index,
    updatedAt: toIso(o.updatedAt),
    ...(notes !== undefined ? { notes } : {}),
    ...(o.deletedAt != null ? { deletedAt: toIso(o.deletedAt) } : {}),
  }
}

function normalizePool(raw: unknown, index: number): Pool | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== "string" || o.id === "") return null
  const rawTasks = Array.isArray(o.tasks) ? o.tasks : []
  const tasks: Task[] = []
  rawTasks.forEach((t, i) => {
    const task = normalizeTask(t, i)
    if (task) tasks.push(task)
  })
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "",
    tasks: sortOrdered(tasks),
    order:
      typeof o.order === "number" && Number.isFinite(o.order) ? o.order : index,
    updatedAt: toIso(o.updatedAt),
    ...(o.deletedAt != null ? { deletedAt: toIso(o.deletedAt) } : {}),
  }
}

function normalizePlanItem(raw: unknown): DailyPlanItem | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== "string" || o.id === "") return null
  const p = o.priority
  const priority = p === 1 || p === 2 || p === 3 ? p : undefined
  const notes =
    typeof o.notes === "string" && o.notes.trim() !== "" ? o.notes : undefined
  const done = o.done === true
  return {
    id: o.id,
    poolId: typeof o.poolId === "string" ? o.poolId : "",
    taskId: typeof o.taskId === "string" ? o.taskId : o.id,
    text: typeof o.text === "string" ? o.text : "",
    done,
    ...(priority !== undefined ? { priority } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(o.doneAt != null ? { doneAt: toIso(o.doneAt) } : {}),
  }
}

export function normalizeDailyPlan(raw: unknown): DailyPlan | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.date !== "string" || !isYmd(o.date)) return null
  if (!Array.isArray(o.items)) return null
  const items: DailyPlanItem[] = []
  for (const it of o.items) {
    const item = normalizePlanItem(it)
    if (item) items.push(item)
  }
  return {
    date: o.date,
    items,
    // Pre-merge exports have no createdAt; treat them as the earliest possible
    // draw so a legacy plan beats a duplicate generated later on another device.
    createdAt: toIso(o.createdAt),
  }
}

function normalizeShuffleConfig(raw: unknown): ShuffleConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: ShuffleConfig = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue
    const v = val as Record<string, unknown>
    const count =
      typeof v.count === "number" && Number.isFinite(v.count)
        ? Math.max(0, Math.min(99, Math.floor(v.count)))
        : 1
    out[key] = {
      include: v.include !== false,
      count,
      updatedAt: toIso(v.updatedAt),
    }
  }
  return out
}

/** Store a plan under its own date, keeping whichever draw already won for that day. */
export function putPlanInHistory(
  history: DailyPlanHistory,
  plan: DailyPlan | null,
): DailyPlanHistory {
  if (!plan) return { ...history }
  return { ...history, [plan.date]: plan }
}

export function getPlan(
  history: DailyPlanHistory,
  date: string,
): DailyPlan | null {
  const plan = history[date]
  return plan?.items.length ? plan : null
}

export function hasTodaysPlan(
  today: string,
  history: DailyPlanHistory,
): boolean {
  return getPlan(history, today) !== null
}

/**
 * Parse any known snapshot shape into the current model. Legacy `dailyPlan` is
 * folded into the history so callers only ever deal with one source of truth.
 */
export function assertValidSnapshot(data: unknown): AppSnapshot {
  if (typeof data !== "object" || data === null) {
    throw new Error("Not a JSON object")
  }
  const o = data as Record<string, unknown>
  if (!Array.isArray(o.pools)) {
    throw new Error("Missing a pools array")
  }

  const pools: Pool[] = []
  o.pools.forEach((p, i) => {
    const pool = normalizePool(p, i)
    if (pool) pools.push(pool)
  })

  const dailyPlanHistory: DailyPlanHistory = {}
  const rawHistory = o.dailyPlanHistory
  if (rawHistory && typeof rawHistory === "object" && !Array.isArray(rawHistory)) {
    for (const [key, val] of Object.entries(
      rawHistory as Record<string, unknown>,
    )) {
      if (!isYmd(key)) continue
      const plan = normalizeDailyPlan(val)
      if (plan) dailyPlanHistory[plan.date] = plan
    }
  }

  const legacyPlan = normalizeDailyPlan(o.dailyPlan)
  if (legacyPlan && !dailyPlanHistory[legacyPlan.date]) {
    dailyPlanHistory[legacyPlan.date] = legacyPlan
  }

  return {
    pools: sortOrdered(pools),
    shuffleConfig: normalizeShuffleConfig(o.shuffleConfig),
    dailyPlanHistory,
  }
}

export function parseAppSnapshotString(text: string): AppSnapshot {
  return assertValidSnapshot(JSON.parse(text.trim()) as unknown)
}

/** Serialize for storage, export, and Gist, keeping `dailyPlan` for older readers. */
export function serializeSnapshot(
  snapshot: AppSnapshot,
  today: string,
): AppSnapshot & { dailyPlan: DailyPlan | null } {
  return {
    ...snapshot,
    dailyPlan: snapshot.dailyPlanHistory[today] ?? null,
  }
}

export function getLastExportAt(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LAST_EXPORT_AT_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { at?: string }
    return typeof o.at === "string" ? o.at : null
  } catch {
    return null
  }
}

export function setLastExportAt(iso: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(LAST_EXPORT_AT_KEY, JSON.stringify({ at: iso }))
}

export function loadGithubCreds(): { token: string; gistId: string } {
  if (typeof window === "undefined") {
    return { token: "", gistId: "" }
  }
  try {
    const raw = localStorage.getItem(GITHUB_CREDS_KEY)
    if (!raw) return { token: "", gistId: "" }
    const o = JSON.parse(raw) as { token?: string; gistId?: string }
    return { token: o.token ?? "", gistId: o.gistId ?? "" }
  } catch {
    return { token: "", gistId: "" }
  }
}

export function saveGithubCreds(next: { token: string; gistId: string }) {
  if (typeof window === "undefined") return
  localStorage.setItem(GITHUB_CREDS_KEY, JSON.stringify(next))
}

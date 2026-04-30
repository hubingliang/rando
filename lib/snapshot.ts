export const STORAGE_KEY = "random-daily-v1"
/** ISO time of last successful Gist push or Gist/clipboard apply — for sync hints only. */
export const LAST_EXPORT_AT_KEY = "random-daily-last-export-at"

/** Task role by priority / dot color: 1 green archive, 2 yellow random pick pool, 3 red mandatory daily. */
export type TaskPriority = 1 | 2 | 3
export type Task = {
  id: string
  text: string
  priority: TaskPriority
  /** Optional longer context; omitted when empty. */
  notes?: string
}
export type Pool = { id: string; name: string; tasks: Task[] }
export type DailyPlanItem = {
  id: string
  poolId: string
  taskId: string
  text: string
  priority?: TaskPriority
  notes?: string
  done: boolean
}
export type DailyPlan = { date: string; items: DailyPlanItem[] }
export type ShuffleConfig = Record<string, { include: boolean; count: number }>
export type DailyPlanHistory = Record<string, DailyPlan>
export type AppSnapshot = {
  pools: Pool[]
  dailyPlan: DailyPlan | null
  shuffleConfig: ShuffleConfig
  /** Past (and current) draws keyed by `yyyy-mm-dd`; synced with export / Gist. */
  dailyPlanHistory: DailyPlanHistory
}

export function mergeDailyPlanIntoHistory(
  history: DailyPlanHistory,
  plan: DailyPlan | null,
): DailyPlanHistory {
  if (!plan) return { ...history }
  return { ...history, [plan.date]: plan }
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function parseDailyPlanHistoryField(raw: unknown): DailyPlanHistory {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }
  const out: DailyPlanHistory = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!isYmd(key)) continue
    if (!val || typeof val !== "object") continue
    const pl = val as Record<string, unknown>
    if (typeof pl.date !== "string" || !Array.isArray(pl.items)) continue
    out[key] = val as DailyPlan
  }
  return out
}

export const GIST_FILE_NAME = "random-daily-v1.json" as const

export type GistFilePayload = AppSnapshot & { exportedAt: string; version: 1 }

export const GITHUB_CREDS_KEY = "random-daily-github"

export function normalizeTask(raw: {
  id: string
  text: string
  priority?: unknown
  notes?: unknown
}): Task {
  const p = raw.priority
  const priority: TaskPriority =
    p === 1 || p === 2 || p === 3 ? p : 1
  const n = raw.notes
  const notes =
    typeof n === "string" && n.trim() !== "" ? n : undefined
  return {
    id: raw.id,
    text: raw.text,
    priority,
    ...(notes !== undefined ? { notes } : {}),
  }
}

export function assertValidSnapshot(data: unknown): AppSnapshot {
  if (typeof data !== "object" || data === null) {
    throw new Error("Not a JSON object")
  }
  const o = data as Record<string, unknown>
  if (!Array.isArray(o.pools)) {
    throw new Error("Missing a pools array")
  }
  const pools: Pool[] = (o.pools as Pool[]).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    tasks: (p.tasks ?? []).map((t) =>
      normalizeTask(
        t as {
          id: string
          text: string
          priority?: unknown
          notes?: unknown
        },
      ),
    ),
  }))
  let dailyPlan: DailyPlan | null = null
  const d = o.dailyPlan
  if (d && typeof d === "object" && d !== null) {
    const pl = d as Record<string, unknown>
    if (typeof pl.date === "string" && Array.isArray(pl.items)) {
      dailyPlan = d as DailyPlan
    }
  }
  const shuffleConfig: ShuffleConfig =
    o.shuffleConfig && typeof o.shuffleConfig === "object" && o.shuffleConfig !== null
      ? (o.shuffleConfig as ShuffleConfig)
      : {}
  let dailyPlanHistory = parseDailyPlanHistoryField(o.dailyPlanHistory)
  dailyPlanHistory = mergeDailyPlanIntoHistory(dailyPlanHistory, dailyPlan)
  return {
    pools,
    dailyPlan,
    shuffleConfig,
    dailyPlanHistory,
  }
}

/** Merge loose imports into a full snapshot (e.g. older exports without `dailyPlanHistory`). */
export function coerceAppSnapshot(input: {
  pools: Pool[]
  dailyPlan: DailyPlan | null
  shuffleConfig: ShuffleConfig
  dailyPlanHistory?: DailyPlanHistory
}): AppSnapshot {
  const dailyPlanHistory = mergeDailyPlanIntoHistory(
    input.dailyPlanHistory ?? {},
    input.dailyPlan,
  )
  return {
    pools: input.pools,
    dailyPlan: input.dailyPlan,
    shuffleConfig: input.shuffleConfig,
    dailyPlanHistory,
  }
}

export function parseAppSnapshotString(text: string): AppSnapshot {
  const data = JSON.parse(text.trim()) as unknown
  return assertValidSnapshot(data)
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

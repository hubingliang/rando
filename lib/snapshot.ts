export const STORAGE_KEY = "random-daily-v1"
/** ISO time of last successful Gist push or Gist/clipboard apply — for sync hints only. */
export const LAST_EXPORT_AT_KEY = "random-daily-last-export-at"

export type TaskPriority = 1 | 2 | 3
export type Task = { id: string; text: string; priority: TaskPriority }
export type Pool = { id: string; name: string; tasks: Task[] }
export type DailyPlanItem = {
  id: string
  poolId: string
  taskId: string
  text: string
  priority?: TaskPriority
  done: boolean
}
export type DailyPlan = { date: string; items: DailyPlanItem[] }
export type ShuffleConfig = Record<string, { include: boolean; count: number }>
export type AppSnapshot = {
  pools: Pool[]
  dailyPlan: DailyPlan | null
  shuffleConfig: ShuffleConfig
}

export const GIST_FILE_NAME = "random-daily-v1.json" as const

export type GistFilePayload = AppSnapshot & { exportedAt: string; version: 1 }

export const GITHUB_CREDS_KEY = "random-daily-github"

export function normalizeTask(raw: {
  id: string
  text: string
  priority?: unknown
}): Task {
  const p = raw.priority
  if (p === 1 || p === 2 || p === 3) {
    return { id: raw.id, text: raw.text, priority: p }
  }
  return { id: raw.id, text: raw.text, priority: 1 }
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
      normalizeTask(t as { id: string; text: string; priority?: unknown }),
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
  return {
    pools,
    dailyPlan,
    shuffleConfig,
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

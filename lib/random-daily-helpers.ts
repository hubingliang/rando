import {
  type AppSnapshot,
  type Pool,
  type ShuffleConfig,
  type Task,
  assertValidSnapshot,
  STORAGE_KEY,
} from "@/lib/snapshot"

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function ticketWeight(t: Task): number {
  const p = t.priority
  if (p === 1 || p === 2 || p === 3) return p
  return 1
}

/** Build a "bowl" of tickets: priority N adds N entries; shuffle; take up to k unique tasks in draw order. */
export function pickRandomTasks(tasks: Task[], n: number): Task[] {
  if (tasks.length === 0 || n < 1) return []
  const k = Math.min(n, tasks.length)
  const bowl: Task[] = []
  for (const t of tasks) {
    const w = ticketWeight(t)
    for (let i = 0; i < w; i++) {
      bowl.push(t)
    }
  }
  const shuffled = shuffleArray(bowl)
  const picked: Task[] = []
  const seen = new Set<string>()
  for (const ticket of shuffled) {
    if (seen.has(ticket.id)) continue
    seen.add(ticket.id)
    picked.push(ticket)
    if (picked.length >= k) break
  }
  return picked
}

export function loadSnapshot(): AppSnapshot {
  if (typeof window === "undefined") {
    return { pools: [], dailyPlan: null, shuffleConfig: {} }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { pools: [], dailyPlan: null, shuffleConfig: {} }
    }
    return assertValidSnapshot(JSON.parse(raw) as unknown)
  } catch {
    return { pools: [], dailyPlan: null, shuffleConfig: {} }
  }
}

export function buildDefaultShuffleConfig(
  pools: Pool[],
  prev: ShuffleConfig,
): ShuffleConfig {
  const next: ShuffleConfig = { ...prev }
  for (const p of pools) {
    if (!next[p.id]) {
      next[p.id] = { include: true, count: 1 }
    }
  }
  for (const k of Object.keys(next)) {
    if (!pools.some((p) => p.id === k)) {
      delete next[k]
    }
  }
  return next
}

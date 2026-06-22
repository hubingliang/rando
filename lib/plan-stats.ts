import { subDays, format } from "date-fns"

import type {
  DailyPlan,
  DailyPlanHistory,
  Pool,
} from "@/lib/snapshot"

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatYmd(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function prevYmd(ymd: string): string | null {
  const d = parseYmd(ymd)
  if (!d) return null
  return formatYmd(subDays(d, 1))
}

/** A day counts as complete when the plan exists, has items, and all are done. */
export function isPlanDayComplete(plan: DailyPlan | null | undefined): boolean {
  if (!plan?.items?.length) return false
  return plan.items.every((i) => i.done)
}

export function getPlanForDate(
  history: DailyPlanHistory,
  date: string,
  currentPlan?: DailyPlan | null,
): DailyPlan | null {
  if (currentPlan?.date === date) return currentPlan
  return history[date] ?? null
}

export function computeStreak(
  history: DailyPlanHistory,
  today: string,
  currentPlan?: DailyPlan | null,
): number {
  const todayPlan = getPlanForDate(history, today, currentPlan)
  let cursor: string | null = today
  let streak = 0

  if (isPlanDayComplete(todayPlan)) {
    streak = 1
    cursor = prevYmd(today)
  } else {
    cursor = prevYmd(today)
  }

  while (cursor) {
    const plan = getPlanForDate(history, cursor, currentPlan)
    if (!isPlanDayComplete(plan)) break
    streak++
    cursor = prevYmd(cursor)
  }

  return streak
}

export type DailyCompletionPoint = {
  date: string
  completed: number
  total: number
  /** 0–1 when total > 0; null when no plan */
  rate: number | null
}

export function computeDailyCompletionSeries(
  history: DailyPlanHistory,
  endDate: string,
  days = 7,
  currentPlan?: DailyPlan | null,
): DailyCompletionPoint[] {
  const end = parseYmd(endDate)
  if (!end) return []

  const out: DailyCompletionPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = formatYmd(subDays(end, i))
    const plan = getPlanForDate(history, date, currentPlan)
    const total = plan?.items.length ?? 0
    const completed = plan?.items.filter((x) => x.done).length ?? 0
    out.push({
      date,
      completed,
      total,
      rate: total > 0 ? completed / total : null,
    })
  }
  return out
}

export type PoolWeeklyStat = {
  poolId: string
  name: string
  completed: number
  total: number
  rate: number | null
}

export function computePoolWeeklyStats(
  history: DailyPlanHistory,
  pools: Pool[],
  endDate: string,
  days = 7,
  currentPlan?: DailyPlan | null,
): PoolWeeklyStat[] {
  const end = parseYmd(endDate)
  if (!end) return []

  const totals = new Map<string, { completed: number; total: number }>()
  for (let i = 0; i < days; i++) {
    const date = formatYmd(subDays(end, i))
    const plan = getPlanForDate(history, date, currentPlan)
    if (!plan?.items.length) continue
    for (const item of plan.items) {
      const cur = totals.get(item.poolId) ?? { completed: 0, total: 0 }
      cur.total++
      if (item.done) cur.completed++
      totals.set(item.poolId, cur)
    }
  }

  const poolNames = new Map(pools.map((p) => [p.id, p.name]))
  const ids = new Set([...totals.keys(), ...pools.map((p) => p.id)])

  return [...ids].map((poolId) => {
    const agg = totals.get(poolId) ?? { completed: 0, total: 0 }
    const name = poolNames.get(poolId) ?? "—"
    return {
      poolId,
      name,
      completed: agg.completed,
      total: agg.total,
      rate: agg.total > 0 ? agg.completed / agg.total : null,
    }
  })
}

/** Longest run of complete days within a lookback window ending on `endDate`. */
export function computeLongestStreakInRange(
  history: DailyPlanHistory,
  endDate: string,
  lookbackDays = 30,
  currentPlan?: DailyPlan | null,
): number {
  const end = parseYmd(endDate)
  if (!end) return 0

  let longest = 0
  let current = 0
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const date = formatYmd(subDays(end, i))
    const plan = getPlanForDate(history, date, currentPlan)
    if (isPlanDayComplete(plan)) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }
  return longest
}

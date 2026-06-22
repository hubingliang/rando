"use client"

import { useMemo } from "react"
import { format, parse } from "date-fns"

import { AppShell } from "@/components/app-shell"
import { useRandomDaily } from "@/components/random-daily-provider"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  computeDailyCompletionSeries,
  computeLongestStreakInRange,
  computePoolWeeklyStats,
  computeStreak,
} from "@/lib/plan-stats"
import { cn } from "@/lib/utils"

function formatShortDate(ymd: string): string {
  const d = parse(ymd, "yyyy-MM-dd", new Date())
  if (Number.isNaN(d.getTime())) return ymd
  return format(d, "EEE M/d")
}

function CompletionBar({
  rate,
  label,
}: {
  rate: number | null
  label: string
}) {
  const pct = rate != null ? Math.round(rate * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {rate != null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-300",
            rate == null && "w-0",
          )}
          style={{ width: rate != null ? `${pct}%` : "0%" }}
          role="progressbar"
          aria-valuenow={rate != null ? pct : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { dailyPlanHistory, dailyPlan, pools, today } = useRandomDaily()

  const streak = useMemo(
    () => computeStreak(dailyPlanHistory, today, dailyPlan),
    [dailyPlanHistory, today, dailyPlan],
  )

  const longest30 = useMemo(
    () => computeLongestStreakInRange(dailyPlanHistory, today, 30, dailyPlan),
    [dailyPlanHistory, today, dailyPlan],
  )

  const dailySeries = useMemo(
    () =>
      computeDailyCompletionSeries(dailyPlanHistory, today, 7, dailyPlan),
    [dailyPlanHistory, today, dailyPlan],
  )

  const poolStats = useMemo(
    () => computePoolWeeklyStats(dailyPlanHistory, pools, today, 7, dailyPlan),
    [dailyPlanHistory, pools, today, dailyPlan],
  )

  const hasAnyData = dailySeries.some((d) => d.total > 0)

  return (
    <AppShell>
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-medium tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Streaks and completion from your daily plan history.
          </p>
        </div>

        {!hasAnyData ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Complete daily plans to see insights here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Streak</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-8">
                <div>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">
                    {streak}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current streak
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-medium tabular-nums tracking-tight text-muted-foreground">
                    {longest30}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Longest in last 30 days
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last 7 days</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {dailySeries.map((point) => (
                  <div key={point.date} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {formatShortDate(point.date)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {point.total > 0
                          ? `${point.completed}/${point.total} done`
                          : "No plan"}
                      </span>
                    </div>
                    <CompletionBar
                      rate={point.rate}
                      label={`${formatShortDate(point.date)} completion`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pools this week</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {poolStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pool activity in the last 7 days.
                  </p>
                ) : (
                  poolStats.map((pool) => (
                    <div key={pool.poolId} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">
                          {pool.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {pool.total > 0
                            ? `${pool.completed}/${pool.total} done`
                            : "—"}
                        </span>
                      </div>
                      <CompletionBar
                        rate={pool.rate}
                        label={`${pool.name} completion`}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </AppShell>
  )
}

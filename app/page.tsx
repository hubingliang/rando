"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Copy } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PlanCalendar } from "@/components/plan-calendar"
import { useRandomDaily } from "@/components/random-daily-provider"
import { taskPriorityDotBgClass } from "@/components/task-priority-radios"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { DailyPlanItem, TaskPriority } from "@/lib/snapshot"

function groupPlanItemsByPool(
  items: DailyPlanItem[],
  pools: { id: string; name: string }[],
): { poolId: string; name: string; items: DailyPlanItem[] }[] {
  const map = new Map<string, DailyPlanItem[]>()
  for (const item of items) {
    const list = map.get(item.poolId)
    if (list) list.push(item)
    else map.set(item.poolId, [item])
  }
  const out: { poolId: string; name: string; items: DailyPlanItem[] }[] = []
  const seen = new Set<string>()
  for (const p of pools) {
    const group = map.get(p.id)
    if (group?.length) {
      out.push({ poolId: p.id, name: p.name, items: group })
      seen.add(p.id)
    }
  }
  for (const poolId of map.keys()) {
    if (!seen.has(poolId)) {
      const group = map.get(poolId)!
      out.push({
        poolId,
        name: pools.find((x) => x.id === poolId)?.name ?? "—",
        items: group,
      })
    }
  }
  return out
}

function roleTag(pr?: TaskPriority): string {
  if (pr === 1) return "Archive"
  if (pr === 2) return "Random"
  if (pr === 3) return "Mandatory"
  return ""
}

function DailyPlanPriorityTrail({
  priority,
  faded,
}: {
  priority: TaskPriority
  faded?: boolean
}) {
  if (priority === 2 || priority === 3) {
    return (
      <span
        role="img"
        aria-label={roleTag(priority)}
        title={roleTag(priority)}
        className={cn(
          "mt-1 size-2.5 shrink-0 rounded-full",
          taskPriorityDotBgClass[priority],
          faded && "opacity-45",
        )}
      />
    )
  }
  return null
}

function formatLongDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function DailyPlanPage() {
  const {
    pools,
    dailyPlan,
    dailyPlanHistory,
    today,
    toggleItemDone,
    copyDataToClipboard,
    copyDone,
  } = useRandomDaily()

  const [calendarSelectedDate, setCalendarSelectedDate] = useState(today)

  const datesWithPlans = useMemo(() => {
    const s = new Set<string>()
    for (const [k, plan] of Object.entries(dailyPlanHistory)) {
      if (plan?.items?.length) s.add(k)
    }
    if (dailyPlan?.items?.length && dailyPlan.date) {
      s.add(dailyPlan.date)
    }
    return s
  }, [dailyPlanHistory, dailyPlan])

  const displayPlan = useMemo(() => {
    if (calendarSelectedDate === today) {
      return dailyPlan?.date === today ? dailyPlan : null
    }
    return dailyPlanHistory[calendarSelectedDate] ?? null
  }, [calendarSelectedDate, today, dailyPlan, dailyPlanHistory])

  const planGroups = useMemo(() => {
    if (!displayPlan?.items.length) return []
    return groupPlanItemsByPool(displayPlan.items, pools)
  }, [displayPlan, pools])

  const viewingToday = calendarSelectedDate === today
  const interactivePlan =
    viewingToday && displayPlan !== null && displayPlan.date === today

  const headerCompleted = displayPlan
    ? displayPlan.items.filter((i) => i.done).length
    : 0
  const headerTotal = displayPlan?.items.length ?? 0

  const calendarPanel = (
    <Card size="sm">
      <CardContent>
        <PlanCalendar
          today={today}
          selectedDate={calendarSelectedDate}
          onSelectDate={setCalendarSelectedDate}
          datesWithPlans={datesWithPlans}
        />
      </CardContent>
    </Card>
  )

  return (
    <AppShell>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <section>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base sm:text-lg">
                        {formatLongDate(calendarSelectedDate)}
                      </CardTitle>
                      <Badge variant={viewingToday ? "secondary" : "outline"}>
                        {viewingToday ? "Today" : "History"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {calendarSelectedDate} · {headerCompleted}/{headerTotal}{" "}
                      done
                      {!viewingToday ? " · read-only" : null}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {!displayPlan || displayPlan.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {viewingToday
                      ? dailyPlan && dailyPlan.date !== today
                        ? `No plan for ${today}. Stored draw is for ${dailyPlan.date}.`
                        : "No plan yet. Add pools and tasks on Task pools."
                      : `No saved daily plan for ${calendarSelectedDate}.`}
                  </p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {planGroups.map((group) => (
                      <div key={group.poolId} className="flex flex-col gap-2">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          {group.name}
                        </p>
                        <ul className="m-0 list-none overflow-hidden rounded-lg border border-border p-0">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0 sm:py-2.5",
                              )}
                            >
                              <Checkbox
                                id={`day-${item.id}`}
                                checked={item.done}
                                disabled={!interactivePlan}
                                className="mt-0.5"
                                onCheckedChange={(v) =>
                                  toggleItemDone(item.id, v === true)
                                }
                                aria-label={
                                  interactivePlan
                                    ? `Complete ${item.text}`
                                    : `Done (read-only): ${item.text}`
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <label
                                  htmlFor={`day-${item.id}`}
                                  className={cn(
                                    "text-sm leading-snug",
                                    !interactivePlan && "cursor-default",
                                    item.done &&
                                      "text-muted-foreground line-through",
                                  )}
                                >
                                  {item.text}
                                </label>
                                {item.notes != null &&
                                item.notes.trim() !== "" ? (
                                  <p
                                    className={cn(
                                      "mt-1 whitespace-pre-wrap text-xs leading-snug text-muted-foreground",
                                      item.done && "line-through opacity-70",
                                    )}
                                  >
                                    {item.notes}
                                  </p>
                                ) : null}
                                {item.priority === 1 ? (
                                  <p
                                    className={cn(
                                      "mt-0.5 text-[0.65rem] text-muted-foreground",
                                      item.done && "opacity-70 line-through",
                                    )}
                                  >
                                    {roleTag(item.priority)}
                                  </p>
                                ) : null}
                              </div>
                              {item.priority === 2 || item.priority === 3 ? (
                                <DailyPlanPriorityTrail
                                  priority={item.priority}
                                  faded={item.done}
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="lg:hidden">{calendarPanel}</section>

          <footer className="flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => void copyDataToClipboard()}
            >
              <Copy />
              {copyDone ? "Copied" : "Copy data"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              asChild
            >
              <Link href="/pools">Task pools & backup</Link>
            </Button>
          </footer>
        </div>

        <aside className="hidden lg:sticky lg:top-[calc(3.5rem+1px)] lg:col-start-2 lg:row-start-1 lg:block lg:self-start">
          {calendarPanel}
        </aside>
      </div>
    </AppShell>
  )
}

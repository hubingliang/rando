"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Copy, Dices } from "lucide-react"

import { RandomDailyNav } from "@/components/random-daily-nav"
import { useRandomDaily } from "@/components/random-daily-provider"
import { taskPriorityDotBgClass } from "@/components/task-priority-radios"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { partitionTasksForDraw } from "@/lib/random-daily-helpers"
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

export default function DailyPlanPage() {
  const {
    pools,
    dailyPlan,
    shuffleConfig,
    today,
    todaysPlan,
    completedCount,
    totalCount,
    toggleItemDone,
    setInclude,
    setCount,
    generatePlan,
    emptyGenerateOpen,
    setEmptyGenerateOpen,
    copyDataToClipboard,
    copyDone,
  } = useRandomDaily()

  const planGroups = useMemo(() => {
    if (!todaysPlan?.items.length) return []
    return groupPlanItemsByPool(todaysPlan.items, pools)
  }, [todaysPlan, pools])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <RandomDailyNav />

        <header className="space-y-2 border-b border-border pb-8">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Random Daily
          </p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Daily plan
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Checkboxes apply only to today; pools live on Task pools. Rules:
            <span className="text-foreground"> Red</span>
            {" "}tasks are mandatory and all go into today;
            <span className="text-foreground"> yellow</span>
            {" "}tasks are random picks—each included pool contributes up to its
            &quot;Random count&quot; without replacement;
            <span className="text-foreground"> green</span>
            {" "}is archive (kept in the pool but never drawn into today).
          </p>
        </header>

        <section className="space-y-4">
          <Card className="border-border shadow-none">
            <CardHeader className="space-y-1 border-b border-border">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Today</CardTitle>
                  <CardDescription className="font-mono text-xs text-muted-foreground">
                    {today} · {completedCount}/{totalCount} done
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {!todaysPlan || todaysPlan.items.length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">
                  {dailyPlan && dailyPlan.date !== today
                    ? `No plan for ${today}. Stored draw is for ${dailyPlan.date} — generate for today.`
                    : "No plan yet. Add pools and tasks on Task pools, configure shuffle below, then Generate."}
                </p>
              ) : (
                <div className="space-y-6">
                  {planGroups.map((group) => (
                    <div key={group.poolId} className="space-y-2">
                      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                        {group.name}
                      </p>
                      <ul className="m-0 list-none space-y-0 border border-border p-0">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0",
                              "bg-card",
                            )}
                          >
                            <Checkbox
                              id={`day-${item.id}`}
                              checked={item.done}
                              onCheckedChange={(v) =>
                                toggleItemDone(item.id, v === true)
                              }
                              className="mt-0.5 shrink-0"
                              aria-label={`Complete ${item.text}`}
                            />
                            <div className="min-w-0 flex-1">
                              <label
                                htmlFor={`day-${item.id}`}
                                className={cn(
                                  "font-mono text-sm leading-snug",
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
                                    "mt-1 whitespace-pre-wrap font-mono text-xs leading-snug text-muted-foreground",
                                    item.done && "line-through opacity-70",
                                  )}
                                >
                                  {item.notes}
                                </p>
                              ) : null}
                              {item.priority === 1 ? (
                                <p
                                  className={cn(
                                    "mt-0.5 font-mono text-[0.65rem] text-muted-foreground",
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

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Shuffle</h2>
          <Card className="border-border shadow-none">
            <CardContent className="space-y-4 pt-4">
              {pools.length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">
                  Add at least one pool on{" "}
                  <Link
                    href="/pools"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Task pools
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-0 border border-border">
                  {pools.map((p) => {
                    const cfg = shuffleConfig[p.id] ?? {
                      include: true,
                      count: 1,
                    }
                    const { archived, yellowCandidates, mandatory } =
                      partitionTasksForDraw(p.tasks)
                    return (
                      <li
                        key={p.id}
                        className="grid gap-3 border-b border-border px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`in-${p.id}`}
                            checked={cfg.include}
                            onCheckedChange={(v) =>
                              setInclude(p.id, v === true)
                            }
                          />
                          <Label
                            htmlFor={`in-${p.id}`}
                            className="font-mono text-sm"
                          >
                            {p.name}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Label
                            htmlFor={`n-${p.id}`}
                            className="font-mono text-xs whitespace-nowrap text-muted-foreground"
                          >
                            Random count
                          </Label>
                          <Input
                            id={`n-${p.id}`}
                            type="number"
                            min={0}
                            max={99}
                            className="h-8 w-16 font-mono text-sm"
                            value={cfg.count}
                            onChange={(e) =>
                              setCount(p.id, parseInt(e.target.value, 10))
                            }
                            disabled={!cfg.include}
                          />
                        </div>
                        <p className="font-mono text-[0.65rem] text-muted-foreground sm:text-right">
                          Mandatory {mandatory.length} · Random{" "}
                          {yellowCandidates.length} · Archive {archived.length}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Button
                type="button"
                onClick={generatePlan}
                className="h-9 w-full font-mono text-sm sm:w-auto"
                disabled={!pools.length}
              >
                <Dices className="size-4" />
                Generate Daily Plan
              </Button>
            </CardContent>
          </Card>
        </section>

        <footer className="space-y-3 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyDataToClipboard()}
              className="h-8 font-mono text-xs"
            >
              <Copy className="size-4" />
              {copyDone ? "Copied" : "Copy data"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 font-mono text-xs"
              asChild
            >
              <Link href="/pools">Task pools & backup</Link>
            </Button>
          </div>
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            Import, Gist sync, and pool editing are on Task pools.
          </p>
        </footer>

        <Dialog open={emptyGenerateOpen} onOpenChange={setEmptyGenerateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nothing to draw</DialogTitle>
              <DialogDescription className="font-mono text-sm">
                Included pools must be able to produce at least one task. Having red
                (mandatory) tasks is enough. If you rely only on yellow random picks,
                set &quot;Random count&quot; to ≥ 1 and make sure the pool has at least
                one yellow task.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                className="font-mono"
                onClick={() => setEmptyGenerateOpen(false)}
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

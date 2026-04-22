"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Cloud, Copy, Dices, Plus, Trash2, Upload } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  buildGistJson,
  gistCreate,
  gistGet,
  gistPut,
  readGistFilePayload,
} from "@/lib/gist-api"
import {
  type AppSnapshot,
  type DailyPlan,
  type DailyPlanItem,
  type Pool,
  type ShuffleConfig,
  type Task,
  type TaskPriority,
  assertValidSnapshot,
  GIST_FILE_NAME,
  getLastExportAt,
  loadGithubCreds,
  parseAppSnapshotString,
  saveGithubCreds,
  setLastExportAt,
  STORAGE_KEY,
} from "@/lib/snapshot"
import { cn } from "@/lib/utils"

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function ticketWeight(t: Task): number {
  const p = t.priority
  if (p === 1 || p === 2 || p === 3) return p
  return 1
}

/** Build a "bowl" of tickets: priority N adds N entries; shuffle; take up to k unique tasks in draw order. */
function pickRandomTasks(tasks: Task[], n: number): Task[] {
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

/** P1=green, P2=yellow, P3=red — solid “traffic” dots, ticket count = 1/2/3. */
const priorityDot: Record<TaskPriority, string> = {
  1: "bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
  2: "bg-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
  3: "bg-red-500 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
}

const priorities: TaskPriority[] = [1, 2, 3]

function TaskPriorityRadios({
  name,
  value,
  onChange,
  disabled,
  labelledBy,
  groupAriaLabel = "Draw weight: green, yellow, or red",
  className,
}: {
  name: string
  value: TaskPriority
  onChange: (p: TaskPriority) => void
  disabled?: boolean
  /** If set, visible label is referenced; otherwise a screen-reader-only label is used. */
  labelledBy?: string
  groupAriaLabel?: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      {...(labelledBy
        ? { "aria-labelledby": labelledBy }
        : { "aria-label": groupAriaLabel })}
      className={cn("flex w-fit items-center gap-3", className)}
    >
      {priorities.map((pr) => {
        const selected = value === pr
        return (
          <label
            key={pr}
            className={cn(
              "group flex cursor-pointer p-0.5",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              className="sr-only border-0 p-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
              name={name}
              value={pr}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(pr)}
              aria-label={`Priority P${pr}, ${pr} ticket in the draw bowl`}
            />
            <span
              className={cn(
                "block shrink-0 rounded-full transition-all duration-150 ease-out",
                priorityDot[pr],
                selected
                  ? "h-4 w-4 opacity-100"
                  : "h-3.5 w-3.5 opacity-40 group-hover:opacity-75",
              )}
              aria-hidden
            />
          </label>
        )
      })}
    </div>
  )
}

function loadSnapshot(): AppSnapshot {
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

function buildDefaultShuffleConfig(
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

export default function Page() {
  const [pools, setPools] = React.useState<Pool[]>([])
  const [dailyPlan, setDailyPlan] = React.useState<DailyPlan | null>(null)
  const [shuffleConfig, setShuffleConfig] = React.useState<ShuffleConfig>({})
  const [ready, setReady] = React.useState(false)
  const [activePoolTab, setActivePoolTab] = React.useState("")

  const [newPoolName, setNewPoolName] = React.useState("")
  const [newTaskText, setNewTaskText] = React.useState<Record<string, string>>(
    {},
  )
  const [newTaskPriority, setNewTaskPriority] = React.useState<
    Record<string, TaskPriority>
  >({})
  const [poolPendingDelete, setPoolPendingDelete] = React.useState<string | null>(
    null,
  )
  const [emptyGenerateOpen, setEmptyGenerateOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [importText, setImportText] = React.useState("")
  const [importError, setImportError] = React.useState("")
  const [copyDone, setCopyDone] = React.useState(false)
  const [gistToken, setGistToken] = React.useState("")
  const [gistId, setGistId] = React.useState("")
  const [gistFormMsg, setGistFormMsg] = React.useState("")

  const queryClient = useQueryClient()
  const skipGistPushRef = React.useRef(false)
  const autoGistPullDoneRef = React.useRef(false)

  const applyAppSnapshot = React.useCallback((s: AppSnapshot) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setPools(s.pools)
    setDailyPlan(s.dailyPlan)
    setShuffleConfig(buildDefaultShuffleConfig(s.pools, s.shuffleConfig))
    if (s.pools[0]) {
      setActivePoolTab(s.pools[0].id)
    } else {
      setActivePoolTab("")
    }
  }, [])

  const gistQuery = useQuery({
    queryKey: ["random-daily-gist", gistId],
    queryFn: () => {
      if (!gistToken || !gistId) {
        throw new Error("Missing Gist settings")
      }
      return gistGet(gistToken, gistId)
    },
    enabled: ready && Boolean(gistToken && gistId),
    staleTime: 30_000,
  })

  const pushGistMutation = useMutation({
    mutationFn: async () => {
      if (!gistToken || !gistId) {
        throw new Error("Missing Gist token or id")
      }
      const body = buildGistJson({ pools, dailyPlan, shuffleConfig })
      await gistPut(gistToken, gistId, body)
      return body
    },
    onSuccess: (body) => {
      const p = JSON.parse(body) as { exportedAt: string }
      setLastExportAt(p.exportedAt)
    },
  })

  React.useEffect(() => {
    const s = loadSnapshot()
    setPools(s.pools)
    setDailyPlan(s.dailyPlan)
    setShuffleConfig(buildDefaultShuffleConfig(s.pools, s.shuffleConfig))
    if (s.pools[0]) {
      setActivePoolTab(s.pools[0].id)
    }
    const c = loadGithubCreds()
    setGistToken(c.token)
    setGistId(c.gistId)
    setReady(true)
  }, [])

  React.useEffect(() => {
    if (!ready) return
    const payload: AppSnapshot = { pools, dailyPlan, shuffleConfig }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [pools, dailyPlan, shuffleConfig, ready])

  React.useEffect(() => {
    if (!pools.length) {
      setActivePoolTab("")
      return
    }
    if (!pools.some((p) => p.id === activePoolTab)) {
      setActivePoolTab(pools[0].id)
    }
  }, [pools, activePoolTab])

  React.useEffect(() => {
    if (!ready) return
    if (!gistToken || !gistId) return
    if (!gistQuery.isFetched) return
    if (skipGistPushRef.current) {
      skipGistPushRef.current = false
      return
    }
    const t = window.setTimeout(() => {
      pushGistMutation.mutate()
    }, 2000)
    return () => clearTimeout(t)
  }, [
    ready,
    pools,
    dailyPlan,
    shuffleConfig,
    gistToken,
    gistId,
    gistQuery.isFetched,
    pushGistMutation.mutate,
  ])

  React.useEffect(() => {
    if (!ready || !gistQuery.isSuccess) return
    if (!gistQuery.data?.content?.trim() || autoGistPullDoneRef.current) return
    if (pools.length > 0) {
      autoGistPullDoneRef.current = true
      return
    }
    try {
      const p = readGistFilePayload(gistQuery.data.content)
      applyAppSnapshot({
        pools: p.pools,
        dailyPlan: p.dailyPlan,
        shuffleConfig: p.shuffleConfig,
      })
      setLastExportAt(p.exportedAt)
      skipGistPushRef.current = true
    } catch {
      /* not our format */
    }
    autoGistPullDoneRef.current = true
  }, [
    ready,
    gistQuery.isSuccess,
    gistQuery.data,
    pools.length,
    applyAppSnapshot,
  ])

  const today = todayYmd()
  const todaysPlan =
    dailyPlan && dailyPlan.date === today ? dailyPlan : null
  const completedCount = todaysPlan
    ? todaysPlan.items.filter((i) => i.done).length
    : 0
  const totalCount = todaysPlan?.items.length ?? 0

  const setTaskDraft = (poolId: string, v: string) => {
    setNewTaskText((m) => ({ ...m, [poolId]: v }))
  }

  const addPool = () => {
    const name = newPoolName.trim()
    if (!name) return
    const id = newId()
    setPools((prev) => [...prev, { id, name, tasks: [] }])
    setShuffleConfig((c) => ({
      ...c,
      [id]: { include: true, count: 1 },
    }))
    setActivePoolTab(id)
    setNewPoolName("")
  }

  const removePool = (id: string) => {
    setPools((p) => p.filter((x) => x.id !== id))
    setShuffleConfig((c) => {
      const n = { ...c }
      delete n[id]
      return n
    })
  }

  const confirmRemovePool = () => {
    if (poolPendingDelete) {
      removePool(poolPendingDelete)
    }
    setPoolPendingDelete(null)
  }

  const addTask = (poolId: string) => {
    const t = (newTaskText[poolId] ?? "").trim()
    if (!t) return
    const pr = newTaskPriority[poolId] ?? 2
    const task: Task = { id: newId(), text: t, priority: pr }
    setPools((pools) =>
      pools.map((p) =>
        p.id === poolId ? { ...p, tasks: [...p.tasks, task] } : p,
      ),
    )
    setTaskDraft(poolId, "")
  }

  const setTaskPriority = (
    poolId: string,
    taskId: string,
    priority: TaskPriority,
  ) => {
    setPools((pools) =>
      pools.map((p) =>
        p.id === poolId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? { ...t, priority } : t,
              ),
            }
          : p,
      ),
    )
  }

  const removeTask = (poolId: string, taskId: string) => {
    setPools((pools) =>
      pools.map((p) =>
        p.id === poolId
          ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
          : p,
      ),
    )
  }

  const updatePoolName = (poolId: string, name: string) => {
    setPools((p) => p.map((x) => (x.id === poolId ? { ...x, name } : x)))
  }

  const setInclude = (poolId: string, include: boolean) => {
    setShuffleConfig((c) => ({
      ...c,
      [poolId]: { ...(c[poolId] ?? { include: true, count: 1 }), include },
    }))
  }

  const setCount = (poolId: string, count: number) => {
    const n = Math.max(0, Math.min(99, Math.floor(Number.isNaN(count) ? 0 : count)))
    setShuffleConfig((c) => ({
      ...c,
      [poolId]: { ...(c[poolId] ?? { include: true, count: 1 }), count: n },
    }))
  }

  const generatePlan = () => {
    const date = todayYmd()
    const items: DailyPlanItem[] = []
    for (const pool of pools) {
      const cfg = shuffleConfig[pool.id] ?? { include: true, count: 1 }
      if (!cfg.include) continue
      if (cfg.count < 1) continue
      if (pool.tasks.length === 0) continue
      for (const t of pickRandomTasks(pool.tasks, cfg.count)) {
        items.push({
          id: newId(),
          poolId: pool.id,
          taskId: t.id,
          text: t.text,
          priority: t.priority,
          done: false,
        })
      }
    }
    if (items.length === 0) {
      setEmptyGenerateOpen(true)
      return
    }
    setDailyPlan({ date, items })
  }

  const toggleItemDone = (itemId: string, done: boolean) => {
    setDailyPlan((plan) => {
      if (!plan) return plan
      return {
        ...plan,
        items: plan.items.map((i) => (i.id === itemId ? { ...i, done } : i)),
      }
    })
  }

  const copyDataToClipboard = async () => {
    try {
      const text = JSON.stringify(
        { pools, dailyPlan, shuffleConfig } satisfies AppSnapshot,
        null,
        2,
      )
      await navigator.clipboard.writeText(text)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      if (typeof window !== "undefined") {
        window.alert(
          "Could not copy. Allow clipboard or use https / localhost.",
        )
      }
    }
  }

  const runImport = () => {
    setImportError("")
    try {
      const s = parseAppSnapshotString(importText)
      applyAppSnapshot(s)
      setLastExportAt(new Date().toISOString())
      setImportOpen(false)
      setImportText("")
    } catch (e) {
      setImportError(
        e instanceof Error
          ? e.message
          : "Invalid JSON or not a valid Random Daily export",
      )
    }
  }

  const saveGistSettings = () => {
    const token = gistToken.trim()
    const id = gistId.trim()
    saveGithubCreds({ token, gistId: id })
    setGistFormMsg("Settings saved")
    window.setTimeout(() => setGistFormMsg(""), 2000)
    void queryClient.invalidateQueries({ queryKey: ["random-daily-gist"] })
  }

  const createGist = async () => {
    if (!gistToken.trim()) {
      setGistFormMsg("Set a personal access token first")
      return
    }
    setGistFormMsg("")
    try {
      const body = buildGistJson({ pools, dailyPlan, shuffleConfig })
      const { gistId: newId } = await gistCreate(gistToken.trim(), body)
      setGistId(newId)
      saveGithubCreds({ token: gistToken.trim(), gistId: newId })
      const p = JSON.parse(body) as { exportedAt: string }
      setLastExportAt(p.exportedAt)
      setGistFormMsg("Secret Gist created. ID filled in — save is done.")
    } catch (e) {
      setGistFormMsg(
        e instanceof Error ? e.message : "Create Gist failed",
      )
    }
  }

  const pullFromGist = async () => {
    if (!gistToken || !gistId) return
    if (
      pools.length > 0 &&
      !window.confirm("Replace in-browser data with the Gist file?")
    ) {
      return
    }
    setGistFormMsg("")
    try {
      const d = await gistGet(gistToken.trim(), gistId.trim())
      if (!d.content?.trim()) {
        setGistFormMsg("Gist file is empty")
        return
      }
      const p = readGistFilePayload(d.content)
      applyAppSnapshot({
        pools: p.pools,
        dailyPlan: p.dailyPlan,
        shuffleConfig: p.shuffleConfig,
      })
      setLastExportAt(p.exportedAt)
      skipGistPushRef.current = true
      setGistFormMsg("Loaded from Gist")
    } catch (e) {
      setGistFormMsg(
        e instanceof Error ? e.message : "Could not read Gist",
      )
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background font-mono text-sm text-muted-foreground">
        INITIALIZING
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-2 border-b border-border pb-8">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            System
          </p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Random Daily
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Task pools and daily random draws. Completion is scoped to the
            current day only; master pools are never modified. Each draw
            uses a weighted bowl: the green, yellow, and red dot gives P1,
            P2, or P3 (1, 2, or 3 tickets) — higher weight surfaces more
            often, without fixing the list order.
          </p>
        </header>

        <section className="space-y-4">
          <Card className="border-border shadow-none">
            <CardHeader className="space-y-1 border-b border-border">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Daily plan</CardTitle>
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
                    : "No plan yet. Configure pools below, then run Generate."}
                </p>
              ) : (
                <ul className="space-y-0 border border-border">
                  {todaysPlan.items.map((item, i) => (
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
                        className="mt-0.5"
                        aria-label={`Complete ${item.text}`}
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`day-${item.id}`}
                          className={cn(
                            "font-mono text-sm leading-snug",
                            item.done && "text-muted-foreground line-through",
                          )}
                        >
                          {String(i + 1).padStart(2, "0")} · {item.text}
                        </label>
                        <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">
                          {pools.find((p) => p.id === item.poolId)?.name ?? "—"}
                          {item.priority != null
                            ? ` · P${item.priority}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
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
                  Add at least one pool to configure the daily draw.
                </p>
              ) : (
                <ul className="space-y-0 border border-border">
                  {pools.map((p) => {
                    const cfg = shuffleConfig[p.id] ?? {
                      include: true,
                      count: 1,
                    }
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
                            className="font-mono text-xs text-muted-foreground whitespace-nowrap"
                          >
                            Pick
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
                          {p.tasks.length} in pool
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

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Task pools</h2>
          <div className="flex flex-col gap-2 border border-border p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="new-pool" className="font-mono text-xs">
                New pool
              </Label>
              <Input
                id="new-pool"
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addPool()
                  }
                }}
                placeholder="e.g. Deep Work"
                className="font-mono"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addPool}
              className="h-8 shrink-0 font-mono"
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>

          {pools.length === 0 ? (
            <p className="font-mono text-sm text-muted-foreground">
              No pools yet. Create one above.
            </p>
          ) : (
            <Tabs
              value={activePoolTab}
              onValueChange={setActivePoolTab}
              className="w-full"
            >
              <TabsList
                variant="line"
                className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 rounded-none border border-border border-b-0 bg-muted/40 p-0"
              >
                {pools.map((p) => (
                  <TabsTrigger
                    key={p.id}
                    value={p.id}
                    className="shrink-0 rounded-none border-r border-border px-3 font-mono text-xs data-active:border-b-transparent data-active:bg-background"
                  >
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {pools.map((p) => (
                <TabsContent
                  key={p.id}
                  value={p.id}
                  className="mt-0 border border-t-0 border-border bg-card p-4"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label
                          htmlFor={`pool-name-${p.id}`}
                          className="font-mono text-xs"
                        >
                          Pool name
                        </Label>
                        <Input
                          id={`pool-name-${p.id}`}
                          value={p.name}
                          onChange={(e) => updatePoolName(p.id, e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPoolPendingDelete(p.id)}
                        className="h-8 font-mono text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Delete pool
                      </Button>
                    </div>

                    <div className="h-px w-full bg-border" />

                    <p className="font-mono text-xs text-muted-foreground">
                      Recurring tasks. Solid green / yellow / red = P1–P3
                      (1–3 tickets in the bowl).
                    </p>
                    {p.tasks.length === 0 ? (
                      <p className="font-mono text-sm text-muted-foreground">
                        No tasks yet.
                      </p>
                    ) : (
                      <ul className="space-y-0 border border-border">
                        {p.tasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex flex-col gap-2 border-b border-border px-2 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                          >
                            <span className="min-w-0 flex-1 font-mono text-sm break-words">
                              {t.text}
                            </span>
                            <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                              <TaskPriorityRadios
                                name={`priority-${p.id}-${t.id}`}
                                value={t.priority}
                                onChange={(pr) =>
                                  setTaskPriority(p.id, t.id, pr)
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTask(p.id, t.id)}
                                className="shrink-0"
                                aria-label="Delete task"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`task-${p.id}`}
                        className="font-mono text-xs"
                      >
                        New task
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Input
                          id={`task-${p.id}`}
                          value={newTaskText[p.id] ?? ""}
                          onChange={(e) => setTaskDraft(p.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addTask(p.id)
                            }
                          }}
                          placeholder="Type and add"
                          className="min-w-0 flex-1 font-mono"
                        />
                        <TaskPriorityRadios
                          name={`new-priority-${p.id}`}
                          value={newTaskPriority[p.id] ?? 2}
                          onChange={(pr) =>
                            setNewTaskPriority((m) => ({ ...m, [p.id]: pr }))
                          }
                          className="shrink-0"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => addTask(p.id)}
                          className="h-8 shrink-0 font-mono"
                        >
                          <Plus className="size-4" />
                          Add task
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Gist sync</h2>
          <Card className="border-border shadow-none">
            <CardHeader className="space-y-1 border-b border-border pb-3">
              <CardTitle className="text-base">GitHub Gist</CardTitle>
              <CardDescription className="font-mono text-xs">
                Store token and Gist id only in this browser. Pushes a single file (
                {GIST_FILE_NAME}) to a secret gist, debounced ~2s
                after pools, daily plan, or shuffle config change. Uses our API
                route so the token never calls GitHub from the open web (CORS).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="gh-token" className="font-mono text-xs">
                  Personal access token
                </Label>
                <Input
                  id="gh-token"
                  type="password"
                  autoComplete="off"
                  value={gistToken}
                  onChange={(e) => setGistToken(e.target.value)}
                  placeholder="ghp_… or github_pat_… (gist scope)"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gist-id" className="font-mono text-xs">
                  Gist ID
                </Label>
                <Input
                  id="gist-id"
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  placeholder="id from https://gist.github.com/you/<id>"
                  className="font-mono"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={saveGistSettings}
                  className="h-8 font-mono text-xs"
                >
                  Save settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void createGist()
                  }}
                  className="h-8 font-mono text-xs"
                  disabled={!gistToken.trim()}
                >
                  <Cloud className="size-4" />
                  Create Gist
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void pullFromGist()
                  }}
                  className="h-8 font-mono text-xs"
                  disabled={!gistToken.trim() || !gistId.trim()}
                >
                  Load from Gist
                </Button>
              </div>
              {gistFormMsg ? (
                <p className="font-mono text-xs text-muted-foreground">
                  {gistFormMsg}
                </p>
              ) : null}
              {gistQuery.isError && gistQuery.error ? (
                <p className="font-mono text-xs text-destructive">
                  {gistQuery.error instanceof Error
                    ? gistQuery.error.message
                    : "Gist request failed"}
                </p>
              ) : null}
              {pushGistMutation.isError && pushGistMutation.error ? (
                <p className="font-mono text-xs text-destructive">
                  Push:{" "}
                  {pushGistMutation.error instanceof Error
                    ? pushGistMutation.error.message
                    : "failed"}
                </p>
              ) : null}
              {pushGistMutation.isPending ? (
                <p className="font-mono text-xs text-muted-foreground">
                  Pushing to Gist…
                </p>
              ) : null}
              <p className="font-mono text-[0.65rem] text-muted-foreground">
                Last known export: {getLastExportAt() ?? "—"} ·{" "}
                {gistQuery.isFetching
                  ? "fetching Gist…"
                  : "Gist in sync (when configured)"}
              </p>
            </CardContent>
          </Card>
        </section>

        <AlertDialog
          open={poolPendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPoolPendingDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this pool?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-1 font-mono text-xs">
                <span>
                  {poolPendingDelete
                    ? (pools.find((x) => x.id === poolPendingDelete)?.name ??
                      "—")
                    : "—"}
                </span>
                <span className="block text-muted-foreground">
                  The pool and its recurring tasks are removed. This cannot be
                  undone.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="font-mono bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={confirmRemovePool}
              >
                Delete pool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={emptyGenerateOpen} onOpenChange={setEmptyGenerateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nothing to draw</DialogTitle>
              <DialogDescription className="font-mono text-sm">
                Include at least one pool that has tasks and set pick count to at
                least 1.
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

        <Dialog
          open={importOpen}
          onOpenChange={(open) => {
            setImportOpen(open)
            if (!open) {
              setImportText("")
              setImportError("")
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import data</DialogTitle>
              <DialogDescription className="font-mono text-sm">
                Paste a JSON export (same format as &quot;Copy data&quot;). This
                replaces the current in-browser data for {STORAGE_KEY}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="import-payload" className="font-mono text-xs">
                JSON
              </Label>
              <textarea
                id="import-payload"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value)
                  setImportError("")
                }}
                className="min-h-32 w-full rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                placeholder='{"pools":[...], "dailyPlan": null, "shuffleConfig":{}}'
                spellCheck={false}
                autoComplete="off"
                aria-invalid={importError ? true : undefined}
              />
              {importError ? (
                <p className="font-mono text-xs text-destructive">{importError}</p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="font-mono"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="font-mono"
                onClick={runImport}
                disabled={!importText.trim()}
              >
                <Upload className="size-4" />
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <footer className="space-y-3 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyDataToClipboard}
              className="h-8 font-mono text-xs"
            >
              <Copy className="size-4" />
              {copyDone ? "Copied" : "Copy data"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setImportError("")
                setImportText("")
                setImportOpen(true)
              }}
              className="h-8 font-mono text-xs"
            >
              <Upload className="size-4" />
              Import
            </Button>
          </div>
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            Persisted in localStorage · {STORAGE_KEY}
          </p>
        </footer>
      </div>
    </div>
  )
}

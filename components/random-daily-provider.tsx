"use client"

import * as React from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"

import {
  buildGistJson,
  gistCreate,
  gistGet,
  gistPut,
  readGistFilePayload,
} from "@/lib/gist-api"
import {
  buildDefaultShuffleConfig,
  loadSnapshot,
  newId,
  partitionTasksForDraw,
  pickRandomSubset,
  todayYmd,
} from "@/lib/random-daily-helpers"
import {
  type AppSnapshot,
  type DailyPlan,
  type DailyPlanHistory,
  type DailyPlanItem,
  type Pool,
  type ShuffleConfig,
  type Task,
  type TaskPriority,
  coerceAppSnapshot,
  parseAppSnapshotString,
  loadGithubCreds,
  saveGithubCreds,
  setLastExportAt,
  getLastExportAt,
  STORAGE_KEY,
  hasTodaysPlan,
} from "@/lib/snapshot"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { syncDailyReminderSchedule } from "@/lib/reminder"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type GistGetData = Awaited<ReturnType<typeof gistGet>>

export type RandomDailyContextValue = {
  ready: boolean
  pools: Pool[]
  dailyPlan: DailyPlan | null
  dailyPlanHistory: DailyPlanHistory
  shuffleConfig: ShuffleConfig
  activePoolTab: string
  setActivePoolTab: React.Dispatch<React.SetStateAction<string>>
  newPoolName: string
  setNewPoolName: React.Dispatch<React.SetStateAction<string>>
  newTaskText: Record<string, string>
  newTaskPriority: Record<string, TaskPriority>
  setTaskDraft: (poolId: string, v: string) => void
  setNewTaskPriority: React.Dispatch<
    React.SetStateAction<Record<string, TaskPriority>>
  >
  poolPendingDelete: string | null
  setPoolPendingDelete: React.Dispatch<React.SetStateAction<string | null>>
  emptyGenerateOpen: boolean
  setEmptyGenerateOpen: React.Dispatch<React.SetStateAction<boolean>>
  importOpen: boolean
  setImportOpen: React.Dispatch<React.SetStateAction<boolean>>
  importText: string
  setImportText: React.Dispatch<React.SetStateAction<string>>
  importError: string
  setImportError: React.Dispatch<React.SetStateAction<string>>
  gistToken: string
  setGistToken: React.Dispatch<React.SetStateAction<string>>
  gistId: string
  setGistId: React.Dispatch<React.SetStateAction<string>>
  gistFormMsg: string
  gistQuery: UseQueryResult<GistGetData, Error>
  pushGistMutation: UseMutationResult<string, Error, void, unknown>
  copyDone: boolean
  taskEditorOpen: boolean
  taskEditorTitle: string
  taskEditorNotes: string
  setTaskEditorTitle: React.Dispatch<React.SetStateAction<string>>
  setTaskEditorNotes: React.Dispatch<React.SetStateAction<string>>
  today: string
  todaysPlan: DailyPlan | null
  completedCount: number
  totalCount: number
  addPool: () => void
  /** Changes pool order used on Daily plan and in exports (swap with neighbor). */
  movePool: (poolId: string, direction: "up" | "down") => void
  removePool: (id: string) => void
  confirmRemovePool: () => void
  addTask: (poolId: string) => void
  setTaskPriority: (
    poolId: string,
    taskId: string,
    priority: TaskPriority,
  ) => void
  removeTask: (poolId: string, taskId: string) => void
  updatePoolName: (poolId: string, name: string) => void
  setInclude: (poolId: string, include: boolean) => void
  setCount: (poolId: string, count: number) => void
  toggleItemDone: (itemId: string, done: boolean) => void
  copyDataToClipboard: () => Promise<void>
  runImport: () => void
  saveGistSettings: () => void
  createGist: () => Promise<void>
  pullFromGist: () => Promise<void>
  openTaskEditor: (poolId: string, taskId: string) => void
  closeTaskEditor: () => void
  saveTaskEditor: () => void
}

const RandomDailyContext = React.createContext<RandomDailyContextValue | null>(
  null,
)

export function useRandomDaily() {
  const ctx = React.useContext(RandomDailyContext)
  if (!ctx) {
    throw new Error("useRandomDaily must be used within RandomDailyProvider")
  }
  return ctx
}

export function RandomDailyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pools, setPools] = React.useState<Pool[]>([])
  const [dailyPlan, setDailyPlan] = React.useState<DailyPlan | null>(null)
  const [dailyPlanHistory, setDailyPlanHistory] =
    React.useState<DailyPlanHistory>({})
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

  const [taskEditorOpen, setTaskEditorOpen] = React.useState(false)
  const [taskEditorCtx, setTaskEditorCtx] = React.useState<{
    poolId: string
    taskId: string
  } | null>(null)
  const [taskEditorTitle, setTaskEditorTitle] = React.useState("")
  const [taskEditorNotes, setTaskEditorNotes] = React.useState("")
  const queryClient = useQueryClient()
  const skipGistPushRef = React.useRef(false)
  const lastAppliedRemoteExportRef = React.useRef<string | null>(null)

  const applyAppSnapshot = React.useCallback(
    (
      raw: Pick<AppSnapshot, "pools" | "dailyPlan" | "shuffleConfig"> & {
        dailyPlanHistory?: DailyPlanHistory
      },
    ) => {
      const full = coerceAppSnapshot(raw)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(full))
      setPools(full.pools)
      setDailyPlan(full.dailyPlan)
      setDailyPlanHistory(full.dailyPlanHistory)
      setShuffleConfig(buildDefaultShuffleConfig(full.pools, full.shuffleConfig))
      if (full.pools[0]) {
        setActivePoolTab(full.pools[0].id)
      } else {
        setActivePoolTab("")
      }
    },
    [],
  )

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
      const body = buildGistJson({
        pools,
        dailyPlan,
        shuffleConfig,
        dailyPlanHistory,
      })
      await gistPut(gistToken, gistId, body)
      return body
    },
    onSuccess: (body) => {
      const p = JSON.parse(body) as { exportedAt: string }
      setLastExportAt(p.exportedAt)
    },
  })

  const generatePlanForToday = React.useCallback((): boolean => {
    const date = todayYmd()
    const items: DailyPlanItem[] = []
    for (const pool of pools) {
      const cfg = shuffleConfig[pool.id] ?? { include: true, count: 1 }
      if (!cfg.include) continue
      if (pool.tasks.length === 0) continue

      const { mandatory, yellowCandidates } = partitionTasksForDraw(pool.tasks)

      for (const t of mandatory) {
        items.push({
          id: newId(),
          poolId: pool.id,
          taskId: t.id,
          text: t.text,
          priority: t.priority,
          ...(t.notes != null && t.notes.trim() !== ""
            ? { notes: t.notes }
            : {}),
          done: false,
        })
      }

      const randomYellow = pickRandomSubset(
        yellowCandidates,
        Math.max(0, cfg.count),
      )
      for (const t of randomYellow) {
        items.push({
          id: newId(),
          poolId: pool.id,
          taskId: t.id,
          text: t.text,
          priority: t.priority,
          ...(t.notes != null && t.notes.trim() !== ""
            ? { notes: t.notes }
            : {}),
          done: false,
        })
      }
    }
    if (items.length === 0) {
      setEmptyGenerateOpen(true)
      return false
    }
    setDailyPlan({ date, items })
    return true
  }, [pools, shuffleConfig])

  React.useEffect(() => {
    const s = loadSnapshot()
    setPools(s.pools)
    setDailyPlan(s.dailyPlan)
    setDailyPlanHistory(s.dailyPlanHistory)
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
    const payload: AppSnapshot = {
      pools,
      dailyPlan,
      shuffleConfig,
      dailyPlanHistory,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [pools, dailyPlan, shuffleConfig, dailyPlanHistory, ready])

  React.useEffect(() => {
    if (!ready) return
    void syncDailyReminderSchedule({ plan: dailyPlan })
  }, [ready, dailyPlan])

  React.useEffect(() => {
    if (!ready) return
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncDailyReminderSchedule({ plan: dailyPlan })
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [ready, dailyPlan])

  React.useEffect(() => {
    if (!ready || !dailyPlan) return
    setDailyPlanHistory((h) => ({ ...h, [dailyPlan.date]: dailyPlan }))
  }, [dailyPlan, ready])

  /** Persist PAT + Gist id whenever they change (previously only "Save settings" wrote these). */
  React.useEffect(() => {
    if (!ready) return
    saveGithubCreds({ token: gistToken, gistId: gistId })
  }, [ready, gistToken, gistId])

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
    dailyPlanHistory,
    gistToken,
    gistId,
    gistQuery.isFetched,
    pushGistMutation.mutate,
  ])

  React.useEffect(() => {
    if (!ready) return

    const today = todayYmd()
    const gistConfigured = Boolean(gistToken && gistId)

    if (gistConfigured && !gistQuery.isFetched) return

    if (gistConfigured && gistQuery.isSuccess) {
      const raw = gistQuery.data?.content?.trim()
      if (raw) {
        try {
          const p = readGistFilePayload(raw)
          const localHasToday = hasTodaysPlan(
            today,
            dailyPlan,
            dailyPlanHistory,
          )
          const remoteHasToday = hasTodaysPlan(
            today,
            p.dailyPlan,
            p.dailyPlanHistory ?? {},
          )

          if (lastAppliedRemoteExportRef.current !== p.exportedAt) {
            const remoteTime = new Date(p.exportedAt).getTime()
            const localExportIso = getLastExportAt()
            const localExportTime = localExportIso
              ? new Date(localExportIso).getTime()
              : 0

            const gistHasData =
              p.pools.length > 0 ||
              p.dailyPlan != null ||
              Object.keys(p.dailyPlanHistory ?? {}).length > 0

            const remoteIsNewer = remoteTime > localExportTime
            const hydrateEmptyLocal = pools.length === 0 && gistHasData
            const shouldApplyRemote =
              remoteIsNewer ||
              hydrateEmptyLocal ||
              (remoteHasToday && !localHasToday)

            if (shouldApplyRemote) {
              applyAppSnapshot({
                pools: p.pools,
                dailyPlan: p.dailyPlan,
                shuffleConfig: p.shuffleConfig,
                dailyPlanHistory: p.dailyPlanHistory,
              })
              setLastExportAt(p.exportedAt)
              skipGistPushRef.current = true
              lastAppliedRemoteExportRef.current = p.exportedAt
              return
            }

            lastAppliedRemoteExportRef.current = p.exportedAt
          }

          if (remoteHasToday) return
        } catch {
          /* not our format */
        }
      }
    }

    if (hasTodaysPlan(today, dailyPlan, dailyPlanHistory)) return
    if (pools.length === 0) return

    generatePlanForToday()
  }, [
    ready,
    gistToken,
    gistId,
    gistQuery.isFetched,
    gistQuery.isSuccess,
    gistQuery.data,
    dailyPlan,
    dailyPlanHistory,
    pools.length,
    applyAppSnapshot,
    generatePlanForToday,
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

  const triggerAllDoneCelebration = React.useCallback(() => {
    toast.success("All done for today.")
  }, [])

  const toggleItemDone = (itemId: string, done: boolean) => {
    setDailyPlan((plan) => {
      if (!plan) return plan
      const prevAllDone = plan.items.every((i) => i.done)
      const nextItems = plan.items.map((i) =>
        i.id === itemId ? { ...i, done } : i,
      )
      const nextAllDone = nextItems.every((i) => i.done)
      if (
        !prevAllDone &&
        nextAllDone &&
        nextItems.length > 0 &&
        done === true
      ) {
        queueMicrotask(() => triggerAllDoneCelebration())
      }
      return { ...plan, items: nextItems }
    })
  }

  const movePool = (poolId: string, direction: "up" | "down") => {
    const delta = direction === "up" ? -1 : 1
    setPools((prev) => {
      const i = prev.findIndex((p) => p.id === poolId)
      if (i < 0) return prev
      const j = i + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const t = next[i]!
      next[i] = next[j]!
      next[j] = t
      return next
    })
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
    setPools((prev) =>
      prev.map((p) =>
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
    setPools((prev) =>
      prev.map((p) =>
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
    setPools((prev) =>
      prev.map((p) =>
        p.id === poolId
          ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
          : p,
      ),
    )
  }

  const setTaskText = (poolId: string, taskId: string, text: string) => {
    setPools((prev) =>
      prev.map((p) =>
        p.id !== poolId
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? { ...t, text } : t,
              ),
            },
      ),
    )
  }

  const setTaskNotes = (poolId: string, taskId: string, notes: string) => {
    const empty = notes.trim() === ""
    setPools((prev) =>
      prev.map((p) =>
        p.id !== poolId
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) => {
                if (t.id !== taskId) return t
                if (empty) {
                  const rest = { ...t }
                  delete rest.notes
                  return rest
                }
                return { ...t, notes }
              }),
            },
      ),
    )
  }

  const openTaskEditor = (poolId: string, taskId: string) => {
    const pool = pools.find((x) => x.id === poolId)
    const task = pool?.tasks.find((x) => x.id === taskId)
    if (!task) return
    setTaskEditorCtx({ poolId, taskId })
    setTaskEditorTitle(task.text)
    setTaskEditorNotes(task.notes ?? "")
    setTaskEditorOpen(true)
  }

  const closeTaskEditor = () => {
    setTaskEditorOpen(false)
    setTaskEditorCtx(null)
  }

  const saveTaskEditor = () => {
    if (!taskEditorCtx) return
    const title = taskEditorTitle.trim()
    if (!title) return
    setTaskText(taskEditorCtx.poolId, taskEditorCtx.taskId, title)
    setTaskNotes(taskEditorCtx.poolId, taskEditorCtx.taskId, taskEditorNotes)
    closeTaskEditor()
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

  const copyDataToClipboard = async () => {
    try {
      const text = JSON.stringify(
        {
          pools,
          dailyPlan,
          shuffleConfig,
          dailyPlanHistory,
        } satisfies AppSnapshot,
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
    setGistFormMsg("Gist preview refreshed")
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
      const body = buildGistJson({
        pools,
        dailyPlan,
        shuffleConfig,
        dailyPlanHistory,
      })
      const { gistId: createdId } = await gistCreate(gistToken.trim(), body)
      setGistId(createdId)
      saveGithubCreds({ token: gistToken.trim(), gistId: createdId })
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
        dailyPlanHistory: p.dailyPlanHistory,
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

  const value: RandomDailyContextValue = {
    ready,
    pools,
    dailyPlan,
    dailyPlanHistory,
    shuffleConfig,
    activePoolTab,
    setActivePoolTab,
    newPoolName,
    setNewPoolName,
    newTaskText,
    newTaskPriority,
    setTaskDraft,
    setNewTaskPriority,
    poolPendingDelete,
    setPoolPendingDelete,
    emptyGenerateOpen,
    setEmptyGenerateOpen,
    importOpen,
    setImportOpen,
    importText,
    setImportText,
    importError,
    setImportError,
    gistToken,
    setGistToken,
    gistId,
    setGistId,
    gistFormMsg,
    gistQuery,
    pushGistMutation,
    copyDone,
    taskEditorOpen,
    taskEditorTitle,
    taskEditorNotes,
    setTaskEditorTitle,
    setTaskEditorNotes,
    today,
    todaysPlan,
    completedCount,
    totalCount,
    addPool,
    movePool,
    removePool,
    confirmRemovePool,
    addTask,
    setTaskPriority,
    removeTask,
    updatePoolName,
    setInclude,
    setCount,
    toggleItemDone,
    copyDataToClipboard,
    runImport,
    saveGistSettings,
    createGist,
    pullFromGist,
    openTaskEditor,
    closeTaskEditor,
    saveTaskEditor,
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        INITIALIZING
      </div>
    )
  }

  return (
    <RandomDailyContext.Provider value={value}>
      {children}
      <Dialog open={emptyGenerateOpen} onOpenChange={setEmptyGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nothing to draw</DialogTitle>
            <DialogDescription>
              Included pools must be able to produce at least one task. Having
              red (mandatory) tasks is enough. If you rely only on yellow random
              picks, set &quot;Random count&quot; to ≥ 1 on Task pools and make
              sure the pool has at least one yellow task.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setEmptyGenerateOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RandomDailyContext.Provider>
  )
}

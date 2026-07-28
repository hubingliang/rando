"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  buildGistJson,
  gistCreate,
  gistGet,
  gistPut,
  readGistFilePayload,
} from "@/lib/gist-api"
import { mergeSnapshots, pruneTombstones, snapshotFingerprint } from "@/lib/merge"
import {
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
  STORAGE_KEY,
  emptySnapshot,
  getPlan,
  hasTodaysPlan,
  livePools,
  loadGithubCreds,
  nextOrder,
  nowIso,
  parseAppSnapshotString,
  putPlanInHistory,
  saveGithubCreds,
  serializeSnapshot,
  setLastExportAt,
} from "@/lib/snapshot"

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

export type SyncStatus = "off" | "idle" | "syncing" | "error"

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
  /** "off" until a token and Gist id are set; "error" means local edits are not backed up yet. */
  syncStatus: SyncStatus
  syncError: string | null
  lastSyncedAt: string | null
  /** True when local edits have not reached the Gist yet. */
  hasPendingChanges: boolean
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
  generateTodayPlan: () => boolean
  copyDataToClipboard: () => Promise<void>
  runImport: () => void
  syncNow: () => Promise<void>
  createGist: () => Promise<void>
  replaceFromGist: () => Promise<void>
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

const PUSH_DEBOUNCE_MS = 2000

export function RandomDailyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [snapshot, setSnapshot] = React.useState<AppSnapshot>(emptySnapshot)
  const [ready, setReady] = React.useState(false)
  const [activePoolTab, setActivePoolTab] = React.useState("")

  const [newPoolName, setNewPoolName] = React.useState("")
  const [newTaskText, setNewTaskText] = React.useState<Record<string, string>>(
    {},
  )
  const [newTaskPriority, setNewTaskPriority] = React.useState<
    Record<string, TaskPriority>
  >({})
  const [poolPendingDelete, setPoolPendingDelete] = React.useState<
    string | null
  >(null)
  const [emptyGenerateOpen, setEmptyGenerateOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [importText, setImportText] = React.useState("")
  const [importError, setImportError] = React.useState("")
  const [copyDone, setCopyDone] = React.useState(false)
  const [gistToken, setGistToken] = React.useState("")
  const [gistId, setGistId] = React.useState("")
  const [gistFormMsg, setGistFormMsg] = React.useState("")
  const [syncing, setSyncing] = React.useState(false)
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null)

  const [taskEditorOpen, setTaskEditorOpen] = React.useState(false)
  const [taskEditorCtx, setTaskEditorCtx] = React.useState<{
    poolId: string
    taskId: string
  } | null>(null)
  const [taskEditorTitle, setTaskEditorTitle] = React.useState("")
  const [taskEditorNotes, setTaskEditorNotes] = React.useState("")

  const gistConfigured = Boolean(gistToken && gistId)

  /** Latest snapshot, readable from async sync code without stale closures. */
  const snapshotRef = React.useRef(snapshot)
  /** Fingerprint of the last remote payload we already folded in. */
  const seenRemoteFingerprintRef = React.useRef<string | null>(null)
  const syncingRef = React.useRef(false)
  /** Fingerprint of what we believe the Gist currently holds. */
  const [syncedFingerprint, setSyncedFingerprint] = React.useState<
    string | null
  >(null)

  React.useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const fingerprint = React.useMemo(
    () => snapshotFingerprint(snapshot),
    [snapshot],
  )

  const today = todayYmd()
  const pools = React.useMemo(() => livePools(snapshot.pools), [snapshot.pools])
  const dailyPlanHistory = snapshot.dailyPlanHistory
  const shuffleConfig = snapshot.shuffleConfig
  const todaysPlan = getPlan(dailyPlanHistory, today)
  const dailyPlan = todaysPlan
  const completedCount = todaysPlan
    ? todaysPlan.items.filter((i) => i.done).length
    : 0
  const totalCount = todaysPlan?.items.length ?? 0

  const updateSnapshot = React.useCallback(
    (fn: (s: AppSnapshot) => AppSnapshot) => {
      setSnapshot((prev) => fn(prev))
    },
    [],
  )

  const updatePool = React.useCallback(
    (poolId: string, fn: (p: Pool) => Pool) => {
      updateSnapshot((s) => ({
        ...s,
        pools: s.pools.map((p) => (p.id === poolId ? fn(p) : p)),
      }))
    },
    [updateSnapshot],
  )

  const updateTask = React.useCallback(
    (poolId: string, taskId: string, fn: (t: Task) => Task) => {
      updatePool(poolId, (p) => ({
        ...p,
        tasks: p.tasks.map((t) => (t.id === taskId ? fn(t) : t)),
      }))
    },
    [updatePool],
  )

  /**
   * Fold a remote snapshot into the local one. Merging is always safe: neither
   * side can lose data, and both devices reach the same result regardless of
   * who syncs first.
   */
  const absorbRemote = React.useCallback((remote: AppSnapshot): AppSnapshot => {
    const current = snapshotRef.current
    const merged = pruneTombstones(mergeSnapshots(current, remote))
    if (snapshotFingerprint(merged) === snapshotFingerprint(current)) {
      return current
    }
    snapshotRef.current = merged
    setSnapshot(merged)
    return merged
  }, [])

  React.useEffect(() => {
    const loaded = pruneTombstones(loadSnapshot())
    snapshotRef.current = loaded
    setSnapshot(loaded)
    const first = livePools(loaded.pools)[0]
    if (first) setActivePoolTab(first.id)
    const c = loadGithubCreds()
    setGistToken(c.token)
    setGistId(c.gistId)
    setReady(true)
  }, [])

  React.useEffect(() => {
    if (!ready) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeSnapshot(snapshot, todayYmd())),
    )
  }, [ready, snapshot])

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

  /** Persist PAT + Gist id whenever they change. */
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
      setActivePoolTab(pools[0]!.id)
    }
  }, [pools, activePoolTab])

  const gistQuery = useQuery({
    queryKey: ["random-daily-gist", gistId],
    queryFn: () => gistGet(gistToken, gistId),
    enabled: ready && gistConfigured,
    staleTime: 30_000,
    retry: 1,
  })

  /**
   * Read-modify-write against the Gist. Fetching immediately before writing is
   * what stops a device from overwriting edits another device made in the
   * meantime; the write is skipped entirely when the merge changed nothing.
   */
  const syncNow = React.useCallback(async () => {
    if (!gistToken || !gistId) return
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await gistGet(gistToken.trim(), gistId.trim())
      const raw = res.content?.trim()
      const remote = raw ? readGistFilePayload(raw) : emptySnapshot()
      const remotePrint = snapshotFingerprint(remote)
      seenRemoteFingerprintRef.current = remotePrint

      const merged = absorbRemote(remote)
      const mergedPrint = snapshotFingerprint(merged)

      if (mergedPrint !== remotePrint) {
        const body = buildGistJson(merged, todayYmd())
        await gistPut(gistToken.trim(), gistId.trim(), body)
        const { exportedAt } = JSON.parse(body) as { exportedAt: string }
        setLastExportAt(exportedAt)
        seenRemoteFingerprintRef.current = mergedPrint
      }

      setSyncedFingerprint(mergedPrint)
      setLastSyncedAt(nowIso())
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [gistToken, gistId, absorbRemote])

  /** Fold in whatever the background query fetched, without writing anything back yet. */
  React.useEffect(() => {
    if (!ready || !gistQuery.isSuccess) return
    const raw = gistQuery.data?.content?.trim()
    let remote: AppSnapshot
    try {
      remote = raw ? readGistFilePayload(raw) : emptySnapshot()
    } catch {
      setSyncError("Gist file is not a Random Daily export")
      return
    }
    const remotePrint = snapshotFingerprint(remote)
    if (remotePrint === seenRemoteFingerprintRef.current) return
    seenRemoteFingerprintRef.current = remotePrint
    absorbRemote(remote)
    // The merge may have added local-only records; the push effect below
    // notices the fingerprint gap and uploads them.
    setSyncedFingerprint(remotePrint)
    setSyncError(null)
    setLastSyncedAt(nowIso())
  }, [ready, gistQuery.isSuccess, gistQuery.data, absorbRemote])

  const hasPendingChanges = gistConfigured && fingerprint !== syncedFingerprint

  /** Push only when local content actually differs from what the Gist holds. */
  React.useEffect(() => {
    if (!ready || !gistConfigured) return
    if (!gistQuery.isFetched) return
    if (fingerprint === syncedFingerprint) return
    const t = window.setTimeout(() => {
      void syncNow()
    }, PUSH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [
    ready,
    gistConfigured,
    gistQuery.isFetched,
    fingerprint,
    syncedFingerprint,
    syncNow,
  ])

  const generateTodayPlan = React.useCallback(
    (options?: { silent?: boolean }): boolean => {
      const date = todayYmd()
      const createdAt = nowIso()
      const current = snapshotRef.current
      const items: DailyPlanItem[] = []

      for (const pool of livePools(current.pools)) {
        const cfg = current.shuffleConfig[pool.id] ?? { include: true, count: 1 }
        if (!cfg.include) continue
        const { mandatory, yellowCandidates } = partitionTasksForDraw(pool.tasks)
        const drawn = [
          ...mandatory,
          ...pickRandomSubset(yellowCandidates, Math.max(0, cfg.count)),
        ]
        for (const t of drawn) {
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
        if (!options?.silent) setEmptyGenerateOpen(true)
        return false
      }

      updateSnapshot((s) => ({
        ...s,
        dailyPlanHistory: putPlanInHistory(s.dailyPlanHistory, {
          date,
          items,
          createdAt,
        }),
      }))
      return true
    },
    [updateSnapshot],
  )

  /**
   * Draw today's plan automatically, but never before we have seen the Gist.
   * Drawing while the remote state is unknown is exactly what produced two
   * different plans for the same day on two devices.
   */
  React.useEffect(() => {
    if (!ready) return
    if (gistConfigured && lastSyncedAt == null) return
    if (hasTodaysPlan(today, dailyPlanHistory)) return
    if (pools.length === 0) return
    generateTodayPlan({ silent: true })
  }, [
    ready,
    gistConfigured,
    lastSyncedAt,
    today,
    dailyPlanHistory,
    pools.length,
    generateTodayPlan,
  ])

  const setTaskDraft = (poolId: string, v: string) => {
    setNewTaskText((m) => ({ ...m, [poolId]: v }))
  }

  const toggleItemDone = (itemId: string, done: boolean) => {
    const plan = snapshot.dailyPlanHistory[today]
    if (!plan) return
    const at = nowIso()
    const items = plan.items.map((i) =>
      i.id === itemId ? { ...i, done, doneAt: at } : i,
    )
    const finishedNow =
      done &&
      items.length > 0 &&
      items.every((i) => i.done) &&
      !plan.items.every((i) => i.done)

    updateSnapshot((s) => {
      const target = s.dailyPlanHistory[today]
      if (!target) return s
      return {
        ...s,
        dailyPlanHistory: putPlanInHistory(s.dailyPlanHistory, {
          ...target,
          items: target.items.map((i) =>
            i.id === itemId ? { ...i, done, doneAt: at } : i,
          ),
        }),
      }
    })

    if (finishedNow) toast.success("All done for today.")
  }

  const movePool = (poolId: string, direction: "up" | "down") => {
    updateSnapshot((s) => {
      const visible = livePools(s.pools)
      const i = visible.findIndex((p) => p.id === poolId)
      if (i < 0) return s
      const j = i + (direction === "up" ? -1 : 1)
      if (j < 0 || j >= visible.length) return s

      const reordered = [...visible]
      reordered[i] = visible[j]!
      reordered[j] = visible[i]!
      const nextOrders = new Map(reordered.map((p, index) => [p.id, index]))
      const at = nowIso()

      return {
        ...s,
        pools: s.pools.map((p) => {
          const order = nextOrders.get(p.id)
          if (order === undefined || order === p.order) return p
          return { ...p, order, updatedAt: at }
        }),
      }
    })
  }

  const addPool = () => {
    const name = newPoolName.trim()
    if (!name) return
    const id = newId()
    const at = nowIso()
    updateSnapshot((s) => ({
      ...s,
      pools: [
        ...s.pools,
        { id, name, tasks: [], order: nextOrder(s.pools), updatedAt: at },
      ],
      shuffleConfig: {
        ...s.shuffleConfig,
        [id]: { include: true, count: 1, updatedAt: at },
      },
    }))
    setActivePoolTab(id)
    setNewPoolName("")
  }

  /** Deletes leave a tombstone so the removal reaches other devices. */
  const removePool = (id: string) => {
    const at = nowIso()
    updatePool(id, (p) => ({ ...p, updatedAt: at, deletedAt: at }))
  }

  const confirmRemovePool = () => {
    if (poolPendingDelete) removePool(poolPendingDelete)
    setPoolPendingDelete(null)
  }

  const addTask = (poolId: string) => {
    const text = (newTaskText[poolId] ?? "").trim()
    if (!text) return
    const priority = newTaskPriority[poolId] ?? 2
    updatePool(poolId, (p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        {
          id: newId(),
          text,
          priority,
          order: nextOrder(p.tasks),
          updatedAt: nowIso(),
        },
      ],
    }))
    setTaskDraft(poolId, "")
  }

  const setTaskPriority = (
    poolId: string,
    taskId: string,
    priority: TaskPriority,
  ) => {
    updateTask(poolId, taskId, (t) => ({
      ...t,
      priority,
      updatedAt: nowIso(),
    }))
  }

  const removeTask = (poolId: string, taskId: string) => {
    const at = nowIso()
    updateTask(poolId, taskId, (t) => ({
      ...t,
      updatedAt: at,
      deletedAt: at,
    }))
  }

  const updatePoolName = (poolId: string, name: string) => {
    updatePool(poolId, (p) => ({ ...p, name, updatedAt: nowIso() }))
  }

  const setInclude = (poolId: string, include: boolean) => {
    updateSnapshot((s) => ({
      ...s,
      shuffleConfig: {
        ...s.shuffleConfig,
        [poolId]: {
          count: s.shuffleConfig[poolId]?.count ?? 1,
          include,
          updatedAt: nowIso(),
        },
      },
    }))
  }

  const setCount = (poolId: string, count: number) => {
    const n = Math.max(
      0,
      Math.min(99, Math.floor(Number.isNaN(count) ? 0 : count)),
    )
    updateSnapshot((s) => ({
      ...s,
      shuffleConfig: {
        ...s.shuffleConfig,
        [poolId]: {
          include: s.shuffleConfig[poolId]?.include ?? true,
          count: n,
          updatedAt: nowIso(),
        },
      },
    }))
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
    const notes = taskEditorNotes.trim()
    updateTask(taskEditorCtx.poolId, taskEditorCtx.taskId, (t) => {
      const next: Task = { ...t, text: title, updatedAt: nowIso() }
      if (notes === "") delete next.notes
      else next.notes = taskEditorNotes
      return next
    })
    closeTaskEditor()
  }

  const copyDataToClipboard = async () => {
    try {
      const text = JSON.stringify(
        serializeSnapshot(snapshot, todayYmd()),
        null,
        2,
      )
      await navigator.clipboard.writeText(text)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      if (typeof window !== "undefined") {
        window.alert("Could not copy. Allow clipboard or use https / localhost.")
      }
    }
  }

  /** Imports merge rather than replace, so pasting an old backup cannot erase newer work. */
  const runImport = () => {
    setImportError("")
    try {
      const imported = parseAppSnapshotString(importText)
      absorbRemote(imported)
      setImportOpen(false)
      setImportText("")
      toast.success("Import merged into your data.")
    } catch (e) {
      setImportError(
        e instanceof Error
          ? e.message
          : "Invalid JSON or not a valid Random Daily export",
      )
    }
  }

  const createGist = async () => {
    if (!gistToken.trim()) {
      setGistFormMsg("Set a personal access token first")
      return
    }
    setGistFormMsg("")
    try {
      const body = buildGistJson(snapshotRef.current, todayYmd())
      const { gistId: createdId } = await gistCreate(gistToken.trim(), body)
      setGistId(createdId)
      saveGithubCreds({ token: gistToken.trim(), gistId: createdId })
      const { exportedAt } = JSON.parse(body) as { exportedAt: string }
      setLastExportAt(exportedAt)
      const print = snapshotFingerprint(snapshotRef.current)
      setSyncedFingerprint(print)
      seenRemoteFingerprintRef.current = print
      setLastSyncedAt(nowIso())
      setGistFormMsg("Secret Gist created. ID filled in — save is done.")
    } catch (e) {
      setGistFormMsg(e instanceof Error ? e.message : "Create Gist failed")
    }
  }

  /** Escape hatch: throw away local data and take the Gist verbatim. */
  const replaceFromGist = async () => {
    if (!gistToken || !gistId) return
    if (
      !window.confirm(
        "Discard the data in this browser and use the Gist copy instead?",
      )
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
      const remote = readGistFilePayload(d.content)
      const print = snapshotFingerprint(remote)
      snapshotRef.current = remote
      setSnapshot(remote)
      setSyncedFingerprint(print)
      seenRemoteFingerprintRef.current = print
      setLastSyncedAt(nowIso())
      setSyncError(null)
      setGistFormMsg("Replaced with the Gist copy")
    } catch (e) {
      setGistFormMsg(e instanceof Error ? e.message : "Could not read Gist")
    }
  }

  const syncStatus: SyncStatus = !gistConfigured
    ? "off"
    : syncing || gistQuery.isFetching
      ? "syncing"
      : syncError || gistQuery.isError
        ? "error"
        : "idle"

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
    syncStatus,
    syncError:
      syncError ??
      (gistQuery.isError
        ? gistQuery.error instanceof Error
          ? gistQuery.error.message
          : "Gist request failed"
        : null),
    lastSyncedAt,
    hasPendingChanges,
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
    generateTodayPlan: () => generateTodayPlan(),
    copyDataToClipboard,
    runImport,
    syncNow,
    createGist,
    replaceFromGist,
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

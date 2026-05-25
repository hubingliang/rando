"use client"

import {
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

import { PoolTaskRow } from "@/components/pool-task-row"
import { RandomDailyNav } from "@/components/random-daily-nav"
import { useRandomDaily } from "@/components/random-daily-provider"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { TaskPriorityRadios } from "@/components/task-priority-radios"
import { GIST_FILE_NAME, STORAGE_KEY, getLastExportAt } from "@/lib/snapshot"
import { cn } from "@/lib/utils"

export default function PoolsPage() {
  const {
    pools,
    newPoolName,
    setNewPoolName,
    newTaskText,
    newTaskPriority,
    setTaskDraft,
    setNewTaskPriority,
    poolPendingDelete,
    setPoolPendingDelete,
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
    addPool,
    movePool,
    confirmRemovePool,
    addTask,
    setTaskPriority,
    removeTask,
    updatePoolName,
    activePoolTab,
    setActivePoolTab,
    copyDataToClipboard,
    runImport,
    saveGistSettings,
    createGist,
    pullFromGist,
    openTaskEditor,
    closeTaskEditor,
    saveTaskEditor,
  } = useRandomDaily()

  const selectedPool =
    pools.length === 0
      ? null
      : (pools.find((x) => x.id === activePoolTab) ?? pools[0]!)
  const selectedPoolIndex =
    selectedPool != null ? pools.findIndex((x) => x.id === selectedPool.id) : -1

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <RandomDailyNav />

        <header className="space-y-2 border-b border-border pb-8">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Random Daily
          </p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Task pools
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage standing tasks per pool; use the pencil to edit title and
            notes.
            <span className="text-foreground"> Green</span> is archive (never
            drawn into today);
            <span className="text-foreground"> yellow</span> is random (subject
            to that pool&apos;s &quot;Random count&quot; on Daily plan);
            <span className="text-foreground"> red</span> is mandatory (all
            included when you generate today).{" "}
            <span className="text-foreground">Pool order</span> is the same on
            Daily plan (shuffle list) and in exports—reorder with the arrows
            next to the pool name. By default data stays on this device; GitHub
            Gist below syncs the full snapshot across browsers when you use the
            same token and gist id.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Pools</h2>
          <Card>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="new-pool">New pool</Label>
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
                  />
                </div>
                <Button type="button" variant="outline" onClick={addPool}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
          {pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pools yet. Create one above.
            </p>
          ) : selectedPool != null ? (
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
              <div
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 lg:hidden"
                role="tablist"
                aria-label="Pools"
              >
                {pools.map((pool) => (
                  <Button
                    key={pool.id}
                    type="button"
                    size="sm"
                    variant={
                      activePoolTab === pool.id ? "secondary" : "outline"
                    }
                    className="shrink-0 whitespace-nowrap"
                    aria-current={
                      activePoolTab === pool.id ? "true" : undefined
                    }
                    onClick={() => setActivePoolTab(pool.id)}
                  >
                    {pool.name || "Untitled"}
                  </Button>
                ))}
              </div>

              <nav
                aria-label="Pool list and order"
                className="hidden w-52 shrink-0 lg:block"
              >
                <p className="mb-2 text-xs font-medium tracking-tight text-muted-foreground">
                  Pool order
                </p>
                <ul className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-1">
                  {pools.map((pool, i) => (
                    <li key={pool.id} className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        onClick={() => setActivePoolTab(pool.id)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          "text-foreground",
                          activePoolTab === pool.id
                            ? "bg-secondary text-secondary-foreground hover:bg-secondary/85 hover:text-secondary-foreground"
                            : "hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded border text-[0.65rem] font-medium tabular-nums",
                            activePoolTab === pool.id
                              ? "border-secondary-foreground/25 bg-black/10 text-secondary-foreground dark:bg-white/15"
                              : "border-border bg-muted/60 text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium">
                          {pool.name || "Untitled"}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col justify-center gap-0.5 py-1 pr-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === 0}
                          aria-label={`Move pool up (${pool.name || "Untitled"})`}
                          onClick={(e) => {
                            e.stopPropagation()
                            movePool(pool.id, "up")
                          }}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === pools.length - 1}
                          aria-label={`Move pool down (${pool.name || "Untitled"})`}
                          onClick={(e) => {
                            e.stopPropagation()
                            movePool(pool.id, "down")
                          }}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </nav>

              <Card className="min-w-0 flex-1">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {selectedPool.name || "Untitled"}
                      </CardTitle>
                      <CardDescription>
                        Order {selectedPoolIndex + 1} of {pools.length} · same
                        order as Daily plan shuffle
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <div className="flex items-center rounded-md border border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-none rounded-l-md"
                          disabled={selectedPoolIndex <= 0}
                          aria-label="Move pool up"
                          onClick={() => movePool(selectedPool.id, "up")}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Separator
                          orientation="vertical"
                          className="h-7 shrink-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-none rounded-r-md"
                          disabled={selectedPoolIndex >= pools.length - 1}
                          aria-label="Move pool down"
                          onClick={() => movePool(selectedPool.id, "down")}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setPoolPendingDelete(selectedPool.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete pool
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-1.5">
                    <Label htmlFor={`pool-name-${selectedPool.id}`}>
                      Pool name
                    </Label>
                    <Input
                      id={`pool-name-${selectedPool.id}`}
                      value={selectedPool.name}
                      onChange={(e) =>
                        updatePoolName(selectedPool.id, e.target.value)
                      }
                    />
                  </div>

                  <Separator />

                  <p className="text-xs text-muted-foreground">
                    Colors: green = archive · yellow = random · red = mandatory.
                    Pencil edits title and notes.
                  </p>
                  {selectedPool.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tasks yet.
                    </p>
                  ) : (
                    <ul className="space-y-0 overflow-hidden rounded-lg border border-border bg-card">
                      {selectedPool.tasks.map((t) => (
                        <PoolTaskRow
                          key={t.id}
                          poolId={selectedPool.id}
                          task={t}
                          onEdit={() => openTaskEditor(selectedPool.id, t.id)}
                          onRemove={() => removeTask(selectedPool.id, t.id)}
                          onPriorityChange={(pr) =>
                            setTaskPriority(selectedPool.id, t.id, pr)
                          }
                        />
                      ))}
                    </ul>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor={`task-${selectedPool.id}`}>New task</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <Input
                          id={`task-${selectedPool.id}`}
                          value={newTaskText[selectedPool.id] ?? ""}
                          onChange={(e) =>
                            setTaskDraft(selectedPool.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addTask(selectedPool.id)
                            }
                          }}
                          placeholder="Type and add"
                        />
                      </div>
                      <div className="shrink-0">
                        <TaskPriorityRadios
                          name={`new-priority-${selectedPool.id}`}
                          value={newTaskPriority[selectedPool.id] ?? 2}
                          onChange={(pr) =>
                            setNewTaskPriority((m) => ({
                              ...m,
                              [selectedPool.id]: pr,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => addTask(selectedPool.id)}
                      >
                        <Plus className="size-4" />
                        Add task
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Gist sync</h2>
          <Card>
            <CardHeader>
              <CardTitle>GitHub Gist</CardTitle>
              <CardDescription>
                Token and Gist id are saved in this browser as you type (
                <span className="whitespace-nowrap">localStorage</span>). With
                the same token and gist id on each device, the app keeps one
                shared snapshot: pools, shuffle settings, today&apos;s plan, and
                plan history. Each save uploads{" "}
                <span className="whitespace-nowrap">{GIST_FILE_NAME}</span> (~2s
                debounced); when another device uploads a newer export, this
                browser replaces its in-browser copy to match the gist (last
                export wins). Uses our API route so the token never calls GitHub
                from the open web (CORS). &quot;Re-fetch Gist&quot; reloads from
                GitHub; &quot;Load from Gist&quot; applies the file after
                confirmation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gh-token">Personal access token</Label>
                  <Input
                    id="gh-token"
                    type="password"
                    autoComplete="off"
                    value={gistToken}
                    onChange={(e) => setGistToken(e.target.value)}
                    placeholder="ghp_… or github_pat_… (gist scope)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gist-id">Gist ID</Label>
                  <Input
                    id="gist-id"
                    value={gistId}
                    onChange={(e) => setGistId(e.target.value)}
                    placeholder="id from https://gist.github.com/you/<id>"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={saveGistSettings}
                  >
                    Re-fetch Gist
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void createGist()
                    }}
                    disabled={!gistToken.trim()}
                  >
                    <Cloud className="size-4" />
                    Create Gist
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void pullFromGist()
                    }}
                    disabled={!gistToken.trim() || !gistId.trim()}
                  >
                    Load from Gist
                  </Button>
                </div>
                {gistFormMsg ? (
                  <p className="text-xs text-muted-foreground">{gistFormMsg}</p>
                ) : null}
                {gistQuery.isError && gistQuery.error ? (
                  <p className="text-xs text-destructive">
                    {gistQuery.error instanceof Error
                      ? gistQuery.error.message
                      : "Gist request failed"}
                  </p>
                ) : null}
                {pushGistMutation.isError && pushGistMutation.error ? (
                  <p className="text-xs text-destructive">
                    Push:{" "}
                    {pushGistMutation.error instanceof Error
                      ? pushGistMutation.error.message
                      : "failed"}
                  </p>
                ) : null}
                {pushGistMutation.isPending ? (
                  <p className="text-xs text-muted-foreground">
                    Pushing to Gist…
                  </p>
                ) : null}
                <p className="text-[0.65rem] text-muted-foreground">
                  Last known export: {getLastExportAt() ?? "—"} ·{" "}
                  {gistQuery.isFetching
                    ? "fetching Gist…"
                    : "Gist in sync (when configured)"}
                </p>
              </div>
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
              <AlertDialogDescription>
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
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={confirmRemovePool}
              >
                Delete pool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Drawer
          open={taskEditorOpen}
          onOpenChange={(open) => {
            if (!open) closeTaskEditor()
          }}
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit task</DrawerTitle>
              <DrawerDescription>
                Title and notes stay in the pool. Today&apos;s draw copies them
                when you generate on Daily plan.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-title">Title</Label>
                <Input
                  id="task-editor-title"
                  value={taskEditorTitle}
                  onChange={(e) => setTaskEditorTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-notes">Notes</Label>
                <Textarea
                  id="task-editor-notes"
                  value={taskEditorNotes}
                  onChange={(e) => setTaskEditorNotes(e.target.value)}
                  placeholder="Optional"
                  rows={5}
                />
              </div>
            </div>
            <DrawerFooter>
              <Button type="button" variant="outline" onClick={closeTaskEditor}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!taskEditorTitle.trim()}
                onClick={saveTaskEditor}
              >
                Save
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import data</DialogTitle>
              <DialogDescription>
                Paste a JSON export (same format as &quot;Copy data&quot;). This
                replaces the current in-browser data for {STORAGE_KEY}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="import-payload">JSON</Label>
              <Textarea
                id="import-payload"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value)
                  setImportError("")
                }}
                rows={12}
                placeholder='{"pools":[...], "dailyPlan": null, "shuffleConfig": {}, "dailyPlanHistory": {}}'
                spellCheck={false}
                autoComplete="off"
                aria-invalid={importError ? true : undefined}
              />
              {importError ? (
                <p className="text-xs text-destructive">{importError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
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
              onClick={() => void copyDataToClipboard()}
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
            >
              <Upload className="size-4" />
              Import
            </Button>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            Persisted in localStorage · {STORAGE_KEY}
          </p>
        </footer>
      </div>
    </div>
  )
}

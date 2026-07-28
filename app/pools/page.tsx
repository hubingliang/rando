"use client"

import {
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { PoolTaskRow } from "@/components/pool-task-row"
import { ReminderSettingsCard } from "@/components/reminder-settings-card"
import { ShuffleConfigCard } from "@/components/shuffle-config-card"
import { TaskEditorModal } from "@/components/task-editor-modal"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { TaskPriorityRadios } from "@/components/task-priority-radios"
import { STORAGE_KEY, getLastExportAt } from "@/lib/snapshot"
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
    syncStatus,
    syncError,
    lastSyncedAt,
    hasPendingChanges,
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
    syncNow,
    createGist,
    replaceFromGist,
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
    <AppShell maxWidth="4xl">
      <section className="flex flex-col gap-3">
        <Card>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
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
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={addPool}
              >
                <Plus />
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
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
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
                  aria-current={activePoolTab === pool.id ? "true" : undefined}
                  onClick={() => setActivePoolTab(pool.id)}
                >
                  {pool.name || "Untitled"}
                </Button>
              ))}
            </div>

            <nav
              aria-label="Pool list and order"
              className="hidden w-full shrink-0 lg:block lg:w-52"
            >
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
                          : "hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded border text-[0.65rem] font-medium tabular-nums",
                          activePoolTab === pool.id
                            ? "border-secondary-foreground/25 bg-black/10 text-secondary-foreground dark:bg-white/15"
                            : "border-border bg-muted/60 text-muted-foreground",
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
                        <ChevronUp />
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
                        <ChevronDown />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </nav>

            <Card className="min-w-0 flex-1">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-base">
                    {selectedPool.name || "Untitled"}
                  </CardTitle>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <div className="flex items-center rounded-md border border-border lg:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-none rounded-l-md"
                        disabled={selectedPoolIndex <= 0}
                        aria-label="Move pool up"
                        onClick={() => movePool(selectedPool.id, "up")}
                      >
                        <ChevronUp />
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
                        <ChevronDown />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setPoolPendingDelete(selectedPool.id)}
                    >
                      <Trash2 />
                      Delete pool
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex flex-col gap-1.5">
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

                {selectedPool.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                ) : (
                  <ul className="overflow-hidden rounded-lg border border-border bg-card">
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`task-${selectedPool.id}`}>New task</Label>
                  <div className="flex flex-col gap-3">
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => addTask(selectedPool.id)}
                      >
                        <Plus />
                        Add task
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <ShuffleConfigCard />

      <ReminderSettingsCard />

      <section>
        <Card>
          <CardHeader>
            <CardTitle>GitHub Gist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gist-id">Gist ID</Label>
                <Input
                  id="gist-id"
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  placeholder="id from https://gist.github.com/you/<id>"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    void syncNow()
                  }}
                  disabled={
                    !gistToken.trim() ||
                    !gistId.trim() ||
                    syncStatus === "syncing"
                  }
                >
                  <RefreshCw
                    className={cn(syncStatus === "syncing" && "animate-spin")}
                  />
                  {syncStatus === "syncing" ? "Syncing…" : "Sync now"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    void createGist()
                  }}
                  disabled={!gistToken.trim()}
                >
                  <Cloud />
                  Create Gist
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    void replaceFromGist()
                  }}
                  disabled={!gistToken.trim() || !gistId.trim()}
                >
                  Replace local with Gist
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Syncing merges both sides, so edits made on another device are
                never overwritten. Use &quot;Replace local with Gist&quot; only
                to discard what is in this browser.
              </p>
              {gistFormMsg ? (
                <p className="text-xs text-muted-foreground">{gistFormMsg}</p>
              ) : null}
              {syncError ? (
                <p className="text-xs text-destructive">{syncError}</p>
              ) : null}
              <p className="text-[0.65rem] text-muted-foreground">
                {syncStatus === "off"
                  ? "Sync is off — data stays in this browser only."
                  : hasPendingChanges
                    ? "Local changes not yet on the Gist."
                    : "Everything on this device is on the Gist."}{" "}
                · Last sync: {lastSyncedAt ?? "—"} · Last push:{" "}
                {getLastExportAt() ?? "—"}
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

      <TaskEditorModal
        open={taskEditorOpen}
        onOpenChange={(open) => {
          if (!open) closeTaskEditor()
        }}
        title={taskEditorTitle}
        notes={taskEditorNotes}
        onTitleChange={setTaskEditorTitle}
        onNotesChange={setTaskEditorNotes}
        onSave={saveTaskEditor}
      />

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import data</DialogTitle>
            <DialogDescription>
              Paste a JSON export (same format as &quot;Copy data&quot;). It is
              merged into the current data for {STORAGE_KEY}, so nothing already
              in this browser is lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
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
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={runImport}
              disabled={!importText.trim()}
            >
              <Upload />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          onClick={() => {
            setImportError("")
            setImportText("")
            setImportOpen(true)
          }}
        >
          <Upload />
          Import
        </Button>
      </footer>
    </AppShell>
  )
}

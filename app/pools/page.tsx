"use client"

import { Cloud, Copy, Plus, Trash2, Upload } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { TaskPriorityRadios } from "@/components/task-priority-radios"
import {
  GIST_FILE_NAME,
  STORAGE_KEY,
  getLastExportAt,
} from "@/lib/snapshot"

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

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        <RandomDailyNav />

        <header className="space-y-2 border-b border-border pb-8">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Random Daily
          </p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Task pools
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Recurring backlog tasks by pool. Edit title and notes with the pencil.
            P1–P3 set draw weight. Changes persist in this browser and sync to Gist
            when configured.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">Pools</h2>
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
                          onChange={(e) =>
                            updatePoolName(p.id, e.target.value)
                          }
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
                      Solid green / yellow / red = P1–P3 (1–3 tickets in the bowl).
                      Use the pencil to edit title and notes.
                    </p>
                    {p.tasks.length === 0 ? (
                      <p className="font-mono text-sm text-muted-foreground">
                        No tasks yet.
                      </p>
                    ) : (
                      <ul className="space-y-0 border border-border">
                        {p.tasks.map((t) => (
                          <PoolTaskRow
                            key={t.id}
                            poolId={p.id}
                            task={t}
                            onEdit={() => openTaskEditor(p.id, t.id)}
                            onRemove={() => removeTask(p.id, t.id)}
                            onPriorityChange={(pr) =>
                              setTaskPriority(p.id, t.id, pr)
                            }
                          />
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
                Token and Gist id are saved in this browser as you type (
                <span className="whitespace-nowrap">localStorage</span>). Pushes a
                single file ({GIST_FILE_NAME}) to a secret gist, debounced ~2s after
                data changes. Uses our API route so the token never calls GitHub from
                the open web (CORS). &quot;Re-fetch Gist&quot; reloads the preview from
                GitHub.
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
                  Re-fetch Gist
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

        <Drawer
          open={taskEditorOpen}
          onOpenChange={(open) => {
            if (!open) closeTaskEditor()
          }}
        >
          <DrawerContent className="flex flex-col font-mono">
            <DrawerHeader>
              <DrawerTitle>Edit task</DrawerTitle>
              <DrawerDescription className="font-mono text-sm">
                Title and notes stay in the pool. Today&apos;s draw copies them when
                you generate on Daily plan.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-title" className="font-mono text-xs">
                  Title
                </Label>
                <Input
                  id="task-editor-title"
                  value={taskEditorTitle}
                  onChange={(e) => setTaskEditorTitle(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-notes" className="font-mono text-xs">
                  Notes
                </Label>
                <Textarea
                  id="task-editor-notes"
                  value={taskEditorNotes}
                  onChange={(e) => setTaskEditorNotes(e.target.value)}
                  placeholder="Optional"
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DrawerFooter className="gap-2 font-mono sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="font-mono"
                onClick={closeTaskEditor}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="font-mono"
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

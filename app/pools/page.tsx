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
import { Separator } from "@/components/ui/separator"
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
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Random Daily
          </p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Task pools
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage standing tasks per pool; use the pencil to edit title and notes.
            <span className="text-foreground"> Green</span>
            {" "}is archive (never drawn into today);
            <span className="text-foreground"> yellow</span>
            {" "}is random (subject to that pool&apos;s &quot;Random count&quot; on Daily plan);
            <span className="text-foreground"> red</span>
            {" "}is mandatory (all included when you generate today). Data stays on this
            device; optional Gist sync on this page.
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
          ) : (
            <Tabs
              value={activePoolTab}
              onValueChange={setActivePoolTab}
              className="w-full gap-3"
            >
              <TabsList className="h-auto min-h-9 w-full flex-wrap justify-start gap-1.5 p-1.5">
                {pools.map((p) => (
                  <TabsTrigger
                    key={p.id}
                    value={p.id}
                    className="shrink-0 px-3 py-2 text-xs"
                  >
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {pools.map((p) => (
                <TabsContent key={p.id} value={p.id}>
                  <div className="space-y-4 pt-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={`pool-name-${p.id}`}>Pool name</Label>
                        <Input
                          id={`pool-name-${p.id}`}
                          value={p.name}
                          onChange={(e) =>
                            updatePoolName(p.id, e.target.value)
                          }

                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setPoolPendingDelete(p.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete pool
                      </Button>
                    </div>

                    <Separator />

                    <p className="text-xs text-muted-foreground">
                      Colors: green = archive · yellow = random · red = mandatory. Pencil
                      edits title and notes.
                    </p>
                    {p.tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No tasks yet.
                      </p>
                    ) : (
                      <ul className="space-y-0 overflow-hidden rounded-lg border border-border bg-card">
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
                      <Label htmlFor={`task-${p.id}`}>New task</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="min-w-0 flex-1">
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
                        />
                        </div>
                        <div className="shrink-0">
                          <TaskPriorityRadios
                            name={`new-priority-${p.id}`}
                            value={newTaskPriority[p.id] ?? 2}
                            onChange={(pr) =>
                              setNewTaskPriority((m) => ({ ...m, [p.id]: pr }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => addTask(p.id)}
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
          <Card>
            <CardHeader>
              <CardTitle>GitHub Gist</CardTitle>
              <CardDescription>
                Token and Gist id are saved in this browser as you type (
                <span className="whitespace-nowrap">localStorage</span>). Pushes a
                single file ({GIST_FILE_NAME}) to a secret gist, debounced ~2s after
                data changes. Uses our API route so the token never calls GitHub from
                the open web (CORS). &quot;Re-fetch Gist&quot; reloads the preview from
                GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-token">
                  Personal access token
                </Label>
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
                <Label htmlFor="gist-id">
                  Gist ID
                </Label>
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
                <p className="text-xs text-muted-foreground">
                  {gistFormMsg}
                </p>
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
              <AlertDialogAction variant="destructive" onClick={confirmRemovePool}>
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
                Title and notes stay in the pool. Today&apos;s draw copies them when
                you generate on Daily plan.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-title">
                  Title
                </Label>
                <Input
                  id="task-editor-title"
                  value={taskEditorTitle}
                  onChange={(e) => setTaskEditorTitle(e.target.value)}

                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-editor-notes">
                  Notes
                </Label>
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
              <Button
                type="button"
                variant="outline"

                onClick={closeTaskEditor}
              >
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
              <Label htmlFor="import-payload">
                JSON
              </Label>
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

"use client"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { useIsDesktop } from "@/hooks/use-media-query"

function TaskEditorFields({
  title,
  notes,
  onTitleChange,
  onNotesChange,
}: {
  title: string
  notes: string
  onTitleChange: (value: string) => void
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-editor-title">Title</Label>
        <Input
          id="task-editor-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-editor-notes">Notes</Label>
        <Textarea
          id="task-editor-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Optional"
          rows={5}
        />
      </div>
    </div>
  )
}

function TaskEditorActions({
  canSave,
  onCancel,
  onSave,
  layout,
}: {
  canSave: boolean
  onCancel: () => void
  onSave: () => void
  layout: "dialog" | "drawer"
}) {
  if (layout === "dialog") {
    return (
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSave} onClick={onSave}>
          Save
        </Button>
      </DialogFooter>
    )
  }

  return (
    <DrawerFooter className="flex-row justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" disabled={!canSave} onClick={onSave}>
        Save
      </Button>
    </DrawerFooter>
  )
}

export function TaskEditorModal({
  open,
  onOpenChange,
  title,
  notes,
  onTitleChange,
  onNotesChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  notes: string
  onTitleChange: (value: string) => void
  onNotesChange: (value: string) => void
  onSave: () => void
}) {
  const isDesktop = useIsDesktop()
  const canSave = title.trim().length > 0

  const handleClose = () => onOpenChange(false)

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Title and notes stay in the pool. Today&apos;s draw copies them
              when you generate on Daily plan.
            </DialogDescription>
          </DialogHeader>
          <TaskEditorFields
            title={title}
            notes={notes}
            onTitleChange={onTitleChange}
            onNotesChange={onNotesChange}
          />
          <TaskEditorActions
            canSave={canSave}
            onCancel={handleClose}
            onSave={onSave}
            layout="dialog"
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit task</DrawerTitle>
          <DrawerDescription>
            Title and notes stay in the pool. Today&apos;s draw copies them when
            you generate on Daily plan.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          <TaskEditorFields
            title={title}
            notes={notes}
            onTitleChange={onTitleChange}
            onNotesChange={onNotesChange}
          />
        </div>
        <TaskEditorActions
          canSave={canSave}
          onCancel={handleClose}
          onSave={onSave}
          layout="drawer"
        />
      </DrawerContent>
    </Drawer>
  )
}

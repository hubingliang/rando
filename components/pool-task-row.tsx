"use client"

import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TaskPriorityRadios } from "@/components/task-priority-radios"
import type { Task, TaskPriority } from "@/lib/snapshot"

export function PoolTaskRow({
  poolId,
  task,
  onEdit,
  onRemove,
  onPriorityChange,
}: {
  poolId: string
  task: Task
  onEdit: () => void
  onRemove: () => void
  onPriorityChange: (p: TaskPriority) => void
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-border bg-card px-2 py-2 last:border-b-0 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm break-words">{task.text}</p>
          {task.notes?.trim() ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-mono text-xs leading-snug text-muted-foreground">
              {task.notes}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-start">
          <TaskPriorityRadios
            name={`priority-${poolId}-${task.id}`}
            value={task.priority}
            onChange={onPriorityChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 shrink-0"
            onClick={onEdit}
            aria-label="Edit task"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 shrink-0"
            onClick={onRemove}
            aria-label="Delete task"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  )
}

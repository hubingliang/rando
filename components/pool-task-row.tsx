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
    <li className="flex flex-col gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3 sm:px-2 sm:py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm break-words">{task.text}</p>
        {task.notes?.trim() ? (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-snug text-muted-foreground">
            {task.notes}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
        <TaskPriorityRadios
          name={`priority-${poolId}-${task.id}`}
          value={task.priority}
          onChange={onPriorityChange}
        />
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit task"
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Delete task"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  )
}

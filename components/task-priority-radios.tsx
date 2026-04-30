"use client"

import type { TaskPriority } from "@/lib/snapshot"
import { cn } from "@/lib/utils"

/** P1 green archive · P2 yellow random candidate · P3 red mandatory */
export const taskPriorityDotBgClass: Record<TaskPriority, string> = {
  1: "bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
  2: "bg-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
  3: "bg-red-500 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
}

const priorities: TaskPriority[] = [1, 2, 3]

const priorityAriaLabel: Record<TaskPriority, string> = {
  1: "Green: archive; excluded from daily generation",
  2: "Yellow: random candidate; drawn without replacement up to the pool’s random count on Daily plan",
  3: "Red: mandatory; all included when generating today’s plan",
}

export function TaskPriorityRadios({
  name,
  value,
  onChange,
  disabled,
  labelledBy,
  groupAriaLabel = "Task type: green archive, yellow random, red mandatory",
  className,
}: {
  name: string
  value: TaskPriority
  onChange: (p: TaskPriority) => void
  disabled?: boolean
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
              aria-label={priorityAriaLabel[pr]}
            />
            <span
              className={cn(
                "block shrink-0 rounded-full transition-all duration-150 ease-out",
                taskPriorityDotBgClass[pr],
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

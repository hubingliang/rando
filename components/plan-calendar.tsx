"use client"

import * as React from "react"
import { format } from "date-fns"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function parseYmd(ymd: string): Date | undefined {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!x) return undefined
  const y = Number(x[1])
  const m = Number(x[2])
  const d = Number(x[3])
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return undefined
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? undefined : dt
}

function formatYmd(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function PlanCalendar({
  today,
  selectedDate,
  onSelectDate,
  datesWithPlans,
  className,
}: {
  today: string
  selectedDate: string
  onSelectDate: (ymd: string) => void
  datesWithPlans: Set<string>
  className?: string
}) {
  const selected = React.useMemo(() => parseYmd(selectedDate), [selectedDate])
  const todayDate = React.useMemo(() => parseYmd(today), [today])

  const [month, setMonth] = React.useState<Date>(
    () => selected ?? todayDate ?? new Date(),
  )

  React.useEffect(() => {
    const d = parseYmd(selectedDate)
    if (d) setMonth(d)
  }, [selectedDate])

  const hasPlanMatcher = React.useCallback(
    (date: Date) => datesWithPlans.has(formatYmd(date)),
    [datesWithPlans],
  )

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Calendar
        mode="single"
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        onSelect={(d) => {
          if (d) onSelectDate(formatYmd(d))
        }}
        modifiers={{ hasPlan: hasPlanMatcher }}
        modifiersClassNames={{
          hasPlan:
            "[&_button]:relative [&_button]:after:pointer-events-none [&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:left-1/2 [&_button]:after:size-1 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-primary [&_button]:data-[selected-single=true]:after:bg-primary-foreground",
        }}
      />
      <div className="flex justify-center sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelectDate(today)}
        >
          Today
        </Button>
      </div>
    </div>
  )
}

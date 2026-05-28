"use client"

import * as React from "react"
import { format } from "date-fns"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const calendarWidthClass = "w-[calc(var(--cell-size)*7)]"

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
  const isTodaySelected = selectedDate === today

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
    <div
      className={cn(
        "mx-auto flex w-full flex-col items-center gap-3",
        "[--cell-size:--spacing(10)] sm:[--cell-size:--spacing(9)] lg:[--cell-size:--spacing(8)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          calendarWidthClass,
        )}
      >
        <p className="min-w-0 truncate text-sm font-medium tabular-nums">
          {selected ? format(selected, "EEE, MMM d") : selectedDate}
        </p>
        {!isTodaySelected ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs"
            onClick={() => onSelectDate(today)}
          >
            Today
          </Button>
        ) : (
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            Today
          </span>
        )}
      </div>

      <Calendar
        mode="single"
        navLayout="around"
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        onSelect={(d) => {
          if (d) onSelectDate(formatYmd(d))
        }}
        modifiers={{ hasPlan: hasPlanMatcher }}
        modifiersClassNames={{
          hasPlan:
            "[&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:left-1/2 [&_button]:after:size-1 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-primary [&_button]:data-[selected-single=true]:after:bg-primary-foreground",
        }}
        className={cn("p-0", calendarWidthClass)}
        classNames={{
          root: calendarWidthClass,
          months: calendarWidthClass,
          month: cn(
            "grid gap-y-2",
            calendarWidthClass,
            "grid-cols-[var(--cell-size)_minmax(0,1fr)_var(--cell-size)]",
          ),
          button_previous:
            "col-start-1 row-start-1 size-(--cell-size) shrink-0 p-0",
          month_caption:
            "col-start-2 row-start-1 flex h-(--cell-size) items-center justify-center",
          caption_label: "text-sm font-medium",
          button_next: "col-start-3 row-start-1 size-(--cell-size) shrink-0 p-0",
          month_grid: "col-span-3 row-start-2 w-full",
          weekdays: "flex w-full",
          weekday:
            "flex size-(--cell-size) shrink-0 items-center justify-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
          week: "mt-1 flex w-full",
          day: "size-(--cell-size) shrink-0 p-0",
          today:
            "rounded-(--cell-radius) bg-muted/70 font-medium ring-1 ring-primary/30",
        }}
      />

      <div
        className={cn(
          "flex items-center justify-center gap-1.5 text-[0.65rem] text-muted-foreground",
          calendarWidthClass,
        )}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <span>Days with a saved plan</span>
      </div>
    </div>
  )
}

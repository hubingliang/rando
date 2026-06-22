"use client"

import * as React from "react"
import { X } from "lucide-react"

import { useRandomDaily } from "@/components/random-daily-provider"
import { Button } from "@/components/ui/button"
import {
  dismissReminderBanner,
  isReminderBannerDismissed,
  loadReminderConfig,
  shouldShowReminderBanner,
} from "@/lib/reminder"

function ReminderBannerInner({
  today,
  dailyPlan,
  completedCount,
  totalCount,
}: {
  today: string
  dailyPlan: ReturnType<typeof useRandomDaily>["dailyPlan"]
  completedCount: number
  totalCount: number
}) {
  const [dismissed, setDismissed] = React.useState(() =>
    isReminderBannerDismissed(today),
  )

  const config = loadReminderConfig()

  const visible =
    !dismissed &&
    shouldShowReminderBanner({
      config,
      today,
      plan: dailyPlan,
      completedCount,
      totalCount,
    })

  if (!visible) return null

  return (
    <div
      role="status"
      className="border-b border-border bg-muted/50 px-4 py-2.5 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          Today&apos;s plan is ready — {completedCount}/{totalCount} done
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Dismiss reminder"
          onClick={() => {
            dismissReminderBanner(today)
            setDismissed(true)
          }}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

export function ReminderBanner() {
  const { today, dailyPlan, completedCount, totalCount } = useRandomDaily()

  return (
    <ReminderBannerInner
      key={today}
      today={today}
      dailyPlan={dailyPlan}
      completedCount={completedCount}
      totalCount={totalCount}
    />
  )
}

"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  configToTimeValue,
  formatReminderTime,
  getNextReminderDate,
  getNotificationPermission,
  loadReminderConfig,
  requestNotificationPermission,
  saveReminderConfig,
  supportsScheduledNotification,
  syncDailyReminderSchedule,
  timeValueToConfig,
  type ReminderConfig,
} from "@/lib/reminder"
import { useRandomDaily } from "@/components/random-daily-provider"

export function ReminderSettingsCard() {
  const { dailyPlan } = useRandomDaily()
  const [config, setConfig] = React.useState<ReminderConfig>(() =>
    loadReminderConfig(),
  )
  const [statusMsg, setStatusMsg] = React.useState("")
  const [permission, setPermission] = React.useState<
    NotificationPermission | "unsupported"
  >(() => getNotificationPermission())

  const persist = React.useCallback(
    async (next: ReminderConfig) => {
      setConfig(next)
      saveReminderConfig(next)
      if (next.enabled && getNotificationPermission() === "granted") {
        const result = await syncDailyReminderSchedule({
          plan: dailyPlan,
          config: next,
        })
        if (result.scheduled) {
          setStatusMsg(
            `Next reminder at ${formatReminderTime(next)}`,
          )
        } else if (!supportsScheduledNotification()) {
          setStatusMsg(
            "Scheduled notifications not supported in this browser — we'll remind you when you open the app.",
          )
        } else {
          setStatusMsg("Reminder saved.")
        }
      } else if (next.enabled) {
        setStatusMsg("Allow notifications to enable reminders.")
      } else {
        setStatusMsg("Daily reminder disabled.")
      }
    },
    [dailyPlan],
  )

  const handleAllowNotifications = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === "granted") {
      await persist({ ...config, enabled: true })
    } else {
      setStatusMsg("Notifications blocked. Enable them in browser settings.")
    }
  }

  const nextReminderLabel = config.enabled
    ? `Next reminder at ${formatReminderTime(config)} (${getNextReminderDate(config).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })})`
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily reminder</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="reminder-enabled" className="flex flex-col gap-0.5">
            <span>Enable daily reminder</span>
            <span className="text-xs font-normal text-muted-foreground">
              Local time · per device
            </span>
          </Label>
          <Switch
            id="reminder-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => {
              void persist({ ...config, enabled: checked })
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-time">Reminder time</Label>
          <Input
            id="reminder-time"
            type="time"
            value={configToTimeValue(config)}
            disabled={!config.enabled}
            onChange={(e) => {
              const next = timeValueToConfig(e.target.value, config)
              void persist(next)
            }}
          />
        </div>

        {permission !== "granted" && config.enabled ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void handleAllowNotifications()}
          >
            Allow notifications
          </Button>
        ) : null}

        {statusMsg ? (
          <p className="text-xs text-muted-foreground">{statusMsg}</p>
        ) : nextReminderLabel ? (
          <p className="text-xs text-muted-foreground">{nextReminderLabel}</p>
        ) : null}

        <p className="text-[0.65rem] text-muted-foreground">
          Works best in Chrome or Edge when installed as a PWA. Safari and iOS
          use an in-app banner when you open the app.
        </p>
      </CardContent>
    </Card>
  )
}

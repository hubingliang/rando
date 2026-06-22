import type { DailyPlan } from "@/lib/snapshot"

export const REMINDER_STORAGE_KEY = "random-daily-reminder-v1"
export const REMINDER_TAG = "daily-plan-reminder"

export type ReminderConfig = {
  enabled: boolean
  hour: number
  minute: number
}

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  hour: 8,
  minute: 0,
}

export function loadReminderConfig(): ReminderConfig {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG }
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const o = JSON.parse(raw) as Partial<ReminderConfig>
    const hour =
      typeof o.hour === "number" && o.hour >= 0 && o.hour <= 23
        ? Math.floor(o.hour)
        : DEFAULT_CONFIG.hour
    const minute =
      typeof o.minute === "number" && o.minute >= 0 && o.minute <= 59
        ? Math.floor(o.minute)
        : DEFAULT_CONFIG.minute
    return {
      enabled: Boolean(o.enabled),
      hour,
      minute,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveReminderConfig(config: ReminderConfig) {
  if (typeof window === "undefined") return
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(config))
}

export function configToTimeValue(config: ReminderConfig): string {
  return `${String(config.hour).padStart(2, "0")}:${String(config.minute).padStart(2, "0")}`
}

export function timeValueToConfig(
  value: string,
  prev: ReminderConfig,
): ReminderConfig {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return prev
  const hour = Math.min(23, Math.max(0, parseInt(m[1]!, 10)))
  const minute = Math.min(59, Math.max(0, parseInt(m[2]!, 10)))
  return { ...prev, hour, minute }
}

export function getNextReminderDate(
  config: ReminderConfig,
  now: Date = new Date(),
): Date {
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setHours(config.hour, config.minute, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

export function isPastReminderTimeToday(
  config: ReminderConfig,
  now: Date = new Date(),
): boolean {
  const target = new Date(now)
  target.setHours(config.hour, config.minute, 0, 0)
  return now.getTime() >= target.getTime()
}

export function formatReminderTime(config: ReminderConfig): string {
  const d = new Date()
  d.setHours(config.hour, config.minute, 0, 0)
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function supportsScheduledNotification(): boolean {
  if (typeof window === "undefined") return false
  return "TimestampTrigger" in window
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied"
  return Notification.requestPermission()
}

export function buildReminderBody(plan: DailyPlan | null): string {
  if (!plan?.items?.length) {
    return "Start your daily plan"
  }
  const poolIds = new Set(plan.items.map((i) => i.poolId))
  const poolCount = poolIds.size
  const total = plan.items.length
  if (poolCount > 0) {
    return `${total} tasks across ${poolCount} pool${poolCount === 1 ? "" : "s"}`
  }
  return `${total} tasks ready`
}

export type ScheduleReminderPayload = {
  type: "SCHEDULE_REMINDER"
  fireAt: number
  title: string
  body: string
  tag: string
}

export async function scheduleReminderSW(
  payload: Omit<ScheduleReminderPayload, "type" | "tag"> & { tag?: string },
): Promise<{ scheduled: boolean; reason?: string }> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { scheduled: false, reason: "no-service-worker" }
  }
  try {
    const registration = await navigator.serviceWorker.ready
    const worker =
      registration.active ??
      registration.waiting ??
      registration.installing
    if (!worker) {
      return { scheduled: false, reason: "no-active-worker" }
    }

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ scheduled: false, reason: "timeout" })
      }, 5000)

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== "SCHEDULE_RESULT") return
        clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener("message", onMessage)
        resolve({
          scheduled: Boolean(event.data.scheduled),
          reason:
            typeof event.data.reason === "string"
              ? event.data.reason
              : undefined,
        })
      }

      navigator.serviceWorker.addEventListener("message", onMessage)
      worker.postMessage({
        type: "SCHEDULE_REMINDER",
        fireAt: payload.fireAt,
        title: payload.title,
        body: payload.body,
        tag: payload.tag ?? REMINDER_TAG,
      } satisfies ScheduleReminderPayload)
    })
  } catch {
    return { scheduled: false, reason: "error" }
  }
}

export async function syncDailyReminderSchedule(opts: {
  plan: DailyPlan | null
  config?: ReminderConfig
}): Promise<{ scheduled: boolean; reason?: string }> {
  const config = opts.config ?? loadReminderConfig()
  if (!config.enabled) {
    return { scheduled: false, reason: "disabled" }
  }
  if (getNotificationPermission() !== "granted") {
    return { scheduled: false, reason: "permission" }
  }

  const fireAt = getNextReminderDate(config).getTime()
  return scheduleReminderSW({
    fireAt,
    title: "Today's plan is ready",
    body: buildReminderBody(opts.plan),
  })
}

export function reminderBannerDismissKey(today: string): string {
  return `reminder-banner-dismissed-${today}`
}

export function isReminderBannerDismissed(today: string): boolean {
  if (typeof sessionStorage === "undefined") return false
  return sessionStorage.getItem(reminderBannerDismissKey(today)) === "1"
}

export function dismissReminderBanner(today: string) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(reminderBannerDismissKey(today), "1")
}

export function shouldShowReminderBanner(opts: {
  config: ReminderConfig
  today: string
  plan: DailyPlan | null
  completedCount: number
  totalCount: number
  now?: Date
}): boolean {
  const { config, today, plan, completedCount, totalCount } = opts
  if (!config.enabled) return false
  if (isReminderBannerDismissed(today)) return false
  if (!plan || plan.date !== today || totalCount === 0) return false
  if (completedCount >= totalCount) return false
  if (!isPastReminderTimeToday(config, opts.now)) return false

  const permission = getNotificationPermission()
  const scheduledOk =
    permission === "granted" && supportsScheduledNotification()
  if (scheduledOk) return false

  return true
}

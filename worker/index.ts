/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

declare class TimestampTrigger {
  constructor(timestamp: number)
}

type ScheduledNotificationOptions = NotificationOptions & {
  showTrigger?: TimestampTrigger
}

const DEFAULT_TAG = "daily-plan-reminder"

type ScheduleMessage = {
  type: "SCHEDULE_REMINDER"
  fireAt: number
  title: string
  body: string
  tag?: string
}

function reply(
  event: ExtendableMessageEvent,
  payload: { scheduled: boolean; reason?: string },
) {
  const source = event.source
  if (source && "postMessage" in source) {
    source.postMessage({ type: "SCHEDULE_RESULT", ...payload })
  }
}

async function handleSchedule(
  data: ScheduleMessage,
  event: ExtendableMessageEvent,
) {
  const tag = data.tag ?? DEFAULT_TAG
  const existing = await self.registration.getNotifications({ tag })
  for (const n of existing) n.close()

  if (typeof TimestampTrigger === "undefined") {
    reply(event, { scheduled: false, reason: "unsupported" })
    return
  }

  try {
    const options: ScheduledNotificationOptions = {
      body: data.body,
      tag,
      icon: "/icons/icon-192.png",
      data: { url: "/" },
      showTrigger: new TimestampTrigger(data.fireAt),
    }
    await self.registration.showNotification(data.title, options)
    reply(event, { scheduled: true })
  } catch (e) {
    reply(event, {
      scheduled: false,
      reason: e instanceof Error ? e.message : "schedule-failed",
    })
  }
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as ScheduleMessage | undefined
  if (!data || data.type !== "SCHEDULE_REMINDER") return
  event.waitUntil(handleSchedule(data, event))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url =
    typeof event.notification.data?.url === "string"
      ? event.notification.data.url
      : "/"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      }),
  )
})

export {}

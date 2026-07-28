import assert from "node:assert/strict"
import { test } from "node:test"

import { mergeSnapshots, snapshotFingerprint } from "@/lib/merge"
import {
  emptySnapshot,
  livePools,
  type AppSnapshot,
  type DailyPlanItem,
  type Pool,
  type Task,
} from "@/lib/snapshot"

/**
 * Simulates the read-modify-write protocol the provider runs against the Gist,
 * so the two failures reported in the app can be reproduced as tests rather
 * than only reasoned about.
 */
class Gist {
  snapshot: AppSnapshot = emptySnapshot()
  writes = 0
}

class Device {
  local: AppSnapshot = emptySnapshot()
  gist: Gist

  constructor(gist: Gist) {
    this.gist = gist
  }

  edit(fn: (s: AppSnapshot) => AppSnapshot) {
    this.local = fn(this.local)
  }

  sync() {
    const remote = this.gist.snapshot
    const merged = mergeSnapshots(this.local, remote)
    this.local = merged
    if (snapshotFingerprint(merged) !== snapshotFingerprint(remote)) {
      this.gist.snapshot = merged
      this.gist.writes++
    }
  }
}

function task(id: string, updatedAt: string, over: Partial<Task> = {}): Task {
  return { id, text: id, priority: 2, order: 0, updatedAt, ...over }
}

function withPool(id: string, updatedAt: string, tasks: Task[]) {
  return (s: AppSnapshot): AppSnapshot => ({
    ...s,
    pools: [...s.pools, { id, name: id, tasks, order: s.pools.length, updatedAt }],
  })
}

function withTask(poolId: string, t: Task) {
  return (s: AppSnapshot): AppSnapshot => ({
    ...s,
    pools: s.pools.map((p) =>
      p.id === poolId ? { ...p, tasks: [...p.tasks, t] } : p,
    ),
  })
}

function withDraw(date: string, createdAt: string, taskIds: string[]) {
  return (s: AppSnapshot): AppSnapshot => ({
    ...s,
    dailyPlanHistory: {
      ...s.dailyPlanHistory,
      [date]: {
        date,
        createdAt,
        items: taskIds.map<DailyPlanItem>((taskId) => ({
          id: `${createdAt}-${taskId}`,
          poolId: "p1",
          taskId,
          text: taskId,
          done: false,
        })),
      },
    },
  })
}

function taskIds(pools: Pool[], poolId: string): string[] {
  return livePools(pools)
    .find((p) => p.id === poolId)!
    .tasks.map((t) => t.id)
}

test("pools maintained on web reach mobile even after mobile pushes first", () => {
  const gist = new Gist()
  const web = new Device(gist)
  const mobile = new Device(gist)

  web.edit(withPool("p1", "2026-02-01T08:00:00.000Z", [task("t1", "2026-02-01T08:00:00.000Z")]))
  web.sync()
  mobile.sync()

  // Web curates its pools.
  web.edit(withTask("p1", task("t2", "2026-02-01T10:00:00.000Z", { order: 1 })))
  web.edit(withPool("p2", "2026-02-01T10:00:00.000Z", [task("t3", "2026-02-01T10:00:00.000Z")]))
  web.sync()

  // Mobile has been sitting on the old data and now pushes something unrelated.
  mobile.edit(withTask("p1", task("t9", "2026-02-01T10:20:00.000Z", { order: 5 })))
  mobile.sync()
  web.sync()

  assert.deepEqual(taskIds(mobile.local.pools, "p1"), ["t1", "t2", "t9"])
  assert.ok(livePools(mobile.local.pools).some((p) => p.id === "p2"))
  assert.equal(
    snapshotFingerprint(web.local),
    snapshotFingerprint(mobile.local),
  )
})

test("two offline draws for one day converge to a single plan", () => {
  const gist = new Gist()
  const web = new Device(gist)
  const mobile = new Device(gist)

  web.edit(withPool("p1", "2026-02-01T00:00:00.000Z", [task("t1", "2026-02-01T00:00:00.000Z")]))
  web.sync()
  mobile.sync()

  // Both devices draw while unable to see each other.
  web.edit(withDraw("2026-02-02", "2026-02-02T06:00:00.000Z", ["t1", "t2"]))
  mobile.edit(withDraw("2026-02-02", "2026-02-02T07:00:00.000Z", ["t3", "t4"]))

  mobile.sync()
  web.sync()
  mobile.sync()

  const webDay = web.local.dailyPlanHistory["2026-02-02"]!
  const mobileDay = mobile.local.dailyPlanHistory["2026-02-02"]!
  assert.deepEqual(webDay.items.map((i) => i.taskId), ["t1", "t2"])
  assert.deepEqual(mobileDay.items.map((i) => i.taskId), ["t1", "t2"])
  assert.equal(
    snapshotFingerprint(web.local),
    snapshotFingerprint(mobile.local),
  )
})

test("syncing an unchanged device writes nothing", () => {
  const gist = new Gist()
  const web = new Device(gist)

  web.edit(withPool("p1", "2026-02-01T00:00:00.000Z", [task("t1", "2026-02-01T00:00:00.000Z")]))
  web.sync()
  const writesAfterFirstPush = gist.writes

  web.sync()
  web.sync()
  assert.equal(gist.writes, writesAfterFirstPush)
})

test("pulling does not bounce a write back to the Gist", () => {
  const gist = new Gist()
  const web = new Device(gist)
  const mobile = new Device(gist)

  web.edit(withPool("p1", "2026-02-01T00:00:00.000Z", [task("t1", "2026-02-01T00:00:00.000Z")]))
  web.sync()
  const writes = gist.writes

  // A device that only receives data must never trigger a push of its own.
  mobile.sync()
  mobile.sync()
  assert.equal(gist.writes, writes)
})

test("devices converge regardless of who syncs first", () => {
  const build = (order: "web-first" | "mobile-first") => {
    const gist = new Gist()
    const web = new Device(gist)
    const mobile = new Device(gist)

    web.edit(withPool("p1", "2026-02-01T00:00:00.000Z", [task("t1", "2026-02-01T00:00:00.000Z")]))
    web.sync()
    mobile.sync()

    web.edit(withTask("p1", task("t2", "2026-02-01T09:00:00.000Z", { order: 1 })))
    mobile.edit(withTask("p1", task("t3", "2026-02-01T09:30:00.000Z", { order: 2 })))

    if (order === "web-first") {
      web.sync()
      mobile.sync()
      web.sync()
    } else {
      mobile.sync()
      web.sync()
      mobile.sync()
    }
    return snapshotFingerprint(gist.snapshot)
  }

  assert.equal(build("web-first"), build("mobile-first"))
})

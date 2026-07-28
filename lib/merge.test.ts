import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canonicalJson,
  mergeSnapshots,
  pruneTombstones,
  snapshotFingerprint,
} from "@/lib/merge"
import {
  emptySnapshot,
  type AppSnapshot,
  type DailyPlan,
  type DailyPlanItem,
  type Pool,
  type Task,
} from "@/lib/snapshot"

const T0 = "2026-01-01T00:00:00.000Z"

function task(id: string, over: Partial<Task> = {}): Task {
  return { id, text: id, priority: 2, order: 0, updatedAt: T0, ...over }
}

function pool(id: string, tasks: Task[], over: Partial<Pool> = {}): Pool {
  return { id, name: id, tasks, order: 0, updatedAt: T0, ...over }
}

function item(taskId: string, over: Partial<DailyPlanItem> = {}): DailyPlanItem {
  return {
    id: `i-${taskId}`,
    poolId: "p",
    taskId,
    text: taskId,
    done: false,
    ...over,
  }
}

function plan(
  date: string,
  items: DailyPlanItem[],
  createdAt: string,
): DailyPlan {
  return { date, items, createdAt }
}

function snap(over: Partial<AppSnapshot> = {}): AppSnapshot {
  return { ...emptySnapshot(), ...over }
}

function same(a: AppSnapshot, b: AppSnapshot): boolean {
  return snapshotFingerprint(a) === snapshotFingerprint(b)
}

test("merge is commutative", () => {
  const web = snap({
    pools: [
      pool("p1", [task("t1"), task("t2", { order: 1, updatedAt: "2026-02-01T10:00:00.000Z" })]),
      pool("p2", [], { order: 1 }),
    ],
    shuffleConfig: { p1: { include: true, count: 3, updatedAt: "2026-02-01T10:00:00.000Z" } },
    dailyPlanHistory: {
      "2026-02-01": plan("2026-02-01", [item("t1")], "2026-02-01T08:00:00.000Z"),
    },
  })
  const mobile = snap({
    pools: [
      pool("p1", [task("t1", { text: "renamed", updatedAt: "2026-02-01T11:00:00.000Z" })]),
      pool("p3", [task("t9")], { order: 2 }),
    ],
    shuffleConfig: { p1: { include: false, count: 1, updatedAt: "2026-02-01T09:00:00.000Z" } },
    dailyPlanHistory: {
      "2026-02-01": plan("2026-02-01", [item("t9")], "2026-02-01T09:00:00.000Z"),
    },
  })

  assert.ok(same(mergeSnapshots(web, mobile), mergeSnapshots(mobile, web)))
})

test("merge is idempotent", () => {
  const s = snap({
    pools: [pool("p1", [task("t1"), task("t2", { order: 1 })])],
    dailyPlanHistory: {
      "2026-02-01": plan("2026-02-01", [item("t1", { done: true, doneAt: T0 })], T0),
    },
  })
  const once = mergeSnapshots(s, s)
  assert.ok(same(once, s))
  assert.ok(same(mergeSnapshots(once, once), once))
})

test("pools edited on one device survive a stale push from the other", () => {
  // The reported failure: web adds a pool and a task, mobile pushes later from
  // data that predates both. Neither side may disappear.
  const web = snap({
    pools: [
      pool("p1", [task("t1"), task("t2", { order: 1, updatedAt: "2026-02-01T10:00:00.000Z" })]),
      pool("p-new", [task("t3")], { order: 1, updatedAt: "2026-02-01T10:00:00.000Z" }),
    ],
  })
  const mobileStale = snap({ pools: [pool("p1", [task("t1")])] })

  const merged = mergeSnapshots(mobileStale, web)
  const p1 = merged.pools.find((p) => p.id === "p1")!
  assert.deepEqual(
    p1.tasks.map((t) => t.id),
    ["t1", "t2"],
  )
  assert.ok(merged.pools.some((p) => p.id === "p-new"))
})

test("two independent draws for the same day collapse into the earliest one", () => {
  const web = snap({
    dailyPlanHistory: {
      "2026-02-01": plan(
        "2026-02-01",
        [item("t1"), item("t2")],
        "2026-02-01T06:00:00.000Z",
      ),
    },
  })
  const mobile = snap({
    dailyPlanHistory: {
      "2026-02-01": plan(
        "2026-02-01",
        [item("t3"), item("t4")],
        "2026-02-01T07:30:00.000Z",
      ),
    },
  })

  for (const merged of [
    mergeSnapshots(web, mobile),
    mergeSnapshots(mobile, web),
  ]) {
    const day = merged.dailyPlanHistory["2026-02-01"]!
    assert.equal(day.createdAt, "2026-02-01T06:00:00.000Z")
    assert.deepEqual(
      day.items.map((i) => i.taskId),
      ["t1", "t2"],
    )
  }
})

test("check marks made on either device are kept", () => {
  const base = plan(
    "2026-02-01",
    [item("t1"), item("t2")],
    "2026-02-01T06:00:00.000Z",
  )
  const web = snap({ dailyPlanHistory: { "2026-02-01": base } })
  const mobile = snap({
    dailyPlanHistory: {
      "2026-02-01": {
        ...base,
        items: [
          item("t1", { done: true, doneAt: "2026-02-01T12:00:00.000Z" }),
          item("t2"),
        ],
      },
    },
  })

  const merged = mergeSnapshots(web, mobile)
  const day = merged.dailyPlanHistory["2026-02-01"]!
  assert.equal(day.items.find((i) => i.taskId === "t1")!.done, true)
  assert.equal(day.items.find((i) => i.taskId === "t2")!.done, false)
})

test("unchecking later wins over an earlier check", () => {
  const base = plan("2026-02-01", [item("t1")], "2026-02-01T06:00:00.000Z")
  const checked = snap({
    dailyPlanHistory: {
      "2026-02-01": {
        ...base,
        items: [item("t1", { done: true, doneAt: "2026-02-01T09:00:00.000Z" })],
      },
    },
  })
  const unchecked = snap({
    dailyPlanHistory: {
      "2026-02-01": {
        ...base,
        items: [item("t1", { done: false, doneAt: "2026-02-01T10:00:00.000Z" })],
      },
    },
  })

  const merged = mergeSnapshots(checked, unchecked)
  assert.equal(merged.dailyPlanHistory["2026-02-01"]!.items[0]!.done, false)
})

test("a delete propagates instead of being resurrected by the other device", () => {
  const withTask = snap({ pools: [pool("p1", [task("t1"), task("t2", { order: 1 })])] })
  const deleted = snap({
    pools: [
      pool("p1", [
        task("t1"),
        task("t2", {
          order: 1,
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: "2026-03-01T00:00:00.000Z",
        }),
      ]),
    ],
  })

  const merged = mergeSnapshots(withTask, deleted)
  const t2 = merged.pools[0]!.tasks.find((t) => t.id === "t2")!
  assert.ok(t2.deletedAt != null)
})

test("an edit made after a delete brings the record back", () => {
  const deleted = snap({
    pools: [
      pool("p1", [
        task("t1", {
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: "2026-03-01T00:00:00.000Z",
        }),
      ]),
    ],
  })
  const edited = snap({
    pools: [pool("p1", [task("t1", { text: "kept", updatedAt: "2026-03-02T00:00:00.000Z" })])],
  })

  const merged = mergeSnapshots(deleted, edited)
  const t1 = merged.pools[0]!.tasks[0]!
  assert.equal(t1.deletedAt, undefined)
  assert.equal(t1.text, "kept")
})

test("expired tombstones are pruned, recent ones are not", () => {
  const now = new Date("2026-06-01T00:00:00.000Z")
  const s = snap({
    pools: [
      pool("p1", [
        task("old", { deletedAt: "2025-01-01T00:00:00.000Z" }),
        task("recent", { order: 1, deletedAt: "2026-05-30T00:00:00.000Z" }),
      ]),
    ],
  })

  const pruned = pruneTombstones(s, now)
  assert.deepEqual(
    pruned.pools[0]!.tasks.map((t) => t.id),
    ["recent"],
  )
})

test("fingerprint ignores key order but not content", () => {
  const a = snap({ pools: [pool("p1", [task("t1")])] })
  const b = snap({ pools: [pool("p1", [{ ...task("t1") }])] })
  assert.equal(snapshotFingerprint(a), snapshotFingerprint(b))

  const c = snap({ pools: [pool("p1", [task("t1", { text: "changed" })])] })
  assert.notEqual(snapshotFingerprint(a), snapshotFingerprint(c))
})

test("canonicalJson sorts keys and drops undefined", () => {
  assert.equal(canonicalJson({ b: 1, a: 2, c: undefined }), '{"a":2,"b":1}')
})

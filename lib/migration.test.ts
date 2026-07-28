import assert from "node:assert/strict"
import { test } from "node:test"

import { mergeSnapshots, snapshotFingerprint } from "@/lib/merge"
import {
  LEGACY_TS,
  assertValidSnapshot,
  livePools,
  parseAppSnapshotString,
  serializeSnapshot,
} from "@/lib/snapshot"

/** Exactly the shape the app wrote before merge-based sync existed. */
const legacyExport = {
  pools: [
    {
      id: "p1",
      name: "Deep Work",
      tasks: [
        { id: "t1", text: "Write", priority: 2 },
        { id: "t2", text: "Review", priority: 3, notes: "before standup" },
      ],
    },
    { id: "p2", name: "Health", tasks: [{ id: "t3", text: "Walk", priority: 2 }] },
  ],
  dailyPlan: {
    date: "2026-07-28",
    items: [
      {
        id: "i1",
        poolId: "p1",
        taskId: "t2",
        text: "Review",
        priority: 3,
        done: true,
      },
    ],
  },
  shuffleConfig: {
    p1: { include: true, count: 2 },
    p2: { include: false, count: 1 },
  },
  dailyPlanHistory: {
    "2026-07-27": {
      date: "2026-07-27",
      items: [
        { id: "i0", poolId: "p1", taskId: "t1", text: "Write", done: false },
      ],
    },
  },
}

test("a legacy export migrates without losing anything", () => {
  const s = assertValidSnapshot(legacyExport)

  const pools = livePools(s.pools)
  assert.deepEqual(
    pools.map((p) => p.id),
    ["p1", "p2"],
  )
  assert.deepEqual(
    pools[0]!.tasks.map((t) => t.id),
    ["t1", "t2"],
  )
  assert.equal(pools[0]!.tasks[1]!.notes, "before standup")
  assert.equal(pools[0]!.tasks[1]!.priority, 3)
  assert.equal(s.shuffleConfig.p1!.count, 2)
  assert.equal(s.shuffleConfig.p2!.include, false)

  // Migrated records must not out-rank a real edit from any device.
  assert.equal(pools[0]!.updatedAt, LEGACY_TS)
  assert.equal(pools[0]!.tasks[0]!.updatedAt, LEGACY_TS)

  // The standalone dailyPlan becomes just another day in the history.
  assert.ok(s.dailyPlanHistory["2026-07-28"])
  assert.equal(s.dailyPlanHistory["2026-07-28"]!.items[0]!.done, true)
  assert.ok(s.dailyPlanHistory["2026-07-27"])
})

test("a storage round trip does not look like a change", () => {
  // If it did, every app launch would push to the Gist for no reason.
  const s = assertValidSnapshot(legacyExport)
  const text = JSON.stringify(serializeSnapshot(s, "2026-07-28"))
  const back = parseAppSnapshotString(text)
  assert.equal(snapshotFingerprint(back), snapshotFingerprint(s))
})

test("two devices holding the same legacy data merge to a no-op", () => {
  // Otherwise the first sync after the upgrade would ping-pong writes forever.
  const web = assertValidSnapshot(legacyExport)
  const mobile = assertValidSnapshot(legacyExport)
  const merged = mergeSnapshots(web, mobile)
  assert.equal(snapshotFingerprint(merged), snapshotFingerprint(web))
})

test("legacy data on one device merges with newer edits on the other", () => {
  const legacy = assertValidSnapshot(legacyExport)
  const edited = assertValidSnapshot({
    ...legacyExport,
    pools: [
      {
        ...legacyExport.pools[0],
        name: "Focus",
        updatedAt: "2026-07-28T09:00:00.000Z",
        tasks: [
          ...legacyExport.pools[0]!.tasks,
          {
            id: "t4",
            text: "Read",
            priority: 2,
            updatedAt: "2026-07-28T09:00:00.000Z",
          },
        ],
      },
      legacyExport.pools[1],
    ],
  })

  const merged = mergeSnapshots(legacy, edited)
  const p1 = livePools(merged.pools).find((p) => p.id === "p1")!
  assert.equal(p1.name, "Focus")
  assert.deepEqual(
    p1.tasks.map((t) => t.id),
    ["t1", "t2", "t4"],
  )
})

test("unknown JSON is rejected rather than wiping data", () => {
  assert.throws(() => assertValidSnapshot({ hello: "world" }))
  assert.throws(() => assertValidSnapshot(null))
})

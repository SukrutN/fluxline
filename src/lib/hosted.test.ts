import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BELT_MMS,
  BUCKET_MS,
  BUCKETS,
  ENGINE,
  LATENCY_KIND,
  LAW,
  MAX_MS,
  MEAN_MS,
  MIN_MS,
  PIECES,
  REGISTERS,
  RELEASES,
  SAMPLES,
  SCAN_MS,
  VERDICTS,
  WALKTHROUGH,
  WATCHDOG_S,
  asSeconds,
  bucketTotal,
} from "./hosted.ts"

/**
 * The site's half of the characterization contract. Every number here is
 * hard-coded against fluxline-plc's committed bench figures
 * (sim/figures/hostblock.json) — if the bench's reading moves, this test
 * holds the page still until the port is deliberately updated.
 */
describe("hosted line figures", () => {
  it("carries the seeded shift's meta", () => {
    assert.equal(ENGINE, "sim/hostblock.py — offline reference model of the ST host block")
    assert.equal(SCAN_MS, 100)
    assert.equal(BELT_MMS, 120)
    assert.equal(PIECES, 20)
    assert.equal(RELEASES, 12)
    assert.equal(WATCHDOG_S, 5)
    assert.match(LAW, /165 mm → L03/)
  })

  it("buckets the release→divert latency, honest about the empty band", () => {
    assert.equal(LATENCY_KIND, "release-to-divert")
    assert.equal(BUCKET_MS, 1000)
    assert.equal(BUCKETS.length, 5)
    assert.deepEqual(
      BUCKETS.map((b) => b.count),
      [1, 3, 4, 0, 4],
    )
    assert.deepEqual(
      BUCKETS.map((b) => b.fromMs),
      [4000, 5000, 6000, 7000, 8000],
    )
    assert.equal(BUCKETS[3].label, "7–8 s")
    assert.equal(bucketTotal(BUCKETS), RELEASES)
  })

  it("reports min, mean and max exactly as the bench measured them", () => {
    assert.equal(MIN_MS, 4466.7)
    assert.equal(MAX_MS, 8800.0)
    assert.equal(MEAN_MS, 6808.3)
  })

  it("carries one sample per release, the veto named", () => {
    assert.equal(SAMPLES.length, 12)
    const accepted = SAMPLES.filter((s) => s.state === "accepted")
    const vetoed = SAMPLES.filter((s) => s.state === "vetoed")
    assert.equal(accepted.length, 11)
    assert.equal(vetoed.length, 1)
    const veto = vetoed[0]
    assert.equal(veto.id, "box-08")
    assert.equal(veto.ask, 1)
    assert.equal(veto.gate, 3, "the law sends the tall piece to L03 anyway")
    for (const s of SAMPLES) {
      assert.ok(s.releaseToVerdictMs > 0)
      assert.ok(s.verdictToDivertMs > 0)
      assert.equal(
        s.releaseToDivertMs,
        Math.round((s.releaseToVerdictMs + s.verdictToDivertMs) * 10) / 10,
      )
      if (s.state === "accepted") assert.equal(s.gate, s.ask)
    }
    assert.equal(
      Math.min(...SAMPLES.map((s) => s.releaseToDivertMs)),
      MIN_MS,
    )
    assert.equal(
      Math.max(...SAMPLES.map((s) => s.releaseToDivertMs)),
      MAX_MS,
    )
  })

  it("counts the verdicts", () => {
    assert.deepEqual(VERDICTS, { accepted: 11, vetoed: 1 })
  })

  it("carries the host block's wire words at shift end", () => {
    assert.equal(REGISTERS.length, 15)
    const byName = new Map(REGISTERS.map((r) => [r.name, r]))
    assert.equal(byName.get("STATE")?.value, 2)
    assert.equal(byName.get("ALARM")?.value, 0)
    assert.equal(byName.get("HOST_WATCHDOG")?.value, 5)
    assert.equal(byName.get("HOST_WATCHDOG")?.addr, "%QW28")
    assert.equal(byName.get("HB_HOST")?.value, 643)
    assert.equal(byName.get("CMD_SEQ")?.value, 12)
    assert.equal(byName.get("CMD_GATE")?.value, 2)
    assert.equal(byName.get("ACK_SEQ")?.value, 12)
    assert.equal(byName.get("ACK_STATE")?.value, 1)
    assert.equal(byName.get("ACK_GATE")?.value, 2)
    assert.equal(byName.get("ACK_CLASS")?.value, 2)
    assert.equal(byName.get("HOST_STATE")?.value, 10)
    assert.equal(byName.get("IN_FLIGHT")?.value, 0)
    assert.equal(byName.get("HOST_ACKS")?.value, 12)
    for (const r of REGISTERS) {
      assert.ok(["host", "line"].includes(r.writer))
      assert.ok(r.note.length > 0)
    }
  })

  it("tells the veto and the honored ask in scan order", () => {
    assert.equal(WALKTHROUGH.length, 10)
    const ts = WALKTHROUGH.map((w) => w.tS)
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b))
    const veto = WALKTHROUGH.find((w) => w.what.includes("VETOED"))
    assert.ok(veto, "the veto row is present")
    assert.equal(veto.tS, 41.5)
    assert.ok(veto.what.includes("the piece takes L03"))
    const last = WALKTHROUGH[WALKTHROUGH.length - 1]
    assert.equal(last.tS, 61.7)
    assert.match(last.what, /gate L02 fires/)
    for (const w of WALKTHROUGH) assert.ok(["host", "line", "belt"].includes(w.who))
  })

  it("formats latencies for the page", () => {
    assert.equal(asSeconds(4466.7), "4.47 s")
    assert.equal(asSeconds(8800.0), "8.80 s")
  })
})

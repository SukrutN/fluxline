/**
 * The hosted line's canonical reading, ported verbatim from the seeded
 * bench in `fluxline-plc` (`sim/hostbench.py`, committed to
 * `sim/figures/hostblock.json`). Every number here is asserted by
 * `hosted.test.ts`, which is the site's half of the characterization
 * contract: if the bench's figures move, these do not move until the
 * bench test says so. The site never invents figures.
 *
 * The bench drives the scan-exact reference model of the ST host block
 * through a scripted shift — 20 pieces, 12 host releases, one veto —
 * and reports what a hosted shift pays: release→verdict measured by the
 * model, verdict→divert as the deterministic ride from the load cell to
 * the gate at belt speed.
 */

export type VerdictState = "accepted" | "vetoed" | "refused" | "expired"
export type Writer = "host" | "line"
export type Who = "host" | "line" | "belt"

export type Bucket = {
  fromMs: number
  label: string
  count: number
}

export type Sample = {
  id: string
  kind: "standard" | "metal" | "tall"
  state: VerdictState
  ask: number
  gate: number
  releaseToVerdictMs: number
  verdictToDivertMs: number
  releaseToDivertMs: number
}

export type RegisterRow = {
  addr: string
  name: string
  writer: Writer
  value: number
  note: string
}

export type WalkRow = {
  tS: number
  who: Who
  what: string
}

/** The shift the bench scripted (meta in the JSON). */
export const ENGINE = "sim/hostblock.py — offline reference model of the ST host block"
export const SCAN_MS = 100
export const BELT_MMS = 120
export const PIECES = 20
export const RELEASES = 12
export const WATCHDOG_S = 5
export const LAW =
  "height ≥ 165 mm → L03 · metal → L02 · weight outside 2–12 kg → RJ · else L01"
export const LATENCY_NOTE =
  "release→verdict is measured by the host block model (command write to the load cell's word, scan exact); verdict→divert is the deterministic ride from the load cell to the gate at belt speed"

/** Release→divert latency, bucketed at 1000 ms across the seeded shift. */
export const LATENCY_KIND = "release-to-divert"
export const BUCKET_MS = 1000
export const BUCKETS: Bucket[] = [
  { fromMs: 4000, label: "4–5 s", count: 1 },
  { fromMs: 5000, label: "5–6 s", count: 3 },
  { fromMs: 6000, label: "6–7 s", count: 4 },
  { fromMs: 7000, label: "7–8 s", count: 0 },
  { fromMs: 8000, label: "8–9 s", count: 4 },
]
export const MIN_MS = 4466.7
export const MAX_MS = 8800.0
export const MEAN_MS = 6808.3

/** One row per released piece, in command order. The veto is box-08. */
export const SAMPLES: Sample[] = [
  { id: "box-01", kind: "standard", state: "accepted", ask: 1, gate: 1, releaseToVerdictMs: 1600.0, verdictToDivertMs: 4166.7, releaseToDivertMs: 5766.7 },
  { id: "box-02", kind: "metal", state: "accepted", ask: 2, gate: 2, releaseToVerdictMs: 700.0, verdictToDivertMs: 5833.3, releaseToDivertMs: 6533.3 },
  { id: "box-03", kind: "tall", state: "accepted", ask: 3, gate: 3, releaseToVerdictMs: 1200.0, verdictToDivertMs: 7500.0, releaseToDivertMs: 8700.0 },
  { id: "box-04", kind: "metal", state: "accepted", ask: 2, gate: 2, releaseToVerdictMs: 400.0, verdictToDivertMs: 5833.3, releaseToDivertMs: 6233.3 },
  { id: "box-05", kind: "standard", state: "accepted", ask: 1, gate: 1, releaseToVerdictMs: 1500.0, verdictToDivertMs: 4166.7, releaseToDivertMs: 5666.7 },
  { id: "box-06", kind: "tall", state: "accepted", ask: 3, gate: 3, releaseToVerdictMs: 900.0, verdictToDivertMs: 7500.0, releaseToDivertMs: 8400.0 },
  { id: "box-07", kind: "standard", state: "accepted", ask: 1, gate: 1, releaseToVerdictMs: 300.0, verdictToDivertMs: 4166.7, releaseToDivertMs: 4466.7 },
  { id: "box-08", kind: "tall", state: "vetoed", ask: 1, gate: 3, releaseToVerdictMs: 1300.0, verdictToDivertMs: 7500.0, releaseToDivertMs: 8800.0 },
  { id: "box-09", kind: "metal", state: "accepted", ask: 2, gate: 2, releaseToVerdictMs: 600.0, verdictToDivertMs: 5833.3, releaseToDivertMs: 6433.3 },
  { id: "box-10", kind: "standard", state: "accepted", ask: 1, gate: 1, releaseToVerdictMs: 1700.0, verdictToDivertMs: 4166.7, releaseToDivertMs: 5866.7 },
  { id: "box-11", kind: "tall", state: "accepted", ask: 3, gate: 3, releaseToVerdictMs: 1000.0, verdictToDivertMs: 7500.0, releaseToDivertMs: 8500.0 },
  { id: "box-12", kind: "metal", state: "accepted", ask: 2, gate: 2, releaseToVerdictMs: 500.0, verdictToDivertMs: 5833.3, releaseToDivertMs: 6333.3 },
]

/** The bench scripted no refusals and no expiries; absence is the zero. */
export const VERDICTS: Record<Exclude<VerdictState, "refused" | "expired">, number> = {
  accepted: 11,
  vetoed: 1,
}

/**
 * The host block's wire words at shift end — the contract, with the
 * values the seeded shift left behind. Locators on the wire; the ST
 * program sees them at +100.
 */
export const REGISTERS: RegisterRow[] = [
  { addr: "%QW2", name: "STATE", writer: "line", value: 2, note: "RUN for the whole shift" },
  { addr: "%QW3", name: "ALARM", writer: "line", value: 0, note: "bit 5 HOST_STALE never lit — the host never dropped" },
  { addr: "%QW28", name: "HOST_WATCHDOG", writer: "host", value: 5, note: "1..60 s, clamped" },
  { addr: "%QW40", name: "HB_HOST", writer: "host", value: 643, note: "incremented every scan" },
  { addr: "%QW41", name: "CMD_SEQ", writer: "host", value: 12, note: "last command's tag" },
  { addr: "%QW42", name: "CMD_CODE", writer: "host", value: 1, note: "release-override" },
  { addr: "%QW43", name: "CMD_GATE", writer: "host", value: 2, note: "1 L01 · 2 L02 · 3 L03 · 4 RJ" },
  { addr: "%QW44", name: "CMD_CLASS", writer: "host", value: 0, note: "0 = any — the claim is checked at the load cell" },
  { addr: "%QW45", name: "ACK_SEQ", writer: "line", value: 12, note: "seq of the last ingested command" },
  { addr: "%QW46", name: "ACK_STATE", writer: "line", value: 1, note: "0 armed · 1 accepted · 2 vetoed · 3 refused · 4 expired" },
  { addr: "%QW47", name: "ACK_GATE", writer: "line", value: 2, note: "the gate the piece actually took" },
  { addr: "%QW48", name: "ACK_CLASS", writer: "line", value: 2, note: "the law class the cell measured" },
  { addr: "%QW49", name: "HOST_STATE", writer: "line", value: 10, note: "bit1 live + bit3 veto-since-live after the veto" },
  { addr: "%QW50", name: "IN_FLIGHT", writer: "line", value: 0, note: "0 — the belt is empty at shift end" },
  { addr: "%QW51", name: "HOST_ACKS", writer: "line", value: 12, note: "every resolved command, since boot" },
]

/**
 * Scan-ordered excerpt of the seeded shift: the veto — a tall piece
 * asked for L01, the law taking it to L03 anyway — then a clean ask the
 * floor honored. Times are shift seconds.
 */
export const WALKTHROUGH: WalkRow[] = [
  { tS: 40.2, who: "host", what: "writes the command block: CMD_SEQ=8, CMD_CODE=1 (release-override), CMD_GATE=1, CMD_CLASS=0" },
  { tS: 40.2, who: "line", what: "ingests at the scan boundary: ACK_SEQ=8, ACK_STATE=0 (armed)" },
  { tS: 41.5, who: "belt", what: "a tall piece reaches the load cell; the law measures class 3" },
  { tS: 41.5, who: "line", what: "requested gate 1 ≠ law gate 3 → VETOED: the piece takes L03. ACK_STATE=2, ACK_GATE=3, ACK_CLASS=3" },
  { tS: 49.0, who: "belt", what: "gate L03 fires — the piece is off the belt" },
  { tS: 55.4, who: "host", what: "writes the command block: CMD_SEQ=12, CMD_CODE=1 (release-override), CMD_GATE=2, CMD_CLASS=0" },
  { tS: 55.4, who: "line", what: "ingests at the scan boundary: ACK_SEQ=12, ACK_STATE=0 (armed)" },
  { tS: 55.9, who: "belt", what: "a metal piece reaches the load cell; the law measures class 2" },
  { tS: 55.9, who: "line", what: "requested gate 2 == law gate 2 → ACCEPTED: ACK_STATE=1, ACK_GATE=2, ACK_CLASS=2" },
  { tS: 61.7, who: "belt", what: "gate L02 fires — the piece is off the belt" },
]

/** Total released pieces across all buckets — the histogram must not eat one. */
export function bucketTotal(rows: Bucket[]): number {
  return rows.reduce((sum, b) => sum + b.count, 0)
}

/** Formats a latency in milliseconds as seconds, one decimal. */
export function asSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`
}

/**
 * The hosted line's canonical reading, read from the seeded bench the PLC
 * program ships (`engine/sim/figures/hostblock.json`, printed by
 * `engine/sim/hostbench.py`). Every figure on the page (the scan, the belt,
 * the buckets, the samples, the verdicts, the wire words, the walkthrough's
 * clock) comes from that document; nothing is transcribed by hand. The prose
 * (the law, the register notes, the walkthrough's narration) keeps the site's
 * editorial typography: the bench prints ASCII, the page sets it.
 *
 * The bench drives the scan-exact reference model of the ST host block
 * through a scripted shift of 20 pieces, 12 host releases, and one veto,
 * and reports what a hosted shift pays: release→verdict measured by the
 * model, verdict→divert as the deterministic ride from the load cell to
 * the gate at belt speed.
 */
import bench from "../../engine/sim/figures/hostblock.json" with { type: "json" }

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
  role: string
  writer: Writer
  value: number
  note: string
}

export type WalkRow = {
  tS: number
  who: Who
  what: string
}

/** The shift the bench scripted (meta in the JSON), named in the page's typography. */
export const ENGINE = "sim/hostblock.py, the offline reference model of the ST host block"
export const SCAN_MS = bench.meta.scan_ms
export const BELT_MMS = bench.meta.belt_mms
export const PIECES = bench.meta.pieces
export const RELEASES = bench.meta.releases
export const WATCHDOG_S = bench.meta.watchdog_s
export const LAW =
  "height ≥ 165 mm → L03 (oversize); metal → L02 (steel loop); weight outside 2 to 12 kg → RJ (reject); anything else → L01 (approved)"
export const LATENCY_NOTE =
  "The model times each request from the host's write to the load cell's reading, exact to the scan; the ride from the load cell to the gate is fixed by belt speed."

/** Release→divert latency, bucketed by the bench's width across the seeded shift. */
export const LATENCY_KIND = bench.latency.kind
export const BUCKET_MS = bench.latency.bucket_ms
export const BUCKETS: Bucket[] = bench.latency.buckets.map((bucket) => ({
  fromMs: bucket.from_ms,
  label: `${bucket.from_ms / 1000} to ${bucket.from_ms / 1000 + 1} s`,
  count: bucket.count,
}))
export const MIN_MS = bench.latency.min_ms
export const MAX_MS = bench.latency.max_ms
export const MEAN_MS = bench.latency.mean_ms

/** One row per released piece, in command order. The veto is box-08. */
export const SAMPLES: Sample[] = bench.latency.samples.map((sample) => ({
  id: sample.id,
  kind: sample.kind as Sample["kind"],
  state: sample.state as VerdictState,
  ask: sample.ask,
  gate: sample.gate,
  releaseToVerdictMs: sample.release_to_verdict_ms,
  verdictToDivertMs: sample.verdict_to_divert_ms,
  releaseToDivertMs: sample.release_to_divert_ms,
}))

/** The bench scripted no refusals and no expiries; absence is the zero. */
export const VERDICTS: Record<Exclude<VerdictState, "refused" | "expired">, number> = {
  accepted: bench.verdicts.accepted,
  vetoed: bench.verdicts.vetoed,
}

/**
 * The editorial notes the register table shows: the bench's prose set in
 * the page's typography. The wire data beside them (addr, name, writer,
 * value) is the bench's own, read from the figure above.
 */
const REGISTER_NOTES: Record<string, string> = {
  STATE: "running for the whole shift",
  ALARM: "the host-stale alarm never lit, because the host never dropped off the line",
  HOST_WATCHDOG: "set to 5 seconds; the program clamps any request to between 1 and 60 seconds",
  HB_HOST: "the heartbeat word; the host increments it every scan so the line knows it is alive",
  CMD_SEQ: "the tag of the last command the host sent",
  CMD_CODE: "code 1: the host asks for one item to be released to its chosen gate",
  CMD_GATE: "which gate the host asked for: 1 approved, 2 steel, 3 oversize, 4 reject",
  CMD_CLASS: "a claim about the item's type; 0 claims nothing, and the load cell verifies whatever is claimed",
  ACK_SEQ: "the tag of the last command the line took in",
  ACK_STATE: "the verdict on that command: 0 armed, 1 accepted, 2 vetoed, 3 refused, 4 expired",
  ACK_GATE: "the gate the item actually took",
  ACK_CLASS: "the item type the load cell actually measured",
  HOST_STATE: "live since the host connected, with the one veto noted since",
  IN_FLIGHT: "zero, because the belt was empty when the shift ended",
  HOST_ACKS: "every command the line has answered since boot",
}

/**
 * The human role each register plays, shown ahead of its wire name. The
 * wire data (name, address, writer, value) stays exactly as the bench
 * printed it; anything unmapped falls back to the wire name, so a
 * register added by a future bench run can never render with an empty
 * label.
 */
const REGISTER_ROLES: Record<string, string> = {
  STATE: "Line state",
  ALARM: "Alarm word",
  HOST_WATCHDOG: "Host watchdog",
  HB_HOST: "Heartbeat",
  CMD_SEQ: "Command sequence",
  CMD_CODE: "Command code",
  CMD_GATE: "Commanded gate",
  CMD_CLASS: "Commanded class",
  ACK_SEQ: "Ack sequence",
  ACK_STATE: "Ack state",
  ACK_GATE: "Ack gate",
  ACK_CLASS: "Ack class",
  HOST_STATE: "Host state",
  IN_FLIGHT: "In flight",
  HOST_ACKS: "Acknowledged commands",
}

/**
 * The host block's wire words at shift end: the contract, with the
 * values the seeded shift left behind. Locators on the wire; the ST
 * program sees them at +100.
 */
export const REGISTERS: RegisterRow[] = bench.registers.map((register) => {
  const name = register.name.toUpperCase()
  return {
    addr: register.addr,
    name,
    role: REGISTER_ROLES[name] ?? name,
    writer: register.writer as Writer,
    value: register.value,
    note: REGISTER_NOTES[name] ?? register.note,
  }
})

/**
 * Scan-ordered excerpt of the seeded shift: the veto (a tall piece
 * asked for L01, and the law took it to L03 anyway), then a clean ask
 * the floor honored. Times are shift seconds. The bench's narration,
 * with its ASCII arrows and dashes set for the page.
 */
const set = (text: string) => text.replaceAll(" -> ", " → ").replaceAll("!=", "≠").replaceAll(" - ", ": ")

export const WALKTHROUGH: WalkRow[] = bench.walkthrough.map((row) => ({
  tS: row.t_s,
  who: row.who as Who,
  what: set(row.what),
}))

/** Total released pieces across all buckets, so the histogram cannot lose one. */
export function bucketTotal(rows: Bucket[]): number {
  return rows.reduce((sum, b) => sum + b.count, 0)
}

/** Formats a latency in milliseconds as seconds, one decimal. */
export function asSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`
}

# 06 · Host Command Block — Line 01

A supervisory host (a WES or WMS) may connect to the line's register server
and request releases: *"put the next piece on lane L02."* It may only
**request** — the floor law keeps absolute precedence. This document is the
wire contract: the registers, their semantics, and the arbitration rules the
program implements scan by scan. Written before the code, per house rule.

Scope is deliberately small: one line, one block, a handful of gates. There
is no building-wide device abstraction here — a second line gets its own
block at its own base address.

## Surface and addressing

The host speaks the same wire register map as the HMI
([02 · register map](02-register-map.md)): holding registers, function
codes 03/06/16, 0-based protocol addresses. In the bench rig that server is
`sim/twin.py` on :1502; in a panel it is whatever endpoint serves the line's
wire map. The runtime's Modbus master stages device register *i* into program
locator `100 + i`, so inside the ST the block lives at `%QW128` and
`%QW140..151` while the wire addresses below stay canonical.

A talker needs three function codes only: read (03) for acks and status,
write multiple (16) for a command block, and a small heartbeat write.
The reference client is `cmd/linehost` in the switchyard repo.

## Who writes what

```
   host (WES/WMS talker)                       the line (PLC program)
   ─────────────────────                       ──────────────────────
   writes  %QW28          watchdog config  ──▶ read at scan start
   writes  %QW40..44      command block    ──▶ read at scan start
   reads   %QW45..51   ◀── acks + status       writes at ingest / resolve
   reads   %QW2 %QW3   ◀── state + alarm       writes every scan
```

Never write the ack or status words: they are the program's ledger of what
actually happened, not a request channel.

## Command block — `%QW40..44` (host-written)

| Register | Name | Values | Meaning |
|---|---|---|---|
| `%QW40` | `HB_HOST` | 0..32000 | heartbeat. Write an incrementing value at 1–2 Hz — any change resets the watchdog. Never write the same value twice |
| `%QW41` | `CMD_SEQ` | 0..32000 | command tag. Ingest happens on a value change at a scan boundary. 0 = idle. Increment per command; never reuse a value |
| `%QW42` | `CMD_CODE` | 1, 2 | 1 = release-override (piece toward `CMD_GATE`), 2 = release-per-law. Anything else is refused at ingest |
| `%QW43` | `CMD_GATE` | 1..4 | 1 L01 · 2 L02 · 3 L03 · 4 RJ. Required for code 1, ignored for code 2 |
| `%QW44` | `CMD_CLASS` | 0..4 | claim about the piece's law class: 0 = any, 1..4 as the gate codes. The floor checks the claim at the load cell |

One command = one write of the five words (FC16, offset 40, count 5), with
`CMD_SEQ` new. Writes land on scan-cycle boundaries: two writes inside one
scan collapse to the last one.

## Acks — `%QW45..48` (program-written)

| Register | Name | Values | Meaning |
|---|---|---|---|
| `%QW45` | `ACK_SEQ` | 0..32000 | seq of the last ingested command; 0 before the first |
| `%QW46` | `ACK_STATE` | 0..4 | see below |
| `%QW47` | `ACK_GATE` | 0..4 | the gate the commanded piece actually took (0 until the command resolves) |
| `%QW48` | `ACK_CLASS` | 0..4 | the law class the load cell measured for the commanded piece (0 until resolved) |

`ACK_STATE`:

| Value | Name | Meaning |
|---|---|---|
| 0 | ARMED | command accepted at ingest, riding the next piece to the load cell |
| 1 | ACCEPTED | released; requested gate matched the law (code 2 always ends here) |
| 2 | VETOED | law won — claimed class or requested gate disagreed with what the load cell measured; the piece took the law's gate |
| 3 | REFUSED | rejected at ingest: line not RUN (E-stop, jam, idle, init), a command already armed, or malformed values |
| 4 | EXPIRED | armed command dropped: the line left RUN or the host went stale |

A refusal or expiry zeroes `ACK_GATE`/`ACK_CLASS` — nothing was measured,
nothing moved.

## Status — `%QW49..51`, and config `%QW28`

| Register | Name | Meaning |
|---|---|---|
| `%QW49` | `HOST_STATE` | bit mask: bit0 (1) armed · bit1 (2) live · bit2 (4) fallback — host was live, now stale · bit3 (8) veto-since-live |
| `%QW50` | `IN_FLIGHT` | tracker slots occupied right now — pieces on the belt |
| `%QW51` | `HOST_ACKS` | commands resolved since boot (accepted + vetoed + refused + expired), wraps past 32000 |
| `%QW28` | `HOST_WATCHDOG` | seconds without an `HB_HOST` change before the host counts as stale. 1..60, default 5, clamped like every config word |

Alarm word bit 5 (mask 32) is **HOST_STALE**: set while the host is in
fallback. A host that has never connected is *not* an alarm — a line without
a supervisor is not a fault; a supervisor that drops mid-shift is.

## Arbitration — the floor has final say

1. **The line always sorts by the verdict law.** There is no mode in which
   the host steers the belt. Whatever the host requests, the piece takes the
   gate the law gives it at the load cell.
2. **Ingest is a scan-boundary event** on a `CMD_SEQ` change. The floor
   checks four things — host live, line RUN, nothing already armed, command
   well-formed — and refuses (3) on the first miss.
3. **One release at a time.** A new command while one is armed is refused
   (3). Wait for the armed command to resolve.
4. **An armed command rides the next piece to the load cell.** The law
   measures the class C. The claim is checked first: `CMD_CLASS ≠ 0` and
   ≠ C → veto (2). Then, for code 1, the requested gate must equal the
   law's gate for C — otherwise veto (2). Code 2 is always accepted.
   Either way the piece takes the law's gate, and the ack records what
   actually happened.
5. **Stop conditions win the same scan.** E-stop, jam or a stop button — at
   ingest or mid-flight — refuses (3) or expires (4) the command
   immediately. There is no grace period and no replay.
6. **Host silence is a fallback, not a fight.** When the watchdog expires,
   the armed command expires (4), new commands are refused, alarm bit 5
   lights, and the line keeps law-sorting. When the heartbeat moves again
   the host is live and the next command arms normally.

## The life of a command

An accepted release:

```
host:  CMD_SEQ=7, CMD_CODE=1, CMD_GATE=2, CMD_CLASS=0     (one FC16 write)
scan:  edge on CMD_SEQ → checks pass → ARMED   ACK_SEQ=7  ACK_STATE=0
belt:  next piece reaches LC, law measures class 2
       requested gate 2 == law gate 2 → ACCEPTED
       ACK_SEQ=7  ACK_STATE=1  ACK_GATE=2  ACK_CLASS=2
talker journals the receipt
```

A vetoed one:

```
host:  CMD_SEQ=8, CMD_CODE=1, CMD_GATE=1, CMD_CLASS=0
scan:  ARMED
belt:  next piece is 180 mm tall → law class 3 (L03)
       requested 1 ≠ law 3 → VETOED
       ACK_STATE=2  ACK_GATE=3  ACK_CLASS=3        (the piece went to L03)
```

The veto is not an error to retry: it is the floor telling the host its
picture of the payload was wrong.

## Determinism

- Every host-block read and write lands on a scan-cycle boundary. The
  program ingests at most one command per scan; acks move only at ingest,
  resolve or expiry — never mid-flight.
- `sim/hostblock.py` is an offline reference model of exactly this block
  (scan inputs in, register writes out). `sim/test_hostblock.py` locks the
  behaviour without a PLC: deterministic ingest (same command sequence →
  same ack sequence), E-stop precedence, heartbeat timeout → fallback →
  return, and the veto/refuse/expiry edges.
- The live counterparts in `sim/test_line.py` assert the same contract
  against a real runtime and skip (never fail) without one.

# Fluxline, a smart sorting line

Live site: https://sukrutn.github.io/fluxline/

[![CI](https://github.com/SukrutN/fluxline/actions/workflows/ci.yml/badge.svg)](https://github.com/SukrutN/fluxline/actions/workflows/ci.yml)

A **3-way smart sorting line**, simulated end to end in the browser: four sensors, three gates, a reject chute, a watchdog, and its own operating ledger. The page runs one fixed configuration of it as a live demo in a deep green control room: bright green signal, mono micro-labels, a raster display sign-off, and a live plant clock.

> Phase 01 of 02: the **web line** (this repo's front). Phase 02 is the real **OpenPLC program** (IEC 61131-3 Structured Text for the OpenPLC Runtime). It lives at [`engine/`](engine/) in this repository, and both are available for free on GitHub.

**Every item, sorted in a single pass**

---

## The chapters

| № | Chapter | What it does |
|---|---------|--------------|
| `01` | **Signal** | Hero, wordmark, live plant clock, status chip, marquee feed |
| `02` | **The line** | The mounted simulation frame: canvas sorter, sensor LEDs, gate indicators, live captions, full controls (Run, Halt, E-stop, Reset, belt speed, item cadence, defect and jam injection) |
| `03` | **Stations** | The four sensor rolls with live readouts and schematics |
| `04` | **Ledger** | OEE ring (A×P×Q), rolling items/min sparkline, per-lane verdict journal, timestamped event stream |
| `05` | **Host requests** | The supervisory host over Modbus: the release-to-divert histogram, the host command block at shift end, and a scan-by-scan walkthrough of one veto and one honored request |
| `06` | **Operating rules** | The routing rules this demo runs, its sensors and gates, and what a real line sets for itself |

A fixed chapter rail (left) and a difference-blended top chrome (wordmark,
status, clock) persist across the page. Lenis drives smooth scrolling from
the GSAP ticker; ScrollTrigger drives the reveals.

## The routing law

One pass down the belt, decided at the load cell (LC-04):

```
tall (≥ 165 mm)                →  L03, the oversize lane
ferrous inductive signature    →  L02, the steel loop
weight anomaly (<2 or >12 kg)  →  RJ, the reject chute
otherwise                      →  L01, the approved lane
```

## The simulation

- Fixed-step engine (`120 Hz`), deterministic items: `standard / metal / tall / offspec`
- Stations: `PE-01 photo-eye`, `HS-02 height profile`, `ID-03 inductive probe`, `LC-04 load cell`
- Cascade diverters with **pre-open lead logic**: gates arm before the item arrives
- `E-STOP` latches everything (watchdog style). A jam outlives **8 s**, then the watchdog trips the stop; `RESET` absolves.
- Metrics: availability (run vs. down seconds), performance (rolling vs. ideal rate), quality (`(routed − rejects) / routed`), rolling items/min history (1 Hz × 60)
- Heartbeat: rAF-starved tabs are flagged `Watchdog re-sync` on return (visible when you tab away and back)

## Stack

Next.js (App Router, typed routes), React 19, Canvas 2D, GSAP + ScrollTrigger, Lenis, TypeScript. **No backend, no keys, no accounts.** Telemetry lives in a tiny external store bridged to React at ~8 Hz; the canvas reads the engine at 60 fps.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (verified)
```

Keyboard: `Space` starts or halts the line, `X` trips the E-stop, `R` resets it (while the line section is in view). A QA handle exists at `window.__FLUXLINE` for scripted demos.

## Phase 02: the real controller

The web line is the storyboard: same station IDs, same routing law, same fault semantics. The Structured Text program (OpenPLC Runtime target) lives at [`engine/`](engine/). The layout mirrors this engine `PE-01…LC-04 → RJ·L01·L02·L03` one-to-one; its offline twin tests run in this repo's CI, and its seeded bench prints the hosted-line figures this site renders.

## References

- IEC 61131-3 — the standard for programmable controller languages; the
  Structured Text program in [`engine/`](engine/) targets it on the OpenPLC
  Runtime.
- MODBUS Application Protocol Specification V1.1b3 — the register surface
  the supervisory host speaks to the line.
  <https://modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf>
- Nakajima, S. (1988). *Introduction to TPM.* Productivity Press — the
  origin of overall equipment effectiveness (OEE = A × P × Q), the
  ledger's headline figure.

## License

MIT — see [LICENSE](LICENSE).

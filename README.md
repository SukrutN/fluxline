# FLUXLINE® — Line 01 · Smart Sorting Systems

A **3-way smart sorting line**, simulated end to end in the browser — four sensors, three gates, a reject chute, a watchdog and its own operating ledger. Presented as an editorial "machine brochure": warm paper, steel, signal amber, huge serif type, live plant clock.

> Phase 01 of 02 — the **web line** (this repo). Phase 02 is the real **OpenPLC program** (ladder logic for OpenPLC Runtime, separate repository).

**Made to sort. Built to last.**

---

## The chapters

| № | Chapter | What it does |
|---|---------|--------------|
| `01` | **SIGNAL** | Hero, wordmark, live plant clock, status chip, marquee feed |
| `02` | **THE LINE** | The mounted simulation frame — canvas sorter, sensor LEDs, gate indicators, live captions, full controls (RUN / HALT / E-STOP / RESET, belt speed, cadence, defect & jam injection) |
| `03` | **STATIONS** | The four sensor rolls with live readouts and schematics |
| `04` | **LEDGER** | OEE ring (A×P×Q), rolling pieces/min sparkline, per-lane verdict journal, timestamped event stream |
| `05` | **UNIT** | Operating rules, stack spec, and the phase-02 promise |

A fixed chapter rail (left) and a difference-blended top chrome (wordmark · status · clock) persist across the page. Smooth scrolling is Lenis-driven from the GSAP ticker; reveals are ScrollTriggered.

## The routing law

One pass down the belt, decided at LC-04:

```
tall profile (≥ 165 mm)        →  L03 · OVERSIZE
ferrous inductive signature    →  L02 · STEEL LOOP
weight anomaly (<2 or >12 kg)  →  RJ  · REJECT
otherwise                      →  L01 · APPROVED
```

## The simulation

- Fixed-step engine (`120 Hz`), deterministic items: `standard / metal / tall / offspec`
- Stations: `PE-01 photo-eye`, `HS-02 height profile`, `ID-03 inductive probe`, `LC-04 load cell`
- Cascade diverters with **pre-open lead logic** — gates arm before the piece arrives
- `E-STOP` latches everything (watchdog style); a jam outlives **8 s** → watchdog trips the stop; `RESET` absolves
- Metrics: availability (run vs. down seconds), performance (rolling vs. ideal rate), quality (`(routed − rejects) / routed`), rolling pieces/min history (1 Hz × 60)
- Heartbeat: rAF-starved tabs are flagged `WDOG RE-SYNC` on return (visible when you tab away and back)

## Stack

Next.js (App Router, typed routes) · React 19 · Canvas 2D · GSAP + ScrollTrigger · Lenis · TypeScript. **No backend, no keys, no accounts** — telemetry lives in a tiny external store bridged to React at ~8 Hz while the canvas reads the engine at 60 fps.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (verified)
```

Keyboard: `Space` start/halt · `X` E-STOP · `R` reset (while the line section is in view). A QA handle exists at `window.__FLUXLINE` for scripted demos.

## Phase 02 — the real controller

The web line is the storyboard: same station IDs, same routing law, same fault semantics. The ladder program (OpenPLC Runtime targets) ships separately — the layout mirrors this engine `PE-01…LC-04 → RJ·L01·L02·L03` one-to-one. *(link lands here when the repo ships)*.

# Changelog

All notable changes to this site are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), versions follow
[Semantic Versioning](https://semver.org/), and a version's date is the
date it shipped on `main` — not the date its work started.

## [0.2.1] - 2026-10-20

### Fixed
- `npm run lint` runs clean (it didn't on main). The errors pointed at
  real problems, fixed at the root:
  - the wall clock in `Chrome` now subscribes via `useSyncExternalStore`
    (cached 1 Hz snapshot) instead of mirroring `Date.now()` into state
    from an effect;
  - the simulation caption in `LineSection` is derived from the event
    snapshot on every render (priority: live FAULT → fresh event 2.4 s →
    tail to 5 s → idle rotation) instead of being mirrored into state by
    two effects that raced for ownership;
  - unused section imports removed from the root layout, JSX apostrophe
    escaped.
- `package.json` version follows the release tags again.

## [0.2.0] - 2026-10-20

### Added
- Operator-voice copy pass across the five chapters; gutters clear the
  rail; the simulation engine ticks continuously (counters and uptime
  advance even with the canvas scrolled away); the chapter rail renders
  dots-only.

## [0.1.1] - 2026-10-20

### Fixed
- Hardening pass: entrances that can't be throttled down, the rail floats
  clear of the simulation frame, hero clock derived from CSS wall time.

## [0.1.0] - 2026-10-20

### Added
- The editorial sorting line: five chapters (SIGNAL, THE LINE, STATIONS,
  LEDGER, UNIT) with a live browser simulation of the 3-way sorting
  line — the routing law, an OEE ledger (A×P×Q, rolling pieces/min,
  per-lane verdict journal, timestamped event stream), full controls
  (RUN / HALT / E-STOP / RESET, belt speed, spawn cadence, defect and
  jam injection). GSAP-driven Lenis smooth scroll, Tailwind styling,
  live plant clock.

Companion repo of [SukrutN/fluxline-plc](https://github.com/SukrutN/fluxline-plc)
— the same line as a real OpenPLC program.

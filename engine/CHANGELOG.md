# Changelog

All notable changes to this project are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), versions follow
[Semantic Versioning](https://semver.org/), and a version's date is the
date it shipped on `main`, not the date its work started.

## [1.2.0] - 2026-11-14

### Added
- **The host command block** ([docs/06](docs/06-host-block.md)): a
  supervisory WCS may request releases over Modbus wire `%QW28` +
  `%QW40..51`: heartbeat, command (seq / code / gate / claimed class),
  acks (armed / accepted / vetoed / refused / expired), status (armed /
  live / fallback / veto-since-live bits, in-flight, resolved count) and
  a host watchdog config word. The host can only request: the verdict
  law keeps absolute precedence, vetoes are acked with the gate the
  piece actually took, and a stale host falls back to the law with alarm
  bit 5 (HOST_STALE), set only after a host had been live.
- `sim/hostblock.py`: offline reference model of the block, scan inputs
  in, register writes out. `sim/test_hostblock.py` locks the behaviour
  with no PLC attached: deterministic ingest (event-order strict,
  timing-tolerant), E-stop precedence, heartbeat timeout → fallback →
  return, and the veto/refuse/expiry edges.
- `sim/test_line.py`: live host tests: refusal while stopped, accepted
  release on the matching lane, veto when the floor disagrees, E-stop
  expiry of an armed command, heartbeat fallback → return. They skip
  without a runtime, or without the master's host requests. Version
  register is now 120 = 1.2.0.
- Amber stack light also marks a host in fallback: the line keeps
  law-sorting, and the operator should know supervision dropped.
- Commissioning §5: the master request pair staging the host block
  (read HR 28..44, write HR 45..51) and two new go-live checks.
- `sim/hostbench.py`: a seeded offline bench, a scripted hosted shift
  (20 pieces, 12 host releases, one veto) driven through the host block
  model. Its figures, committed to `sim/figures/hostblock.json`, are the
  release→divert latency histogram, the final register table and a
  scan-ordered walkthrough; they are ported into the fluxline site,
  where a test locks them. Deterministic: no wall clock, no RNG.

### Changed
- Twin holding-register store widened 32 → 64 words so wire 28..51 is
  addressable; CI runs the offline host block suite alongside the law
  tests.

## [1.1.1] - 2026-10-20

### Fixed
- **Route credits can no longer lie.** A confirming pulse now counts only
  if the unit it belongs to is physically past its gate
  (`p_pos >= gate_end` before the credit fires). The shared confirm level
  previously could credit a route on a unit the tracker had released; the
  gate-arrival guard makes that impossible. The no-confirm fallback
  window tightens 300 → 60 mm.
- Twin confirm/chute photo-eye pulses 0.25/0.30 s → 0.50 s, tolerating
  one missed master cycle, safe now that arrival ownership blocks
  phantom credits.

### Added
- `sim/oee_check.py`: standing OEE commissioning probe, a 6-unit batch
  through the live OpenPLC runtime, ten assertions comparing the ledger
  to the Modbus OEE counters, settle-aware counter reads, exit code 1 on
  any disagreement.

### Corrected
- `docs/02-register-map.md`: availability/performance/quality registers
  publish per-mille (×1000); the document said ×10.

## [1.1.0] - 2026-10-20

### Changed
- Verified end-to-end against a real OpenPLC v3 runtime, fully local
  (WSL2): upload, master→twin Modbus polling, cold boot,
  `pytest sim/test_line.py` 4/4. The locator law is now stated uniformly:
  MB-master device register *i* maps to runtime locator `100 + i`
  (`%IX100.0`, `%IW100/102/104`, `%QX100.x`, `%QW101`); wire addresses
  stay 0-based everywhere outside the named locators; master-facing HRI
  indices are unchanged.

### Fixed
- Twin Modbus server lifecycle: instance-owned asyncio loop,
  bind-before-ready, `close()` that actually closes; removed the loop
  shadowing between the physics thread and the server.
- Simulation fixture: the cold-boot ESTOP latch is honored, not fought;
  press-until-RUN start line (`scenarios.start_line()`), feed explicitly
  off, teardown guaranteed in `try/finally`.
- Profiling photo-eye is a true through-beam (high while the body covers
  the beam); HS/LC share the same exposure; gate attribution narrowed to
  `[gate-5, gate+25]` mm.

### Added
- README runtime bring-up notes: the CONFIGURATION wrapper requirement,
  the +100 locator law, the cold-boot ESTOP latch, and the modern
  toolchain build deviations (`disable_opendnp3`,
  `-DCMAKE_POLICY_VERSION_MINIMUM=3.5`).

## [1.0.1] - 2026-10-20

### Added
- `program/fluxline.st`: single-POU IEC 61131-3 Structured Text: a
  parallel-array piece tracker, inline sensor debounces, the verdict law
  (tall ≥ 165 mm → L03 · OVERSIZE; else metal → L02 · STEEL LOOP; else
  weight outside 2..12 kg → RJ · REJECT; else L01 · APPROVED), jam
  watchdog, software E-stop latch, Modbus-writable clamped config,
  honest OEE accounting.
- `sim/twin.py`: digital twin, a Modbus slave with belt physics and
  sensor/load-cell frames.
- `sim/scenarios.py` + `sim/test_scenarios.py`: offline law tests (no
  PLC needed) plus jam and E-stop scripts shared by tests and CLIs.
- `sim/test_line.py`: the live suite, the runtime's actual verdicts,
  asserted against the twin; skips (never fails) without a runtime.
- `docs/01..05`: IO map, register map, commissioning procedure, safety
  envelope, architecture.
- CI: every push compiles `fluxline.st` with matiec, the compiler the
  OpenPLC runtime uses, and runs the offline twin tests.

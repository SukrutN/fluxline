# Changelog

All notable changes to this site are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), versions follow
[Semantic Versioning](https://semver.org/), and a version's date is the
date it shipped on `main`, not the date its work started.

## [Unreleased]

### Changed
- The repository is pointed at from three places, no more. The hero
  lede becomes the plain professional sentence ("The controller program
  that runs on real hardware is available for free on GitHub"), and
  the closing theater's description no longer repeats a GitHub link
  seconds before the footer carries one; the remaining mentions are
  the hero lede, the About row of the rules table, and the footer.
- Position-driven motion throughout, replacing every timed entrance.
  Each reveal is a scrub: a pure function of the scroll position that
  moves exactly as far as the reader has scrolled, stops when they stop,
  and plays in reverse on the way back up, so a fast flick can never
  read as content waiting for a clock to catch up. The closing theater
  is rebuilt as a closing theater: a 200vh region
  tucked 100vh behind the section above, a masked wrapper that shows
  only its bottom half (the rect mask, softened at the
  leading edge so a resting descender reads as veiled, not cut), and a
  sticky stage that rises into view through the opening while pinned;
  the scrub maps to three decimals across the hold. Two engine bugs are
  fixed underneath: the reveal settle had been wiping React's own inline
  margins off the page (quietly shrinking the layout 117px under every
  trigger below it), and a settle timer had been killing each section's
  entrance 4.5s after load, before the reader ever reached it. Reveals
  now bind once per element (StrictMode's double effect had left two
  tween sets fighting), and a ResizeObserver on the body re-anchors
  every trigger whenever the page's height actually changes, so the
  event journal filling in after load can no longer desynchronize the
  theater. The stage takes pointer events only once the window has
  opened over it, so the masked-out region never shadows the operating
  rules' own links.
- Brand and copy pass. The hero title wrappers extend past their line
  boxes, so the rise animation's overflow no longer amputates the tail
  of a g at rest, and the "routed: approved" verdict tag sits fifteen
  points higher. "Line 01" is retired from the title, the anchors tab,
  and the ticker (now "Fluxline", "Belt: running"), and the tab shows
  the Fluxline mark (app/icon.svg) in place of the Next.js favicon. The
  meta description says item, not piece. The hero lede and the About
  row now say the program is available for free on GitHub, and the
  About row names Fluxline itself instead of the IEC 61131-3 and
  OpenPLC chain: this page runs one fixed configuration of Fluxline,
  and Fluxline runs the same rules on real hardware. The operating
  rules table follows suit: "Routing rules in this demo" and "Sensors
  in this demo" each state what this configuration runs and what a
  real line sets for itself. The README drops
  "Line 01" from its title, frames the page as one fixed configuration
  of the controller, and the changelog gains this record.
- Feedback pass across the page. "Item" replaces "piece" everywhere the
  page speaks, the industry's own word for what a sorter handles. The
  hero is generic: the eyebrow reads "Signal / Smart sorting line /
  Demo", the statement is "Every item, sorted in a single pass" with no
  trailing period, the lede explains the capability without enumerating
  the demo's lanes and links to the repository on GitHub, and the Run
  button sits at the right edge. The hosted chapter leads with the
  generic story (a host asks, the rules you configure keep the final
  say) and its disclosure shrinks to one line about the fixed-shift
  replay; the machine's own notation stays in the source, where
  engineers read it. The register note calls Modbus "the standard way
  industrial equipment exchanges data". The rules table closes with
  "About this demo" (configurable controller, program open on GitHub)
  instead of build narration, the footer carries the wordmark, the
  GitHub link, and the credit line, and the closing theater now runs a
  drifting-bars canvas backdrop behind the statement,
  in a plain 2D canvas. The canvas stencil tag
  scales to stay inside each item's box.
- The site's visual system settles: deep green scales (#0b191b page,
  #061217 machine room, #5eff88 signal), bright green body text, mono
  micro-labels, a clamp-based type scale, 12 px superellipse-radius
  buttons, CRT scanlines in place of film grain, a bright green gradient
  glow over the footer, focus-visible rings, and a
  cubic-bezier(0.23,1,0.32,1) easing across reveals. Fonts: Inter,
  Archivo, Silkscreen and Pixelify Sans, JetBrains Mono for code, all
  open faces, none licensed, none bundled. Breakpoints follow 743 /
  1023 / 1290 and the canvas palette mirrors the tokens.
- A full interaction pass: text selection turns near-black page-wide and
  bright green inside the console; a Console.log panel docks to the right
  and types each chapter's snippet as it comes into reading position; a
  thin anchors bar pinned to the top carries the chapter links and the
  reading progress; the fixed wordmark chrome and the side rail give way
  to a floating menu pill at the bottom center carrying the wordmark, the
  line's live state, the plant clock, and the CTA; the hero gains floating
  verdict tags (a red chip for a detection, a green one for a routing)
  and an arrival preloader veil; the CRT overlay gains a slow sweep and a
  quiet flicker; and the footer gains floating code snippets and the
  rotated edge badge. On the copy side, the revision talk is gone, the
  hero states the capability, says Demo plainly with one sentence of
  context, and explains what the actual deliverable is: the program that
  would run a real line, in this repository under engine/.
- Clarity pass after review. The hero carries a demo tag ("Demo: the
  line, its sensors and its counts are all simulated") and a tighter
  lede; the marquee drops its decorative periods; the keyboard hint
  is gone; the telemetry strip becomes a labeled legend (Sensors,
  Gates, Line) with a live value under every cell; the canvas station
  modules and their labels grow for readability. The hosted chapter
  leads with a plain-English definition of a host and the routing
  law, states that every figure comes from one scripted sample run
  and appears the same on every load, and moves the program's own
  notation and raw log behind disclosures, one click away, so the
  reading flow is sentences while the machine words stay verbatim.
  The dev indicator is disabled in local development.
- Operator-voice copy pass across every user-facing surface: the six
  chapters, the fixed chrome, the canvas HUD, the engine's journal
  strings, page metadata, and the README. Complete sentences replace
  telegraphic fragments; mid-dot separators become commas or
  parentheses; labels are sentence case; the ledger gains a key note
  defining OEE, A, P and Q; station and gate labels lead with the human name
  ("Photo-eye (PE-01)"); register rows lead with the register's role
  ("Commanded gate (CMD_GATE, %QW43)"); the hero and the footer
  sign-off now say "Every piece, sorted in a single pass." in place
  of "Made to sort. Built to last."; chapters five and six are
  relabeled
  "Host requests" and "Operating rules" (labels only, section ids
  unchanged); the engine's journal messages read as sentences. The
  bench figure locks, the ENGINE string, the LAW's locked substring,
  and the walkthrough's fixture wording are untouched, and `npm run
  test`, `npm run lint` and `npm run build` pass.

### Added
- Three more set pieces. The closing theater
  before the footer: a 200vh scroll region with a sticky viewport, a drifting-bars canvas backdrop, and the two-line
  statement ("Every piece, sorted" in soft green, "in a single pass."
  in signal) rising in on a scrubbed GSAP timeline that ends on a
  "Run the line again" action and a drawn closure line; it collapses to
  a plain statement under reduced motion. Odometer figures: the OEE
  ring and the four lane counts now render as digit strips that roll to
  their value, rolling again on every live change. The anchors bar
  gains hover panels: resting the pointer on a chapter
  opens a small panel under the bar with that chapter's one-liner and a
  live value from the line (running state, items detected, OEE, the
  fixed shift replay, the program under engine/), closing on leave;
  clicking still jumps. The operating rules table now showcases the
  program instead of narrating the build: the Stack row is gone (it
  lives in the README where developers read), and "The real program" row
  states that the line being watched follows the controller program
  under engine/, same stations, same routing law, same fault handling,
  running on real hardware while the demo runs it in the browser.
- Mouse-reactive layer: living backgrounds in the page's own
  stack: a signal-colored pointer glow follows the cursor across the
  page (direct DOM writes on a requestAnimationFrame loop, hover-capable
  pointers only, still under reduced motion); a machine-vision
  crosshair tracks the mouse over the belt with a live millimetre
  readout on the station datum; the station cards lift a background
  step, turn signal, glow their schematics, and sweep a scan line while
  the pointer rests on them; and the ledger and register rows highlight
  under the cursor. The demo framing is trimmed to one line on the hero
  tag and one clause in the hosted chapter, which now says what the
  demo shows, what the rules do with each request, and that the same
  rules ship in the program under engine/.
- **05 · HOSTED**: the hosted line, chapter six of five. A supervisory
  host asks for releases over Modbus and the verdict law keeps the last
  word. The chapter shows the seeded bench's figures: the release→divert
  latency histogram (12 releases, honest about the empty 7 to 8 s band),
  the host command block's wire words at shift end, and a scan-by-scan
  walkthrough of the veto (a tall item asked for L01; the law takes it
  to L03 anyway) and a clean ask the floor honored. The numbers are
  ported verbatim from fluxline-plc's seeded bench
  (`sim/figures/hostblock.json`) into `src/lib/hosted.ts` and locked by
  `hosted.test.ts` (`npm test`, node's own runner): if the bench's
  figures move, the page holds still until the port is deliberate.
  The chapter rail and section numbering follow (UNIT is 06 now).

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
  line: the routing law, an OEE ledger (A×P×Q, rolling pieces/min,
  per-lane verdict journal, timestamped event stream), full controls
  (RUN / HALT / E-STOP / RESET, belt speed, spawn cadence, defect and
  jam injection). GSAP-driven Lenis smooth scroll, Tailwind styling,
  live plant clock.

Companion repo of [the fluxline PLC program](https://github.com/SukrutN/fluxline/tree/main/engine),
the same line as a real OpenPLC program.

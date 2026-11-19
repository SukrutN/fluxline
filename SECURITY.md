# Security notes: fluxline

What the sorter program and its harness enforce, what they leave out, and how
to place them. Read alongside
[docs/04-safety.md](engine/docs/04-safety.md). Safety and security are
different documents here, and both are honest.

## What this is

An IEC 61131-3 Structured Text sorting program, an offline reference model
of its host block, a digital twin that speaks Modbus, and a control-room
page over the model. All figures are fictional. The threat model is a
controls engineer's machine or a commissioning bench, never a production
network.

## What is enforced

- **The control room's bearer-token gate** (`FLUXLINE_TOKEN`). When set,
  every route except `/health`, `/ready`, `/metrics`, and the page itself
  answers 401 without `Authorization: Bearer …`, compared with
  `hmac.compare_digest`. The page asks for the token on the first refusal
  and keeps it in `sessionStorage` for the tab's life only.
- **A per-client rate limit** (`FLUXLINE_RATE_LIMIT`, default 600 per
  minute) and **a body cap** (`FLUXLINE_MAX_BODY`, default 1 MiB), refused
  before the body is read.
- **Strict input handling.** Scan requests are field-whitelisted; a bad
  count, class, or cell is refused with words. The page never writes to
  disk.
- **Escaped output everywhere** in the control room page.

## What it leaves out

- **No authentication on the twin** (`sim/twin.py`, port 1502). Modbus TCP
  carries no authentication in the protocol, and the twin adds none. It is
  a test rig: bind it to the loopback and never to a plant network.
- **No authentication on the OpenPLC runtime path.** The runtime's own
  admin UI and Modbus server are its project's posture, not this one; the
  commissioning guide says to change the default login before anything
  touches a network.
- **No TLS anywhere in the harness.** Plain HTTP and plain Modbus.
- **No user identity, no audit trail, no persistence.** The host block
  model resets with every page open; the twin's records live in memory
  until the process ends.

## Deployment guidance

Everything here defaults to the loopback. The commissioning gate
(`sim/commissioning.py`) and the shift report (`sim/shift_report.py`)
refuse with the exact doc section that fixes it when the runtime is not
reachable; they never guess. For a wider bench: set `FLUXLINE_TOKEN`, keep
the twin on `127.0.0.1`, and put the runtime behind the plant's own
controls.

## Provenance

The printed bench figures (`engine/sim/figures/hostblock.json`) carry a
checksum manifest (`MANIFEST` beside them, `sha256sum -c` format), verified
by CI on every push, so the site's locked figures trace to exact bytes.
Regenerate over the committed bytes, not the checked-out files, because
line-ending conversion differs by platform: `git cat-file -p
HEAD:<figure> | sha256sum` is the portable way. The ST program itself is
source under git with a compile gate.

## Reporting

Open an issue in this repository. This is a portfolio project. These notes
describe the posture; they certify nothing.

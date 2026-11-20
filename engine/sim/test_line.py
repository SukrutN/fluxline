"""Live tests: the real OpenPLC runtime against the digital twin.

Prerequisites (see docs/03-commissioning.md section 5):
  1. OpenPLC runtime running with program/fluxline.st uploaded
  2. Runtime's Modbus master configured to poll 127.0.0.1:1502
     (read DI/IR/HR 28..44, write CO/HR 0..27 + 45..51 - six requests,
     the host block needs the last two)
  3. This suite starts the twin itself.

Behavior: if the runtime is not polling the twin, tests SKIP with a clear
reason - a fresh clone or CI machine must not fail for missing hardware.
The host block tests skip separately when the master is not staging the
host words. Determinism lives offline (test_hostblock.py); these tests
assert the contract points on real hardware.
"""

import os
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from twin import Twin                              # noqa: E402
import scenarios                                   # noqa: E402

RUNTIME_TIMEOUT = 20.0


class LiveHost:
    """Plays the supervisory host: a poll cycle writes a fresh heartbeat
    word and, on demand, the command block (seq last, so an edge never
    lands on a half-written command)."""

    def __init__(self):
        self.hb = 0

    def cycle(self, t, command=None, beat=True):
        if beat:
            self.hb = (self.hb % 32000) + 1
        if command:
            seq, code, gate, cls = command
            t.store.setValues(3, 44, [cls])
            t.store.setValues(3, 43, [gate])
            t.store.setValues(3, 42, [code])
            t.store.setValues(3, 41, [seq])
        t.store.setValues(3, 40, [self.hb])

    @staticmethod
    def ack(t):
        seq, state, gate, cls = t.store.getValues(3, 45, 4)
        return {"seq": seq, "state": state, "gate": gate, "class": cls}

    @staticmethod
    def status(t):
        st, in_flight, acks = t.store.getValues(3, 49, 3)
        return {"host_state": st, "in_flight": in_flight, "acks": acks}


def host_block_ready(t, host):
    """Skip unless the runtime's master stages the host block both ways."""
    deadline = time.time() + 5.0
    while time.time() < deadline:
        host.cycle(t)
        if t.store.getValues(3, 49, 1)[0] & 2:      # bit1: live
            return
        time.sleep(0.25)
    pytest.skip("runtime master not staging the host block - add the "
                "read HR 28..44 / write HR 45..51 requests (docs/03 §5)")


@pytest.fixture()
def twin():
    t = Twin(seed=2026)
    t.start()
    try:
        # a runtime polls the twin; without one the heartbeat never moves and
        # nothing else in this file is meaningful
        hb0 = t.store.getValues(3, 1, 1)[0]
        got_heartbeat = True
        try:
            scenarios.wait_for(
                lambda: t.store.getValues(3, 1, 1)[0] != hb0,
                RUNTIME_TIMEOUT, poll=1.0, what="runtime heartbeat")
        except TimeoutError:
            got_heartbeat = False
        if not got_heartbeat:
            pytest.skip("OpenPLC runtime not polling the twin - start it and "
                        "configure the Modbus master (docs/03-commissioning.md)")
        t.set_feed(False)                 # the tests own the piece flow;
        scenarios.start_line(t)           # a cold-booted runtime latches its
        yield t                           # chain fault, so this may need two
    finally:                              # start presses (see start_line)
        t.close()                             # always free the port + master


def test_every_verdict_class_routes_correctly(twin):
    t = twin
    kinds = ["standard", "metal", "tall", "light", "heavy"] * 3   # 15 pieces
    # pacing note: pieces are 100..200 mm long on a 120 mm/s belt. Two
    # constraints bite on the live runtime, where the phase 1 web sim
    # tolerated a 0.35 s batch: (a) a piece blocks the photo-eye for
    # len/120 s (up to 1.7 s), so consecutive rises need > 1.7 s of gap or
    # the runtime registers two pieces as one; (b) a piece spends ~25..29 s
    # in transit, so at 2.5 s pacing the batch holds ~12 concurrent pieces -
    # inside the runtime's 16 tracker slots.
    for k in kinds:
        t.spawn(k)
        time.sleep(2.5)
    scenarios.wait_for(lambda: len(t.snapshot()["pieces"]) >= len(kinds), 90,
                       what="all pieces routed")
    snap = t.snapshot()
    for p in snap["pieces"]:
        assert p["ok"], (f"FLX piece {p['id']} ({p['kind']}): expected "
                         f"{p['expected']}, runtime sent it to {p['lane_got']}")
    assert snap["missed"] == 0, "pieces fell off the belt unrouted"
    # and every lane actually got traffic
    counts = snap["counts"]
    assert counts["L01"] >= 2 and counts["L02"] >= 2
    assert counts["L03"] >= 2 and counts["RJ"] >= 2


def test_jam_watchdog_trips_and_resets(twin):
    t = twin
    out = scenarios.jam_watchdog(t)
    assert out["belt_dropped"], "watchdog tripped but belt stayed on"


def test_estop_chain_drops_belt_same_scan(twin):
    t = twin
    scenarios.estop_chain(t)
    # the estop scenario returned after the latch cleared; belt must be off
    # or already restarted cleanly by the scenario's own reset flow
    assert t.store.getValues(3, 2, 1)[0] in (1, 2)


def test_heartbeat_and_counters_advancing(twin):
    t = twin
    hb = t.store.getValues(3, 1, 1)[0]
    scenarios.wait_for(lambda: t.store.getValues(3, 1, 1)[0] != hb, 5,
                       poll=0.5, what="heartbeat tick")
    assert t.store.getValues(3, 19, 1)[0] == 120, "version register"


def test_host_refuses_when_the_line_is_not_running(twin):
    t = twin
    host = LiveHost()
    host_block_ready(t, host)
    t.pulse_stop()                       # RUN -> IDLE, belt stopped
    scenarios.wait_for(lambda: t.store.getValues(3, 2, 1)[0] == 1, 5,
                       what="line idle")
    host.cycle(t, command=(1, 2, 0, 0))  # release-per-law, harmless request
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 1, 5, what="ack")
    assert host.ack(t)["state"] == 3, "ingest while stopped must be refused"
    assert host.ack(t)["gate"] == 0 and host.ack(t)["class"] == 0
    scenarios.start_line(t)              # leave the line running


def test_host_release_accepted_on_the_matching_lane(twin):
    t = twin
    host = LiveHost()
    host_block_ready(t, host)
    t.spawn("metal")                     # law class 2 -> gate L02
    host.cycle(t, command=(2, 1, 2, 0))  # release-override toward L02
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 2
                       and host.ack(t)["state"] == 0, 5, what="armed")
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 2
                       and host.ack(t)["state"] in (1, 2), 40,
                       poll=0.25, what="release resolved")
    a = host.ack(t)
    assert a["state"] == 1, f"expected accepted, got {a}"
    assert a["gate"] == 2 and a["class"] == 2


def test_host_vetoed_when_the_floor_disagrees(twin):
    t = twin
    host = LiveHost()
    host_block_ready(t, host)
    t.spawn("tall")                      # law class 3, gate L03
    host.cycle(t, command=(3, 1, 1, 0))  # the host asks for L01
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 3
                       and host.ack(t)["state"] == 0, 5, what="armed")
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 3
                       and host.ack(t)["state"] in (1, 2), 40,
                       poll=0.25, what="release resolved")
    a = host.ack(t)
    assert a["state"] == 2, f"expected vetoed, got {a}"
    assert a["gate"] == 3 and a["class"] == 3, "the piece took the law's gate"


def test_estop_expires_an_armed_host_command(twin):
    t = twin
    host = LiveHost()
    host_block_ready(t, host)
    host.cycle(t, command=(4, 1, 2, 0))
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 4
                       and host.ack(t)["state"] == 0, 5, what="armed")
    t.open_estop()                       # the floor wins, the same scan
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 4
                       and host.ack(t)["state"] == 4, 5, what="expired")
    assert t.store.getValues(3, 2, 1)[0] == 4, "line must be in ESTOP"
    t.close_estop()
    scenarios.start_line(t)              # chain healthy + start: latch clears


def test_heartbeat_timeout_falls_back_and_returns(twin):
    t = twin
    host = LiveHost()
    host_block_ready(t, host)
    host.cycle(t, command=(5, 1, 2, 0))
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 5
                       and host.ack(t)["state"] == 0, 5, what="armed")
    # freeze the heartbeat: cycles keep writing the same word - the
    # program sees no change, the watchdog expires, the command drops
    deadline = time.time() + 10.0
    while time.time() < deadline and host.ack(t)["state"] != 4:
        host.cycle(t, beat=False)
        time.sleep(0.25)
    a = host.ack(t)
    assert a["state"] == 4 and a["seq"] == 5, "armed command must expire"
    assert t.store.getValues(3, 3, 1)[0] & 32, "HOST_STALE alarm bit"
    st = host.status(t)
    assert st["host_state"] & 4, "fallback bit"
    assert st["host_state"] & 2 == 0, "not live anymore"
    # the belt kept running the whole time - fallback is not a stop
    assert t.store.getValues(3, 2, 1)[0] == 2
    # the host returns: live again, and the next command arms normally
    host.cycle(t, command=(6, 2, 0, 0))
    scenarios.wait_for(lambda: host.ack(t)["seq"] == 6
                       and host.ack(t)["state"] == 0, 5, what="armed again")

"""Offline reference model of the FLUXLINE host command block (docs/06).

Mirrors program/fluxline.st section 3 scan by scan: wire register writes
in, register writes out. The offline tests (test_hostblock.py) lock this
model's behaviour; the live tests (test_line.py) assert the same contract
against a real runtime; the bench (hostbench.py) uses it for figures.

The model is deliberately boring: one scan() method, no threads, no wall
clock. Determinism is the point - the same command sequence produces the
same event sequence, scan for scan.

Register values persist between scans exactly like holding registers: pass
only the words the host wrote since the last scan.
"""

# ACK_STATE values (docs/06)
ARMED = 0
ACCEPTED = 1
VETOED = 2
REFUSED = 3
EXPIRED = 4

ACK_NAMES = {
    ARMED: "armed",
    ACCEPTED: "accepted",
    VETOED: "vetoed",
    REFUSED: "refused",
    EXPIRED: "expired",
}

# CMD_CODE values
OVERRIDE = 1
PER_LAW = 2

# line states (docs/02)
INIT, IDLE, RUN, JAM, ESTOP = 0, 1, 2, 3, 4

HB_WRAP = 32000


class HostBlock:
    """Scan-step model of the ST host block (program/fluxline.st section 3)."""

    def __init__(self, watchdog_s=5.0, scan_s=0.01):
        self.watchdog_s = watchdog_s
        self.scan_s = scan_s

        # wire-visible ack words (program-written, %QW45..48)
        self.ack_seq = 0
        self.ack_state = 0
        self.ack_gate = 0
        self.ack_class = 0

        # wire-visible status (%QW49..51, alarm bit 5)
        self.armed = False
        self.live = False
        self.hb_seen = False
        self.vetoed = False
        self.in_flight = 0
        self.host_acks = 0

        # internals (mirrors the ST VAR block)
        self._seq_last = 0
        self._hb_last = 0
        self._hb = 0
        self._seq = 0
        self._code = 0
        self._gate = 0
        self._cls = 0
        self._stale_s = 0.0
        self._armed_seq = 0
        self._armed_code = 0
        self._armed_gate = 0
        self._armed_class = 0

        # bookkeeping for tests and the bench
        self.tick = 0
        self.armed_tick = None
        self.last_latency = None   # scans from arm to resolve, or None
        self.events = []           # every ack write: dicts, in order

    # -- wire view -------------------------------------------------------

    def host_state(self):
        """HOST_STATE bit mask as the program publishes it (%QW49)."""
        w = 0
        if self.armed:
            w |= 1
        if self.live:
            w |= 2
        if self.hb_seen and not self.live:
            w |= 4
        if self.vetoed:
            w |= 8
        return w

    def alarm_bit(self):
        """The alarm bits this block owns: bit 5 (32) HOST_STALE."""
        return 32 if (self.hb_seen and not self.live) else 0

    def snapshot(self):
        """All wire-visible words in one dict - what a Modbus read sees."""
        return {
            "ack_seq": self.ack_seq,
            "ack_state": self.ack_state,
            "ack_gate": self.ack_gate,
            "ack_class": self.ack_class,
            "host_state": self.host_state(),
            "in_flight": self.in_flight,
            "host_acks": self.host_acks,
            "alarm_host_bit": self.alarm_bit(),
        }

    # -- the scan --------------------------------------------------------

    def scan(self, hb=None, seq=None, code=None, gate=None, cls=None,
             state=RUN, lc_class=None, in_flight=0):
        """One scan cycle.

        hb/seq/code/gate/cls: command words the host wrote since the last
        scan (None = register unchanged). state: the line state word.
        lc_class: law class of a piece finishing the load-cell window this
        scan, or None. in_flight: tracker slots occupied, published as is.

        Returns the list of ack events written this scan (0, 1 or 2 of
        them - a watchdog expiry and a fresh ingest can share a scan).
        """
        wrote = []
        self.tick += 1
        self.in_flight = in_flight

        # registers persist: apply this scan's host writes first
        if hb is not None:
            self._hb = hb
        if seq is not None:
            self._seq = seq
        if code is not None:
            self._code = code
        if gate is not None:
            self._gate = gate
        if cls is not None:
            self._cls = cls

        # -- watchdog: seconds since HB_HOST changed ----------------------
        if self._hb != self._hb_last:
            self._hb_last = self._hb
            self._stale_s = 0.0
            if not self.live:
                self.vetoed = False      # fresh session on every return
            self.live = True
            self.hb_seen = True
        elif self.live:
            self._stale_s += self.scan_s
            if self._stale_s > self.watchdog_s:
                self.live = False
                if self.armed:
                    self._write_ack(self._armed_seq, EXPIRED, 0, 0, wrote)
                    self.armed = False
                    self.armed_tick = None

        # -- ingest: edge on CMD_SEQ, checks in floor-first order ---------
        if (self._seq != 0) and (self._seq != self._seq_last):
            self._seq_last = self._seq
            if not self.live:
                self._write_ack(self._seq, REFUSED, 0, 0, wrote)
            elif state != RUN:
                self._write_ack(self._seq, REFUSED, 0, 0, wrote)
            elif self.armed:
                self._write_ack(self._seq, REFUSED, 0, 0, wrote)
            elif not self._well_formed():
                self._write_ack(self._seq, REFUSED, 0, 0, wrote)
            else:
                self.armed = True
                self.armed_tick = self.tick
                self._armed_seq = self._seq
                self._armed_code = self._code
                self._armed_gate = self._gate
                self._armed_class = self._cls
                self._write_ack(self._seq, ARMED, 0, 0, wrote, count=False)

        # -- an armed command needs continuous RUN ------------------------
        if self.armed and (state != RUN):
            self._write_ack(self._armed_seq, EXPIRED, 0, 0, wrote)
            self.armed = False
            self.armed_tick = None

        # -- arbitration at the load cell: the floor has final say --------
        if lc_class is not None and self.armed:
            self.host_acks += 1
            self.last_latency = self.tick - self.armed_tick
            self.armed = False
            self.armed_tick = None
            self.ack_seq = self._armed_seq
            self.ack_class = lc_class
            self.ack_gate = lc_class      # the law's gate, always
            self.ack_state = ACCEPTED
            if (self._armed_class != 0) and (self._armed_class != lc_class):
                self.ack_state = VETOED
                self.vetoed = True
            elif (self._armed_code == OVERRIDE) and (self._armed_gate != lc_class):
                self.ack_state = VETOED
                self.vetoed = True
            wrote.append(self._event(self.ack_state, self.ack_seq,
                                     self.ack_gate, self.ack_class))

        if self.host_acks > HB_WRAP:
            self.host_acks = 0
        return wrote

    # -- internals --------------------------------------------------------

    def _well_formed(self):
        if self._code not in (OVERRIDE, PER_LAW):
            return False
        if self._code == OVERRIDE and not (1 <= self._gate <= 4):
            return False
        if not (0 <= self._cls <= 4):
            return False
        return True

    def _write_ack(self, seq, ack_state, gate, cls, wrote, count=True):
        self.ack_seq = seq
        self.ack_state = ack_state
        self.ack_gate = gate
        self.ack_class = cls
        if count:
            self.host_acks += 1
        wrote.append(self._event(ack_state, seq, gate, cls))

    def _event(self, ack_state, seq, gate, cls):
        return {
            "tick": self.tick,
            "event": ACK_NAMES[ack_state],
            "seq": seq,
            "gate": gate,
            "class": cls,
        }

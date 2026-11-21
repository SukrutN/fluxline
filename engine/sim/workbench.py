"""The FLUXLINE control room: the host block model with a face on it.

A stdlib HTTP server, no dependencies beyond the engine itself. The page it
serves (sim/web/index.html) drives the same HostBlock the offline tests lock
(program/fluxline.st section 3, docs/06): write the command block, run scans,
read the ack words back, watch the watchdog and the veto. The bench endpoint
re-runs the seeded shift live, so the figures on the page are the engine's
own, never transcribed.

Endpoints:
  GET  /health     the process is serving
  GET  /           the control room page
  GET  /v1/bench   the seeded shift, run live (hostbench.bench())
  POST /v1/scan    run 1..100 scans against the session block
  POST /v1/reset   a fresh block, registers back to boot
"""

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(__file__))

from hostblock import ACK_NAMES, HostBlock  # noqa: E402
import hostbench  # noqa: E402

SCAN_S = 0.1
WATCHDOG_S = 5.0
STATE_NAMES = {"INIT": 0, "IDLE": 1, "RUN": 2, "JAM": 3, "ESTOP": 4}
CODE_NAMES = {"release-override": 1, "per-law": 2}
JOURNAL_CAP = 400

PAGE_PATH = os.path.join(os.path.dirname(__file__), "web", "index.html")


class Problem(Exception):
    """A refusal the page can render: a title, a detail, and the reasons."""

    def __init__(self, detail, reasons=None):
        super().__init__(detail)
        self.detail = detail
        self.reasons = reasons or []


class Session:
    """One live HostBlock plus the words the host side last wrote."""

    def __init__(self):
        self.lock = threading.Lock()
        self.reset()

    def reset(self):
        self.block = HostBlock(watchdog_s=WATCHDOG_S, scan_s=SCAN_S)
        self.hb = 0
        self.cmd = {"seq": 0, "code": 0, "gate": 0, "cls": 0}
        self.journal = []
        self.scans = 0

    def run_scans(self, request):
        """Run a burst of scans. The command is written on the first scan
        only (the host wrote it once since the last scan); a piece at the
        load cell finishes on the last scan of the burst."""
        count = request["count"]
        drop_hb = request["dropHeartbeat"]
        state = STATE_NAMES[request["state"]]
        command = request.get("command")
        lc_class = request.get("lcClass")
        in_flight = request.get("inFlight", 0)

        events = []
        with self.lock:
            for i in range(count):
                hb = None if drop_hb else (self.hb % 32000) + 1
                if hb is not None:
                    self.hb = hb
                kwargs = {
                    "hb": hb,
                    "state": state,
                    "in_flight": in_flight,
                }
                if command is not None and i == 0:
                    kwargs["seq"] = command["seq"]
                    kwargs["code"] = CODE_NAMES[command["code"]]
                    kwargs["gate"] = command["gate"]
                    kwargs["cls"] = command["class"]
                    self.cmd = {
                        "seq": command["seq"],
                        "code": command["code"],
                        "gate": command["gate"],
                        "cls": command["class"],
                    }
                if lc_class is not None and i == count - 1:
                    kwargs["lc_class"] = lc_class
                wrote = self.block.scan(**kwargs)
                self.scans += 1
                for event in wrote:
                    event = dict(event)
                    event["t_s"] = round(self.block.tick * SCAN_S, 1)
                    events.append(event)
                    self.journal.append(event)
            if len(self.journal) > JOURNAL_CAP:
                self.journal = self.journal[-JOURNAL_CAP:]
        return events

    def reading(self, events):
        """The wire view: command words in, ack and status words out."""
        snap = self.block.snapshot()
        with self.lock:
            journal = list(reversed(self.journal))
            command = dict(self.cmd)
            hb = self.hb
            scans = self.scans
        return {
            "scanS": SCAN_S,
            "watchdogS": WATCHDOG_S,
            "scans": scans,
            "registers": {
                "HB_HOST": {"addr": "%QW40", "writer": "host", "value": hb,
                            "note": "the host's heartbeat, wrapped at 32000"},
                "CMD_SEQ": {"addr": "%QW41", "writer": "host", "value": command["seq"],
                            "note": "the last command's tag"},
                "CMD_CODE": {"addr": "%QW42", "writer": "host", "value": command["code"],
                             "note": CODE_NAMES.get(command["code"], "nothing written yet")},
                "CMD_GATE": {"addr": "%QW43", "writer": "host", "value": command["gate"],
                             "note": "1 L01, 2 L02, 3 L03, 4 RJ"},
                "CMD_CLASS": {"addr": "%QW44", "writer": "host", "value": command["cls"],
                              "note": "0 matches any class"},
                "ACK_SEQ": {"addr": "%QW45", "writer": "line", "value": snap["ack_seq"],
                            "note": "seq of the last ingested command"},
                "ACK_STATE": {"addr": "%QW46", "writer": "line", "value": snap["ack_state"],
                              "note": ACK_NAMES.get(snap["ack_state"], "unknown")},
                "ACK_GATE": {"addr": "%QW47", "writer": "line", "value": snap["ack_gate"],
                             "note": "the gate the piece actually took"},
                "ACK_CLASS": {"addr": "%QW48", "writer": "line", "value": snap["ack_class"],
                              "note": "the law class the cell measured"},
                "HOST_STATE": {"addr": "%QW49", "writer": "line", "value": snap["host_state"],
                               "note": "bit0 armed, bit1 live, bit2 stale-seen, bit3 vetoed"},
                "IN_FLIGHT": {"addr": "%QW50", "writer": "line", "value": snap["in_flight"],
                              "note": "tracker slots occupied, published as is"},
                "HOST_ACKS": {"addr": "%QW51", "writer": "line", "value": snap["host_acks"],
                              "note": "every resolved command, since boot"},
            },
            "alarmHostBit": snap["alarm_host_bit"],
            "armed": self.block.armed,
            "hostLive": self.block.live,
            "events": events,
            "journal": journal[:60],
        }


SESSION = Session()


def read_request(body, allowed):
    """Parse and field-check a JSON body; refuse loudly, never silently."""
    try:
        node = json.loads(body)
    except ValueError as failure:
        raise Problem("The request is not valid JSON. " + str(failure))
    if not isinstance(node, dict):
        raise Problem("The request must be a JSON object.")
    reasons = []
    for name in node:
        if name not in allowed:
            reasons.append("Request has unknown field " + name + ".")
    if reasons:
        raise Problem("The request was refused.", reasons)
    return node


def scan_request(node):
    """Validate one /v1/scan body and return it in engine terms."""
    reasons = []
    count = node.get("count", 1)
    if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= 100:
        reasons.append("count must be a whole number from 1 to 100.")
    state = node.get("state", "RUN")
    if state not in STATE_NAMES:
        reasons.append("state must be one of " + ", ".join(STATE_NAMES) + ".")
    drop = node.get("dropHeartbeat", False)
    if not isinstance(drop, bool):
        reasons.append("dropHeartbeat must be true or false.")
    in_flight = node.get("inFlight", 0)
    if not isinstance(in_flight, int) or isinstance(in_flight, bool) or not 0 <= in_flight <= 32000:
        reasons.append("inFlight must be a whole number from 0 to 32000.")

    command = node.get("command")
    if command is not None:
        if not isinstance(command, dict):
            reasons.append("command must be an object or null.")
            command = None
        else:
            cmd_reasons = []
            for name in command:
                if name not in ("seq", "code", "gate", "class"):
                    cmd_reasons.append("command has unknown field " + name + ".")
            seq = command.get("seq")
            if not isinstance(seq, int) or isinstance(seq, bool) or not 1 <= seq <= 32000:
                cmd_reasons.append("command seq must be a whole number from 1 to 32000.")
            code = command.get("code")
            if code not in CODE_NAMES:
                cmd_reasons.append("command code must be release-override or per-law.")
            gate = command.get("gate")
            if not isinstance(gate, int) or isinstance(gate, bool) or not 1 <= gate <= 4:
                cmd_reasons.append("command gate must be 1, 2, 3, or 4.")
            cls = command.get("class")
            if not isinstance(cls, int) or isinstance(cls, bool) or not 0 <= cls <= 4:
                cmd_reasons.append("command class must be a whole number from 0 to 4.")
            if cmd_reasons:
                reasons.extend(cmd_reasons)
                command = None
            else:
                command = {"seq": seq, "code": code, "gate": gate, "class": cls}

    lc_class = node.get("lcClass")
    if lc_class is not None and (not isinstance(lc_class, int) or isinstance(lc_class, bool)
                                 or not 1 <= lc_class <= 3):
        reasons.append("lcClass must be 1 (standard), 2 (metal), or 3 (tall).")
    if reasons:
        raise Problem("The scan was refused.", reasons)
    return {
        "count": count,
        "state": state,
        "dropHeartbeat": drop,
        "inFlight": in_flight,
        "command": command,
        "lcClass": lc_class,
    }


class ControlRoom(BaseHTTPRequestHandler):
    """One handler, five routes, JSON in and JSON out."""

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler's naming
        if self.path == "/health":
            self.send_json(200, {"status": "up"})
        elif self.path == "/":
            try:
                with open(PAGE_PATH, encoding="utf-8") as page:
                    body = page.read()
            except OSError:
                self.send_json(500, {"title": "The control room page is missing",
                                     "detail": "sim/web/index.html could not be read."})
                return
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.send_header("content-length", str(len(body.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(body.encode("utf-8"))
        elif self.path == "/v1/bench":
            self.send_json(200, hostbench.bench())
        else:
            self.send_json(404, {"title": "No such route", "detail": self.path})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length).decode("utf-8", "replace")
        try:
            if self.path == "/v1/scan":
                request = scan_request(read_request(body, {
                    "count", "state", "dropHeartbeat", "inFlight", "command", "lcClass"}))
                events = SESSION.run_scans(request)
                self.send_json(200, SESSION.reading(events))
            elif self.path == "/v1/reset":
                read_request(body, {})
                with SESSION.lock:
                    SESSION.reset()
                self.send_json(200, SESSION.reading([]))
            else:
                self.send_json(404, {"title": "No such route", "detail": self.path})
        except Problem as problem:
            self.send_json(400, {
                "title": "The control room refused the request",
                "detail": problem.detail,
                "reasons": problem.reasons,
            })

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):  # keep the console quiet
        pass


def main():
    port = int(os.environ.get("PORT", "8092"))
    server = ThreadingHTTPServer(("127.0.0.1", port), ControlRoom)
    print("control room on http://127.0.0.1:%d/" % port)
    server.serve_forever()


if __name__ == "__main__":
    main()

"""A hand-over (``{"op": "handover"}``, the CAD Viewer page's Restart): the engine starts its successor
through the distribution's hook (``daemon.SUCCESSOR``) unless an app server holds it or work runs, and
for a minute its pages no longer keep it, so the successor's start retires it (the idle ``stop``)."""

from __future__ import annotations

import time
import types
import unittest
from unittest import mock

from tests.python.support import engine_daemon


def setUpModule() -> None:
    engine_daemon.isolate(unittest.addModuleCleanup, start=False)


class HandoverTest(unittest.TestCase):
    def engine(self, *, holders: int = 0, busy: int = 0):
        """An engine one page watches, its request under way: what a Restart finds."""
        from cadgen.engine import daemon

        engine = daemon.Daemon(cap=1)
        self.addCleanup(engine.pool.stop)
        engine.server = types.SimpleNamespace(watched=lambda: ["a-document"], clients_active=lambda: True)
        engine.holders, engine.busy = holders, busy
        return engine

    def ask(self, engine, request: dict) -> dict:
        sent: list[dict] = []
        engine.handle(request, sent.append)
        return sent[-1]

    def successor(self, answer: str | None = None):
        from cadgen.engine import daemon

        started: list[int] = []
        patch = mock.patch.object(daemon, "SUCCESSOR", lambda port: started.append(port) or answer)
        patch.start()
        self.addCleanup(patch.stop)
        return started

    def test_an_app_server_or_work_under_way_refuses_it_in_a_retirement_s_words(self) -> None:
        from cadgen.engine.client import stop_command

        started = self.successor()
        for holders, busy, said in ((1, 0, "in use by 1 app server: quit that app"),
                                    (0, 2, "in use by 2 requests: let it finish")):
            with self.subTest(holders=holders, busy=busy):
                engine = self.engine(holders=holders, busy=busy)
                self.assertEqual(self.ask(engine, {"op": "handover"}),
                                 {"failed": f"{said} or run `{stop_command(engine.port)}`"})
                self.assertFalse(engine.handing())
        self.assertEqual(started, [])

    def test_the_successor_starts_and_the_watching_page_no_longer_keeps_the_engine(self) -> None:
        started = self.successor()
        engine = self.engine()
        self.assertEqual(self.ask(engine, {"op": "stop", "idle": True})["failed"], "the engine is in use")
        self.assertEqual(self.ask(engine, {"op": "handover"}), {"ok": True})
        self.assertEqual(started, [engine.port])
        self.assertEqual(self.ask(engine, {"op": "handover"}), {"ok": True})
        self.assertEqual(started, [engine.port], "one successor while one is starting")
        self.assertEqual(engine.uses(), {"holders": 0, "watched": 0, "busy": 0, "active": False})
        # An app server that holds it meanwhile still keeps it.
        engine.holders = 1
        self.assertEqual(self.ask(engine, {"op": "stop", "idle": True})["failed"], "the engine is in use")
        self.assertFalse(engine.stopping.is_set())
        engine.holders = 0
        self.assertEqual(self.ask(engine, {"op": "stop", "idle": True}), {"ok": True})
        self.assertTrue(engine.stopping.is_set())

    def test_a_minute_on_with_no_successor_come_its_pages_keep_it_again(self) -> None:
        self.successor()
        engine = self.engine()
        self.assertEqual(self.ask(engine, {"op": "handover"}), {"ok": True})
        later = time.monotonic() + 61
        with mock.patch("time.monotonic", return_value=later):
            self.assertEqual(engine.uses()["watched"], 1)
            self.assertEqual(self.ask(engine, {"op": "stop", "idle": True})["failed"], "the engine is in use")

    def test_a_successor_that_cannot_start_is_the_answer(self) -> None:
        from cadgen.engine import daemon

        self.successor("no installation of 0.9.0 is registered: run the install command")
        engine = self.engine()
        self.assertEqual(self.ask(engine, {"op": "handover"}),
                         {"failed": "no installation of 0.9.0 is registered: run the install command"})
        self.assertFalse(engine.handing())
        self.assertEqual(engine.uses()["watched"], 1)
        with mock.patch.object(daemon, "SUCCESSOR", None):
            self.assertEqual(self.ask(engine, {"op": "handover"}),
                             {"failed": "this engine has nothing to start a successor with"})


if __name__ == "__main__":
    unittest.main()

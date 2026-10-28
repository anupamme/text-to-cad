"""Attach to the explicitly selected server through its private, authenticated door."""

from __future__ import annotations

import functools
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable

from cadgen.engine import daemon as _daemon
from cadgen.engine.atomic_replace import RETRY_DELAYS_SECONDS
from cadgen.engine.door import Connection, answering, dial

__all__ = ["hold", "legacy", "request", "stop_legacy", "sweep"]

DAEMON_MODULE = "cadgen.engine.daemon"  # the enclosing distribution may supply an application host
# Called once a connection reaches a daemon this process started (``connect``): a command that
# starts the engine says so (``cli.answered``); None, the default, says nothing.
on_started: Callable[[], None] | None = None

# The sandboxes known to refuse the loopback port the engine's HTTP server needs, each by a variable
# and the value it sets in the shells it runs: a daemon started there could never serve a build. The
# enclosing distribution names them (its host adapter); a sandbox none names is found by the daemon
# that cannot listen (``daemon.failure_path``), as fast.
SANDBOXES: tuple[tuple[str, str], ...] = ()
SANDBOXED = ("no engine server is running, and this shell's sandbox cannot start one: open a CAD card "
             "(the CAD plugin's server starts the engine) or run `cadgen server` outside the sandbox")
# An older release's engine -- 0.8.1 and before, protocol 3, the door's first -- named its door by
# its installation rather than by the port it serves, and takes one request a connection with no
# handshake. ``legacy`` finds the one serving a port through that door: each older door in the
# engine's folder asked its status once, read-only, at most ``LEGACY_DOORS`` of them, each answer at
# most ``LEGACY_BYTES`` and ``LEGACY_SECONDS`` (a wedged engine never wedges this process).
LEGACY_PROTOCOL = 3
LEGACY_DOORS = 16
LEGACY_BYTES = 1 << 20
LEGACY_SECONDS = 3.0
_TAG = re.compile(r"[0-9a-f]{12}")
_VERSION = re.compile(r"[0-9][0-9A-Za-z.+_-]*")


def _connect(address: Path | None = None) -> Connection | None:
    """A connection to the daemon at ``address`` (its door, on Windows its port file; by default
    the selected port's), or None when none answers there. ``ConnectionError`` when the system
    refuses this process the engine's folder (a sandbox that forbids writing there), and when no
    port is selected (a ``CADGEN_PORT`` that names none): said in one line, as a verb says it."""
    if address is None:
        try:
            address = _daemon.address()
        except ValueError as error:
            raise ConnectionError(str(error)) from None
    folder = address.parent
    if folder.exists() and (refusal := _daemon.folder_refusal(folder)) is not None:
        raise ConnectionError(refusal)
    try:
        if _daemon.WINDOWS:
            port, _token = _port_text(address).split()
            connection = socket.create_connection(("127.0.0.1", int(port)), timeout=5)
            connection.settimeout(None)
            stream = connection.makefile("rwb")
            return Connection(stream, stream, stream, connection)
        door = address
        if not door.exists():
            return None
        return dial(door)
    except PermissionError as error:
        raise _denied(f"opening a pipe in the engine's folder {_daemon.state_dir()}: {error.strerror or error}") from None
    except (OSError, ValueError):
        return None


def _port_text(path: Path) -> str:
    """A Windows engine's port file. Windows refuses a reader (EACCES) while the file is renamed
    into place or removed -- an engine starting, which ``connect`` polls, or stopping -- so that
    refusal waits out the ladder the writer's rename does (``atomic_replace``) before it is said to be
    the system's."""
    for delay in RETRY_DELAYS_SECONDS:
        try:
            return path.read_text(encoding="utf-8")
        except PermissionError:
            time.sleep(delay)
    return path.read_text(encoding="utf-8")


def _answering(address: Path) -> bool:
    """Whether a daemon answers at ``address``, asked without a request: its door takes a writer
    (on Windows, its port takes a connection)."""
    if not _daemon.WINDOWS:
        return answering(address)
    connection = _connect(address)
    if connection is None:
        return False
    connection.close()
    return True


def _sandboxed() -> bool:
    return any(os.environ.get(name) == value for name, value in SANDBOXES)


def _denied(cause: str) -> ConnectionError:
    """The engine refused by the system (a sandbox that forbids writing in the engine's folder),
    said to the agent or person who runs the command."""
    return ConnectionError(f"the system denies cadgen's local engine ({cause}); a sandbox that forbids "
                           "it does: run this command outside it, or with the sandbox's permission")


def _lock(path: Path | None = None) -> Any:
    """``daemon.lock`` taken by a client (to see a daemon gone, or its files dead): a folder refused
    (``daemon.folder_refusal``) or denied by the system said in one line, as ``connect`` says it."""
    try:
        return _daemon.lock(path)
    except PermissionError as error:
        if error.errno is None:  # ``folder_refusal``'s words
            raise ConnectionError(str(error)) from None
        raise _denied(f"taking the lock in the engine's folder {_daemon.state_dir()}: "
                      f"{error.strerror or error}") from None


def _not_started(code: int) -> ConnectionError:
    """A daemon that exited at once, failing (``daemon.main``): the reason its note gives."""
    try:
        note = json.loads(_daemon.failure_path().read_text(encoding="utf-8"))
        reason, denied = str(note["reason"]), bool(note.get("denied"))
    except (OSError, ValueError, KeyError, TypeError):
        reason, denied = f"it exited with code {code}", False
    if denied:
        return ConnectionError(f"{SANDBOXED} ({reason})")
    return ConnectionError(f"the engine server did not start: {reason}")


# Switches that govern only the process they are set in -- ``DO_NOT_TRACK`` and
# ``CADGEN_TELEMETRY`` (the distribution's ``cadgen.analytics.ENVIRONMENT``). The daemon serves
# every later client, so it is one of the "processes started for others" that go by the
# person's saved choice, never by the switch of whichever client happened to start it. The
# engine imports nothing of cadgen (law 3), so it carries the names here rather than importing them.
_PER_PROCESS_TELEMETRY = ("DO_NOT_TRACK", "CADGEN_TELEMETRY")


def environment() -> dict[str, str]:
    """This process's environment as the engine is handed it: ``os.environ``, every relative
    ``PYTHONPATH`` entry made absolute against this process's working folder, as Python resolves it
    for ``python SCRIPT`` (``site`` makes ``sys.path`` absolute at startup). The engine's processes
    stand in folders of their own (a script's, the engine's), where ``PYTHONPATH=src`` would name
    another folder, or none. An empty ``PYTHONPATH`` is no path at all, as Python reads it: left
    empty, never made this folder (an empty entry in a longer one is this folder, as there)."""
    env = dict(os.environ)
    path = env.get("PYTHONPATH")
    if path:
        cwd = os.getcwd()
        env["PYTHONPATH"] = os.pathsep.join(item if os.path.isabs(item) else os.path.join(cwd, item)
                                            for item in path.split(os.pathsep))
    return env


def _start() -> subprocess.Popen:
    """A daemon started, detached: its process, whose ``pid`` says whether the daemon that answers
    is the one this process started (``_told_started``)."""
    env = {name: value for name, value in environment().items() if name not in _PER_PROCESS_TELEMETRY}
    root = _daemon.engine_root()
    path = env.get("PYTHONPATH", "")
    if root not in path.split(os.pathsep):
        env["PYTHONPATH"] = os.pathsep.join(item for item in (root, path) if item)
    _daemon.bytecode(env)
    process = subprocess.Popen([sys.executable, "-P", "-m", DAEMON_MODULE], stdin=subprocess.DEVNULL,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env, cwd=_working_folder(),
                               **_daemon.detached())
    # Bootstrap may live as long as the server (MCP, an embedded client or a test). Reap our
    # child when it exits instead of leaving a zombie until another subprocess is started.
    if hasattr(process, "wait"):
        threading.Thread(target=process.wait, name="cadgen-server-exit", daemon=True).start()
    return process


def _working_folder() -> str | None:
    """Where the daemon (and every child it starts) stands. On POSIX the engine's own folder, which
    is this user's alone (``daemon.folder_refusal``): never the shared temporary folder above it,
    where another user could leave a file a name-resolved helper would find. On Windows the
    per-user temporary folder above it, so the engine's folder holds no process's working folder."""
    folder = _daemon.state_dir()
    if not _daemon.WINDOWS:
        return str(folder) if folder.is_dir() else None
    return str(folder.parent) if folder.parent.exists() else None


def connect(*, start: bool = False, timeout: float = 60.0) -> Connection | None:
    """A connection to the daemon, started when ``start`` and none answers. In a shell whose
    sandbox refuses the loopback port the engine's HTTP server needs, none is started: that is
    said at once, as is a daemon that exits failing (its note, ``daemon.failure_path``)."""
    found = _connect()
    if found is not None:
        return _greet(found)
    if not start:
        return None
    if _sandboxed():
        raise ConnectionError(SANDBOXED)
    try:
        _daemon.state_dir().mkdir(parents=True, exist_ok=True, mode=0o700)
    except PermissionError as error:
        raise _denied(f"making the engine's folder: {error.strerror or error}") from None
    refusal = _daemon.folder_refusal(_daemon.state_dir())
    if refusal is not None:  # said now, not after waiting out a daemon that cannot start there
        raise ConnectionError(refusal)
    try:  # the note is the one this start leaves
        _daemon.failure_path().unlink(missing_ok=True)
    except PermissionError as error:
        raise _denied(f"writing in the engine's folder: {error.strerror or error}") from None
    process = _start()
    mine = [process]
    started = time.monotonic()
    deadline = started + timeout
    while time.monotonic() < deadline:
        found = _connect()
        if found is not None:
            found = _greet(found)
            _told_started(mine)
            return found
        time.sleep(0.02)
        if process.poll():  # it could not take its lock or listen: said now, not after the timeout
            raise _not_started(process.returncode)
        if time.monotonic() - started > 1.0 and process.poll() == 0:
            # A daemon that is stopping still holds the lock, and the one just started
            # left at once: start another once the lock is free.
            process = _start()
            mine.append(process)
            started = time.monotonic()
    raise ConnectionError("the engine server did not start")


def _told_started(mine: list[subprocess.Popen]) -> None:
    """``on_started``, when the daemon that answers is one of ``mine`` (the daemons this process
    started): a command racing this one may have started the one that won the lock."""
    if on_started is None:
        return
    connection = _connect()
    try:
        answer = _exchange(connection, {"op": "pid"}) if connection is not None else {}
    except (OSError, ValueError):
        return
    if answer.get("pid") in {process.pid for process in mine}:
        on_started()


def missing() -> ConnectionError:
    """No engine of this release answers at the selected port's door: an older release's engine
    serving the port named (``legacy``), with the command that stops it; else the command that
    starts one."""
    port = _daemon.selected_port()
    older = legacy(port)
    if older is not None:
        return ConnectionError(held_words(older))
    return ConnectionError(f"no cadgen server is running on port {port}; start `cadgen server --port {port}` "
                           "outside the sandbox, or start the CAD plugin. Set CADGEN_PORT to select another server; "
                           "run `cadgen doctor --json --python /path/to/project/python` for diagnostics")


def _listening(port: int) -> bool:
    """Whether something listens on loopback ``port``: a connection made and let go at once."""
    try:
        socket.create_connection(("127.0.0.1", port), timeout=0.5).close()
    except OSError:
        return False
    return True


def stop_command(port: int) -> str:
    """The command that stops the engine on ``port``, as a person types it: ``--port`` only for
    a port other than the default."""
    return "cadgen stop" + ("" if port == _daemon.DEFAULT_PORT else f" --port {port}")


def legacy(port: int | None = None) -> dict[str, Any] | None:
    """The older release's engine whose HTTP server serves ``port`` (by default the selected one),
    found through its own door: ``{"port", "release", "installation"?, "pid", "address", "said"}``
    (``address`` its door, on Windows its port file; ``said`` its name in words). Once something
    listens on the port, each door in the engine's folder that no port of this protocol names
    (``daemon._tag``) is asked its status once (``_legacy_ask``); None when none serves ``port``."""
    port = _daemon.selected_port() if port is None else port
    folder = _daemon.state_dir()
    if not _listening(port) or _daemon.folder_refusal(folder) is not None:
        return None  # nothing serves the port; or a folder another can change, none of it this user's
    suffix, ours = (".port" if _daemon.WINDOWS else ".door"), _daemon._tag()
    try:
        tags = sorted(entry.name[:-len(suffix)] for entry in os.scandir(folder) if entry.name.endswith(suffix))
    except OSError:
        return None
    tags = [tag for tag in tags if _TAG.fullmatch(tag) and tag != ours]
    if tags:
        current = _current_tags()  # only once there is a door that may be an older engine's
        tags = [tag for tag in tags if tag not in current]
    for name in (tag + suffix for tag in tags[:LEGACY_DOORS]):
        address = folder / name
        found = _legacy_identity(_legacy_ask(address, {"op": "status"}))
        if found is not None and found["port"] == port:
            return {**found, "address": str(address), "said": _legacy_name(found)}
    return None


@functools.cache
def _current_tags() -> frozenset[str]:
    """The tag of every port's engine of this protocol: a door so named is never an older engine's,
    and is never sent a request with no handshake."""
    return frozenset(_daemon._tag(port=port) for port in range(1, 65536))


def _legacy_identity(answer: Any) -> dict[str, Any] | None:
    """What an older engine's ``status`` says of itself, and nothing else of it (its documents, its
    paths, its token): its release, the version its installation runs as, its process and the port
    its HTTP server serves; None for an answer of no such shape."""
    if not isinstance(answer, dict) or answer.get("ok") is not True:
        return None
    serving = answer.get("serving")
    port = serving.get("port") if isinstance(serving, dict) else None
    release, pid = answer.get("version"), answer.get("pid")
    if (type(port) is not int or not 1 <= port <= 65535 or not isinstance(release, str) or len(release) > 128
            or not _VERSION.fullmatch(release) or type(pid) is not int or pid <= 0):
        return None
    found: dict[str, Any] = {"port": port, "release": release, "pid": pid}
    named = answer.get("installation")
    if isinstance(named, str) and len(named) <= 128 and _VERSION.fullmatch(named):
        found["installation"] = named
    return found


def _legacy_name(found: dict[str, Any]) -> str:
    """An older engine in words: ``cadgen 0.8.1's engine (pid 83604)``."""
    return f"cadgen {found.get('installation') or found['release']}'s engine (pid {found['pid']})"


def held_words(found: dict[str, Any]) -> str:
    """The selected port held by the older engine ``found`` (``legacy``), and what frees it: what
    ``cadgen server``, the MCP bootstrap and every client say."""
    return f"port {found['port']} is held by {found['said']}: run `{stop_command(found['port'])}` to stop it, then start again"


def _legacy_ask(address: Path, message: dict[str, Any]) -> dict[str, Any] | None:
    """``message`` asked of the older engine at ``address`` as its protocol takes a request: a
    connection of its own, the request's line with no handshake (on Windows its token first), one
    answer line of at most ``LEGACY_BYTES``. Asked in a thread of its own and waited for at most
    ``LEGACY_SECONDS``; None when no answer comes in that time, or none of that shape."""
    answers: list[Any] = []

    def ask() -> None:
        try:
            connection = _connect(address)
        except OSError:
            return
        if connection is None:
            return
        try:
            sent = message
            if _daemon.WINDOWS:
                sent = {"token": _port_text(address).split()[1], **message}
            connection.writer.write((json.dumps(sent) + "\n").encode())
            connection.writer.flush()
            line = connection.reader.readline(LEGACY_BYTES + 1)
            if len(line) <= LEGACY_BYTES:
                answers.append(json.loads(line))
        except (OSError, ValueError, IndexError, RecursionError):
            pass
        finally:
            connection.close()

    thread = threading.Thread(target=ask, name="cadgen-older-engine", daemon=True)
    thread.start()
    thread.join(LEGACY_SECONDS)
    return answers[0] if answers and isinstance(answers[0], dict) else None


def stop_legacy(found: dict[str, Any], timeout: float = 60.0) -> bool:
    """The older engine ``found`` (``legacy``) asked to stop through its own door, as its protocol
    takes it (``{"op": "stop"}``), and waited for until it is gone, as ``sweep`` waits for this
    release's, then what its stop left of its files removed, as ``sweep`` does. False when it refuses
    the request or does not answer it; ``ConnectionError`` when it takes it and does not exit."""
    address = Path(found["address"])
    answer = _legacy_ask(address, {"op": "stop"})
    if not isinstance(answer, dict) or answer.get("ok") is not True:
        return False
    endpoint = _daemon.Endpoint(LEGACY_PROTOCOL, address, address.with_suffix(".lock"))
    if not wait_gone(timeout, endpoint):
        raise ConnectionError(f"{found['said']} did not exit")
    _remove_dead(endpoint)
    return True


def _greet(connection: Connection, address: Path | None = None) -> Connection:
    """Validate the server before sending client environment, paths or work."""
    from cadgen.engine.previous import version

    message = {"op": "hello", "protocol": _daemon.PROTOCOL, "release": version(),
               "port": _daemon.selected_port()}
    try:
        if _daemon.WINDOWS:
            message = {"token": _port_text(address or _daemon.port_path()).split()[1], **message}
        connection.writer.write((json.dumps(message) + "\n").encode())
        connection.writer.flush()
        answer = json.loads(connection.reader.readline() or b"{}")
        if answer.get("failed"):
            raise ConnectionError(str(answer["failed"]) + "; run `cadgen doctor --json --python /path/to/project/python` "
                                  "for diagnostics")
        if (answer.get("protocol") != _daemon.PROTOCOL or answer.get("release") != version()
                or answer.get("port") != _daemon.selected_port() or not isinstance(answer.get("instance"), str)
                or not answer["instance"]):
            raise ConnectionError("the selected cadgen server has an incompatible protocol, release or port; "
                                  "client and server must use exactly the same cadgen release")
        connection.engine_identity = {key: answer[key] for key in ("protocol", "release", "port", "instance")}
        return connection
    except BaseException:
        connection.close()
        raise


def wait_gone(timeout: float = 60.0, endpoint: _daemon.Endpoint | None = None) -> bool:
    """Wait until the daemon (by default this protocol's) is gone: its door no longer answers
    and its lock, held until its workers have stopped, is free."""
    deadline = time.monotonic() + timeout
    lock = endpoint.lock if endpoint else _daemon.lock_path()
    while time.monotonic() < deadline:
        if not _answering(endpoint.address if endpoint else _daemon.address()):
            if not lock.exists():
                return True  # it removed its lock as it let it go (``daemon.let_go``)
            held = _lock(lock)
            if held is not None:
                held.close()
                return True
        time.sleep(0.05)
    return False


def hold(*, start: bool = False, host: Callable[[], str | None] | None = None,
         holder: str | None = None) -> Connection | None:
    """A hold on the engine (``Daemon.hold``), explicitly bootstrapped only when ``start``. The
    connection owns its MCP sessions. Reading it waits until
    the engine goes (its end of file). None when none runs and ``start`` is false. ``host()``, asked
    once the engine answers, names the agent host the holder serves (its ``status`` counts it);
    ``holder``, the name its MCP sessions are opened under, which end when the hold does."""
    connection = connect(start=start)
    if connection is None:
        return None
    try:
        message: dict[str, Any] = {"op": "hold", "engineIdentity": connection.engine_identity}
        named = host() if host is not None else None
        if named:
            message["host"] = named
        if holder:
            message["holder"] = holder
        if _daemon.WINDOWS:
            message = {"token": _daemon.port_path().read_text(encoding="utf-8").split()[1], **message}
        connection.writer.write((json.dumps(message) + "\n").encode())
        connection.writer.flush()
        if json.loads(connection.reader.readline() or b"{}").get("ok") is not True:
            raise ConnectionError("the engine server did not take the hold")
    except BaseException:
        connection.close()
        raise
    return connection


def request(message: dict[str, Any], on_log: Callable[[dict[str, Any]], None] = lambda _m: None, *,
            start: bool | None = None, on_progress: Callable[[dict[str, Any]], None] | None = None) -> dict[str, Any] | None:
    """Send one request; every log line to ``on_log`` and every progress frame of its build to
    ``on_progress`` (``progress.py``); the final answer returned (None when no daemon is up and
    ``start`` is false)."""
    connection = connect(start=start is True)
    if connection is None:
        if start is None:
            raise missing()
        return None
    return _exchange(connection, message, on_log, on_progress)


def _exchange(connection: Connection, message: dict[str, Any], on_log: Callable[[dict[str, Any]], None] = lambda _m: None,
              on_progress: Callable[[dict[str, Any]], None] | None = None, address: Path | None = None) -> dict[str, Any]:
    if not hasattr(connection, "engine_identity"):
        _greet(connection, address)
    message = {**message, "engineIdentity": connection.engine_identity}
    with connection:
        if _daemon.WINDOWS:
            # The token first, so the daemon checks it before reading the request body.
            message = {"token": _port_text(address or _daemon.port_path()).split()[1], **message}
        connection.writer.write((json.dumps(message) + "\n").encode())
        connection.writer.flush()
        for line in connection.reader:
            answer = json.loads(line)
            if "log" in answer:
                on_log(answer)
                continue
            if set(answer) == {"progress"}:
                if on_progress is not None:
                    on_progress(answer["progress"])
                continue
            notice = answer.pop("notice", None)
            # Diagnostic notices, when the server has any.
            for said in (notice or "").splitlines():
                print(f"cadgen: {said}", file=sys.stderr)
            return answer
    raise ConnectionError("the engine server closed the connection")


def sweep(*, stop: bool) -> dict[str, list[str]]:
    """The selected port's daemon: with ``stop``, stopped and waited for until gone;
    a live one left running listed in ``running``. The door and lock files of a dead one -- nothing
    answers there and nobody holds its lock -- are removed (``removed``). A daemon starting or
    stopping holds its lock before it listens and until it has left, so its files are never taken."""
    found: dict[str, list[str]] = {"stopped": [], "running": [], "removed": []}
    for endpoint in _daemon.endpoints():
        if _answering(endpoint.address):
            if not stop:
                found["running"].append(str(endpoint.address))
                continue
            connection = _connect(endpoint.address)
            if connection is None:
                continue  # it went meanwhile: gone, as asked
            _exchange(connection, {"op": "stop"}, address=endpoint.address)
            if not wait_gone(endpoint=endpoint):
                raise ConnectionError(f"the engine server at {endpoint.address} did not exit")
            found["stopped"].append(str(endpoint.address))
            _remove_dead(endpoint)  # what an engine from before engines removed their own files left: its stop's
            continue
        found["removed"] += _remove_dead(endpoint)
    return found


def _remove_dead(endpoint: _daemon.Endpoint) -> list[str]:
    """The files of ``endpoint`` removed when its daemon is dead: its lock free (taken here while
    they go, so no daemon starts between) and nothing answering at its address."""
    present = [path for path in (endpoint.address, endpoint.lock) if path.exists() or path.is_symlink()]
    if not present or _daemon.folder_refusal(endpoint.lock.parent) is not None:
        return []  # nothing, or a folder another can change: none of it this user's daemon's to remove
    held = _lock(endpoint.lock)
    if held is None:
        return []  # a daemon holds it: starting, stopping or running
    removed: list[str] = []
    try:
        if _answering(endpoint.address):
            return []
        for path in present:
            if _daemon.WINDOWS and path == endpoint.lock:
                continue  # an open file is not removed on Windows: after the lock is let go
            try:
                path.unlink()
                removed.append(str(path))
            except FileNotFoundError:
                pass
    finally:
        held.close()
    if _daemon.WINDOWS and endpoint.lock in present:
        try:
            endpoint.lock.unlink()
            removed.append(str(endpoint.lock))
        except OSError:
            pass
    return removed

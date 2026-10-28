# Setup and troubleshooting

Read this for first-time setup, a missing command, or a version/connection error.
`cadgen` means the versioned CLI defined in this skill's `SKILL.md`; `python` means
an actual project interpreter, not cadgen's bootstrap environment.

## Install, update or find the CLI

The plugin's MCP startup normally downloads cadgen and registers the CLI. To install
or update text-to-cad on this computer, run its install command. It installs uv if it
is missing, then cadgen (the engine, the `cadgen` command and the MCP server) for
every agent app on the computer, and replaces an older engine; run again, it updates
them all:

```bash
curl -fsSL https://texttocad.dev/install.sh | sh
```

On Windows, in PowerShell: `irm https://www.texttocad.dev/install.ps1 | iex`. Restart
the agent app afterwards.

To register exactly this skill's release without changing any app (skills-only use,
or when the command says this release is not installed), run:

```bash
uvx --no-config --managed-python --python 3.13 --from cadgen==0.8.3 cadgen doctor
```

It needs uv: the install command installs it, or follow uv's
[platform installation instructions](https://docs.astral.sh/uv/getting-started/installation/).
It downloads the pinned runtime, registers it, writes the CLI proxy and checks the
CAD kernel. It does not start an engine. Both commands download and write outside
the project: run them outside a sandbox that refuses either, or with that sandbox's
permission.

Use the explicit CLI path so an activated project venv cannot shadow it:

- macOS/Linux: `~/.local/bin/cadgen +0.8.3`.
- Windows: `%USERPROFILE%\.local\bin\cadgen.cmd +0.8.3` (PowerShell: `$env:USERPROFILE`).
- If `CADGEN_LAUNCHER_DIR` moved the proxy, use `cadgen` or `cadgen.cmd` in that directory.

Keep that explicit version selection when appending verbs. `cadgen doctor <skill-dir>` checks
this skill's pin and the kernel and reports the selected engine. Each command's
`--help` lists its arguments.

## Project Python, when running scripts

Keep an existing project environment and its dependency manager. For a new
project, create one with uv on Python 3.11 or newer, cadgen's floor (a stock macOS
`python3` is older):

```bash
uv venv --python 3.13 .venv
```

Use its interpreter (`.venv/bin/python`, or `.venv\Scripts\python.exe` on Windows)
wherever the skill says `python`. Install cadgen and the project's dependencies
there; installing the CLI above does not install anything in a project venv. A venv
uv made has no pip, so install with uv:

```bash
uv pip install --python <project-python> cadgen==0.8.3
```

In an environment that has pip, `python -m pip install cadgen==0.8.3` does the same.
Either downloads from PyPI, so it needs network access. Keep the requirement in the
project's dependency declaration when it has one. Run scripts with this Python, for
example `python model.py`; the selected engine starts warm workers using that
interpreter and its dependencies.

A project's cadgen need not be the engine's release. The engine serves an older
one and says once, as the project's worker starts, that `uv pip install -U cadgen`
in that environment updates it; update at the project's pace. A project cadgen
newer than the engine says to update the engine with the install command above.

XML validation through `cadgen urdf|sdf|srdf validate` needs only the installed CLI,
not a project venv or running engine. Start an engine for viewing or snapshots.

## Engine startup and selection

With the CAD plugin, its MCP server starts or attaches to the engine and
advertises its release and port at initialization. Use those values in the project
environment. Without the plugin, start the engine yourself and keep it running, in
a terminal of its own or in the background from a shell that outlives the command,
outside any sandbox that refuses listeners:

```bash
uvx --no-config --managed-python --python 3.13 --from cadgen==0.8.3 cadgen server
```

With the CLI already registered, `cadgen server` does the same job; in the
background, for example
`nohup ~/.local/bin/cadgen +0.8.3 server > cadgen-server.log 2>&1 &`.

Clients select port 3245 by default; set `CADGEN_PORT` in both the server
and client environments to use another port (`cadgen server --port N` also selects it).
For GUI hosts, set it in the CAD MCP server's `env` settings too; a terminal export
alone does not configure the GUI server.

Client, engine and project worker need not share a cadgen release. They work
together when they speak the same protocol, the engine reads the document format
the worker writes, and both use the same CAD kernel line (OCP major.minor) on the
same OS and architecture; otherwise the failure names what differs and the fix.
Bootstrap reuses a compatible selected engine. An older cadgen's engine on the port,
0.8.0's and 0.8.1's included, is retired once nothing is using it, and the newer
engine takes the port; one still in use is reported with its release and pid, and
`cadgen stop` stops it. Bootstrap fails on any other listener and never changes
ports. Ordinary Python calls and CLI document operations only attach; a missing or
incompatible engine fails, with no automatic startup or local fallback.

## Diagnose a failure

For version or connection conflicts, use the actual project interpreter and this
skill's directory:

```bash
cadgen doctor --json --python <project-python> <skill-dir>
```

Omit `--python` when there is no project interpreter, or omit `--json` for a text
project report. These diagnostic modes do not register, prune, start or stop
anything. They compare the CLI, skill, project and selected engine, and report
registered installations and discoverable provider configuration. Discovery is
bounded; cached plugins do not prove what an agent host has loaded. Use the
findings to update the side that is behind (the install command for the engine
and CLI, `uv pip install -U cadgen` for a project) or to configure separate ports
explicitly. Do not silently switch releases.

For installation or kernel-load problems, plain `cadgen doctor <skill-dir>` also
performs setup and checks the CAD kernel in a separate process.

A first launch downloads the runtime and may outlast the host's startup timeout.
The Codex plugin requests 300 seconds; Claude Code's `MCP_TIMEOUT` is in
milliseconds. Pre-download with the bootstrap doctor command, then restart the
host. If a command reports that the system denies the engine's folder, rerun it
with the sandbox's permission rather than repeating the refused call.

A model build cut off by the shell's timeout keeps running in the engine.
`cadgen status` reports its workers and documents; rerunning the same model call
waits for that build and replays it. Give a cold build a suitable shell timeout
or run it in the background.

## After changing dependencies

A worker reads the installed packages once, when it starts. After installing,
upgrading or reinstalling dependencies in a project environment:

1. `cadgen stop` stops the selected engine, whoever started it.
2. Start it again: `cadgen server` as above, or, with the CAD plugin, its next CAD
   tool call starts it (a model run only attaches).
3. Restart any long-lived Python process that calls cadgen, then run the model again.

Stop only the selected engine on your own machine, never one on a port another
person or project deliberately runs.

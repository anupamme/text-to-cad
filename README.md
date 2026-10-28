<div align="center">

<img src="apps/docs/public/brand/logo-texttocad-animated.svg" alt="text-to-cad" width="800">

Design physical products with AI.

[Website](https://www.texttocad.dev)

[![cadgen](https://img.shields.io/pypi/v/cadgen?style=flat&logo=pypi&logoColor=white&label=cadgen)](https://pypi.org/project/cadgen/)
[![Tests](https://img.shields.io/github/actions/workflow/status/earthtojake/text-to-cad/test.yml?branch=main&style=flat&logo=githubactions&logoColor=white&label=Tests)](https://github.com/earthtojake/text-to-cad/actions/workflows/test.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)
[![skills.sh](https://skills.sh/b/earthtojake/text-to-cad?style=flat)](https://skills.sh/earthtojake/text-to-cad)
[![Downloads](https://img.shields.io/pepy/dt/cadgen?style=flat&logo=pypi&logoColor=white&label=downloads)](https://pepy.tech/projects/cadgen)

[![Join Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/5FGB9DwJYU)
[![Follow @earthtojake](https://img.shields.io/badge/Follow-%40earthtojake-000000?style=flat&logo=x)](https://x.com/earthtojake)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-EA4AAA?style=flat&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/earthtojake)

</div>

# text-to-cad

The text-to-cad plugin gives your agent local workflows for generating 3D models
as STEP, GLB, STL or 3MF files. It also does design for manufacturing checks,
generates engineering drawings, and connects to popular 3D printing, sheet metal
and CNC fabrication services.

It is supported by all popular agents that support plugins or the
[skills](https://skills.sh) framework, including Claude Code, Codex, Cursor,
Gemini and Grok.

### How it works

1. Your agent writes each model as a Python script with [build123d](https://github.com/gumyr/build123d), built on [Open CASCADE](https://dev.opencascade.org).
2. With cadgen's engine running, `python model.py` uses the project's Python
   environment to build an `.xbf` document (its parts, names, colours, materials
   and joints) and the STEP, GLB, STL or 3MF files the script declares. The engine
   keeps each model's work in memory, so an edit rebuilds only what it changed.
3. The CAD viewer shows the model in your agent app or your browser, and follows
   every rebuild.

## 💻 Install

macOS and Linux:

```bash
curl -fsSL https://texttocad.dev/install.sh | sh
```

Windows, in PowerShell:

```powershell
irm https://www.texttocad.dev/install.ps1 | iex
```

It installs uv if it is missing, then cadgen (CAD's engine, the `cadgen` command
and its MCP server), sets up text-to-cad in every agent app on your computer, and
replaces an older engine. Run it again to update everything, then restart your
agent apps.

By default, text-to-cad sends usage stats and crash reports, tagged with a random
ID and never including your files, paths or prompts; turn them off with
`uvx --no-config --managed-python --python 3.13 --from cadgen==0.8.3 cadgen telemetry off`,
or from the start by installing with
`curl -fsSL https://texttocad.dev/install.sh | sh -s -- --no-telemetry`.
[Telemetry](#telemetry) says the rest.

Installing by hand, app by app: [docs/install.md](docs/install.md)

### Updates

To update, run the install command again: it updates cadgen and text-to-cad in
every agent app, and the new release's engine takes over from the older one once
nothing is using it. Then restart your agent apps. Plugins also update through
their apps (Claude Code's and Codex's plugin marketplaces, Gemini's auto-update),
and the newer engine takes over the next time the app starts it.

When a newer release is out, a copy you installed yourself says so: a blue update
button, first in CAD's navbar and on its home, whose card shows the install
command to copy, and whose **Send to agent** posts "Run
`curl -fsSL https://texttocad.dev/install.sh | sh` to update text-to-cad to 0.9.0
(on Windows: `irm https://www.texttocad.dev/install.ps1 | iex`)" to your chat; or,
in an app that shows CAD's replies as text, a line with its reply. The card also
links to the [install instructions](https://www.texttocad.dev/install). Copies
from a plugin directory or the Cursor Marketplace never show it, since their store
updates them, and neither does Gemini's extension, which Gemini updates: for those
there is nothing to run.

To find out, cadgen fetches `api.texttocad.dev/v1/versions` at most once a day:
one anonymous request, with no ID, path or anything about you, never in CI and
never for a copy that something else updates. `CADGEN_UPDATE_CHECK=0` turns it off.

A project's Python environment keeps its own cadgen, and nothing updates it for
you. An older project cadgen keeps working with a newer engine, which says once,
as the project's worker starts, that `uv pip install -U cadgen` in that
environment updates it; a project cadgen newer than the engine says to run the
install command.

Updating from 0.8.0 or 0.8.1, whose engine never exits on its own: the install
command stops it, and so does `cadgen stop`
([details](docs/migrations/migrating-0.7-to-0.8.md#updating-from-080-or-081)).

A CAD project written for cadgen 0.7 needs porting to 0.8:
[the migration guide](docs/migrations/migrating-0.7-to-0.8.md) takes one across, step by
step, and an agent with the CAD skill can follow it.

### Telemetry

The CAD app (the plugin's `cad` server) and the browser viewer (`cadgen viewer`) send usage stats by default, with
what every `cadgen` command and model script counted, tagged with a random install ID: versions, where you installed
it from (as the plugin's CAD app names it, noted in cadgen's state folder for the rest), your OS and agent app, and
counts -- how often each CAD tool was called and why a call failed (one of a fixed set of words, such as "no file at
that path" or "no view open", never its message), how often views were used, how many files of each format were
shown, how many models were built and exported and snapshots drawn, how those ended, why one failed (again a fixed
word, such as "the model's code raised" or "the geometry kernel refused", never its message) and how long they took,
which features were used, and how many of the engine's warm workers started, crashed or were retired -- added up over
a few minutes before they are sent, each batch under a random ID of its own and the time it was made, so one sent
again is counted once. When cadgen's own
code fails, they also send a crash report: the error's type and where in cadgen (or Python, or one of its
dependencies) it failed, never its message, and with any of your own code a bare placeholder. Our server adds the country each request
comes from (worked out from its IP address, which it doesn't keep) and stores it all with PostHog. Never file names,
paths, contents or prompts. The first `cadgen` command says so once, and sending starts then. Turn it off, which
also deletes what was sent, with `uvx --no-config --managed-python --python 3.13 --from cadgen==0.8.3 cadgen telemetry off`, **Telemetry** in either app's menu (the logo at
the top left, over any model), or by asking your agent. `DO_NOT_TRACK=1` or `CADGEN_TELEMETRY=0` turns it off for
one process, and `CADGEN_TELEMETRY=1` on, without changing your setting; nothing is sent by default in CI or from a
development install. Nothing waits to send: a command or a model script sends nothing itself, and what it counted,
like what any part of cadgen counted since its last send when it exits, waits in small files in cadgen's state folder
until the CAD app or the viewer sends it in the background -- or, when nothing has for five minutes, a short-lived
sender the next command starts, which sends it and exits; turning telemetry off deletes them.
Offline, nothing is sent and everything works. See
the [privacy policy](https://www.texttocad.dev/privacy-policy).

## 🧰 Skills

Install the library to give agents focused workflows for CAD, fabrication,
robot description files, simulation, and local review.

| Skill        | Summary                                                                                                                                            | Source                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| CAD          | Creates and edits CAD models from plain-language or image requests as Python scripts, built into XBF documents with STEP, STL, 3MF and GLB exports. | [skills/cad](skills/cad/SKILL.md)                   |
| step.parts   | Finds off-the-shelf STEP parts like screws, bearings, motors, and connectors.                                                                      | [skills/step-parts](skills/step-parts/SKILL.md)     |
| Engineering Drawing | Dimensioned engineering drawings from a part, as a PDF: views, hidden lines, dimensions, hole callouts, title block. | [skills/engineering-drawing](skills/engineering-drawing/SKILL.md) |
| DXF          | Creates 2D DXF drawings like profiles, templates, gaskets, and cut layouts from Python sources or CAD geometry.                                    | [skills/dxf](skills/dxf/SKILL.md)                   |
| URDF         | Writes robot structure files with links, joints, limits, inertials, and meshes.                                                                    | [skills/urdf](skills/urdf/SKILL.md)                 |
| SRDF         | Adds MoveIt planning groups, end effectors, poses, and collision rules to a URDF.                                                                  | [skills/srdf](skills/srdf/SKILL.md)                 |
| SDF          | Creates simulator models and worlds with frames, physics, sensors, and lights.                                                                     | [skills/sdf](skills/sdf/SKILL.md)                   |
| SendCutSend  | Checks DXF and STEP files before upload to SendCutSend.                                                                                            | [skills/sendcutsend](skills/sendcutsend/SKILL.md)   |
| DfAM Check   | Measures mesh printability per process: wall thickness, overhangs, support volume, and build orientation.                                          | [skills/dfam-check](skills/dfam-check/SKILL.md)     |
| DFM | Reviews a part for sheet metal, CNC machining, or injection molding, with measured evidence and the cited rule behind every finding; measures draft, undercuts and projected area from a mesh. | [skills/dfm](skills/dfm/SKILL.md) |
| G-code       | Slices models into printer-ready G-code with OrcaSlicer, using your own printer presets.                                                           | [skills/gcode](skills/gcode/SKILL.md)               |
| Bambu Labs   | Sends prints to Bambu Lab printers through Bambu Connect, Bambu Lab's official app, or Bambu Studio.                                               | [skills/bambu-labs](skills/bambu-labs/SKILL.md)     |

## 🛠️ Contributing

Branch from `main` and open PRs against `main`. For the local workflow, testing in
agent apps and validation, see [CONTRIBUTING.md](CONTRIBUTING.md); an agent working in
the repository starts at [AGENTS.md](AGENTS.md). A security problem is reported privately,
as [SECURITY.md](SECURITY.md) says.


<a href="https://trendshift.io/repositories/26559"><img src="https://trendshift.io/api/badge/repositories/26559" alt="earthtojake/text-to-cad | Trendshift" width="250" height="55"></a>

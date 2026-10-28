# text-to-cad's installer for Windows:
#
#   irm https://texttocad.dev/install.ps1 | iex
#
# It finds uv, or installs it with uv's own installer, then runs `cadgen install` from the newest
# cadgen release through uvx: text-to-cad installed or updated in every agent app on this machine.
# Run it again to update. For its options, run it as a script block:
#
#   & ([scriptblock]::Create((irm https://texttocad.dev/install.ps1))) --help
#
# Everything happens inside Install-TextToCad, called on the last line: a download cut short runs
# nothing, and a failure returns instead of closing the window.

function Install-TextToCad {
    $ErrorActionPreference = 'Stop'
    # The release this script was published with, installed when the version feed cannot be read.
    $CadgenVersion = "0.8.3"
    $VersionFeed = 'https://api.texttocad.dev/v1/versions'
    $Releases = 'https://github.com/earthtojake/text-to-cad/releases/download'

    function Show-Usage {
        Write-Host "text-to-cad's installer: installs or updates text-to-cad in every agent app on this machine."
        Write-Host ''
        Write-Host '  irm https://texttocad.dev/install.ps1 | iex'
        Write-Host '  & ([scriptblock]::Create((irm https://texttocad.dev/install.ps1))) --dry-run'
        Write-Host ''
        Write-Host 'Options (all but --version go to `cadgen install`):'
        Write-Host '  --dry-run          print the plan and stop: nothing is changed'
        Write-Host '  --yes              go ahead without asking'
        Write-Host '  --only APP[,APP]   only these apps: claude, claude-desktop, codex, cursor, grok, gemini'
        Write-Host '  --uninstall        take text-to-cad out again (with --purge, cadgen''s state and caches too)'
        Write-Host '  --no-telemetry     turn telemetry off'
        Write-Host "  --version X.Y.Z    install that cadgen release (default: the newest, from $VersionFeed)"
        Write-Host ''
        Write-Host "uv comes from its own installer when it is missing; UV_NO_MODIFY_PATH=1 keeps it from editing"
        Write-Host 'your PATH. To read this script before running it, or to keep to one release, take the copy'
        Write-Host "attached to that release and check it against the release's SHA256SUMS:"
        Write-Host ''
        Write-Host "  irm $Releases/v$CadgenVersion/install.ps1 -OutFile install.ps1"
        Write-Host "  irm $Releases/v$CadgenVersion/SHA256SUMS"
        Write-Host '  (Get-FileHash install.ps1 -Algorithm SHA256).Hash'
        Write-Host '  powershell -ExecutionPolicy ByPass -File install.ps1'
        Write-Host ''
        Write-Host 'On macOS and Linux: curl -fsSL https://texttocad.dev/install.sh | sh'
    }

    # uvx: on PATH, else where uv's installer puts it before a new shell has it on PATH.
    function Find-Uvx {
        $command = Get-Command uvx -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
        $folders = @($env:UV_INSTALL_DIR)
        if ($env:UV_INSTALL_DIR) { $folders += (Join-Path $env:UV_INSTALL_DIR 'bin') }
        $folders += @($env:XDG_BIN_HOME, (Join-Path $HOME '.local\bin'), (Join-Path $HOME '.cargo\bin'))
        foreach ($folder in $folders) {
            if ($folder -and (Test-Path (Join-Path $folder 'uvx.exe'))) { return (Join-Path $folder 'uvx.exe') }
        }
        return $null
    }

    # --version picks the release; every other argument goes to `cadgen install`, in order.
    $version = $null
    $asked = $false
    $rest = @()
    for ($index = 0; $index -lt $args.Count; $index++) {
        $argument = [string]$args[$index]
        if ($argument -eq '-h' -or $argument -eq '--help') { Show-Usage; return }
        if ($argument -eq '--version') {
            if ($index + 1 -ge $args.Count) {
                Write-Host "error: --version needs a release, as in --version $CadgenVersion" -ForegroundColor Red
                return
            }
            $index++
            $version = [string]$args[$index]
            continue
        }
        if ($argument.StartsWith('--version=')) { $version = $argument.Substring(10); continue }
        if ($argument -eq '--yes' -or $argument -eq '-y') { $asked = $true }
        $rest += $argument
    }

    if ($version) {
        $origin = 'as --version asked'
    } else {
        # An older Windows PowerShell may not offer TLS 1.2 on its own.
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        try {
            $version = [string](Invoke-RestMethod -Uri $VersionFeed -TimeoutSec 3).latest
        } catch {
            $version = $null
        }
        if ($version) {
            $origin = 'the newest release'
        } else {
            $version = $CadgenVersion
            $origin = "this script's own: the version feed could not be read"
        }
    }
    if ($version -notmatch '^[0-9][0-9A-Za-z.+-]*$') {
        Write-Host "error: not a cadgen release: $version" -ForegroundColor Red
        return
    }

    $uvx = Find-Uvx
    if (-not $uvx) {
        Write-Host "uv is not installed: installing it with uv's own installer (https://docs.astral.sh/uv/):"
        Write-Host '  irm https://astral.sh/uv/install.ps1 | iex'
        $shell = (Get-Process -Id $PID).Path
        & $shell -NoProfile -ExecutionPolicy ByPass -Command 'irm https://astral.sh/uv/install.ps1 | iex'
        $uvx = Find-Uvx
        if (-not $uvx) {
            Write-Host 'error: uv was installed, but uvx was not found: open a new terminal and run this again' -ForegroundColor Red
            return
        }
    }
    # uvx's folder on PATH: `cadgen install` writes uvx's absolute path into the apps' configs.
    $env:Path = "$(Split-Path $uvx);$env:Path"

    $arguments = @('--no-config', '--managed-python', '--python', '3.13', '--refresh-package', 'cadgen',
                   '--from', "cadgen==$version", 'cadgen', 'install') + $rest
    # cadgen install asks at a terminal; with none it goes ahead without asking.
    if (-not $asked -and (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected)) {
        $arguments += '--yes'
    }
    Write-Host "text-to-cad: cadgen $version ($origin). The first run downloads it, which takes a minute."
    Write-Host "Running: $uvx $($arguments -join ' ')"
    & $uvx @arguments
    if ($LASTEXITCODE) {
        Write-Host "cadgen install exited $LASTEXITCODE; what it said is above." -ForegroundColor Red
    }
}

Install-TextToCad @args

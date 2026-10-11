# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh:
#   up [--capture <dir>]...  down  found [vessel-found args] (under a TTY; no TTY = CredentialTtyRefusal)  logs  <anything else> = the lares CLI INSIDE the container
# The CLI runs by `compose exec`, never `run` (founding alone runs). The engine gets no docker socket.
# LARES_STATE / LARES_WORKSPACE come from the environment or `lares-surface.env` beside the compose file; keep both
# mounts inside the WSL distro's filesystem, never a Windows share. One lararium per HUMAN: nothing here names a face.
$ErrorActionPreference = 'Stop'

function Die([string]$m) { [Console]::Error.WriteLine("lares-container: $m"); exit 2 }

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$ComposeFile = if ($env:LARES_COMPOSE_FILE) { $env:LARES_COMPOSE_FILE } else { Join-Path $Root 'docker-compose.surface.yml' }
$EnvFile = Join-Path (Split-Path -Parent $ComposeFile) 'lares-surface.env'
$Cli = 'packages/lares-cli/bin/lares.mjs'

foreach ($name in 'LARES_STATE', 'LARES_WORKSPACE') {
  $val = [Environment]::GetEnvironmentVariable($name)
  $inFile = (Test-Path $EnvFile) -and (Select-String -Path $EnvFile -Pattern "^\s*$name=\S" -Quiet)
  if (-not $val -and -not $inFile) { Die "$name stands in neither the environment nor $EnvFile — set it (the host directory mounted for the vessel)" }
}

$Base = @()
if (Test-Path $EnvFile) { $Base += @('--env-file', $EnvFile) }
$Base += @('-f', $ComposeFile)

function Compose([string[]]$more) {
  & docker compose @Base @more
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$Tty = (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
$NoTty = if ($Tty) { @() } else { @('-T') }

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|<lares verb…>' }
$verb = [string]$args[0]
$rest = @(); if ($args.Count -gt 1) { $rest = @($args[1..($args.Count - 1)]) }

switch ($verb) {
  'up' {
    $n = 0; $binds = @(); $i = 0
    while ($i -lt $rest.Count) {
      if ($rest[$i] -ne '--capture') { Die "unknown option $($rest[$i]) for up" }
      if ($i + 1 -ge $rest.Count) { Die '--capture wants a directory' }
      $d = $rest[$i + 1]
      if (-not (Test-Path -PathType Container $d)) { Die "--capture: $d is no directory" }
      $dir = (Resolve-Path $d).Path.TrimEnd('/', '\')
      $home_ = [Environment]::GetFolderPath('UserProfile').TrimEnd('/', '\')
      if ($dir -eq '' -or $dir -eq $home_ -or $dir -eq '/home') { Die "--capture refuses $dir — name a session root inside it, never a home directory whole" }
      $n++
      $binds += "      - type: bind`n        source: `"$dir`"`n        target: /capture/$n`n        read_only: true"
      $i += 2
    }
    if ($binds.Count -gt 0) {
      $override = [IO.Path]::GetTempFileName()
      try {
        Set-Content -Path $override -Value ("services:`n  lares:`n    volumes:`n" + ($binds -join "`n")) -Encoding utf8
        & docker compose @Base -f $override up -d lares
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      } finally { Remove-Item -Force $override -ErrorAction SilentlyContinue }
    } else { Compose @('up', '-d', 'lares') }
  }
  'down'  { Compose (@('down', '--remove-orphans') + $rest) }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
  'found' {
    if ($rest.Count -eq 0) { Compose (@('--profile', 'found', 'run', '--rm') + $NoTty + @('found')) }
    else { Compose (@('--profile', 'found', 'run', '--rm') + $NoTty + @('found', 'vessel', 'found', '--skip-build', '--root', '/state', '--genesis', '/app/genesis') + $rest) }
  }
  default { Compose (@('exec') + $NoTty + @('lares', 'node', $Cli, $verb) + $rest) }
}

# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh: up [--capture <dir>]...  down  found [vessel-found args]  logs
# vessel stand  <lares verb…>. The CLI runs by exec while a vessel stands and through the offline door while none
# stands. The host holds the engine: the shim reads the CLI's standing verdict after a verb and restarts the vessel
# itself when the verdict reads `restand`. The app gets no docker socket.
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

# Whether a vessel stands. A `ps` that fails reads as UNKNOWN, never as "none stands": the offline door opens only
# on a reading, so a broken engine never routes an act beside a live holder.
function HasRunningVessel {
  $id = & docker compose @Base ps -q --status running lares
  if ($LASTEXITCODE -ne 0) { Die "cannot read the vessel's state (docker compose ps failed); nothing ran" }
  return -not [string]::IsNullOrWhiteSpace(($id -join ''))
}

# The CLI's own reading of the standing vessel against its state on disk. It runs without a TTY: the answer is JSON
# for this script, never a prompt.
$script:ObserveFailed = $false
function ObserveStanding {
  $out = & docker compose @Base exec -T lares node $Cli vessel stand --observe --json
  $script:ObserveFailed = ($LASTEXITCODE -ne 0)
  return ,@($out)
}

function VerdictRestand([string[]]$output) {
  try { return (ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.act -eq 'restand' } catch { return $false }
}

function LiftVessel([string[]]$output) {
  $reason = 'the standing requires a re-stand'
  try { $reason = (ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.reason } catch {}
  [Console]::Error.WriteLine("lares-container: $reason; restarting the vessel")
  & docker compose @Base restart lares
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel restart failed'); exit $LASTEXITCODE }
  & docker compose @Base up -d --wait lares
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel did not answer healthy after its restart'); exit $LASTEXITCODE }
}

# Any CLI verb: inside the standing vessel, else through the offline door. A verb that succeeds inside a standing
# vessel gets followed by one standing check, and the shim lifts the vessel when the verdict asks for it.
function RouteCli([string[]]$argv, [bool]$followUp) {
  if (HasRunningVessel) {
    Compose (@('exec') + $NoTty + @('lares', 'node', $Cli) + $argv)
    if ($followUp) {
      # The verb landed. A standing check that fails leaves a possible lift unperformed, so it never passes silently.
      $answer = ObserveStanding
      if ($script:ObserveFailed) {
        [Console]::Error.WriteLine('lares-container: the verb succeeded, and the standing check after it failed; run `lares-container.ps1 vessel stand`')
        exit 1
      }
      if (VerdictRestand $answer) { LiftVessel $answer }
    }
  } else {
    [Console]::Error.WriteLine('lares-container: no vessel stands; this act runs offline on the store')
    Compose (@('--profile', 'offline', 'run', '--rm') + $NoTty + @('offline') + $argv)
  }
}

$Tty = (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
$NoTty = if ($Tty) { @() } else { @('-T') }

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|vessel stand|<lares verb…>' }
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
      # The path rides the override as a single-quoted YAML scalar (a quote doubles, nothing else escapes), with
      # each dollar sign doubled so compose reads it as a literal and interpolates nothing.
      if ($dir.Contains("`n")) { Die '--capture refuses a path that holds a newline' }
      $yamlDir = $dir.Replace("'", "''").Replace('$', '$$')
      $n++
      $binds += "      - type: bind`n        source: '$yamlDir'`n        target: /capture/$n`n        read_only: true"
      $i += 2
    }
    if ($binds.Count -gt 0) {
      $override = [IO.Path]::GetTempFileName()
      try {
        Set-Content -Path $override -Value ("services:`n  lares:`n    volumes:`n" + ($binds -join "`n")) -Encoding utf8
        & docker compose @Base -f $override up -d --wait lares
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      } finally { Remove-Item -Force $override -ErrorAction SilentlyContinue }
    } else { Compose @('up', '-d', '--wait', 'lares') }
  }
  'down'  { Compose (@('down', '--remove-orphans') + $rest) }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
  'found' {
    Compose (@('--profile', 'offline', 'run', '--rm') + $NoTty + @('offline', 'vessel', 'found', '--skip-build', '--root', '/state', '--genesis', '/app/genesis') + $rest)
  }
  'vessel' {
    $observing = $rest -contains '--observe'
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    $wipe = 'removes a vessel''s state; no pave or wipe command runs through this shim (a fresh start happens by hand: move the state directory aside, then found again)'
    if ($sub -eq 'stand' -and -not $observing) {
      # The acting stand belongs to the host and takes no option.
      if ($rest.Count -ne 1) { Die 'vessel stand takes no option through this shim (it stands or restarts the container); --observe reads the standing' }
      if (-not (HasRunningVessel)) { Compose @('up', '-d', '--wait', 'lares') }
      else {
        $answer = ObserveStanding
        if ($script:ObserveFailed) { Die 'the standing vessel answered no verdict' }
        if (VerdictRestand $answer) { LiftVessel $answer } else { $answer }
      }
    }
    # Stopping the daemon stops the container's main process: a host act.
    elseif ($sub -eq 'stop') { if ($rest.Count -ne 1) { Die 'vessel stop takes no option through this shim' }; Compose @('stop', 'lares') }
    # NO PAVE, NO WIPE: no verb of this shim removes a vessel's state.
    elseif ($sub -eq 'clear') { Die "vessel clear $wipe" }
    elseif ($sub -eq 'rite' -and $rest.Count -gt 1 -and $rest[1] -eq 'rebirth') { Die "vessel rite rebirth $wipe" }
    else { RouteCli (@($verb) + $rest) (-not $observing) }
  }
  default { RouteCli (@($verb) + $rest) $true }
}

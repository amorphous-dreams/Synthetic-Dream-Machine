# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh: up [--capture <dir>]...  down [compose-down args]  found [vessel-found args]  logs
# vessel stand  <lares verb…>. The CLI runs by exec while a vessel stands and through the offline door while none
# stands. The host holds the engine: the shim reads the CLI's standing verdict after a verb and restarts the vessel
# itself when the verdict reads `restand`. The app gets no docker socket.
# LARES_HOUSE / LARES_WORKSPACE come from the environment or the operator's `~/.lares/lares-surface.env` (outside every
# bind; never beside the compose file). LARES_HOUSE names the ONE host house root, absolute: its hearth, sensoriums,
# projections, library and config bind under /lar, and this shim makes those five directories before a container stands. Keep every
# mount inside the WSL distro's filesystem, never a Windows share. One lararium per HUMAN: nothing here names a face.
# A VESSEL STANDS HOLDING NO KEY. Every start returns it to the floor, so after `up`, after `vessel stand`, and after
# each restart this shim performs, it runs `vault unlock` attached when this shell holds a TTY, and otherwise names
# that one command. `vault lock` routes to the CLI like any other verb. No flag, env var or pipe carries a credential.
# A STOP NEVER DROPS CONTENT SILENTLY. While a vessel stands, `down` asks it first (`vessel census`, by compose exec,
# bounded): the saves its sealed rest holds in memory and the carriers its disk projector has not settled. A clean
# answer stops as before; any item, or a census that cannot answer, prints what it learned and refuses, naming two ways
# on: unlock and let it settle (`vault unlock`, then `down` again), or type `accept-loss` on this terminal. With no
# terminal it refuses. With no vessel standing, `down` runs as it always has.
$ErrorActionPreference = 'Stop'

function Die([string]$m) { [Console]::Error.WriteLine("lares-container: $m"); exit 2 }

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$ComposeFile = if ($env:LARES_COMPOSE_FILE) { $env:LARES_COMPOSE_FILE } else { Join-Path $Root 'docker-compose.surface.yml' }
$EnvFile = Join-Path (Join-Path $HOME '.lares') 'lares-surface.env'
$Cli = 'packages/lares-cli/bin/lares.mjs'

foreach ($name in 'LARES_HOUSE', 'LARES_WORKSPACE') {
  $val = [Environment]::GetEnvironmentVariable($name)
  $inFile = (Test-Path $EnvFile) -and (Select-String -Path $EnvFile -Pattern "^\s*$name=\S" -Quiet)
  if (-not $val -and -not $inFile) { Die "$name stands in neither the environment nor $EnvFile — set it (the host directory mounted for the vessel)" }
}

# The value one name carries: the environment first, else the env file's last plain KEY=VALUE line for it.
function ValueOf([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if (-not $v -and (Test-Path $EnvFile)) {
    $line = Select-String -Path $EnvFile -Pattern "^\s*$name=(.*)$" | Select-Object -Last 1
    if ($line) { $v = $line.Matches[0].Groups[1].Value }
  }
  return [string]$v
}
$House = ValueOf 'LARES_HOUSE'
if (-not [System.IO.Path]::IsPathRooted($House)) { Die "LARES_HOUSE ($House) reads relative — name the host house root by an absolute path" }
$HouseClasses = @('hearth', 'sensoriums', 'projections', 'library', 'config')
# THE ENV FILE RESTS OUTSIDE EVERY BIND.
$envFull = [System.IO.Path]::GetFullPath($EnvFile)
foreach ($class in $HouseClasses) {
  $bind = [System.IO.Path]::GetFullPath((Join-Path $House $class)).TrimEnd('/', '\')
  if ($envFull -eq $bind -or $envFull.StartsWith($bind + [System.IO.Path]::DirectorySeparatorChar)) { Die "the env file $EnvFile sits inside LARES_HOUSE's $class bind — keep it outside every bind" }
}
# Make the five bound classes as the operator, so the engine never makes one owned by root.
function EnsureHouse { foreach ($class in $HouseClasses) { New-Item -ItemType Directory -Force -Path (Join-Path $House $class) | Out-Null } }

$Base = @()
if (Test-Path $EnvFile) { $Base += @('--env-file', $EnvFile) }
else { $Base += @('--env-file', $(if ([System.IO.Path]::DirectorySeparatorChar -eq '\') { 'NUL' } else { '/dev/null' })) }
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

# The verdict an answer names, or '' when it names none this shim knows (an empty or unreadable answer).
function VerdictAct([string[]]$output) {
  try {
    $act = [string](ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.act
    if ($act -eq 'attach' -or $act -eq 'restand') { return $act }
  } catch {}
  return ''
}
function VerdictRestand([string[]]$output) { return (VerdictAct $output) -eq 'restand' }

# Does the standing vessel hold its key? The custody door answers on `vault status --json`; anything but a plain
# `"unlocked":true` reads as not held.
function KeyHeld {
  $out = & docker compose @Base exec -T lares node $Cli vault status --json 2>$null
  return (($out -join "`n") -match '"unlocked"\s*:\s*true')
}

# THE IMAGE'S REVISION LABEL AGAINST THE CHECKOUT'S HEAD: warns and stands. Read only on `up`, BEFORE compose runs so a
# build it triggers bakes the label; no git, or no checkout, skips the check with a note and never dies. A dirty tree
# (tracked files only) labels `<sha>-dirty`.
$script:GitRev = ''; $script:GitDirty = $false
function ResolveGitRev {
  try {
    $head = (& git -C $PSScriptRoot rev-parse HEAD 2>$null) -join ''
    if ($LASTEXITCODE -eq 0 -and $head) {
      $rev = $head.Trim()
      $porcelain = (& git -C $PSScriptRoot status --porcelain --untracked-files=no 2>$null) -join ''
      if ($porcelain) { $script:GitDirty = $true; $rev = "$rev-dirty" }
      $script:GitRev = $rev
      $env:GIT_REV = $rev
    }
  } catch { $script:GitRev = '' }
}
function WarnImageRevision {
  $rev = $script:GitRev
  if (-not $rev) {
    [Console]::Error.WriteLine('lares-container: no git checkout answers here, so the image revision check is skipped')
    return
  }
  $cid = (& docker compose @Base ps -q lares 2>$null) -join ''
  if ([string]::IsNullOrWhiteSpace($cid)) { return }
  $label = ((& docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' $cid 2>$null) -join '') -replace '[\x00-\x1f\x7f-\x9f]', ''
  $named = if ($label) { $label } else { 'none' }
  if ($label -eq $rev) { return }
  if ($script:GitDirty) {
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout holds uncommitted changes; commit first, then rebuild with ``" + '$env:GIT_REV = (git rev-parse HEAD); docker compose -f "' + $ComposeFile + '" build lares' + "`` and ``up`` again")
  } else {
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout stands at $rev; rebuild with ``" + "`$env:GIT_REV='$rev'; docker compose -f `"$ComposeFile`" build lares" + "``, then ``up`` again")
  }
}

# The vessel just stood (or restarted), so it holds no key. With a TTY, run the unlock attached; without one, name
# it. A refused or abandoned unlock leaves the vessel standing at the floor and never fails the act that stood it.
function UnlockOrName {
  if (KeyHeld) { return }
  if ($script:Tty) {
    [Console]::Error.WriteLine('lares-container: the vessel stands holding no vessel key; unlocking it on this terminal')
    & docker compose @Base exec lares node $Cli vault unlock
    if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel still stands at the floor; open it with `lares-container.ps1 vault unlock`') }
  } else {
    [Console]::Error.WriteLine('lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.ps1 vault unlock')
  }
}

function LiftVessel([string[]]$output) {
  $reason = 'the standing requires a re-stand'
  try { $reason = (ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.reason } catch {}
  [Console]::Error.WriteLine("lares-container: $reason; restarting the vessel")
  & docker compose @Base restart lares
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel restart failed'); exit $LASTEXITCODE }
  & docker compose @Base up -d --wait lares
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel did not answer healthy after its restart'); exit $LASTEXITCODE }
  UnlockOrName
}

# Any CLI verb: inside the standing vessel, else through the offline door. A verb that succeeds inside a standing
# vessel gets followed by one standing check, and the shim lifts the vessel when the verdict asks for it.
function RouteCli([string[]]$argv, [bool]$followUp) {
  if (HasRunningVessel) {
    Compose (@('exec') + $NoTty + @('lares', 'node', $Cli) + $argv)
    if ($followUp) {
      # The verb landed. A standing check that fails leaves a possible lift unperformed, so it never passes silently.
      $answer = ObserveStanding
      if ($script:ObserveFailed -or (VerdictAct $answer) -eq '') {
        [Console]::Error.WriteLine('lares-container: the verb succeeded, and the standing check after it answered no verdict; run `lares-container.ps1 vessel stand`')
        exit 1
      }
      if (VerdictRestand $answer) { LiftVessel $answer }
    }
  } else {
    [Console]::Error.WriteLine('lares-container: no vessel stands; this act runs offline on the store')
    EnsureHouse
    Compose (@('--profile', 'offline', 'run', '--rm') + $NoTty + @('offline') + $argv)
  }
}

# THE CENSUS BEFORE A STOP, bounded over the whole exec, so a wedged vessel never hangs `down`.
$CensusWaitSeconds = 60
function OfferAcceptLoss {
  [Console]::Error.WriteLine('lares-container: the vessel stands. Two ways on:')
  [Console]::Error.WriteLine('  - unlock it and let it settle: tools/lares-container.ps1 vault unlock, then tools/lares-container.ps1 down again')
  [Console]::Error.WriteLine('  - stop anyway, dropping what the list names: type accept-loss below')
  if (-not $script:Tty) { Die 'down refuses: no terminal stands here to type accept-loss on; the vessel stands' }
  [Console]::Out.Write('Type accept-loss to stop anyway: ')
  $answer = [Console]::In.ReadLine()
  if ($null -eq $answer) { Die 'down: no answer read; the vessel stands' }
  if ($answer.TrimEnd("`r") -ne 'accept-loss') { Die 'down: the answer did not read accept-loss; the vessel stands' }
  [Console]::Error.WriteLine('lares-container: accept-loss typed; stopping the vessel')
}
function Indent([string]$text) {
  foreach ($line in ($text -split "`r?`n")) { if ($line) { [Console]::Error.WriteLine("  $line") } }
}
function CensusBeforeStop {
  $psi = [System.Diagnostics.ProcessStartInfo]::new('docker')
  foreach ($a in (@('compose') + $Base + @('exec', '-T', 'lares', 'node', $Cli, 'vessel', 'census', '--no-json'))) { $psi.ArgumentList.Add([string]$a) }
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.RedirectStandardInput = $true
  $out = ''; $err = ''; $rc = -1; $timedOut = $false
  try {
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Close()
    $outTask = $p.StandardOutput.ReadToEndAsync(); $errTask = $p.StandardError.ReadToEndAsync()
    if ($p.WaitForExit($CensusWaitSeconds * 1000)) { $p.WaitForExit(); $rc = $p.ExitCode }
    else { $timedOut = $true; try { $p.Kill($true) } catch {} }
    if ($outTask.Wait(5000)) { $out = $outTask.Result }
    if ($errTask.Wait(5000)) { $err = $errTask.Result }
  } catch { $err = $_.Exception.Message }
  if ($rc -eq 0 -and ($out -split "`r?`n" | Where-Object { $_ -like 'census: clean*' })) { return }
  if ($rc -eq 3 -and -not $timedOut) {
    [Console]::Error.WriteLine('lares-container: down refuses a silent stop: the census names content that rests nowhere yet, and a stop now drops it:')
    Indent $out
  } else {
    $why = if ($timedOut) { "no answer within ${CensusWaitSeconds}s (the vessel may stand wedged)" } else { "the census exec ended with status $rc" }
    [Console]::Error.WriteLine("lares-container: down refuses a silent stop: the census could not answer ($why), so what a stop would drop reads unknown")
    Indent $out
    Indent $err
  }
  OfferAcceptLoss
}

$script:Tty = (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
$Tty = $script:Tty
$NoTty = if ($Tty) { @() } else { @('-T') }

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|vessel stand|<lares verb…>' }
$verb = [string]$args[0]
$rest = @(); if ($args.Count -gt 1) { $rest = @($args[1..($args.Count - 1)]) }

switch ($verb) {
  'up' {
    EnsureHouse
    ResolveGitRev
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
    WarnImageRevision
    UnlockOrName
  }
  'down'  {
    # A ps that fails reads as UNKNOWN: whether a vessel stands, and what it holds, goes uncounted, so the same typed
    # acceptance guards the stop.
    $ids = & docker compose @Base ps -q --status running lares
    if ($LASTEXITCODE -ne 0) {
      [Console]::Error.WriteLine('lares-container: down refuses a silent stop: docker compose ps failed, so whether a vessel stands reads unknown')
      OfferAcceptLoss
    } elseif (-not [string]::IsNullOrWhiteSpace(($ids -join ''))) { CensusBeforeStop }
    Compose (@('down', '--remove-orphans') + $rest)
  }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
  'found' {
    EnsureHouse
    Compose (@('--profile', 'offline', 'run', '--rm') + $NoTty + @('offline', 'vessel', 'found', '--skip-build', '--root', '/lar', '--genesis', '/app/genesis') + $rest)
  }
  'vessel' {
    $observing = $rest -contains '--observe'
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    if ($sub -eq 'stand' -and -not $observing -and $rest.Count -eq 1) {
      # The no-argument acting stand belongs to the host: it stands, restarts on a `restand` verdict, or prints the standing.
      if (-not (HasRunningVessel)) { EnsureHouse; Compose @('up', '-d', '--wait', 'lares'); UnlockOrName }
      else {
        $answer = ObserveStanding
        if ($script:ObserveFailed -or (VerdictAct $answer) -eq '') { Die 'the standing vessel answered no verdict' }
        if (VerdictRestand $answer) { LiftVessel $answer } else { $answer }
      }
    }
    # Stopping the daemon stops the container's main process: a host act.
    elseif ($sub -eq 'stop') { if ($rest.Count -ne 1) { Die 'vessel stop takes no option through this shim' }; Compose @('stop', 'lares') }
    else { RouteCli (@($verb) + $rest) (-not $observing) }
  }
  default { RouteCli (@($verb) + $rest) $true }
}

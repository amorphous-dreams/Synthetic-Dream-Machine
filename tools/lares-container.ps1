# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh: up [--capture <dir>]... [--workspace <name>=<dir>]...  down [compose-down args]  found [vessel-found args]  logs
# build [compose-build args]  vessel stand  <lares verb…>. `build` rebuilds the vessel image (every package the
# vessel runs) from the committed checkout, through the env file, stamping HEAD as its revision label; a dirty checkout,
# or none, refuses by name. The CLI runs by exec while a vessel stands and through the offline door while none
# stands. The host holds the engine: the shim reads the CLI's standing verdict after a verb and restarts the vessel
# itself when the verdict reads `restand`. The app gets no docker socket.
# LARES_HOUSE / LARES_WORKSPACE come from the environment or the operator's `~/.lares/lares-surface.env` (outside every
# bind; never beside the compose file). LARES_WORKSPACE names the workspace the house lays canon from and projects into,
# a projection target the operator names; for the Kahu cabal it names the repo checkout, the working surface
# (founding-runbook#/prepare). LARES_HOUSE names the ONE host house root, absolute: its hearth, sensoriums,
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
# The pūlama's socket directory binds into the vessel in every mode, so the shim makes it as the operator whether or not
# a pūlama stands; the engine never makes it owned by root.
$HouseClasses = @('hearth', 'sensoriums', 'projections', 'library', 'config', 'pulama/socket')
# THE PŪLAMA (road L47e): with LARES_PULAMA=1 the house's custody holder stands in its own container beside the vessel,
# lit once by the operator's own hand (`pulama light`), outliving every vessel restart. Its socket and private state rest
# under LARES_HOUSE/pulama, so they keep the operator's ownership.
$PulamaMode = (ValueOf 'LARES_PULAMA') -eq '1'
if ($PulamaMode) {
  $HouseClasses += @('pulama/state')
  [Environment]::SetEnvironmentVariable('LAR_PULAMA_SOCKET', '/pulama/socket/pulama.sock')
  # The kūkulu's offer (its lei and the standing vessel's vouch) rests in the config bind, which the rite writes on the host.
  [Environment]::SetEnvironmentVariable('LAR_KUKULU_OFFER', '/lar/config/kukulu-offer.json')
}
$PulamaMain = 'packages/lararium-node/dist/src/pulama-main.js'
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

# A STOP NEVER STRANDS AN ACT INSIDE THE VESSEL. Docker forwards no signal to an exec'd process, and a killed
# `compose run` client leaves its container running. An exec carries LARES_EXEC_TAG (by name, a random value of this
# run) and a run names its container; when Ctrl+C stops the act before it ends, the finally block signals each vessel
# process holding the tag, or stops and removes the named run container.
$env:LARES_EXEC_TAG = -join ((1..8) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
$RunName = "lares-offline-$($env:LARES_EXEC_TAG)"
# The in-vessel stop: signal each process whose environment holds this run's tag.
$StopScript = 'for p in /proc/[0-9]*; do pid=${p#/proc/}; [ "$pid" = "$$" ] && continue; if tr "\0" "\n" < "$p/environ" 2>/dev/null | grep -qx "LARES_EXEC_TAG=$2"; then kill -s "$1" "$pid" 2>/dev/null; fi; done'

# A LONE SIGNAL STOPS THE ACT TOO (Linux, macOS). A TERM, HUP or QUIT sent to this pwsh alone never reaches the finally
# below, so a POSIX signal registration runs the same stop: it ends the compose client (this process's child), stops
# what the act started inside the vessel, and exits by the signal's code (128 + its number). The handler runs on a
# runtime thread that holds no PowerShell runspace, so it lives in a small compiled class rather than a script block.
# Windows, and a pwsh without the registration type, keep the finally alone.
$script:SignalStop = $null
function ArmSignalStop([string]$kind) {
  if (-not ($IsLinux -or $IsMacOS)) { return $null }
  if (-not ('System.Runtime.InteropServices.PosixSignalRegistration' -as [type])) { return $null }
  if (-not ('LaresSignalStop' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
public sealed class LaresSignalStop : IDisposable {
  static volatile bool stopping;
  public static bool Stopping { get { return stopping; } }
  readonly List<PosixSignalRegistration> regs = new List<PosixSignalRegistration>();
  readonly string[] composeBase; readonly string kind; readonly string tag; readonly string runName; readonly string stop;
  public LaresSignalStop(string[] composeBase, string kind, string tag, string runName, string stop) {
    this.composeBase = composeBase; this.kind = kind; this.tag = tag; this.runName = runName; this.stop = stop;
    regs.Add(PosixSignalRegistration.Create(PosixSignal.SIGTERM, ctx => Handle(ctx, "TERM", 143)));
    regs.Add(PosixSignalRegistration.Create(PosixSignal.SIGHUP, ctx => Handle(ctx, "HUP", 129)));
    regs.Add(PosixSignalRegistration.Create(PosixSignal.SIGQUIT, ctx => Handle(ctx, "QUIT", 131)));
  }
  static void Run(string file, IEnumerable<string> args) {
    try {
      var psi = new ProcessStartInfo(file) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
      foreach (var a in args) psi.ArgumentList.Add(a);
      using (var p = Process.Start(psi)) { p.WaitForExit(30000); }
    } catch (Exception) { }
  }
  void Handle(PosixSignalContext ctx, string sig, int code) {
    ctx.Cancel = true;
    stopping = true;
    Run("pkill", new[] { "-TERM", "-P", Environment.ProcessId.ToString() });
    if (kind == "run") {
      Run("docker", new[] { "stop", "-t", "10", runName });
      Run("docker", new[] { "rm", "-f", runName });
    } else {
      var args = new List<string> { "compose" }; args.AddRange(composeBase);
      args.AddRange(new[] { "exec", "-T", "lares", "sh", "-c", stop, "stop", sig, tag });
      Run("docker", args);
    }
    Environment.Exit(code);
  }
  public void Dispose() { foreach (var r in regs) r.Dispose(); }
}
'@
  }
  return [LaresSignalStop]::new([string[]]$Base, $kind, $env:LARES_EXEC_TAG, $RunName, $StopScript)
}

function Act([string]$kind, [string[]]$more) {
  $ended = $false
  $armed = ArmSignalStop $kind
  try {
    & docker compose @Base @more
    # The signal stop ended the client: its handler owns the exit (by the signal's code), so this thread waits for it.
    while ($null -ne $armed -and [LaresSignalStop]::Stopping) { Start-Sleep -Milliseconds 200 }
    $ended = $true
  } finally {
    if ($null -ne $armed) { $armed.Dispose() }
    if (-not $ended) {
      if ($kind -eq 'run') {
        & docker stop -t 10 $RunName *> $null
        & docker rm -f $RunName *> $null
      } else {
        & docker compose @Base exec -T lares sh -c $StopScript stop INT $env:LARES_EXEC_TAG *> $null
      }
    }
  }
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

# THE IMAGE'S REVISION LABEL AGAINST THE CHECKOUT'S HEAD: warns and stands. Every stand and restart this shim performs reads it
# (`up`, the bare `vessel stand`, a re-stand); `up` resolves the rev BEFORE compose runs so a build it triggers bakes the label; no git, or no checkout, skips the check with a note and never dies. A dirty tree
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
  if (-not $script:GitRev) { ResolveGitRev }
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
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout holds uncommitted changes; commit first, then rebuild with ``tools/lares-container.ps1 build`` and ``up`` again")
  } else {
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout stands at $rev; rebuild with ``tools/lares-container.ps1 build``, then ``up`` again")
  }
}

# THE FACE TO WEAR AGAIN. The mount never survives a restart, so the shim keeps the face the operator last wore through it
# (`vault unlock --face N`) in the house's config (`config/last-worn-face`, a reset keeps it): after a stand or a restart it
# opens every face the credential opens and wears that one again, else face 0.
$WornFaceFile = Join-Path (Join-Path $House 'config') 'last-worn-face'
function LastWornFace {
  try { $w = (Get-Content -Raw -Path $WornFaceFile -ErrorAction Stop).Trim() } catch { $w = '' }
  if ($w -match '^[0-9]+$') { return $w } else { return '0' }
}
function RememberWornFace([string[]]$argv) {
  $face = ''
  for ($i = 0; $i -lt $argv.Count; $i++) {
    if ($argv[$i] -eq '--face' -and $i + 1 -lt $argv.Count) { $face = $argv[$i + 1]; $i++ }
    elseif ($argv[$i] -like '--face=*') { $face = $argv[$i].Substring(7) }
  }
  if ($face -notmatch '^[0-9]+$') { return }
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $House 'config') | Out-Null
    Set-Content -Path $WornFaceFile -Value $face -Encoding ascii
  } catch { [Console]::Error.WriteLine('lares-container: the worn face could not be remembered; the next stand wears face 0') }
}

# The vessel just stood (or restarted), so it holds no key. With a TTY, run the unlock attached: it opens every face the
# credential opens (`--all`), then `lares wear` takes the last worn face again (or face 0); without one, name both commands. A refused or
# abandoned unlock leaves the vessel standing at the floor and never fails the act that stood it. A hint never names the
# bare command that fails on a vessel of several faces.
# UNDER A PŪLAMA THE ROUTE GOES TO THE PŪLAMA ALONE. The vessel's own unlock asks nothing there (it redials the pūlama),
# so it runs detached from this terminal, its stdin empty: an image that prompts anyway reads no keystroke.
function DetachedUnlock([string[]]$argv) {
  $null | & docker compose @Base exec -e LARES_EXEC_TAG @PassEnv -T lares node $Cli vault unlock @argv
  return $LASTEXITCODE
}
function DetachedWear([string]$face) {
  $null | & docker compose @Base exec -e LARES_EXEC_TAG @PassEnv -T lares node $Cli wear $face
  return $LASTEXITCODE
}
function UnlockOrName {
  if (KeyHeld) { return }
  $wear = LastWornFace
  if ($PulamaMode) {
    if ((DetachedUnlock @('--all')) -eq 0) {
      if ((DetachedWear "$wear") -ne 0) { [Console]::Error.WriteLine("lares-container: the vessel opened, but h$wear stands outside the lent set or locked; wear another face with ``lares-container.ps1 wear N``") }
    } else {
      [Console]::Error.WriteLine('lares-container: the vessel stands at the floor, unserved by the pūlama; read it with `lares-container.ps1 pulama status`, light it with `lares-container.ps1 pulama light`, admit the image that stands with `lares-container.ps1 pulama admit`, or raise a served vessel with `lares rite kukulu`')
    }
    return
  }
  if ($script:Tty) {
    [Console]::Error.WriteLine("lares-container: the vessel stands holding no vessel key; unlocking it on this terminal (every face the credential opens, then wear h$wear)")
    & docker compose @Base exec -e LARES_EXEC_TAG @PassEnv lares node $Cli vault unlock --all
    if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine("lares-container: the vessel still stands at the floor; open every face the credential opens with ``lares-container.ps1 vault unlock --all``, then ``lares-container.ps1 wear $wear``") }
    elseif ((DetachedWear "$wear") -ne 0) { [Console]::Error.WriteLine("lares-container: the vessel opened, but h$wear stands locked or outside the lent set; wear another face with ``lares-container.ps1 wear N``") }
  } else {
    [Console]::Error.WriteLine("lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.ps1 vault unlock --all, then lares-container.ps1 wear $wear (every face the credential opens, then wear h$wear; another face: wear N)")
  }
}

function LiftVessel([string[]]$output) {
  $reason = 'the standing requires a re-stand'
  try { $reason = (ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.reason } catch {}
  [Console]::Error.WriteLine("lares-container: $reason; restarting the vessel")
  & docker compose @Base restart lares
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel restart failed'); exit $LASTEXITCODE }
  # THE RESTART KEEPS THE WORKSPACES: the restart's `up` carries every LARES_WORKSPACES bind, as the operator's `up` did.
  $script:WorkspaceNames = @()
  $wsBinds = @()
  foreach ($pair in ((ValueOf 'LARES_WORKSPACES') -split ';')) { if ($pair) { $wsBinds += WorkspaceBind $pair } }
  if ($wsBinds.Count -gt 0) {
    $wsOverride = [IO.Path]::GetTempFileName()
    try {
      Set-Content -Path $wsOverride -Value ("services:`n  lares:`n    volumes:`n" + ($wsBinds -join "`n")) -Encoding utf8
      & docker compose @Base -f $wsOverride up -d --wait lares
    } finally { Remove-Item -Force $wsOverride -ErrorAction SilentlyContinue }
  } else {
    & docker compose @Base up -d --wait lares
  }
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel did not answer healthy after its restart'); exit $LASTEXITCODE }
  WarnImageRevision
  UnlockOrName
}

# Any CLI verb: inside the standing vessel, else through the offline door. A verb that succeeds inside a standing
# vessel gets followed by one standing check, and the shim lifts the vessel when the verdict asks for it.
function RouteCli([string[]]$argv, [bool]$followUp) {
  if (HasRunningVessel) {
    Act 'exec' (@('exec', '-e', 'LARES_EXEC_TAG') + $PassEnv + $NoTty + @('lares', 'node', $Cli) + $argv)
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
    Act 'run' (@('--profile', 'offline', 'run', '--rm', '--name', $RunName) + $PassEnv + $NoTty + @('offline') + $argv)
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
# THE HOUSE KEEPS ITSELF: where a keep workspace stands named, down runs the host's `rite keep --if-due` while the vessel
# still stands (it keeps only a house that moved); a keep that refuses never blocks the down. LARES_HOST_CLI names the
# host's lares door, else the checkout's own bin under the host's node.
function KeepBeforeDown {
  if ([string]::IsNullOrEmpty((ValueOf 'LARES_KEEP_WORKSPACE') + (ValueOf 'LARES_WORKSPACES'))) { return }
  $hostCli = ValueOf 'LARES_HOST_CLI'
  if ($hostCli) { $cmd = $hostCli; $pre = @() }
  elseif (Get-Command node -ErrorAction SilentlyContinue) { $cmd = 'node'; $pre = @((Join-Path $Root 'packages/lares-cli/bin/lares.mjs')) }
  else { [Console]::Error.WriteLine('lares-container: no host node answers, so down keeps nothing; `lares rite keep` keeps by hand'); return }
  & $cmd @pre rite keep --if-due --no-json
  if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the keep did not complete (above); down goes on, and `lares rite keep` keeps by hand') }
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
  # A LOCKED HEARTH: the census names the cure in one line (`census: vessel locked: ...`); say it plainly, not "could not answer".
  if (-not $timedOut -and ($err -split "`r?`n" | Where-Object { $_ -like 'census: vessel locked*' })) {
    [Console]::Error.WriteLine('lares-container: down refuses a silent stop: vessel locked: run tools/lares-container.ps1 vault unlock, then down')
    OfferAcceptLoss
    return
  }
  if ($rc -eq 3 -and -not $timedOut) {
    [Console]::Error.WriteLine('lares-container: down refuses a silent stop: the census names content that rests nowhere yet, and a stop now drops it:')
    Indent $out
  } else {
    $why = if ($timedOut) { "no answer within ${CensusWaitSeconds}s (the vessel may stand wedged)" } else { "the census exec ended with status $rc" }
    [Console]::Error.WriteLine("lares-container: down refuses a silent stop: the census could not answer ($why), so what a stop would drop reads unknown")
    [Console]::Error.WriteLine('lares-container: down cannot confirm the vessel census; it remains standing. Check tools/lares-container.sh logs, then retry down.')
    if ($env:LARES_DEBUG -eq '1') { Indent $out; Indent $err }
  }
  OfferAcceptLoss
}

$script:Tty = (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
$Tty = $script:Tty
$NoTty = if ($Tty) { @() } else { @('-T') }
# DISPLAY AND DEBUG RIDE BY NAME: each one the caller's environment sets crosses into the vessel as `-e NAME` (compose
# reads the value from this environment), so no value rides argv; no other name crosses, and no credential.
$PassEnv = @()
foreach ($name in @('NO_COLOR', 'TERM', 'COLORTERM', 'LARES_DEBUG', 'CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED')) {
  if (Test-Path "env:$name") { $PassEnv += @('-e', $name) }
}

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|build|vessel stand|<lares verb…> (build rebuilds the vessel image, every package, from the committed checkout)' }
$verb = [string]$args[0]
$rest = @(); if ($args.Count -gt 1) { $rest = @($args[1..($args.Count - 1)]) }

# A WORKSPACE (cabal-realm#/the-workbench): bound read-write at /lar/workspaces/<name>, from `--workspace <name>=<dir>` and from
# LARES_WORKSPACES (`;`-separated `<name>=<dir>` pairs). One inside LARES_HOUSE/hearth refuses; the checkout and LARES_WORKSPACE bind (rank 4j).
$script:WorkspaceNames = @()
function Test-Within([string]$child, [string]$parent) {
  $c = $child.TrimEnd('/', '\'); $p = $parent.TrimEnd('/', '\')
  return ($c -eq $p) -or $c.StartsWith($p + [System.IO.Path]::DirectorySeparatorChar) -or $c.StartsWith($p + '/')
}
function WorkspaceBind([string]$pair) {
  $at = $pair.IndexOf('=')
  if ($at -lt 1) { Die "--workspace wants <name>=<dir>, and `"$pair`" names no '='" }
  $name = $pair.Substring(0, $at); $wdir = $pair.Substring($at + 1)
  if ($name -cnotmatch '^[a-z0-9][a-z0-9._-]{0,63}$') { Die "--workspace: `"$name`" names no workspace (lower-case letters, digits, '.', '_' and '-')" }
  if ($script:WorkspaceNames -contains $name) { Die "--workspace: `"$name`" binds once" }
  if (-not (Test-Path -PathType Container $wdir)) { Die "--workspace ${name}: $wdir is no directory" }
  $real = (Get-Item $wdir).ResolveLinkTarget($true)
  $real = if ($real) { $real.FullName } else { (Resolve-Path $wdir).Path }
  $real = $real.TrimEnd('/', '\')
  if (Test-Within $real ([System.IO.Path]::GetFullPath((Join-Path $House 'hearth')))) { Die "--workspace $name refuses $real — it rests inside the hearth" }
  if ($real.Contains("`n")) { Die '--workspace refuses a path that holds a newline' }
  $script:WorkspaceNames += $name
  $yamlDir = $real.Replace("'", "''").Replace('$', '$$')
  return "      - type: bind`n        source: '$yamlDir'`n        target: /lar/workspaces/$name"
}

# The pūlama stands before any vessel (--no-recreate leaves a lit one lit), then the host reports the image digest the
# vessel will raise: a vessel never vouches for its own face.
# The digest of the image a vessel stands from: what up reports to the pūlama and what the kūkulu rite's offer names.
function ImageDigest {
  $image = ValueOf 'LARES_IMAGE'; if (-not $image) { $image = 'lares-surface:local' }
  $d = (& docker image inspect --format '{{.Id}}' $image) -join ''
  if ($LASTEXITCODE -ne 0) { Die "cannot read the vessel image's digest ($image); nothing raised" }
  return $d
}
function StandPulama {
  if (-not $PulamaMode) { return }
  & docker compose @Base --profile pulama up -d --no-recreate pulama
  if ($LASTEXITCODE -ne 0) { Die 'the pūlama did not stand; nothing raised' }
  $digest = ImageDigest
  # The image offers its seed beside its digest: a one-shot of the image (no house mounted) prints the whole frame on one
  # stdout line; a read that prints no frame falls back to the bare digest, so a seed read never blocks a stand.
  $image = ValueOf 'LARES_IMAGE'; if (-not $image) { $image = 'lares-surface:local' }
  $frame = ''
  try { $frame = ((& docker run --rm -e LAR_ROOT=/lar $image node $Cli vessel floor seed --genesis /app/genesis --image $digest 2>$null) | Select-Object -Last 1) } catch { $frame = '' }
  $report = if ("$frame".StartsWith('{')) { "$frame" } else { $digest }
  & docker compose @Base --profile pulama exec -T pulama node $PulamaMain image $report
  if ($LASTEXITCODE -ne 0) { Die "the pūlama refused the image report for $digest; nothing raised" }
}
# Does a pūlama run beside the vessel? It reads the container itself, whatever LARES_PULAMA now says: running, absent, or
# unknown where the ps fails.
function PulamaState {
  $id = & docker compose @Base --profile pulama ps -q --status running pulama
  if ($LASTEXITCODE -ne 0) { return 'unknown' }
  if ([string]::IsNullOrWhiteSpace(($id -join ''))) { return 'absent' }
  return 'running'
}

switch ($verb) {
  'up' {
    EnsureHouse
    ResolveGitRev
    $n = 0; $binds = @(); $i = 0
    while ($i -lt $rest.Count) {
      if ($rest[$i] -eq '--workspace') {
        if ($i + 1 -ge $rest.Count) { Die '--workspace wants <name>=<dir>' }
        $binds += WorkspaceBind ([string]$rest[$i + 1])
        $i += 2; continue
      }
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
    foreach ($pair in ((ValueOf 'LARES_WORKSPACES') -split ';')) { if ($pair) { $binds += WorkspaceBind $pair } }
    StandPulama
    if ($binds.Count -gt 0) {
      $override = [IO.Path]::GetTempFileName()
      try {
        Set-Content -Path $override -Value ("services:`n  lares:`n    volumes:`n" + ($binds -join "`n")) -Encoding utf8
        & docker compose @Base -f $override up -d --wait lares
        if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel did not become ready — check tools/lares-container.sh logs; if it already runs, run up again'); exit $LASTEXITCODE }
      } finally { Remove-Item -Force $override -ErrorAction SilentlyContinue }
    } else {
      & docker compose @Base up -d --wait lares
      if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel did not become ready — check tools/lares-container.sh logs; if it already runs, run up again'); exit $LASTEXITCODE }
    }
    WarnImageRevision
    UnlockOrName
  }
  'down'  {
    # A pūlama that reads unknown stops nothing: a full down would take a lit pūlama with it.
    $pulama = PulamaState
    if ($pulama -eq 'unknown') { Die 'down refuses: docker compose ps failed for the pūlama, so whether the pūlama stands reads unknown; the vessel and the pūlama stand' }
    # A ps that fails reads as UNKNOWN: whether a vessel stands, and what it holds, goes uncounted, so the same typed
    # acceptance guards the stop.
    $ids = & docker compose @Base ps -q --status running lares
    if ($LASTEXITCODE -ne 0) {
      [Console]::Error.WriteLine('lares-container: down refuses a silent stop: docker compose ps failed, so whether a vessel stands reads unknown')
      [Console]::Error.WriteLine('lares-container: down cannot confirm the vessel census; it remains standing. Check tools/lares-container.sh logs, then retry down.')
      OfferAcceptLoss
    } elseif (-not [string]::IsNullOrWhiteSpace(($ids -join ''))) { KeepBeforeDown; CensusBeforeStop }
    if ($pulama -eq 'running') {
      # The pūlama keeps the hearth lit through the rebuild: the vessel alone stops (with down's options) and leaves.
      Compose (@('stop') + $rest + @('lares')); Compose @('rm', '-f', 'lares')
    } else { Compose (@('down', '--remove-orphans') + $rest) }
  }
  'pulama' {
    if (-not $PulamaMode) { Die "pulama needs LARES_PULAMA=1 in the environment or $EnvFile" }
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    switch ($sub) {
      'up' { EnsureHouse; Compose @('--profile', 'pulama', 'up', '-d', '--no-recreate', 'pulama') }
      'down' { Compose @('--profile', 'pulama', 'stop', 'pulama') }
      { $_ -in @('light', 'lock', 'status', 'tessera') } { Compose (@('--profile', 'pulama', 'exec') + $NoTty + @('pulama', 'node', $PulamaMain, $sub)) }
      'admit' {
        # admit reads the route on a real terminal inside the pūlama; the face ordinals name the lent set (none names every lit face).
        $face = @($rest | Select-Object -Skip 1)
        foreach ($f in $face) { if ($f -notmatch '^[0-9]+$') { Die 'pulama admit takes face ordinals (numbers)' } }
        Compose (@('--profile', 'pulama', 'exec') + $NoTty + @('pulama', 'node', $PulamaMain, 'admit') + $face)
      }
      'unadmit' {
        # unadmit ends one image's admission: the route proves on a real terminal inside the pūlama, and a signed
        # tombstone naming the admission's tessera rests; the gate then reads pulama-image-unadmitted.
        if ($rest.Count -ne 2 -or $rest[1] -cnotmatch '^sha256:[0-9a-f]{64}$') { Die 'pulama unadmit takes one image digest (sha256:<64 hex>)' }
        Compose (@('--profile', 'pulama', 'exec') + $NoTty + @('pulama', 'node', $PulamaMain, 'unadmit', $rest[1]))
      }
      'keep-seat' {
        # The keep seat on a pūlama house: the pūlama proves the steward's route on this terminal and answers the wrapped seat
        # plus the local signing seed on one stdout line; the shim writes { ...seat, signer } as config/keep-seat.json (owner
        # read-write, temp file then move). The signer never reaches the screen or a log.
        $reseat = ($rest.Count -ge 2 -and $rest[1] -eq '--reseat')
        if ($rest.Count -gt 2 -or ($rest.Count -eq 2 -and -not $reseat)) { Die 'pulama keep-seat takes only --reseat' }
        if (-not $script:Tty) { Die 'pulama keep-seat reads its route on a terminal; run it on one (nothing seated)' }
        $seatFile = Join-Path (Join-Path $House 'config') 'keep-seat.json'
        if ((Test-Path $seatFile) -and -not $reseat) { Die "a keep seat already rests at $seatFile; pass --reseat to replace it" }
        [Console]::Error.WriteLine("lares-container: the pūlama now reads the steward's route to seat the keep (typed, unseen)")
        $line = ''
        & docker compose @Base --profile pulama exec pulama node $PulamaMain keep-seat | ForEach-Object {
          $l = "$_".Trim("`r")
          if ($l.StartsWith('{"op":"keep-seat"')) { $line = $l }
        }
        if (-not $line) { Die 'the pūlama answered no seat; nothing written' }
        $answer = $line | ConvertFrom-Json
        if ($answer.reading -eq 'refused') { Die "the pūlama seated nothing: $($answer.code) ($($answer.message))" }
        if ($answer.reading -ne 'seated' -or -not $answer.seat -or -not ($answer.signer -is [string]) -or -not ($answer.seat.publicKey -is [string])) { Die "the pūlama's seat line read malformed; nothing written" }
        $file = $answer.seat | Select-Object *
        $file | Add-Member -NotePropertyName signer -NotePropertyValue $answer.signer -Force
        $json = $file | ConvertTo-Json -Depth 32 -Compress
        New-Item -ItemType Directory -Force -Path (Join-Path $House 'config') | Out-Null
        $tmp = "$seatFile.$PID.tmp"
        [System.IO.File]::WriteAllText($tmp, $json + "`n")
        if (-not $IsWindows) { & chmod 600 $tmp }
        Move-Item -Force -LiteralPath $tmp -Destination $seatFile
        [Console]::Error.WriteLine("lares-container: the keep seat rests at $seatFile (0600); a keep now seals under it")
      }
      default { Die 'pulama takes up, down, light, admit, unadmit, keep-seat, lock, status or tessera' }
    }
  }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
  'image-digest' {
    if ($rest.Count -gt 0) { Die 'image-digest takes no arguments' }
    Write-Output (ImageDigest)
  }
  'build' {
    # THE IMAGE BUILDS THROUGH THE SHIM: compose reads the env file, and the revision label names the commit the
    # checkout stands at. A dirty checkout refuses (commit first), and so does a shim outside any checkout.
    ResolveGitRev
    if (-not $script:GitRev) { Die "build refuses: no git checkout answers at $PSScriptRoot, so the image's revision label would name no commit; build from a checkout" }
    if ($script:GitDirty) { Die "build refuses: the checkout holds uncommitted tracked changes, so the image's revision label ($($script:GitRev)) would name no real commit; commit first, then run build again" }
    [Console]::Error.WriteLine("lares-container: rebuilding the vessel image (every package) from the committed checkout at $($script:GitRev)")
    Compose (@('build') + $rest + @('lares'))
    [Console]::Error.WriteLine("lares-container: the vessel image stands rebuilt, stamped revision $($script:GitRev); ``up`` stands it")
  }
  'found' {
    EnsureHouse
    Act 'run' (@('--profile', 'offline', 'run', '--rm', '--name', $RunName) + $PassEnv + $NoTty + @('offline', 'vessel', 'found', '--skip-build', '--root', '/lar', '--genesis', '/app/genesis') + $rest)
  }
  'vessel' {
    $observing = $rest -contains '--observe'
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    if ($sub -eq 'stand' -and -not $observing -and $rest.Count -eq 1) {
      # The no-argument acting stand belongs to the host: it stands, restarts on a `restand` verdict, or prints the standing.
      if (-not (HasRunningVessel)) { EnsureHouse; StandPulama; Compose @('up', '-d', '--wait', 'lares'); WarnImageRevision; UnlockOrName }
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
  'lei' {
    # The lei hand door under a pūlama (#269): the vessel reads the act's terms, the pūlama reads the route on this terminal
    # and signs one record, the vessel lands it. The signing's terminal output shows as it runs; the answer is its last JSON
    # line. A signing that answers no record lands nothing. Without a pūlama, every lei act routes as before.
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    if ($PulamaMode -and $sub -in @('kui', 'restring', 'unstring')) {
      if (-not $script:Tty) { Die 'lei under a pūlama reads its route on a terminal; run it on one (nothing signed)' }
      $terms = ($null | & docker compose @Base exec @PassEnv -T lares node $Cli lei terms @rest) -join ''
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      $answer = ''
      & docker compose @Base --profile pulama exec pulama node $PulamaMain lei $sub $terms | ForEach-Object {
        [Console]::Error.WriteLine($_)
        $line = "$_".Trim("`r")
        if ($line.StartsWith('{')) { $answer = $line }
      }
      if (-not $answer) { Die 'the pūlama signed nothing; nothing lands' }
      $null | & docker compose @Base exec -e LARES_EXEC_TAG @PassEnv -T lares node $Cli lei land $answer
      exit $LASTEXITCODE
    }
    RouteCli (@($verb) + $rest) $true
  }
  'wear' {
    # `lares wear N` moves the daemon mount inside the lent set and asks no route; a wear that landed names the face the
    # operator wears, which the shim keeps for the next stand.
    RouteCli (@($verb) + $rest) $true
    $face = @($rest | Where-Object { $_ -match '^[0-9]+$' } | Select-Object -First 1)
    if ($face.Count -gt 0) { RememberWornFace @('--face', $face[0]) }
  }
  'vault' {
    # A `vault unlock --face N` that landed names the face the operator wears: the shim keeps it for the next stand.
    # Under a pūlama the unlock runs detached from this terminal: the route goes to the pūlama (pulama light), never
    # into a vessel's prompt.
    if ($PulamaMode -and $rest.Count -gt 0 -and $rest[0] -eq 'unlock') {
      if (-not (HasRunningVessel)) { Die 'vault unlock under a pūlama needs a standing vessel; run up' }
      $rc = DetachedUnlock @($rest | Select-Object -Skip 1)
      if ($rc -ne 0) { exit $rc }
      RememberWornFace $rest
      return
    }
    RouteCli (@($verb) + $rest) $true
    if ($rest.Count -gt 0 -and $rest[0] -eq 'unlock') { RememberWornFace $rest }
  }
  default { RouteCli (@($verb) + $rest) $true }
}

# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh: up [--capture <dir>]... [--workspace <name>=<dir>]...  down [compose-down args]  found [vessel-found args]  logs
# build [--at <rev>] [compose-build args]  vessel stand  <lares verb…>. `build` builds the vessel image (every package the
# vessel runs) from one commit (HEAD unless --at names another), unpacked from its archive under the house's cache,
# stamping that revision as its label; a dirty tree builds from HEAD and names what it left out; no checkout refuses.
# `rebuild [--at <rev>]` re-stands the house onto a new image: down (keep, census), build from the commit (tag, prune),
# then up, the pūlama's admit on this terminal and the last face worn; where the pūlama's code closure moved it restands
# the pūlama and stops for the operator's light: `pulama light`, then `rebuild --resume`. The CLI runs by exec while a vessel stands and through the offline door while none
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
# on: let it settle, by the way the vessel's state names (`wear N` where faces stand open and none worn, `vault unlock`
# where the key stands shut, a wait where a worn face holds it), then `down` again; or type `accept-loss` on this terminal. With no
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

# THE IMAGE'S REVISION LABEL AGAINST THE CHECKOUT'S HEAD: warns and stands. A build reads the commit, so uncommitted changes never ride an image and the label reads against HEAD alone. Every stand and restart this shim performs reads it
# (`up`, the bare `vessel stand`, a re-stand); `up` resolves the rev BEFORE compose runs so a build it triggers bakes the label; no git, or no checkout, skips the check with a note and never dies. A dirty tree
# (tracked files only) reads as dirty, and the warning names the changes no image carries.
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
  $head = $rev -replace '-dirty$', ''
  if ($label -eq $head) { return }
  if ($script:GitDirty) {
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout stands at $head, beside uncommitted changes no image carries; rebuild from the commit with ``tools/lares-container.ps1 build``, then ``up`` again")
  } else {
    [Console]::Error.WriteLine("lares-container: the image names revision $named and the checkout stands at $rev; rebuild with ``tools/lares-container.ps1 build``, then ``up`` again")
  }
}

# THE FACE TO WEAR AGAIN. The mount never survives a restart, so the shim keeps the face the operator last wore through it
# (`vault unlock --face N`) in the house's config (`config/last-worn-face`, a reset keeps it): after a stand or a restart it
# opens every face the credential opens and wears that one again.
# AN EMPTY MEMORY NAMES NO FACE. A file that reads empty (or absent, or no ordinal) answers '', and the shim wears
# nothing: a `wear` writes the pūlama's `face.worn`, which it wears again after every restart, so a guessed face 0 would
# outlive the guess. The vessel's own mount stands instead (node-vessel-identity's daemonMountOf: face 0 where it stands
# open, else the lowest face open, under a pūlama the lowest it lends lit).
$WornFaceFile = Join-Path (Join-Path $House 'config') 'last-worn-face'
function LastWornFace {
  try { $w = (Get-Content -Raw -Path $WornFaceFile -ErrorAction Stop).Trim() } catch { $w = '' }
  if ($w -match '^[0-9]+$') { return $w } else { return '' }
}
$NoFaceRemembered = "no face rests remembered (config/last-worn-face reads empty), so the shim wears none and the vessel's own mount stands; another face: wear N"
# The face an unlock's argv names (`--face N` or `--face=N`), '' where it names none or no ordinal.
function NamedFace([string[]]$argv) {
  $face = ''
  for ($i = 0; $i -lt $argv.Count; $i++) {
    if ($argv[$i] -eq '--face' -and $i + 1 -lt $argv.Count) { $face = $argv[$i + 1]; $i++ }
    elseif ($argv[$i] -like '--face=*') { $face = $argv[$i].Substring(7) }
  }
  if ($face -match '^[0-9]+$') { return $face } else { return '' }
}
function RememberWornFace([string[]]$argv) {
  $face = NamedFace $argv
  if (-not $face) { return }
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $House 'config') | Out-Null
    Set-Content -Path $WornFaceFile -Value $face -Encoding ascii
  } catch { [Console]::Error.WriteLine('lares-container: the worn face could not be remembered; the next stand wears the face remembered before, or none') }
}

# The vessel just stood (or restarted), so it holds no key. With a TTY, run the unlock attached: it opens every face the
# credential opens (`--all`), then `lares wear` takes the last worn face again (none remembered: the vessel's own mount); without one, name both commands. A refused or
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
# After an unlock that landed: wear the face last worn, or, with none remembered, say the vessel's own mount stands.
function WearAfterUnlock([string]$wear) {
  if (-not $wear) { [Console]::Error.WriteLine("lares-container: the vessel opened; $NoFaceRemembered"); return }
  if ((DetachedWear "$wear") -ne 0) { [Console]::Error.WriteLine("lares-container: the vessel opened, but h$wear stands outside the lent set or locked; wear another face with ``lares-container.ps1 wear N``") }
}
function UnlockOrName {
  if (KeyHeld) {
    # A HELD KEY IS NOT A WORN FACE. Under a pūlama the vessel redials its key at boot, while the mount lives in process
    # memory and leaves with every restart: the census frame names the worn face, and over faces lent and none worn the
    # shim wears the face last worn.
    if (NoneWorn) { WearLastFace }
    return
  }
  $wear = LastWornFace
  if ($PulamaMode) {
    if ((DetachedUnlock @('--all')) -eq 0) {
      WearAfterUnlock $wear
    } else {
      [Console]::Error.WriteLine('lares-container: the vessel stands at the floor, unserved by the pūlama; read it with `lares-container.ps1 pulama status`, light it with `lares-container.ps1 pulama light`, admit the image that stands with `lares-container.ps1 pulama admit`, or raise a served vessel with `lares rite kukulu`')
    }
    return
  }
  $thenWear = if ($wear) { ", then wear h$wear" } else { ", then the vessel's own mount" }
  if ($script:Tty) {
    [Console]::Error.WriteLine("lares-container: the vessel stands holding no vessel key; unlocking it on this terminal (every face the credential opens$thenWear)")
    & docker compose @Base exec -e LARES_EXEC_TAG @PassEnv lares node $Cli vault unlock --all
    if ($LASTEXITCODE -ne 0) {
      if ($wear) { [Console]::Error.WriteLine("lares-container: the vessel still stands at the floor; open every face the credential opens with ``lares-container.ps1 vault unlock --all``, then ``lares-container.ps1 wear $wear``") }
      else { [Console]::Error.WriteLine('lares-container: the vessel still stands at the floor; open every face the credential opens with `lares-container.ps1 vault unlock --all`') }
    }
    else { WearAfterUnlock $wear }
  } elseif ($wear) {
    [Console]::Error.WriteLine("lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.ps1 vault unlock --all, then lares-container.ps1 wear $wear (every face the credential opens, then wear h$wear; another face: wear N)")
  } else {
    [Console]::Error.WriteLine('lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.ps1 vault unlock --all (every face the credential opens; no face rests remembered, so the vessel mounts its own; another face: wear N)')
  }
}

function LiftVessel([string[]]$output) {
  $reason = 'the standing requires a re-stand'
  try { $reason = (ConvertFrom-Json -InputObject ($output -join "`n")).data.standing.reason } catch {}
  [Console]::Error.WriteLine("lares-container: $reason; restarting the vessel")
  # A lift over a moved image recreates the vessel, so the down path runs first; on the image that stands, a restart.
  if (VesselMoved) { DownIfMoved }
  else {
    & docker compose @Base restart lares
    if ($LASTEXITCODE -ne 0) { [Console]::Error.WriteLine('lares-container: the vessel restart failed'); exit $LASTEXITCODE }
  }
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
# THE WAY TO SETTLE READS THE VESSEL'S STATE: faces open and none worn (the census says so) wear one; a key the vessel holds
# under a worn face waits alone; a key it does not hold, or a census that never answered, unlocks.
function SettleWay([string]$err, [bool]$timedOut) {
  $lines = $err -split "`r?`n"
  if ($lines | Where-Object { $_ -like 'census: no face worn*' }) {
    return '  - wear a face and let it settle: tools/lares-container.ps1 wear N (faces stand open and none worn), then tools/lares-container.ps1 down again'
  }
  if (-not $timedOut -and -not ($lines | Where-Object { $_ -like 'census: vessel locked*' }) -and (KeyHeld)) {
    return '  - let it settle: give the vessel a moment, then tools/lares-container.ps1 down again'
  }
  return '  - unlock it and let it settle: tools/lares-container.ps1 vault unlock, then tools/lares-container.ps1 down again'
}
function OfferAcceptLoss([string]$err = '', [bool]$timedOut = $false) {
  [Console]::Error.WriteLine('lares-container: the vessel stands. Two ways on:')
  [Console]::Error.WriteLine((SettleWay $err $timedOut))
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
$script:KeepSaid = ''
function KeepBeforeDown {
  $script:KeepSaid = 'no keep workspace named'
  if ([string]::IsNullOrEmpty((ValueOf 'LARES_KEEP_WORKSPACE') + (ValueOf 'LARES_WORKSPACES'))) { return }
  $hostCli = ValueOf 'LARES_HOST_CLI'
  if ($hostCli) { $cmd = $hostCli; $pre = @() }
  elseif (Get-Command node -ErrorAction SilentlyContinue) { $cmd = 'node'; $pre = @((Join-Path $Root 'packages/lares-cli/bin/lares.mjs')) }
  else { $script:KeepSaid = 'no host node answered, so nothing kept'; [Console]::Error.WriteLine('lares-container: no host node answers, so down keeps nothing; `lares rite keep` keeps by hand'); return }
  & $cmd @pre rite keep --if-due --no-json
  if ($LASTEXITCODE -ne 0) { $script:KeepSaid = 'the keep did not complete'; [Console]::Error.WriteLine('lares-container: the keep did not complete (above); down goes on, and `lares rite keep` keeps by hand') }
  else { $script:KeepSaid = 'kept (rite keep --if-due)' }
}
# The census exec, bounded: `--no-json` gives the lines down prints, `--json` the frame a mount read greps.
function RunCensus([string]$fmt = '--no-json') {
  $psi = [System.Diagnostics.ProcessStartInfo]::new('docker')
  foreach ($a in (@('compose') + $Base + @('exec', '-T', 'lares', 'node', $Cli, 'vessel', 'census', $fmt))) { $psi.ArgumentList.Add([string]$a) }
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
  return [pscustomobject]@{ Out = $out; Err = $err; Rc = $rc; TimedOut = $timedOut }
}
# THE MOUNT, read: the census frame names `worn` beside the lit set, null where faces stand lent and none worn. Any
# other answer, or none, reads as no need to wear.
function NoneWorn { return ((RunCensus '--json').Out -match '"worn"\s*:\s*null') }
$script:Wore = ''
function WearLastFace {
  $wear = LastWornFace
  if (-not $wear) {
    $script:Wore = ''
    [Console]::Error.WriteLine('lares-container: faces stand lent and none worn, and no face rests remembered (config/last-worn-face reads empty); the shim wears none: wear one with `lares-container.ps1 wear N`')
    return
  }
  [Console]::Error.WriteLine("lares-container: faces stand lent and none worn; wearing h$wear, the face last worn")
  if ((DetachedWear "$wear") -eq 0) { $script:Wore = "h$wear" }
  else { $script:Wore = ''; [Console]::Error.WriteLine("lares-container: h$wear stands outside the lent set or locked; wear another face with ``lares-container.ps1 wear N``") }
}
function CensusBeforeStop {
  $c = RunCensus '--no-json'
  $out = $c.Out; $err = $c.Err; $rc = $c.Rc; $timedOut = $c.TimedOut
  if ($rc -eq 0 -and ($out -split "`r?`n" | Where-Object { $_ -like 'census: clean*' })) { return }
  # A LOCKED HEARTH: the census names the cure in one line (`census: vessel locked: ...`); say it plainly, not "could not answer".
  if (-not $timedOut -and ($err -split "`r?`n" | Where-Object { $_ -like 'census: vessel locked*' })) {
    [Console]::Error.WriteLine('lares-container: down refuses a silent stop: vessel locked: run tools/lares-container.ps1 vault unlock, then down')
    OfferAcceptLoss $err $timedOut
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
  OfferAcceptLoss $err $timedOut
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

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|build|rebuild|image-digest|pulama|vessel stand|<lares verb…> (build builds the vessel image, every package, from a commit; rebuild walks down, build, up, admit and the worn face)' }
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

# THE PŪLAMA'S CODE AGAINST THE IMAGE THAT STANDS. `up` keeps a lit pūlama lit (--no-recreate), so after a `build` it runs
# the image it stood from. The pūlama runs the vessel's image, so the image id moves with every vessel build; what decides
# a re-stand is the pūlama's own code closure, the `lares.pulama.closure` label a build stamps. One reading serves the
# line `up` and `pulama status` print and the `rebuild` verb's choice: absent, level, closure-level (an older image, the
# same closure: it stays lit), moved (the closure moved or reads unlabeled: restand, then a light by hand), unread.
$PulamaClosureFormat = '{{ index .Config.Labels "lares.pulama.closure" }}'
function ClosureLabel([string]$kind, [string]$ref) {
  if ($kind -eq 'image') { $o = ((& docker image inspect --format $PulamaClosureFormat $ref 2>$null) -join '').Trim() }
  else { $o = ((& docker inspect --format $PulamaClosureFormat $ref 2>$null) -join '').Trim() }
  if ($LASTEXITCODE -eq 0 -and $o -cmatch '^sha256:[0-9a-f]{64}$') { return $o } else { return '' }
}
$script:Pr = [pscustomobject]@{ State = 'unread'; Ran = ''; Stands = ''; Closure = '' }
function PulamaReading {
  $script:Pr = [pscustomobject]@{ State = 'unread'; Ran = ''; Stands = ''; Closure = '' }
  $id = ((& docker compose @Base --profile pulama ps -q --status running pulama 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0) { return }
  if (-not $id) { $script:Pr.State = 'absent'; return }
  $ran = ((& docker inspect --format '{{.Image}}' $id 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0) { return }
  $stands = ((& docker image inspect --format '{{.Id}}' $ImageRef 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0) { return }
  if (-not $ran -or -not $stands) { return }
  $script:Pr.Ran = $ran; $script:Pr.Stands = $stands
  if ($ran -eq $stands) { $script:Pr.State = 'level'; return }
  $script:Pr.Closure = ClosureLabel 'container' $id
  if ($script:Pr.Closure -and $script:Pr.Closure -eq (ClosureLabel 'image' $ImageRef)) { $script:Pr.State = 'closure-level' } else { $script:Pr.State = 'moved' }
}
# THE IMAGE LINE (road rank 4l, L6): wherever a pūlama runs, `up` and `pulama status` print one line naming its image
# beside the image the tag names and, where a vessel stands, the vessel's own.
function VesselClause {
  $id = ((& docker compose @Base ps -q --status running lares 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $id) { return '' }
  $img = ((& docker inspect --format '{{.Image}}' $id 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $img) { return '' }
  return " (the vessel runs $img)"
}
function WarnPulamaSkew {
  if (-not $PulamaMode) { return }
  PulamaReading
  $p = $script:Pr
  if ($p.State -in @('absent', 'unread')) { return }
  $v = VesselClause
  switch ($p.State) {
    'level' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Stands), the image $ImageRef stands at$v") }
    'moved' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Ran), and $ImageRef stands at $($p.Stands)$v; its code closure moved (or reads unlabeled), so it keeps the older code until ``tools/lares-container.ps1 down`` and ``tools/lares-container.ps1 pulama restand`` (then light it by hand, ``up``, and ``pulama admit``)") }
    'closure-level' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Ran), and $ImageRef stands at $($p.Stands)$v; its code closure reads the same ($($p.Closure.Substring(0, 19))), so it stands lit and owes no restand") }
  }
}

# THE DOWN PATH (`down`, and every act that must stop the vessel first): the keep while the vessel stands, the census,
# the refusal of a silent stop; then the vessel alone stops where a pūlama runs, or the whole project downs.
function DownVessel([string[]]$opts) {
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
  else { $script:KeepSaid = 'no vessel stood, so no keep ran' }
  if ($pulama -eq 'running') {
    # The pūlama keeps the hearth lit through the rebuild: the vessel alone stops (with down's options) and leaves.
    Compose (@('stop') + $opts + @('lares')); Compose @('rm', '-f', 'lares')
  } else { Compose (@('down', '--remove-orphans') + $opts) }
}

# A MOVED IMAGE NEVER RECREATES SILENTLY (road rank 4l, RD4). Compose recreates a vessel whose image moved, and a
# recreate drops whatever the vessel holds in memory. So `up`, and a lift, over a running vessel whose image differs from
# the image the tag names runs the down path first. A read that fails names no move (the act goes on as it did).
$script:MovedRan = ''; $script:MovedStands = ''
function VesselMoved {
  $id = ((& docker compose @Base ps -q --status running lares 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $id) { return $false }
  $script:MovedRan = ((& docker inspect --format '{{.Image}}' $id 2>$null) -join '').Trim()
  $script:MovedStands = ((& docker image inspect --format '{{.Id}}' $ImageRef 2>$null) -join '').Trim()
  return ($script:MovedRan -and $script:MovedStands -and $script:MovedRan -ne $script:MovedStands)
}
function DownIfMoved {
  if (-not (VesselMoved)) { return }
  [Console]::Error.WriteLine("lares-container: the vessel runs image $($script:MovedRan), and $ImageRef stands at $($script:MovedStands); the down path runs first (keep, census), never a silent recreate")
  DownVessel @()
}

# THE IMAGE BUILDS FROM A COMMIT (road rank 4l, RD2), never from the live tree. `git archive <rev>`, and each submodule's
# own archive at the commit the revision pins, unpack in a scratch folder under the house's cache (outside the checkout
# and outside every bind), and compose builds from there through the env file, an override naming that folder as the
# context and the revision as the label. So an untracked or uncommitted file never rides an image; a dirty tree builds
# from HEAD and names what it left out. A submodule whose checkout lacks the pinned commit is named and left out.
$ImageRef = ValueOf 'LARES_IMAGE'; if (-not $ImageRef) { $ImageRef = 'lares-surface:local' }
$ImageRepo = if (($ImageRef -split '/')[-1].Contains(':')) { $ImageRef.Substring(0, $ImageRef.LastIndexOf(':')) } else { $ImageRef }
$script:BuiltRev = ''

# THE OUTGOING IMAGE KEEPS A REVISION TAG (road rank 4l, RD3). Before a build moves the image tag, the image it held
# takes `<repo>:rev-<12 hex of its revision label>` (`rev-unlabeled-<12 hex of its id>` where it names no revision).
# After a build lands, the newest three revision tags stand and the rest untag, never a hand tag, an image a container
# runs, or the image the pūlama admitted last or last raised. A prune only untags: the admission record stays.
$RevTagsKept = 3
function TagOutgoing {
  $line = ((& docker image inspect --format '{{.Id}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' $ImageRef 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $line) { [Console]::Error.WriteLine("lares-container: no image stands at $ImageRef yet, so no outgoing image takes a revision tag"); return }
  $bar = $line.IndexOf('|'); $id = $line.Substring(0, $bar); $rev = $line.Substring($bar + 1)
  if ($rev -cmatch '^[0-9a-f]{12,40}(-dirty)?$') {
    $tag = "rev-$($rev.Substring(0, 12))"; if ($rev.EndsWith('-dirty')) { $tag += '-dirty' }
  } else {
    $hex = $id -replace '^sha256:', ''; $tag = "rev-unlabeled-$($hex.Substring(0, [Math]::Min(12, $hex.Length)))"
  }
  & docker tag $ImageRef "${ImageRepo}:$tag"
  if ($LASTEXITCODE -eq 0) { [Console]::Error.WriteLine("lares-container: the outgoing image keeps the tag ${ImageRepo}:$tag") }
  else { [Console]::Error.WriteLine("lares-container: the outgoing image could not take the tag ${ImageRepo}:$tag; the build goes on") }
}
# The image the pūlama admitted last (its newest admission row, read from its state on the host). It may read empty.
function PulamaAdmittedLast {
  $dir = Join-Path (Join-Path (Join-Path $House 'pulama') 'state') 'records'
  if (-not (Test-Path -PathType Container $dir)) { return '' }
  $rows = @(Get-ChildItem -Path $dir -Filter '*.json' -File -ErrorAction SilentlyContinue | Where-Object { (Get-Content -Raw -LiteralPath $_.FullName -ErrorAction SilentlyContinue) -like '*lares/pulama/admitted/*' } | Sort-Object LastWriteTime -Descending)
  if ($rows.Count -eq 0) { return '' }
  $m = [regex]::Match((Get-Content -Raw -LiteralPath $rows[0].FullName), 'image\\*"\s*:\s*\\*"(sha256:[0-9a-f]{64})')
  if ($m.Success) { return $m.Groups[1].Value } else { return '' }
}
function PruneRevTags {
  $tags = @(& docker image ls --format '{{.Tag}}' $ImageRepo 2>$null)
  if ($LASTEXITCODE -ne 0) { return }
  $admitted = PulamaAdmittedLast
  $raised = ''
  try { $raised = (Get-Content -Raw -LiteralPath (Join-Path (Join-Path (Join-Path $House 'pulama') 'state') 'image') -ErrorAction Stop).Trim() } catch {}
  $rows = @()
  foreach ($t in $tags) {
    $t = "$t".Trim()
    if ($t -cnotmatch '^rev-([0-9a-f]{12}(-dirty)?|unlabeled-[0-9a-f]{1,12})$') { continue }
    $info = ((& docker image inspect --format '{{.Created}} {{.Id}}' "${ImageRepo}:$t" 2>$null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $info) { continue }
    $parts = $info -split ' '
    $rows += [pscustomobject]@{ Created = $parts[0]; Id = $parts[1]; Tag = $t }
  }
  $n = 0
  foreach ($row in ($rows | Sort-Object -Property Created -Descending)) {
    $n++
    if ($n -le $RevTagsKept) { continue }
    $named = "${ImageRepo}:$($row.Tag)"
    if ($admitted -and $row.Id -eq $admitted) { [Console]::Error.WriteLine("lares-container: keeps ${named}: the pūlama admitted it last"); continue }
    if ($raised -and $row.Id -eq $raised) { [Console]::Error.WriteLine("lares-container: keeps ${named}: the image the pūlama last raised"); continue }
    $runs = ((& docker ps -q --filter "ancestor=$($row.Id)" 2>$null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or $runs) { [Console]::Error.WriteLine("lares-container: keeps ${named}: a container runs it"); continue }
    & docker rmi $named *> $null
    if ($LASTEXITCODE -eq 0) { [Console]::Error.WriteLine("lares-container: pruned $named (created $($row.Created))") }
    else { [Console]::Error.WriteLine("lares-container: $named could not prune; it stands") }
  }
}
function BuildImage([string]$at, [string[]]$more) {
  ResolveGitRev
  if (-not $script:GitRev) { Die "build refuses: no git checkout answers at $PSScriptRoot, so the image's revision label would name no commit; build from a checkout" }
  $top = ((& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $top) { Die "build refuses: no git checkout answers at $PSScriptRoot" }
  $rev = ((& git -C $top rev-parse --verify --quiet "$at^{commit}" 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $rev) { Die "build refuses: $at names no commit in $top; nothing built" }
  $short = $rev.Substring(0, 12)
  $left = @(& git -C $top status --porcelain 2>$null | Where-Object { $_ })
  if ($left.Count -gt 0) {
    [Console]::Error.WriteLine("lares-container: the checkout holds $($left.Count) uncommitted or untracked path(s); the image builds from $short and leaves them out:")
    foreach ($l in ($left | Select-Object -First 20)) { [Console]::Error.WriteLine("  $l") }
  }
  $cache = Join-Path $House 'cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $suffix = -join ((1..6) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $ctx = Join-Path $cache "build.$suffix"
  $ov = Join-Path $cache "build-override.$suffix"
  $tar = "$ctx.tar"
  New-Item -ItemType Directory -Force -Path $ctx | Out-Null
  $topFull = [System.IO.Path]::GetFullPath($top)
  if (Test-Within ([System.IO.Path]::GetFullPath($ctx)) $topFull) { Remove-Item -Recurse -Force $ctx; Die "build refuses: the house's cache ($cache) rests inside the checkout; name a LARES_HOUSE outside it" }
  if ($ctx.Contains("'") -or $ctx.Contains("`n")) { Remove-Item -Recurse -Force $ctx; Die 'build refuses a house path that holds a quote or a newline' }
  try {
    & git -C $top archive --format=tar -o $tar $rev
    if ($LASTEXITCODE -eq 0) { & tar -xf $tar -C $ctx }
    if ($LASTEXITCODE -ne 0) { Die "the archive of $short did not unpack; nothing built" }
    Remove-Item -Force $tar -ErrorAction SilentlyContinue
    # Each submodule at the commit this revision pins (a gitlink: mode 160000), from its own checkout.
    foreach ($row in @(& git -C $top ls-tree -r $rev)) {
      $tab = $row.IndexOf("`t"); if ($tab -lt 0) { continue }
      $meta = $row.Substring(0, $tab) -split ' '; $path = $row.Substring($tab + 1)
      if ($meta.Count -lt 3 -or $meta[1] -ne 'commit') { continue }
      $sha = $meta[2]
      $sub = Join-Path $top $path
      $have = $false
      if (Test-Path (Join-Path $sub '.git')) { & git -C $sub cat-file -e "$sha^{commit}" 2>$null; $have = ($LASTEXITCODE -eq 0) }
      if ($have) {
        $dest = Join-Path $ctx $path
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        & git -C $sub archive --format=tar -o $tar $sha
        if ($LASTEXITCODE -eq 0) { & tar -xf $tar -C $dest }
        if ($LASTEXITCODE -ne 0) { Die "the submodule $path at $($sha.Substring(0, 12)) did not unpack; nothing built" }
        Remove-Item -Force $tar -ErrorAction SilentlyContinue
      } else {
        [Console]::Error.WriteLine("lares-container: the submodule $path stands unchecked-out or lacks its pinned commit $($sha.Substring(0, 12)) here, so the image builds without it")
      }
    }
    # THE PŪLAMA'S CODE CLOSURE rides the image as a label (`lares.pulama.closure`): the pūlama runs the vessel's image,
    # so a build compares this digest, never the image id, to decide whether the standing pūlama must re-stand and re-light.
    $closure = ''
    if (Get-Command node -ErrorAction SilentlyContinue) {
      $closure = ((& node (Join-Path $PSScriptRoot 'pulama-closure.mjs') $ctx 2>$null) -join '').Trim()
      if ($LASTEXITCODE -ne 0) { $closure = '' }
    }
    if ($closure -cmatch '^sha256:[0-9a-f]{64}$') { [Console]::Error.WriteLine("lares-container: the pūlama's code closure reads $($closure.Substring(0, 19))") }
    else { $closure = ''; [Console]::Error.WriteLine('lares-container: no pūlama code closure reads from this tree (no host node, or no pūlama entry), so the image carries none and a pūlama beside it reads as moved') }
    Set-Content -Path $ov -Value "services:`n  lares:`n    build:`n      context: '$ctx'`n      args:`n        GIT_REV: '$rev'`n        PULAMA_CLOSURE: '$closure'" -Encoding utf8
    $env:GIT_REV = $rev; $script:GitRev = $rev
    TagOutgoing
    [Console]::Error.WriteLine("lares-container: building the vessel image (every package) from commit $short")
    & docker compose @Base -f $ov build @more lares
    $rc = $LASTEXITCODE
  } finally {
    Remove-Item -Recurse -Force $ctx, $ov, $tar -ErrorAction SilentlyContinue
  }
  if ($rc -ne 0) { Die "the build failed (above); $ImageRef stands as it stood" }
  $script:BuiltRev = $rev
  PruneRevTags
  [Console]::Error.WriteLine("lares-container: the vessel image stands rebuilt from $short (revision $rev); ``up`` stands it")
}

# THE STAND (`up`, and the rebuild's stand): the moved-image down path, the pūlama, the vessel healthy, the revision and
# image lines, then the unlock or the hint. Inside a rebuild under a pūlama the unlock waits for the admit.
$script:Rebuilding = $false
function UpVerb([string[]]$upArgs) {
  if ($null -eq $upArgs) { $upArgs = @() }
  EnsureHouse
  ResolveGitRev
  $n = 0; $binds = @(); $i = 0
  while ($i -lt $upArgs.Count) {
    if ($upArgs[$i] -eq '--workspace') {
      if ($i + 1 -ge $upArgs.Count) { Die '--workspace wants <name>=<dir>' }
      $binds += WorkspaceBind ([string]$upArgs[$i + 1])
      $i += 2; continue
    }
    if ($upArgs[$i] -ne '--capture') { Die "unknown option $($upArgs[$i]) for up" }
    if ($i + 1 -ge $upArgs.Count) { Die '--capture wants a directory' }
    $d = $upArgs[$i + 1]
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
  DownIfMoved
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
  WarnPulamaSkew
  if ($script:Rebuilding -and $PulamaMode) { return }
  UnlockOrName
}

function PulamaRestand {
  # THE PŪLAMA RE-STANDS ON THE IMAGE THAT STANDS. `up` never recreates a lit pūlama, so after a `build` this verb
  # does: with no vessel standing (down first), it locks a running pūlama (every session drops, every key zero-fills),
  # then recreates it on the current image. It stands unlit: the operator lights it by hand, then `up` and
  # `pulama admit`. It reads no route and types none.
  $vessel = & docker compose @Base ps -q --status running lares
  if ($LASTEXITCODE -ne 0) { Die 'pulama restand refuses: docker compose ps failed, so whether a vessel stands reads unknown; nothing recreated' }
  if (-not [string]::IsNullOrWhiteSpace(($vessel -join ''))) { Die 'pulama restand refuses while the lares vessel stands; run `tools/lares-container.ps1 down` first (nothing recreated)' }
  $state = PulamaState
  if ($state -eq 'unknown') { Die 'pulama restand refuses: docker compose ps failed for the pūlama, so whether it stands reads unknown; nothing recreated' }
  EnsureHouse
  if ($state -eq 'running') {
    & docker compose @Base --profile pulama exec -T pulama node $PulamaMain lock
    if ($LASTEXITCODE -ne 0) { Die 'the pūlama refused the lock; nothing recreated' }
  }
  & docker compose @Base --profile pulama up -d --force-recreate pulama
  if ($LASTEXITCODE -ne 0) { Die 'the pūlama did not stand on the current image' }
  $image = ValueOf 'LARES_IMAGE'; if (-not $image) { $image = 'lares-surface:local' }
  $digest = ((& docker image inspect --format '{{.Id}}' $image 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $digest) { $digest = $image }
  [Console]::Error.WriteLine("lares-container: the pūlama stands unlit on $digest; light it by hand (``tools/lares-container.ps1 pulama light``), then ``tools/lares-container.ps1 up`` and ``tools/lares-container.ps1 pulama admit``")
}

# THE REBUILD RITE (road rank 4l, L7): one verb re-stands the house onto a new image, internally re-standable.
#   1  the down path: the keep (`rite keep --if-due`, while the vessel stands), the census, the refusal of a silent stop
#   2  the build from the commit (HEAD unless --at names another): the outgoing image keeps its revision tag, old ones prune
#   3  under a pūlama whose code closure moved (or that stands absent): `pulama restand`, then it STOPS with one line,
#      since the light reads the operator's route by their own hand; `rebuild --resume` picks up after the light
#   4  `up` on the new image; under a pūlama, `pulama admit` on this terminal (the one route a rebuild reads, and the
#      pūlama reads it, never this shim), then the vessel's unlock (detached) and the face last worn
#   5  one closing line: the image's revision, the worn face, the keep
# It never switches a branch, never reads or types a route, and never lights the pūlama.
$RebuildPending = Join-Path (Join-Path $House 'cache') 'rebuild-pending'
function WornNow {
  $m = [regex]::Match((RunCensus '--json').Out, '"worn"\s*:\s*([0-9]+)')
  if ($m.Success) { return $m.Groups[1].Value } else { return '' }
}
function RebuildVerb([string[]]$rargs) {
  if ($null -eq $rargs) { $rargs = @() }
  $resume = $false; $at = 'HEAD'; $atGiven = $false; $i = 0
  while ($i -lt $rargs.Count) {
    switch ($rargs[$i]) {
      '--resume' { $resume = $true; $i++ }
      '--at' { if ($i + 1 -ge $rargs.Count) { Die 'rebuild --at wants a revision' }; $at = [string]$rargs[$i + 1]; $atGiven = $true; $i += 2 }
      default { Die "rebuild takes --at <rev> or --resume, and `"$($rargs[$i])`" names neither" }
    }
  }
  if ($resume -and $atGiven) { Die 'rebuild --resume takes no --at: the image stands built; run rebuild --at <rev> for another' }
  if ($PulamaMode -and -not $script:Tty) { Die "rebuild under a pūlama ends on the pūlama's admit, which reads your route on a terminal; run it on one (nothing touched)" }
  if (-not $resume) {
    [Console]::Error.WriteLine('lares-container: rebuild: the down path (keep, census)')
    DownVessel @()
    [Console]::Error.WriteLine("lares-container: rebuild: the build from $at")
    BuildImage $at @()
    if ($PulamaMode) {
      PulamaReading
      switch ($script:Pr.State) {
        'unread' { Die 'rebuild stops: whether the pūlama stands, or what it runs, reads unknown; the image stands built (read it with `tools/lares-container.ps1 pulama status`)' }
        { $_ -in @('absent', 'moved') } {
          PulamaRestand
          try { New-Item -ItemType Directory -Force -Path (Join-Path $House 'cache') | Out-Null; Set-Content -Path $RebuildPending -Value $script:KeepSaid -Encoding utf8 } catch {}
          [Console]::Error.WriteLine('lares-container: rebuild stops for your hand: the pūlama stands unlit on the new image; light it (`tools/lares-container.ps1 pulama light`), then `tools/lares-container.ps1 rebuild --resume`')
          exit 0
        }
        default { [Console]::Error.WriteLine("lares-container: rebuild: the pūlama's code closure stands unmoved, so it stays lit (no restand, no light)") }
      }
    }
  } else {
    if ($PulamaMode) {
      PulamaReading
      switch ($script:Pr.State) {
        'unread' { Die 'rebuild --resume refuses: whether the pūlama stands, or what it runs, reads unknown; read it with `tools/lares-container.ps1 pulama status`' }
        'absent' { Die 'rebuild --resume refuses: no pūlama runs; `tools/lares-container.ps1 pulama restand`, light it, then rebuild --resume' }
        'moved' { Die 'rebuild --resume refuses: the pūlama still runs an older code closure; `tools/lares-container.ps1 pulama restand`, light it, then rebuild --resume' }
      }
    }
    $script:KeepSaid = ''
    try { $script:KeepSaid = (Get-Content -Raw -LiteralPath $RebuildPending -ErrorAction Stop).Trim() } catch {}
    if (-not $script:KeepSaid) { $script:KeepSaid = "ran before the light, in the rebuild's first half" }
  }
  Remove-Item -Force -LiteralPath $RebuildPending -ErrorAction SilentlyContinue
  $script:Rebuilding = $true
  UpVerb @()
  if ($PulamaMode) {
    [Console]::Error.WriteLine('lares-container: rebuild: the pūlama admits the new image; it reads your route on this terminal')
    & docker compose @Base --profile pulama exec pulama node $PulamaMain admit
    if ($LASTEXITCODE -ne 0) { Die 'the pūlama admitted nothing (above); the vessel stands at the floor: `tools/lares-container.ps1 pulama admit`, then `tools/lares-container.ps1 vault unlock --all`' }
    if ((DetachedUnlock @('--all')) -ne 0) { Die 'the vessel did not open after the admit (above); read it with `tools/lares-container.ps1 pulama status`, then `tools/lares-container.ps1 vault unlock --all`' }
    if (NoneWorn) { WearLastFace }
  }
  $worn = $script:Wore -replace '^h', ''
  if (-not $worn) { $worn = WornNow }
  $rev = ((& docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' $ImageRef 2>$null) -join '').Trim()
  if ($rev.Length -gt 12) { $rev = $rev.Substring(0, 12) }
  if (-not $rev) { $rev = 'unlabeled' }
  $wearing = if ($worn) { "wearing h$worn" } else { 'no face worn (wear one: `tools/lares-container.ps1 wear N`)' }
  $keep = if ($script:KeepSaid) { $script:KeepSaid } else { 'none ran' }
  [Console]::Error.WriteLine("lares-container: rebuilt: the vessel stands on revision $rev, $wearing; keep: $keep")
}

switch ($verb) {
  'up' { UpVerb $rest }
  'rebuild' { RebuildVerb $rest }
  'down'  { DownVessel $rest }
  'pulama' {
    if (-not $PulamaMode) { Die "pulama needs LARES_PULAMA=1 in the environment or $EnvFile" }
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    switch ($sub) {
      'up' { EnsureHouse; Compose @('--profile', 'pulama', 'up', '-d', '--no-recreate', 'pulama') }
      'down' { Compose @('--profile', 'pulama', 'stop', 'pulama') }
      'restand' {
        if ($rest.Count -ne 1) { Die 'pulama restand takes no arguments' }
        PulamaRestand
      }
      { $_ -in @('light', 'lock', 'status', 'tessera') } { if ($sub -eq 'status') { WarnPulamaSkew }; Compose (@('--profile', 'pulama', 'exec') + $NoTty + @('pulama', 'node', $PulamaMain, $sub)) }
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
        # plus the local signing seed on one stdout line; the shim writes that line verbatim as config/keep-seat.json (owner
        # read-write, temp file then move), since the house CLI reads it whole. The signer never reaches the screen or a log.
        $reseat = ($rest.Count -ge 2 -and $rest[1] -eq '--reseat')
        if ($rest.Count -gt 2 -or ($rest.Count -eq 2 -and -not $reseat)) { Die 'pulama keep-seat takes only --reseat' }
        if (-not $script:Tty) { Die 'pulama keep-seat reads its route on a terminal; run it on one (nothing seated)' }
        $seatFile = Join-Path (Join-Path $House 'config') 'keep-seat.json'
        if ((Test-Path $seatFile) -and -not $reseat) { Die "a keep seat already rests at $seatFile; pass --reseat to replace it" }
        # The route rides a forced terminal, the answer a capture: a captured stdout makes compose drop the pseudo-terminal
        # (--no-TTY defaults to "stdout reads no terminal") and the pūlama refuses route-needs-a-terminal, so the exec forces
        # one (--no-TTY=false): keystrokes reach the pūlama's pty in raw mode (no echo), and every byte it writes, its own
        # prompt and the seat line, folds into the capture, never the screen. The line below stands as the prompt.
        [Console]::Error.WriteLine("lares-container: the pūlama now reads the steward's route to seat the keep: type it, then Enter (typed, unseen)")
        $line = ''
        & docker compose @Base --profile pulama exec --no-TTY=false pulama node $PulamaMain keep-seat | ForEach-Object {
          $l = "$_".Trim("`r")
          if ($l.StartsWith('{"op":"keep-seat"')) { $line = $l }
        }
        if (-not $line) { Die 'the pūlama answered no seat; nothing written' }
        $answer = $line | ConvertFrom-Json
        if ($answer.reading -eq 'refused') { Die "the pūlama seated nothing: $($answer.code) ($($answer.message))" }
        if ($answer.reading -ne 'seated' -or -not $answer.seat -or -not ($answer.signer -is [string]) -or -not ($answer.seat.publicKey -is [string])) { Die "the pūlama's seat line read malformed; nothing written" }
        $json = $line
        New-Item -ItemType Directory -Force -Path (Join-Path $House 'config') | Out-Null
        $tmp = "$seatFile.$PID.tmp"
        [System.IO.File]::WriteAllText($tmp, $json + "`n")
        if (-not $IsWindows) { & chmod 600 $tmp }
        Move-Item -Force -LiteralPath $tmp -Destination $seatFile
        [Console]::Error.WriteLine("lares-container: the keep seat rests at $seatFile (0600); a keep now seals under it")
      }
      default { Die 'pulama takes up, down, restand, light, admit, unadmit, keep-seat, lock, status or tessera' }
    }
  }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
  'image-digest' {
    if ($rest.Count -gt 0) { Die 'image-digest takes no arguments' }
    Write-Output (ImageDigest)
  }
  'build' {
    $at = 'HEAD'; $more = $rest
    if ($rest.Count -gt 0 -and $rest[0] -eq '--at') {
      if ($rest.Count -lt 2) { Die 'build --at wants a revision' }
      $at = [string]$rest[1]; $more = @($rest | Select-Object -Skip 2)
    }
    BuildImage $at $more
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
      # An unlock under a pūlama that named no face can leave faces lent and none worn: the shim wears the last one.
      $namedFace = @($rest | Where-Object { $_ -eq '--face' -or $_ -like '--face=*' }).Count -gt 0
      if (-not $namedFace -and (NoneWorn)) { WearLastFace }
      # THE UNLOCK'S FACE REACHES THE PŪLAMA. The pūlama keeps the face worn in memory and wears it again after a restart,
      # and only `wear` writes that memory, never the unlock: the shim follows a named face with `wear N`, the chain `up`
      # walks, so the pūlama's memory and the face this shim keeps name one face.
      $face = NamedFace $rest
      if ($face -and (DetachedWear $face) -ne 0) { [Console]::Error.WriteLine("lares-container: the vessel opened h$face, but the wear that tells the pūlama refused; a restart re-wears the face last worn: run ``lares-container.ps1 wear $face``") }
      return
    }
    RouteCli (@($verb) + $rest) $true
    if ($rest.Count -gt 0 -and $rest[0] -eq 'unlock') { RememberWornFace $rest }
  }
  default { RouteCli (@($verb) + $rest) $true }
}

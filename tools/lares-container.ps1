# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml), PowerShell form.
# Same contract as tools/lares-container.sh: up [--capture <dir>]... [--workspace <name>=<dir>]...  down [compose-down args]  found [vessel-found args]  logs
# build [--at <rev>] [compose-build args]  vessel stand  <lares verb…>. `build` builds the vessel image (every package the
# vessel runs) from one commit (HEAD unless --at names another), unpacked from its archive under the house's cache,
# stamping that revision as its label; a dirty tree builds from HEAD and names what it left out; no checkout refuses.
# `rebuild [--at <rev> | --prior] [--image]` is the restand `lares rite kukulu` calls (the one human verb): the image of the
# revision (the tag, a kept rev tag, or a build), then down (keep, census), the pūlama re-stood and lit on this terminal
# where its code moved or it stands unlit, up, its admit where owed, the last face worn. It reads where the house stands each
# run, so a stopped run picks up from there; with no terminal, a light or admit owed stops it before anything moves; `--image`
# stops after the image and prints the reading as one JSON line; `--keep-after-landing` leaves a keep a down left owed
# (`run/keep-owed`) to `keep-owed`, which the rite runs once it lands its halves (it waits while a kūkulu half rests
# unlanded). `vessel-image` prints the image the running vessel runs. The pūlama reads every route; this shim never reads or
# types one. The CLI runs by exec while a vessel stands and through the offline door while none
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
$HouseClasses = @('hearth', 'sensoriums', 'projections', 'library', 'config')
# THE PŪLAMA (road L47e): with LARES_PULAMA=1 the house's custody holder stands in its own container beside the vessel,
# lit once by the operator's own hand (`pulama light`), outliving every vessel restart. Its private state rests under
# LARES_HOUSE/pulama/state, so it keeps the operator's ownership. Its socket rests in a named Docker volume the pūlama and
# the vessel share and no host path reaches: the shim never makes, reads or clears a socket on the host.
# THE PŪLAMA BELONGS TO ITS HOUSE. The env file's LARES_PULAMA=1 names the pūlama of the env file's own house; a
# LARES_HOUSE in the environment naming another house (a new house founding beside the standing one) stands that vessel
# holding its own custody, and the line says so. LARES_PULAMA in the environment speaks for whichever house stands.
$PulamaMode = (ValueOf 'LARES_PULAMA') -eq '1'
if ($PulamaMode -and -not [Environment]::GetEnvironmentVariable('LARES_PULAMA') -and (Test-Path $EnvFile)) {
  $fileHouseLine = Select-String -Path $EnvFile -Pattern '^\s*LARES_HOUSE=(.*)$' | Select-Object -Last 1
  $fileHouse = if ($fileHouseLine) { $fileHouseLine.Matches[0].Groups[1].Value } else { '' }
  if ($fileHouse -and $fileHouse -ne $House) {
    [Console]::Error.WriteLine("lares-container: LARES_PULAMA=1 in $EnvFile names the pūlama of $fileHouse; this house ($House) holds its own custody")
    $PulamaMode = $false
  }
}
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
function EnsureHouse {
  foreach ($class in $HouseClasses) { New-Item -ItemType Directory -Force -Path (Join-Path $House $class) | Out-Null }
  # A host directory at pulama/socket mounts nowhere (the socket rides a named volume); the shim names it and never removes it.
  $staleSocket = Join-Path $House 'pulama/socket'
  if (Test-Path -LiteralPath $staleSocket) { [Console]::Error.WriteLine("lares-container: $staleSocket mounts nowhere (the pūlama's socket rides a named volume); remove it by hand: Remove-Item -Recurse -LiteralPath $staleSocket") }
}

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
    if ($script:HostInputFile) {
      $psi = [System.Diagnostics.ProcessStartInfo]::new('docker')
      $psi.UseShellExecute = $false
      $psi.RedirectStandardInput = $true
      foreach ($arg in (@('compose') + $Base + $more)) { $psi.ArgumentList.Add([string]$arg) }
      $process = [System.Diagnostics.Process]::Start($psi)
      try {
        $source = [System.IO.File]::OpenRead($script:HostInputFile)
        try {
          try { $source.CopyTo($process.StandardInput.BaseStream) }
          catch [System.IO.IOException] { }
          try { $process.StandardInput.Close() }
          catch [System.IO.IOException] { }
        } finally { $source.Dispose() }
        $process.WaitForExit()
        $global:LASTEXITCODE = $process.ExitCode
      } finally { $process.Dispose() }
    } else { & docker compose @Base @more }
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
  $script:HostInputFile = $null
  if ($argv.Count -ge 3 -and $argv[0] -ceq 'tiddler' -and $argv[1] -ceq 'put') {
    $hasSlot = $false
    $hasMeme = $false
    $alwaysValued = @('--fields', '--note', '--reason', '--text')
    $boolean = @('accept-omissions', 'added', 'all', 'all-strata', 'apply', 'approve', 'brief', 'bulk', 'cancel', 'cards', 'cosign', 'confirm', 'create', 'cut', 'drain', 'deny', 'docs', 'draft', 'drop', 'dry-run', 'edge', 'ephemeral', 'every', 'executable', 'family', 'force', 'foreground', 'from-persona', 'held', 'help', 'help-mempalace', 'history', 'hearth', 'hold', 'if-due', 'in-wiki', 'init', 'join', 'json', 'keep', 'keep-hooks', 'keyhive-trace', 'launch', 'list', 'meme', 'memory', 'observe', 'orphans', 'over-fresher', 'page', 'pair', 'palaces', 'paper', 'partial', 'passphrase', 'pending', 'probe', 'quorum', 'remove', 'repour', 'restart', 'rotate', 'seat', 'sessions', 'shadow', 'skinny', 'skip-build', 'spectral', 'split-root', 'staged', 'sweep', 'tag-blobs', 'tree', 'verbose', 'wait', 'watch', 'with-web', 'writeback', 'yes')
    $sources = @()
    for ($i = 0; $i -lt $argv.Count; $i++) {
      $word = $argv[$i]
      if ($word -ceq '--') { break }
      if ($word -ceq '--meme') { $hasMeme = $true; continue }
      if ($word -clike '--slot=*') { $hasSlot = $true; continue }
      if ($word -cmatch '(?s)^--(file|append)=(.*)$') {
        $sources += ,@($i, $Matches[2], "--$($Matches[1])")
        continue
      }
      if ($word -ceq '--slot') { $hasSlot = $true }
      if ($word -clike '--*' -and $word -cnotlike '--no-*' -and $word -cnotlike '*=*' -and $word.Substring(2) -cnotin $boolean) {
        if ($i + 1 -lt $argv.Count -and ($word -cin $alwaysValued -or $argv[$i + 1] -cnotlike '--*')) {
          if ($word -cin @('--file', '--append')) { $sources += ,@(($i + 1), $argv[$i + 1], $word) }
          $i++
        }
      }
    }
    if ($sources.Count -gt 1) { Die 'name one text source: --file or --append, once' }
    if ($sources.Count -eq 1 -and ($sources[0][2] -eq '--file' -or ($hasMeme -and $hasSlot)) -and $argv[$sources[0][0]] -cmatch '^--(file|append)=') {
      Die "SeparateSourceToken: use $($sources[0][2]) <path> as separate tokens"
    }
    if ($sources.Count -eq 1 -and $sources[0][1] -eq '') { Die "$($sources[0][2]) names no host file (an empty value)" }
    if ($sources.Count -eq 1 -and ($sources[0][2] -eq '--file' -or ($hasMeme -and $hasSlot))) {
      $source = $sources[0]
      if ($source[1] -ne '-') {
        # A relative path reads against the caller's directory, never .NET's own current directory.
        $hostPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($source[1])
        if (-not $IsWindows) {
          & test -f $hostPath
          if ($LASTEXITCODE -ne 0) { Die "cannot read host file $($source[1])" }
          $fsType = & stat -f -c %T -- $hostPath 2>$null
          if ($LASTEXITCODE -eq 0 -and $fsType -ceq 'proc') { Die "cannot read host file $($source[1])" }
        }
        if (-not [System.IO.File]::Exists($hostPath)) { Die "cannot read host file $($source[1])" }
        try { $handle = [System.IO.File]::OpenRead($hostPath); $handle.Dispose() }
        catch { Die "cannot read host file $($source[1])" }
        $script:HostInputFile = $hostPath
        $argv = @($argv)
        if ($argv[$source[0]] -cmatch '^--(file|append)=') { $argv[$source[0]] = "$($source[2])=-" }
        else { $argv[$source[0]] = '-' }
      }
    }
  }
  if (HasRunningVessel) {
    $tty = if ($script:HostInputFile) { @('-T') } else { $NoTty }
    Act 'exec' (@('exec', '-e', 'LARES_EXEC_TAG') + $PassEnv + $tty + @('lares', 'node', $Cli) + $argv)
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
    $tty = if ($script:HostInputFile) { @('-T') } else { $NoTty }
    Act 'run' (@('--profile', 'offline', 'run', '--rm', '--name', $RunName) + $PassEnv + $tty + @('offline') + $argv)
  }
  $script:HostInputFile = $null
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
# host's lares door, else the checkout's own bin under the host's node. A keep that refuses leaves the house's
# `run/keep-owed` mark, which outlives this invocation (a Ctrl+C, a later run), and a keep that keeps clears it.
$script:KeepSaid = ''
function KeepOwedMark { return (Join-Path (Join-Path $House 'run') 'keep-owed') }
function KeepBeforeDown {
  $script:KeepSaid = 'no keep workspace named'
  if ([string]::IsNullOrEmpty((ValueOf 'LARES_KEEP_WORKSPACE') + (ValueOf 'LARES_WORKSPACES'))) { return }
  $hostCli = ValueOf 'LARES_HOST_CLI'
  if ($hostCli) { $cmd = $hostCli; $pre = @() }
  elseif (Get-Command node -ErrorAction SilentlyContinue) { $cmd = 'node'; $pre = @((Join-Path $Root 'packages/lares-cli/bin/lares.mjs')) }
  else { $script:KeepSaid = 'no host node answered, so nothing kept'; [Console]::Error.WriteLine('lares-container: no host node answers, so down keeps nothing; `lares rite keep` keeps by hand'); return }
  # SAID UP FRONT: a house that moved cuts and pushes a keep inside the stop, which can take minutes.
  [Console]::Error.WriteLine('lares-container: keeping first (rite keep --if-due): a house that moved cuts and pushes its keep before the stop')
  # THE MARK CLEARS ON A REAL KEEP: an answer naming no workspace (`"workspace":null`) kept nothing, and the keep stays owed.
  $kbLines = @(& $cmd @pre rite keep --if-due --json)
  $kbRc = $LASTEXITCODE
  # THE MARK CLEARS ON A REAL KEEP alone: a successful envelope (`"ok":true`) naming its workspace (`data.workspace`, non-empty),
  # parsed as JSON; an answer that parses as none reads nothing kept.
  if ($kbRc -eq 0) {
    # STRICT JSON (System.Text.Json: no trailing commas, no NaN), each type checked: the root an object, `ok` the boolean true,
    # `data` an object, `data.workspace` a non-empty string (or null: none named).
    $last = @($kbLines | Where-Object { "$_".Trim() }) | Select-Object -Last 1
    $verdict = 'malformed'
    try {
      $doc = [System.Text.Json.JsonDocument]::Parse("$last")
      $rootEl = $doc.RootElement
      $okEl = [System.Text.Json.JsonElement]::new(); $dataEl = [System.Text.Json.JsonElement]::new(); $wsEl = [System.Text.Json.JsonElement]::new()
      if ($rootEl.ValueKind -eq 'Object' -and $rootEl.TryGetProperty('ok', [ref]$okEl) -and $okEl.ValueKind -eq 'True' -and $rootEl.TryGetProperty('data', [ref]$dataEl) -and $dataEl.ValueKind -eq 'Object' -and $dataEl.TryGetProperty('workspace', [ref]$wsEl)) {
        if ($wsEl.ValueKind -eq 'Null') { $verdict = 'none' }
        elseif ($wsEl.ValueKind -eq 'String' -and $wsEl.GetString().Trim()) { $verdict = 'kept' }
      }
    } catch { $verdict = 'malformed' }
    # ANY ANSWER THAT READS AS NO REAL KEEP WRITES THE MARK (a first down holds none yet), so the next raise keeps again.
    if ($verdict -ne 'kept') {
      New-Item -ItemType Directory -Force -Path (Join-Path $House 'run') | Out-Null
      New-Item -ItemType File -Force -Path (KeepOwedMark) | Out-Null
    }
    if ($verdict -eq 'none') { $script:KeepSaid = 'no keep workspace resolved, so nothing kept; the keep stays owed'; return }
    if ($verdict -ne 'kept') { $script:KeepSaid = 'the keep answered no envelope naming its workspace, so nothing reads kept; the keep stays owed'; return }
  }
  $global:LASTEXITCODE = $kbRc
  if ($LASTEXITCODE -ne 0) {
    $script:KeepSaid = 'the keep did not complete'
    New-Item -ItemType Directory -Force -Path (Join-Path $House 'run') | Out-Null
    New-Item -ItemType File -Force -Path (KeepOwedMark) | Out-Null
    [Console]::Error.WriteLine('lares-container: the keep did not complete (above); down goes on, and `lares rite keep` keeps by hand')
  }
  else { $script:KeepSaid = 'kept (rite keep --if-due)'; Remove-Item -LiteralPath (KeepOwedMark) -Force -ErrorAction SilentlyContinue }
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
# A CENSUS OF HELD SAVES ALONE says so plainly before the accept-loss offer: how many documents, that each waits in memory for a
# session in this vessel, and that no carrier and no untracked file waits, so accept-loss drops exactly these. Under a restand it
# adds that the keep runs after the raise once the new vessel's census reads clean.
function HeldOnlyLine([string]$out) {
  $lines = @($out -split "`r?`n" | Where-Object { $_ })
  if ($lines.Count -eq 0 -or ($lines | Where-Object { -not $_.StartsWith('held-save ') })) { return }
  $docs = if ($lines.Count -eq 1) { '1 document' } else { "$($lines.Count) documents" }
  $more = if ($script:InRebuild) { "; the keep runs after the raise once the new vessel's census reads clean" } else { '' }
  [Console]::Error.WriteLine("lares-container: the census names held saves alone ($docs): each a save the sealed rest keeps in memory until a session books it in this vessel; no carrier and no untracked file waits, so accept-loss drops exactly these$more")
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
    HeldOnlyLine $out
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
# THE HOST CHAIN CROSSES AS THE MARK, AT THIS DOOR (hitl-reads-a-hand), as lares-container.sh's `host_chain_kind` reads it.
# Inside the vessel an exec'd process has parent pid 0, so this shim reads its OWN host chain before any act: where /proc
# stands (pwsh on Linux or WSL) it reads every link as `branchKind` does (a harness mark in a link's launch environment or a
# link named `claude` / `codex*` reads ai; an unreadable stat, or a walk past 64 links, reads unknown). On Windows no process
# exposes another's environment, so it reads this shell's own marks and each link's name and command line, and the chain
# ends where a parent no longer stands (Windows reuses no live parent pid, and a gone one ends every chain); a CIM query that
# fails reads unknown. Anything but `hand` sets CLAUDECODE=1, which $PassEnv hands in by name, a stripped mark included.
function IsHarnessName([string]$n) {
  if (-not $n) { return $false }
  $b = [IO.Path]::GetFileNameWithoutExtension(($n -split '[\\/]')[-1])
  return ($b -eq 'claude') -or $b.StartsWith('codex')
}
function HostChainKind {
  if ($env:CLAUDECODE -eq '1' -or $env:CODEX_SANDBOX -or $env:CODEX_SANDBOX_NETWORK_DISABLED) { return 'ai' }
  if (Test-Path '/proc/self/stat') {
    $at = $PID; $n = 0
    while ($at -gt 0) {
      if ($n -ge 64) { return 'unknown' }
      $n++
      try { $stat = [IO.File]::ReadAllText("/proc/$at/stat") } catch { return 'unknown' }
      $envs = @(); try { $envs = [IO.File]::ReadAllText("/proc/$at/environ") -split "`0" } catch { }
      foreach ($e in $envs) { if ($e -ceq 'CLAUDECODE=1' -or $e -cmatch '^CODEX_SANDBOX(_NETWORK_DISABLED)?=.+') { return 'ai' } }
      $open = $stat.IndexOf('('); $close = $stat.LastIndexOf(')')
      if ($open -lt 0 -or $close -lt $open) { return 'unknown' }
      if (IsHarnessName $stat.Substring($open + 1, $close - $open - 1)) { return 'ai' }
      $argv = @(); try { $argv = @(([IO.File]::ReadAllText("/proc/$at/cmdline") -split "`0") | Select-Object -First 2) } catch { }
      foreach ($a in $argv) { if (IsHarnessName $a) { return 'ai' } }
      $fields = $stat.Substring($close + 2).Split(' ')
      $next = 0
      if ($fields.Count -lt 2 -or -not [int]::TryParse($fields[1], [ref]$next)) { return 'unknown' }
      $at = $next
    }
    return 'hand'
  }
  try {
    $at = $PID; $n = 0
    while ($at -gt 0) {
      if ($n -ge 64) { return 'unknown' }
      $n++
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$at" -ErrorAction Stop
      if (-not $proc) { return 'hand' }
      if (IsHarnessName $proc.Name) { return 'ai' }
      foreach ($a in @(($proc.CommandLine -split '\s+') | Where-Object { $_ } | Select-Object -First 2)) { if (IsHarnessName $a.Trim('"')) { return 'ai' } }
      $at = [int]$proc.ParentProcessId
    }
    return 'hand'
  } catch { return 'unknown' }
}
if ((HostChainKind) -ne 'hand') { $env:CLAUDECODE = '1' }

$PassEnv = @()
foreach ($name in @('NO_COLOR', 'TERM', 'COLORTERM', 'LARES_DEBUG', 'CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED')) {
  if (Test-Path "env:$name") { $PassEnv += @('-e', $name) }
}

if ($args.Count -eq 0) { Die 'usage: lares-container.ps1 up|down|found|logs|build|rebuild|pulama|vessel stand|<lares verb…> (build builds the vessel image, every package, from a commit; rebuild is the restand `lares rite kukulu` walks)' }
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
# The digest of the image a vessel stands from: what up reports to the pūlama.
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
    'level' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Ran), and $ImageRef stands at the same $($p.Stands)$v") }
    'moved' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Ran), and $ImageRef stands at $($p.Stands)$v; its code closure moved (or reads unlabeled), so it keeps the older code until ``lares rite kukulu`` re-stands it (``pulama restand``) and lights it on a terminal") }
    'closure-level' { [Console]::Error.WriteLine("lares-container: the pūlama runs image $($p.Ran), and $ImageRef stands at $($p.Stands)$v; its code closure reads the same ($($p.Closure.Substring(0, 19))), so it stands lit and owes no restand") }
  }
}

# THE DOWN PATH (`down`, and every act that must stop the vessel first): the keep while the vessel stands, the census,
# the refusal of a silent stop; then the vessel alone stops where a pūlama runs, or the whole project downs.
# THE VESSEL'S LOG OUTLIVES THE DOWN. A down removes the container, and its log leaves with it, so the down path saves
# the last $VesselLogLines lines (stdout and stderr) to the house's run/vessel-last.log first, overwritten each down,
# and names the file. A log that cannot be read is named and never blocks the down.
$VesselLogLines = 20000
function SaveVesselLog([string]$id) {
  $id = (($id -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 1)
  $file = Join-Path (Join-Path $House 'run') 'vessel-last.log'
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $House 'run') | Out-Null
    $lines = & docker logs --tail $VesselLogLines $id.Trim() 2>&1 | ForEach-Object { "$_" }
    $rc = $LASTEXITCODE
    if ($rc -ne 0) { throw "docker logs exited $rc" }
    Set-Content -LiteralPath $file -Value $lines -Encoding utf8
    [Console]::Error.WriteLine("lares-container: the vessel's log (its last $VesselLogLines lines) rests at $file")
  } catch { [Console]::Error.WriteLine("lares-container: the vessel's log could not be read; the down goes on") }
}
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
  } elseif (-not [string]::IsNullOrWhiteSpace(($ids -join ''))) {
    # UNDER THE RITE an owed keep waits for its landing: the down keeps nothing while the mark stands.
    if ($script:KeepLater -and (Test-Path -LiteralPath (KeepOwedMark))) {
      $script:KeepSaid = 'owed; it runs after the rite lands its halves'
      [Console]::Error.WriteLine("lares-container: the keep a down left owed waits for the rite's landing; this down keeps nothing")
    } else { KeepBeforeDown }
    CensusBeforeStop; SaveVesselLog ($ids -join "`n")
  }
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
    # The build's own lines ride stderr, so stdout carries a reading alone.
    & docker compose @Base -f $ov build @more lares 2>&1 | ForEach-Object { [Console]::Error.WriteLine("$_") }
    $rc = $LASTEXITCODE
  } finally {
    Remove-Item -Recurse -Force $ctx, $ov, $tar -ErrorAction SilentlyContinue
  }
  if ($rc -ne 0) { Die "the build failed (above); $ImageRef stands as it stood" }
  $script:BuiltRev = $rev
  PruneRevTags
  [Console]::Error.WriteLine("lares-container: the vessel image stands rebuilt from $short (revision $rev); ``up`` stands it")
  BuildHost $top $rev
}

# THE HOST BUILDS FROM THE SAME REVISION. The host's own `lares` runs this checkout's build, so an image built from the
# commit the checkout stands at takes the host CLI with it (`pnpm run build:host`): one verb keeps the two in step. A
# checkout standing elsewhere (a `--at` of another commit) keeps its own build, and the line names both revisions.
function BuildHost([string]$top, [string]$rev) {
  $head = ((& git -C $top rev-parse HEAD 2>$null) -join '').Trim()
  $short = $rev.Substring(0, 12)
  if ($head -ne $rev) {
    $headShort = if ($head.Length -ge 12) { $head.Substring(0, 12) } else { $head }
    [Console]::Error.WriteLine("lares-container: the checkout stands at $headShort and the image carries $short, so the host CLI keeps its own build; build from the checkout's commit to bring both into step")
    return
  }
  [Console]::Error.WriteLine("lares-container: the host CLI builds from $short, the revision the image carries")
  & pnpm --dir $top run --silent build:host 2>&1 | ForEach-Object { [Console]::Error.WriteLine($_) }
  if ($LASTEXITCODE -ne 0) { Die "the host CLI build failed (above); the image stands built from $short, and the host keeps its prior build" }
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
  if ($script:InRebuild) { [Console]::Error.WriteLine("lares-container: the pūlama stands unlit on $digest") }
  else { [Console]::Error.WriteLine("lares-container: the pūlama stands unlit on $digest; light it by hand (``tools/lares-container.ps1 pulama light``), then ``tools/lares-container.ps1 up`` and ``tools/lares-container.ps1 pulama admit`` (``lares rite kukulu`` on a terminal walks all of it)") }
}

# THE RESTAND (road rank 4l, L7, folded under `lares rite kukulu`, the one human verb that calls it): `rebuild` raises the
# house onto the image of one revision. It reads where the house stands on every run and walks only what remains, so a run
# that stopped (a refused census, a light not yet typed, no terminal) picks up from wherever the house stands; no file
# remembers a half-done run.
#   1  the image of the revision (HEAD, `--at <rev>`, or `--prior`: the newest kept image before the one the tag holds):
#      the tag holds it already; else a kept `<repo>:rev-<12 hex>` tag does, and it takes the tag (no build); else a build
#      from the commit. `--image` stops here and prints ONE JSON line on stdout naming where the house stands
#   2  under a pūlama: a light is owed where none runs, where its code closure moved, or where it stands unlit; an admit
#      where a new vessel rises on an image the pūlama has not admitted and no kūkulu offer carries. With no terminal, a
#      light or an admit owed stops HERE, before anything moves, and names the hand act
#   3  the down path (keep, census) where the vessel runs another image or the pūlama re-stands; a vessel already on the
#      image stays standing
#   4  the pūlama re-stands where its code moved, then lights ATTACHED on this terminal: the pūlama reads the route
#   5  up on the image; under a pūlama its admit, attached, where owed (a vessel left standing at the floor on an image
#      neither admitted nor offered, as a Ctrl+C at the admit leaves it, owes it too), then the vessel's unlock (detached)
#      and the face last worn; a keep that refused before the down runs now where the new census reads clean
#   6  one closing line: the revision, the worn face, the keep
# It never switches a branch, never moves the checkout, and never reads or types a route.
$script:InRebuild = $false
function WornNow {
  $m = [regex]::Match((RunCensus '--json').Out, '"worn"\s*:\s*([0-9]+)')
  if ($m.Success) { return $m.Groups[1].Value } else { return '' }
}
function LabelOf([string]$ref) {
  $o = ((& docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' $ref 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0) { return '' }
  return ($o -replace '[\x00-\x1f\x7f]', '')
}
function ImageId {
  $o = ((& docker image inspect --format '{{.Id}}' $ImageRef 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0) { return '' }
  return $o
}
# THE PRIOR IMAGE: the newest kept `rev-<12 hex>` tag whose image the tag does not hold now, read by its revision label.
function PriorRevision {
  $cur = ImageId
  $tags = @(& docker image ls --format '{{.Tag}}' $ImageRepo 2>$null)
  if ($LASTEXITCODE -ne 0) { return '' }
  $rows = @()
  foreach ($t in $tags) {
    $t = "$t".Trim()
    if ($t -cnotmatch '^rev-[0-9a-f]{12}$') { continue }
    $info = ((& docker image inspect --format '{{.Created}} {{.Id}}' "${ImageRepo}:$t" 2>$null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $info) { continue }
    $parts = $info -split ' '
    if ($parts.Count -lt 2 -or $parts[1] -eq $cur) { continue }
    $rows += [pscustomobject]@{ Created = $parts[0]; Tag = $t }
  }
  if ($rows.Count -eq 0) { return '' }
  $best = $rows | Sort-Object -Property Created -Descending | Select-Object -First 1
  return (LabelOf "${ImageRepo}:$($best.Tag)")
}
$script:RRev = ''; $script:RHow = ''
function ResolveImage([string]$want) {
  ResolveGitRev
  if (-not $script:GitRev) { Die "rebuild refuses: no git checkout answers at $PSScriptRoot, so no revision names the image; run it from a checkout" }
  $top = ((& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $top) { Die "rebuild refuses: no git checkout answers at $PSScriptRoot" }
  if (-not $want) {
    $script:RRev = PriorRevision
    if ($script:RRev -cnotmatch '^[0-9a-f]{40}$') { Die "rebuild --prior finds no kept image before the one $ImageRef holds (a kept image carries the tag ${ImageRepo}:rev-<12 hex> and its revision label); nothing moved" }
  } else {
    $r = ((& git -C $top rev-parse --verify --quiet "$want^{commit}" 2>$null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $r) { Die "rebuild refuses: $want names no commit in $top; nothing moved" }
    $script:RRev = $r
  }
  $short = $script:RRev.Substring(0, 12)
  if ((LabelOf $ImageRef) -ceq $script:RRev) {
    $script:RHow = 'stood'
    [Console]::Error.WriteLine("lares-container: $ImageRef holds the image of $short already; no build")
    return
  }
  $kept = "${ImageRepo}:rev-$short"
  if ((LabelOf $kept) -ceq $script:RRev) {
    TagOutgoing
    $null = & docker tag $kept $ImageRef
    if ($LASTEXITCODE -ne 0) { Die "the kept image $kept could not take the tag $ImageRef; it stands as it stood" }
    $script:RHow = 'kept'
    [Console]::Error.WriteLine("lares-container: $ImageRef now holds the kept image $kept; no build")
    return
  }
  if (-not $want) { Die "rebuild --prior: the kept tag $kept no longer holds revision $short; nothing moved" }
  BuildImage $script:RRev @()
  $script:RHow = 'built'
}
# THE PŪLAMA'S OWN STATUS (`pulama-main.js status`, read detached): whether it stands lit, and whether the admitted set it
# reads under its key names the image and no tombstone ends it. An unlit pūlama lists no admission; a status that never
# answers leaves both unread.
$script:PsLit = ''; $script:PsAdmitted = ''
function PulamaStatusRead([string]$digest) {
  $script:PsLit = ''; $script:PsAdmitted = ''
  $out = $null | & docker compose @Base --profile pulama exec -T pulama node $PulamaMain status 2>$null
  if ($LASTEXITCODE -ne 0) { return }
  $flat = (($out -join '') -replace '\s', '')
  if ($flat.Contains('"lit":true')) { $script:PsLit = 'yes' }
  elseif ($flat.Contains('"lit":false')) { $script:PsLit = 'no'; return }
  else { return }
  $list = ([regex]::Match($flat, '"admitted":\[([^\]]*)\]')).Groups[1].Value
  $ended = ([regex]::Match($flat, '"ended":\[([^\]]*)\]')).Groups[1].Value
  $q = '"' + $digest + '"'
  $script:PsAdmitted = if ($list.Contains($q) -and -not $ended.Contains($q)) { 'yes' } else { 'no' }
}
# A kūkulu offer the standing vessel rested (config/kukulu-offer.json) whose vouch names the image: the next vessel offers
# it once, and the pūlama lends on it with no admit.
function OfferCarries([string]$digest) {
  if (-not $digest) { return $false }
  $f = Join-Path (Join-Path $House 'config') 'kukulu-offer.json'
  if (-not (Test-Path -LiteralPath $f)) { return $false }
  # It reads the vouch's own `image` field, never a digest that merely begins another.
  return (Get-Content -Raw -LiteralPath $f).Contains("`"image`":`"$digest`"")
}
# Does a vessel run the image the tag names? VoRunning reads true wherever a vessel runs at all.
$script:VoRunning = $false
function VesselOnImage {
  $script:VoRunning = $false
  $id = ((& docker compose @Base ps -q --status running lares 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $id) { return $false }
  $script:VoRunning = $true
  $ran = ((& docker inspect --format '{{.Image}}' $id 2>$null) -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or -not $ran) { return $false }
  return ($ran -eq (ImageId))
}
function PrintReading {
  $img = ImageId
  $current = if (VesselOnImage) { 'true' } else { 'false' }
  $vessel = if ($script:VoRunning) { 'standing' } else { 'down' }
  $pul = 'off'; $lit = 'null'; $adm = 'null'
  if ($PulamaMode) {
    PulamaReading; $pul = $script:Pr.State
    if ($pul -notin @('absent', 'unread')) {
      PulamaStatusRead $img
      if ($script:PsLit -eq 'yes') { $lit = 'true' } elseif ($script:PsLit -eq 'no') { $lit = 'false' }
      if ($script:PsAdmitted -eq 'yes') { $adm = 'true' } elseif ($script:PsAdmitted -eq 'no') { $adm = 'false' }
    }
  }
  # An offer that rests names when it rested (its file's time, UTC), so a resumed rite names the begin it picks up.
  $offer = 'false'; $at = ''
  if (OfferCarries $img) {
    $offer = 'true'
    $f = Join-Path (Join-Path $House 'config') 'kukulu-offer.json'
    try { $at = ",`"offerAt`":`"$((Get-Item -LiteralPath $f).LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ssZ', [System.Globalization.CultureInfo]::InvariantCulture))`"" } catch { $at = '' }
  }
  [Console]::Out.WriteLine("{`"op`":`"rebuild-image`",`"revision`":`"$($script:RRev)`",`"image`":`"$img`",`"how`":`"$($script:RHow)`",`"vessel`":`"$vessel`",`"current`":$current,`"pulama`":`"$pul`",`"lit`":$lit,`"admitted`":$adm,`"offer`":$offer$at}")
}
$HandLine = 'your hand: lares rite kukulu on a terminal'
# THE KEEP AFTER THE RAISE: a keep that refused before the down (its census named what rests nowhere yet) runs again once the
# new vessel's census reads clean, so a restand never skips the keep silently; a census that still names items defers it by name.
$script:KeepLater = $false
function KeepAfterRaise {
  if (-not (Test-Path -LiteralPath (KeepOwedMark))) { return }
  $c = RunCensus '--no-json'
  if ($c.Rc -eq 0 -and ($c.Out -split "`r?`n" | Where-Object { $_ -like 'census: clean*' })) {
    [Console]::Error.WriteLine("lares-container: the keep before the down did not complete; the new vessel's census reads clean, so the keep runs now")
    KeepBeforeDown
    if ($script:KeepSaid -eq 'kept (rite keep --if-due)') { $script:KeepSaid = 'kept after the raise (rite keep --if-due)' }
  } else {
    $script:KeepSaid = 'deferred: the census after the raise still names what rests nowhere yet; `lares rite keep` keeps once it reads clean'
  }
}
function StandHouse {
  $digest = ImageId
  $restand = $false; $light = $false; $admit = $false; $why = ''
  $stays = VesselOnImage
  if ($PulamaMode) {
    PulamaReading
    switch ($script:Pr.State) {
      'unread' { Die 'rebuild stops before anything moves: whether the pūlama stands, or what it runs, reads unknown (read it with `tools/lares-container.ps1 pulama status`)' }
      'absent' { $restand = $true; $light = $true; $why = 'no pūlama runs' }
      'moved' { $restand = $true; $light = $true; $why = "the pūlama's code closure moved" }
      default {
        PulamaStatusRead $digest
        if ($script:PsLit -eq 'no') { $light = $true; $why = 'the pūlama stands unlit' }
        elseif ($script:PsLit -ne 'yes') { Die 'rebuild stops before anything moves: the pūlama answers no status, so whether it stands lit reads unknown (read it with `tools/lares-container.ps1 pulama status`)' }
      }
    }
    if ($restand) { $stays = $false }
    if (-not $light -and -not $stays -and $script:PsAdmitted -ne 'yes' -and -not (OfferCarries $digest)) { $admit = $true }
    # A CTRL+C AT THE ADMIT left the vessel standing on the image at the floor, the image unadmitted and no offer carrying it:
    # the admit it never took is owed again, never a bare unlock that cannot open.
    if (-not $light -and $stays -and $script:PsAdmitted -ne 'yes' -and -not (OfferCarries $digest) -and -not (KeyHeld)) { $admit = $true }
    if (-not $script:Tty) {
      if ($light) { Die "rebuild stops before anything moves: $why, and its light reads your route on a terminal; $HandLine" }
      if ($admit) { Die "rebuild stops before anything moves: the pūlama has not admitted this image and no kūkulu offer carries it, and its admit reads your route on a terminal; $HandLine (or string a kukulu lei first: lares lei kui --rite kukulu --branch <name> --returns <n> --all)" }
    }
  }
  if ($stays) {
    $script:KeepSaid = 'the vessel stayed standing, so no keep ran'
    [Console]::Error.WriteLine("lares-container: rebuild: the vessel runs $digest already and stays standing")
  } else {
    [Console]::Error.WriteLine('lares-container: rebuild: the down path (keep, census)')
    DownVessel @()
  }
  if ($restand) { PulamaRestand }
  if ($light) {
    [Console]::Error.WriteLine("lares-container: rebuild: $why; the pūlama lights on this terminal (it reads your route, this shim never does)")
    & docker compose @Base --profile pulama exec pulama node $PulamaMain light
    PulamaStatusRead $digest
    if ($script:PsLit -ne 'yes') { Die 'the pūlama did not light (above); run `lares rite kukulu` again on a terminal, and it picks up from here' }
    if (-not $stays -and $script:PsAdmitted -ne 'yes' -and -not (OfferCarries $digest)) { $admit = $true }
  }
  if (-not $stays) { $script:Rebuilding = $true; UpVerb @() }
  if ($PulamaMode) {
    if ($admit) {
      [Console]::Error.WriteLine('lares-container: rebuild: the pūlama admits the image; it reads your route on this terminal')
      & docker compose @Base --profile pulama exec pulama node $PulamaMain admit
      if ($LASTEXITCODE -ne 0) { Die 'the pūlama admitted nothing (above); the vessel stands at the floor: `tools/lares-container.ps1 pulama admit`, then `tools/lares-container.ps1 vault unlock --all`' }
    }
    if ($stays) { UnlockOrName }
    else {
      if ((DetachedUnlock @('--all')) -ne 0) { Die 'the vessel did not open (above); read it with `tools/lares-container.ps1 pulama status`, then `tools/lares-container.ps1 vault unlock --all`' }
      if (NoneWorn) { WearLastFace }
    }
  } elseif ($stays) { UnlockOrName }
  if ($script:KeepLater -and (Test-Path -LiteralPath (KeepOwedMark))) { $script:KeepSaid = 'owed; it runs after the rite lands its halves' }
  else { KeepAfterRaise }
  $worn = $script:Wore -replace '^h', ''
  if (-not $worn) { $worn = WornNow }
  $rev = LabelOf $ImageRef
  if ($rev.Length -gt 12) { $rev = $rev.Substring(0, 12) }
  if (-not $rev) { $rev = 'unlabeled' }
  $wearing = if ($worn) { "wearing h$worn" } else { 'no face worn (wear one: `tools/lares-container.ps1 wear N`)' }
  $keep = if ($script:KeepSaid) { $script:KeepSaid } else { 'none ran' }
  [Console]::Error.WriteLine("lares-container: the house stands on revision $rev, $wearing; keep: $keep")
}
function RebuildVerb([string[]]$rargs) {
  if ($null -eq $rargs) { $rargs = @() }
  $at = 'HEAD'; $atGiven = $false; $prior = $false; $imageOnly = $false; $i = 0
  while ($i -lt $rargs.Count) {
    switch ($rargs[$i]) {
      '--at' { if ($i + 1 -ge $rargs.Count) { Die 'rebuild --at wants a revision' }; $at = [string]$rargs[$i + 1]; $atGiven = $true; $i += 2 }
      '--prior' { $prior = $true; $i++ }
      '--image' { $imageOnly = $true; $i++ }
      '--keep-after-landing' { $script:KeepLater = $true; $i++ }
      default { Die "rebuild takes --at <rev>, --prior, --image and --keep-after-landing, and `"$($rargs[$i])`" names none of them" }
    }
  }
  if ($prior -and $atGiven) { Die 'rebuild takes --at <rev> or --prior, never both' }
  $script:InRebuild = $true
  if ($prior) { ResolveImage '' } else { ResolveImage $at }
  if ($imageOnly) { PrintReading; return }
  StandHouse
}

# THE KEEP THE RITE RUNS AFTER ITS LANDING (`keep-owed`): the keep a down left owed, once the census reads clean, or its
# deferral by name; with no keep owed it runs nothing.
function KeepOwedVerb([string[]]$kargs) {
  if ($kargs.Count -gt 0) { Die 'keep-owed takes no argument' }
  if (-not (Test-Path -LiteralPath (KeepOwedMark))) { [Console]::Error.WriteLine('lares-container: keep: none owed'); return }
  # THE KEEP WAITS FOR THE LANDING: a kūkulu half resting unlanded on any line, or a debt read that fails, keeps nothing.
  # The read names a face, so a house with several faces open never refuses it for no face named: the
  # face last worn, else face 0, the keep's face.
  $koFace = LastWornFace; if ($koFace -eq '') { $koFace = '0' }
  $debt = (($null | & docker compose @Base exec -T lares node $Cli rite receipts --rite kukulu --face $koFace --json 2>$null) -join '') -replace '\s', ''
  $koRc = $LASTEXITCODE
  if ($koRc -ne 0 -or -not $debt.Contains('"pending":[]')) {
    $why = ''
    if ($koRc -ne 0) { $why = '; the debt read refused (with several faces open and none worn, wear a face: `lares wear N`)' }
    [Console]::Error.WriteLine('lares-container: keep: owed; a kūkulu half rests unlanded (or the debt reads nowhere), so the keep waits for `lares rite kukulu` to land it' + $why)
    return
  }
  KeepAfterRaise
  [Console]::Error.WriteLine("lares-container: keep: $($script:KeepSaid)")
}

switch ($verb) {
  'up' { UpVerb $rest }
  'rebuild' { RebuildVerb $rest }
  'keep-owed' { KeepOwedVerb $rest }
  'vessel-image' {
    # THE IMAGE THE RUNNING VESSEL RUNS, by digest (the rite lands over it, never over a tag that may have moved); none prints nothing.
    if ($rest.Count -gt 0) { Die 'vessel-image takes no argument' }
    $id = ((& docker compose @Base ps -q --status running lares 2>$null) -join '').Trim()
    if ($LASTEXITCODE -eq 0 -and $id) {
      # An inspect that fails exits non-zero and prints nothing: the rite reads the image as unknown, never the staged digest.
      $img = ((& docker inspect --format '{{.Image}}' $id 2>$null) -join '').Trim()
      if ($LASTEXITCODE -ne 0) { Die "vessel-image: the running vessel's image reads nowhere (docker inspect failed)" }
      [Console]::Out.WriteLine($img)
    }
  }
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
      'rehive' {
        # rehive stands a SHUT face's hive again from its own seed: the face's own route reads on a real terminal inside the
        # pūlama, which holds its keys; `pulama lock` shuts every face first.
        if ($rest.Count -ne 2 -or $rest[1] -notmatch '^[0-9]+$') { Die 'pulama rehive takes one face ordinal (a number)' }
        Compose (@('--profile', 'pulama', 'exec') + $NoTty + @('pulama', 'node', $PulamaMain, 'rehive', $rest[1]))
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
      default { Die 'pulama takes up, down, restand, light, admit, unadmit, rehive, keep-seat, lock, status or tessera' }
    }
  }
  'logs'  { Compose (@('logs') + $rest + @('lares')) }
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
    # and signs one record, the vessel lands it. The signing's terminal output shows as it runs; the answer is the last object
    # it prints, from its opening brace at the line's start to the end, joined onto one line. A signing that answers no record lands nothing. Without a pūlama, every lei act routes as before.
    $sub = if ($rest.Count -gt 0) { $rest[0] } else { '' }
    if ($PulamaMode -and $sub -in @('kui', 'restring', 'unstring')) {
      if (-not $script:Tty) { Die 'lei under a pūlama reads its route on a terminal; run it on one (nothing signed)' }
      $terms = ($null | & docker compose @Base exec @PassEnv -T lares node $Cli lei terms @rest) -join ''
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      $answer = ''
      # The answer rides the pipeline, and a captured stdout makes compose drop the pty, so the exec forces one
      # (--no-TTY=false): the pūlama reads the route on the operator's terminal.
      & docker compose @Base --profile pulama exec --no-TTY=false pulama node $PulamaMain lei $sub $terms | ForEach-Object {
        [Console]::Error.WriteLine($_)
        $line = "$_".Trim("`r")
        if ($line.StartsWith('{')) { $answer = '' }
        $answer += $line
      }
      if (-not $answer.StartsWith('{')) { Die 'the pūlama signed nothing; nothing lands' }
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

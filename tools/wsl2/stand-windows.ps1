<#
.SYNOPSIS
  stand-windows - Windows half of lar:///ha.ka.ba/wsl2/setup, idempotent by intent.

.DESCRIPTION
  It merges only resource keys owned by this runbook, preserves other `.wslconfig` sections and
  comments, selects the registered default Linux distro unless `-Distro` names one, and never
  unregisters, exports, or modifies a nonselected distro.

  -DryRun shows the plan without writes.
  -Distro optionally names the WSL distro the sparse opt-in selects.
  -Sparse opts into sparse vhdx allocation. WSL 2.5.6+ gates sparse VHDs behind --allow-unsafe
          and prints "sparse VHD support is currently disabled due to potential data corruption";
          without -Sparse the script neither writes sparseVhd nor runs --set-sparse.

  The runbook's PowerShell is 7 (pwsh), read at its one install path, Program Files\PowerShell\7,
  as the witness reads it. Step 0 reads the running engine: under Windows PowerShell 5.1 with pwsh
  installed it relaunches itself there once; without pwsh it reports needs-you and continues, since
  every later step tolerates 5.1. The file keeps a UTF-8 BOM and ASCII-only code so that 5.1
  bootstrap parse holds.

  Step 0b reads the host without elevation: the hypervisor / firmware virtualization state and the
  WSL engine version (inbox WSL lacks --version and --manage; 2.5.6+ carries the --allow-unsafe
  sparse gate).
#>
[CmdletBinding()]
param([switch]$DryRun, [string]$Distro = '', [switch]$Sparse)

$ErrorActionPreference = 'Stop'
function Already($m) { Write-Host ("  {0,-10} {1}" -f 'already', $m) -ForegroundColor DarkGray }
function Set_($m)    { Write-Host ("  {0,-10} {1}" -f 'set', $m) -ForegroundColor Green }
function Plan($m)    { Write-Host ("  {0,-10} {1}" -f 'would-set', $m) -ForegroundColor Yellow }
function Need($m)    { Write-Host ("  {0,-10} {1}" -f 'needs-you', $m) -ForegroundColor Red }
function Step($m)    { Write-Host "`n$m" -ForegroundColor White }
function Act($label, [scriptblock]$do) { if ($DryRun) { Plan $label } else { & $do; Set_ $label } }

Step '0 | PowerShell 7 - the runbook engine'
$pwsh = Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'
if (-not (Test-Path -LiteralPath $pwsh)) { $pwsh = '' }
if ($PSVersionTable.PSVersion.Major -ge 7) {
  Already "pwsh $($PSVersionTable.PSVersion) running"
} elseif ($pwsh -and $PSCommandPath) {
  $forward = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
  if ($DryRun) { $forward += '-DryRun' }
  if ($Sparse) { $forward += '-Sparse' }
  if ($Distro) { $forward += @('-Distro', $Distro) }
  Set_ "relaunching under $pwsh (was Windows PowerShell $($PSVersionTable.PSVersion))"
  & $pwsh @forward
  exit $LASTEXITCODE
} elseif ($pwsh) {
  Already "pwsh present; staying in $($PSVersionTable.PSVersion) (no script path to relaunch)"
} else {
  Need "install PowerShell 7: winget install --id Microsoft.PowerShell --source winget   (continuing under Windows PowerShell $($PSVersionTable.PSVersion))"
}

# wsl.exe writes UTF-16LE to a redirected stdout; decoded as the OEM code page every letter grows a NUL and no regex matches
function Read-Wsl([string[]]$wslArgs) {
  $oldEnc = [Console]::OutputEncoding
  try { [Console]::OutputEncoding = [Text.Encoding]::Unicode; (& wsl.exe @wslArgs 2>&1 | Out-String) } catch { '' } finally { [Console]::OutputEncoding = $oldEnc }
}

Step '0b | Windows host - virtualization, WSL engine (read-only)'
$computer = Get-CimInstance Win32_ComputerSystem
$hostGB = [math]::Round($computer.TotalPhysicalMemory / 1GB)
$processors = @(Get-CimInstance Win32_Processor)
$cpus = ($processors | Measure-Object NumberOfLogicalProcessors -Sum).Sum
if ($computer.HypervisorPresent) {
  Already 'hypervisor present'
} elseif (($processors | Where-Object { $_.VirtualizationFirmwareEnabled -eq $false }).Count -gt 0) {
  Need 'enable virtualization (Intel VT-x / AMD-V, often named SVM) in UEFI/BIOS setup; Task Manager > Performance > CPU shows "Virtualization: Disabled" until then'
} else {
  Need 'enable the Virtual Machine Platform: in an Administrator PowerShell run  wsl --install --no-distribution  then restart Windows'
}
$wslCmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
$wslVersion = $null
if ($wslCmd) {
  $versionText = Read-Wsl @('--version')
  if ($versionText -match 'WSL[^\r\n]*?(\d+)\.(\d+)\.(\d+)') { $wslVersion = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" }
}
if (-not $wslCmd) {
  Need 'wsl.exe missing - in an Administrator PowerShell run  wsl --install --no-distribution  then restart Windows'
} elseif (-not $wslVersion) {
  Need 'wsl --version did not answer (inbox WSL) - run  wsl --update  to move to the Store build, which carries --manage and systemd support'
} else {
  Already "WSL $wslVersion"
}
$lxssRootPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
$lxssRoot = Get-ItemProperty $lxssRootPath -ErrorAction SilentlyContinue
$lxss = Get-ChildItem $lxssRootPath -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ItemProperty $_.PSPath } |
  Where-Object { $_.DistributionName -and $_.BasePath }

# The selection is the registered default or the -Distro name, never a guess from the registry listing.
if (-not $Distro) {
  $defaultGuid = [string]$lxssRoot.DefaultDistribution
  $selected = @($lxss | Where-Object { $_.PSChildName -eq $defaultGuid }) | Select-Object -First 1
  if ($selected) { $Distro = [string]$selected.DistributionName }
}

Step "1 | $env:USERPROFILE\.wslconfig - bounded VM resource ceiling"
$cfgPath = Join-Path $env:USERPROFILE '.wslconfig'
$want = [ordered]@{
  'wsl2' = [ordered]@{
    memory = "$([math]::Max(2, [math]::Floor($hostGB * 5 / 8)))GB"
    swap = '4GB'
    processors = "$([math]::Max(2, $cpus - 2))"
  }
  'experimental' = [ordered]@{
    autoMemoryReclaim = 'gradual'
  }
}
# sparse VHD stays opt-in: WSL 2.5.6+ (2025-04) gates it behind --allow-unsafe for potential data corruption.
if ($Sparse) { $want['experimental']['sparseVhd'] = 'true' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sections = [ordered]@{}; $order = @(); $preamble = @(); $cur = ''; $linkTarget = ''
if (Test-Path -LiteralPath $cfgPath) {
  # A symlink (some dotfiles managers keep one) reads through to its target, but the move below would replace the
  # link with a plain file and the manager's next sync would drop these keys again; a read-only file marks an
  # operator's hold the writer must not clear. The writer refuses both.
  $cfgItem = Get-Item -LiteralPath $cfgPath -Force
  if ([string]$cfgItem.Target -or ($cfgItem.Attributes -band [IO.FileAttributes]::ReadOnly)) {
    Need "$cfgPath is a link or read-only; the writer will not follow or clear it - apply the plan by hand, or change it, then re-run"
    if (-not $DryRun) { throw "$cfgPath is a link or read-only; stopping before the write (run with -DryRun for the plan)" }
  }
  # A strict decoder: an ANSI/cp1252 file with a non-ASCII byte in a value would otherwise decode to U+FFFD and be rewritten that way without a word.
  try { $lines = [IO.File]::ReadAllLines($cfgPath, (New-Object System.Text.UTF8Encoding($false, $true))) }
  catch [System.Text.DecoderFallbackException] { throw "$cfgPath is not valid UTF-8 (an ANSI-saved file with an accented character?); re-save it as UTF-8 and re-run" }
  foreach ($line in $lines) {
    # ReadAllLines honors a UTF-16 byte-order mark; without one every letter grows a NUL, every key reads unset, and ours would be appended to the wreck.
    if ($line -match "`0") { throw "$cfgPath holds NUL bytes (UTF-16 without a byte-order mark?); re-save it as UTF-8 and re-run" }
    if ($line -match '^\s*\[(.+?)\]\s*$') { $cur = $Matches[1]; if (-not $sections.Contains($cur)) { $sections[$cur] = @(); $order += $cur } }
    elseif ($cur) { $sections[$cur] += $line }
    else { $preamble += $line }
  }
}
# Trailing blank lines of every section fall away once here; the writer puts one blank after each section back.
foreach ($sec in @($sections.Keys)) {
  $body = @($sections[$sec]); $n = $body.Count
  while ($n -gt 0 -and [string]::IsNullOrWhiteSpace($body[$n - 1])) { $n-- }
  # assigned as @(...) on each branch: an if-expression would hand a one-line body back as a string
  if ($n -gt 0) { $sections[$sec] = @($body[0..($n - 1)]) } else { $sections[$sec] = @() }
}
$changed = $false
foreach ($sec in $want.Keys) {
  if (-not $sections.Contains($sec)) { $sections[$sec] = @(); $order += $sec }
  foreach ($key in $want[$sec].Keys) {
    $value = $want[$sec][$key]
    # Every line carrying the key counts: a duplicate left behind could win at WSL load while the first reads satisfied.
    $hits = @()
    for ($i = 0; $i -lt $sections[$sec].Count; $i++) { if ($sections[$sec][$i] -match "^\s*$([regex]::Escape($key))\s*=") { $hits += $i } }
    if ($hits.Count -gt 0) {
      $haves = @($hits | ForEach-Object { ($sections[$sec][$_] -split '=', 2)[1].Trim() })
      if (@($haves | Where-Object { $_ -ne $value }).Count -eq 0) { Already "[$sec] $key=$value"; continue }
      $changed = $true
      Act "[$sec] $key=$value (was $($haves -join ', '))" {
        foreach ($i in $hits) {
          # the operator's spelling of the key stays; a trailing comment on that one line does not survive the rewrite
          $spelled = if ($sections[$sec][$i] -match '^\s*([^=\s]+)') { $Matches[1] } else { $key }
          $sections[$sec][$i] = "$spelled=$value"
        }
      }
    } else {
      $changed = $true
      Act "[$sec] $key=$value (was unset)" { $sections[$sec] += "$key=$value" }
    }
  }
}
if ($changed -and -not $DryRun) {
  $out = @($preamble)
  foreach ($sec in $order) { $out += "[$sec]"; $out += @($sections[$sec]); $out += '' }
  # The text lands on a sibling temp file first; the previous file is copied to .wslconfig.bak, then the temp moves
  # into place. A failure before the move leaves .wslconfig as it was and takes the temp with it.
  $tmp = "$cfgPath.tmp"; $bak = "$cfgPath.bak"
  try {
    [IO.File]::WriteAllText($tmp, (($out -join "`r`n") + "`r`n"), $utf8)
    if (Test-Path -LiteralPath $cfgPath) { Copy-Item -LiteralPath $cfgPath -Destination $bak -Force }
    Move-Item -LiteralPath $tmp -Destination $cfgPath -Force
    Need "run wsl --shutdown at a session boundary - .wslconfig changes apply on the next VM start (previous file, if any, kept as $bak)"
  } catch {
    # The set lines above were printed as the plan was merged; a failed copy or move leaves the file as it was.
    Need "$cfgPath kept as it was; the set lines above did not land"
    throw
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
}

Step '2 | selected distro vhdx - sparse allocation (opt-in by -Sparse)'
$work = @($lxss | Where-Object DistributionName -eq $Distro) | Select-Object -First 1
$vhd = if ($work) { Join-Path ($work.BasePath -replace '^\\\\\?\\', '') 'ext4.vhdx' } else { '' }
if (-not $Distro) {
  Need 'no default WSL distro is registered; install one with wsl --install -d <DistroName>, or name one with -Distro'
} elseif (-not $work) {
  # A -Distro name the registry does not carry reads needs-you with or without -Sparse: a typo must not pass as already.
  $registered = @($lxss | Sort-Object DistributionName | ForEach-Object { [string]$_.DistributionName }) -join ', '
  Need "distro '$Distro' is not registered (registered: $registered); pass -Distro with an exact name"
} elseif ($Distro -match '^(docker-desktop|rancher-desktop|podman-machine)') {
  # A desktop tool owns its distros, and -Distro does not override that. The check sits ahead of the -Sparse gate so a
  # tool-managed default is never set sparse under the tool's feet.
  Need "'$Distro' is tool-managed; this runbook sets no tool-managed distro sparse - name the Linux distro with -Distro, or wsl --set-default <name>"
} elseif (-not $Sparse) {
  Already "sparse vhdx not requested for '$Distro' (-Sparse opts in; WSL gates it as unsafe) - $vhd left as found"
} elseif ($Sparse -and (-not $wslVersion -or $wslVersion -lt [version]'2.5.6')) {
  Need "sparse needs WSL 2.5.6 or later (wsl --update); nothing run"
} elseif (-not (Test-Path -LiteralPath $vhd)) {
  # -LiteralPath: a base path holding [ or ] would otherwise read as a wildcard and the vhdx as absent.
  Need "'$Distro' has no ext4.vhdx at its registered base path"
} else {
  $sizeGB = [math]::Round((Get-Item -LiteralPath $vhd).Length / 1GB, 1)
  if ((Get-Item -LiteralPath $vhd).Attributes -band [IO.FileAttributes]::SparseFile) { Already "$Distro sparse ($sizeGB GB on disk)" }
  else {
    # `--running -q` lists names alone, locale-free; the registry already proved registration, so an exact-name match decides.
    $running = @((Read-Wsl @('-l', '--running', '-q')) -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($running -contains $Distro) { Need "run wsl --shutdown, then re-run with -Sparse to set '$Distro' sparse ($sizeGB GB on disk)" }
    else {
      Need "you accepted Microsoft's warning by passing -Sparse: 'sparse VHD support is currently disabled due to potential data corruption'"
      Act "wsl --manage '$Distro' --set-sparse true --allow-unsafe" { wsl.exe --manage $Distro --set-sparse true --allow-unsafe | Out-Null; if ($LASTEXITCODE -ne 0) { throw "wsl --manage exited $LASTEXITCODE" } }
    }
  }
}

Write-Host ''
Write-Host "host: $hostGB GB | $cpus threads | Windows account: $env:USERNAME | selected distro: $(if ($Distro) { $Distro } else { '<none>' })"

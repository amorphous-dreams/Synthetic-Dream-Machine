<#
.SYNOPSIS
  stand-windows - the Windows half of lar:///ha.ka.ba/wsl2/setup, idempotent by intent.

.DESCRIPTION
  Each step names what it INTENDS, reads what IS, and acts only on the difference. Run twice and
  the second run reports every step `already`. Run elevated (Defender exclusions need it; the
  rest tolerate a plain shell).

  Steps: 1 .wslconfig keys | 2 Defender exclusions | 3 sparse vhdx | 4 stale distros | 5 shutdown advice

  -DryRun  show the plan, write nothing
  -Distro  the working distro (default Ubuntu-24.04)

  From inside WSL:  powershell.exe -ExecutionPolicy Bypass -File tools/wsl2/stand-windows.ps1
  (then re-run elevated for step 2 if it reports needs-admin)
#>
[CmdletBinding()]
param([switch]$DryRun, [string]$Distro = 'Ubuntu-24.04')

$ErrorActionPreference = 'Stop'
function Already($m) { Write-Host ("  {0,-10} {1}" -f 'already', $m) -ForegroundColor DarkGray }
function Set_($m)    { Write-Host ("  {0,-10} {1}" -f 'set', $m)     -ForegroundColor Green }
function Plan($m)    { Write-Host ("  {0,-10} {1}" -f 'would-set', $m) -ForegroundColor Yellow }
function Need($m)    { Write-Host ("  {0,-10} {1}" -f 'needs-you', $m) -ForegroundColor Red }
function Step($m)    { Write-Host "`n$m" -ForegroundColor White }
function Act($label, [scriptblock]$do) { if ($DryRun) { Plan $label } else { & $do; Set_ $label } }

$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$hostGB  = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$cpus    = (Get-CimInstance Win32_Processor | Measure-Object NumberOfLogicalProcessors -Sum).Sum

# ── 1 | .wslconfig ───────────────────────────────────────────────────────────────────────────────
Step "1 | $env:USERPROFILE\.wslconfig - the VM ceiling"
$cfgPath = Join-Path $env:USERPROFILE '.wslconfig'
# intents, derived from the host: VM gets 5/8 of RAM (Windows keeps 3/8 ≈ a quarter-plus), swap 4 GB, two threads left.
$want = [ordered]@{
  'wsl2' = [ordered]@{
    memory            = "$([math]::Floor($hostGB * 5 / 8))GB"
    swap              = '4GB'
    processors        = "$([math]::Max(2, $cpus - 2))"
    vmIdleTimeout     = '600000'
  }
  'experimental' = [ordered]@{
    autoMemoryReclaim = 'gradual'
    sparseVhd         = 'true'
  }
}
# parse the existing file into ordered sections, keeping comments and unknown keys as lines.
# Lines before the first [section] (a file-top comment) ride along as the preamble.
# Read and write as UTF-8 without BOM: a superset of ASCII, so an operator's non-ASCII comment survives.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sections = [ordered]@{}; $order = @(); $preamble = @(); $cur = ''
if (Test-Path $cfgPath) {
  foreach ($line in [IO.File]::ReadAllLines($cfgPath, $utf8)) {
    if ($line -match '^\s*\[(.+?)\]\s*$') { $cur = $Matches[1]; if (-not $sections.Contains($cur)) { $sections[$cur] = @(); $order += $cur } }
    elseif ($cur) { $sections[$cur] += $line }
    else { $preamble += $line }
  }
}
$changed = $false
foreach ($sec in $want.Keys) {
  if (-not $sections.Contains($sec)) { $sections[$sec] = @(); $order += $sec }
  foreach ($k in $want[$sec].Keys) {
    $v = $want[$sec][$k]
    $idx = -1; for ($i = 0; $i -lt $sections[$sec].Count; $i++) { if ($sections[$sec][$i] -match "^\s*$k\s*=") { $idx = $i; break } }
    if ($idx -ge 0) {
      $have = ($sections[$sec][$idx] -split '=', 2)[1].Trim()
      if ($have -eq $v) { Already "[$sec] $k=$v"; continue }
      Act "[$sec] $k=$v (was $have)" { $sections[$sec][$idx] = "$k=$v" }.GetNewClosure()
    } else {
      # insert after the section's last non-blank line, so the key sits with its siblings rather than after the gap
      Act "[$sec] $k=$v (was unset)" {
        $b = @($sections[$sec]); $n = $b.Count
        while ($n -gt 0 -and [string]::IsNullOrWhiteSpace($b[$n - 1])) { $n-- }
        $head = if ($n -gt 0) { $b[0..($n - 1)] } else { @() }
        $tail = if ($n -lt $b.Count) { $b[$n..($b.Count - 1)] } else { @() }
        $sections[$sec] = @($head) + "$k=$v" + @($tail)
      }.GetNewClosure()
    }
    $changed = $true
  }
}
if ($changed -and -not $DryRun) {
  # each section ends in exactly one blank line, so repeated writes do not grow the file
  $out = @($preamble)
  foreach ($sec in $order) {
    $body = @($sections[$sec]); $n = $body.Count
    while ($n -gt 0 -and [string]::IsNullOrWhiteSpace($body[$n - 1])) { $n-- }
    $out += "[$sec]"; if ($n -gt 0) { $out += $body[0..($n - 1)] }; $out += ''
  }
  [IO.File]::WriteAllText($cfgPath, (($out -join "`r`n") + "`r`n"), $utf8)
  Need "wsl --shutdown (from Windows, at a session boundary) - .wslconfig changes wait on it"
}

# ── 2 | Defender exclusions ──────────────────────────────────────────────────────────────────────
Step "2 | Defender - leave the vhdx and vmmem alone"
$lxss = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DistributionName -and $_.BasePath }
$vhdDirs = $lxss | ForEach-Object { $_.BasePath -replace '^\\\\\?\\', '' }
if (-not $IsAdmin) { Need "re-run elevated for Defender exclusions ($($vhdDirs -join ', '); process vmmem)" }
else {
  $pref = Get-MpPreference
  foreach ($d in $vhdDirs) {
    if ($pref.ExclusionPath -contains $d) { Already "path $d" } else { Act "exclude path $d" { Add-MpPreference -ExclusionPath $d }.GetNewClosure() }
  }
  foreach ($p in 'vmmem', 'vmmemWSL', 'wslservice.exe') {
    if ($pref.ExclusionProcess -contains $p) { Already "process $p" } else { Act "exclude process $p" { Add-MpPreference -ExclusionProcess $p }.GetNewClosure() }
  }
}

# ── 3 | sparse vhdx ──────────────────────────────────────────────────────────────────────────────
Step "3 | $Distro vhdx - let it shrink"
$work = $lxss | Where-Object DistributionName -eq $Distro
if (-not $work) { Need "distro $Distro not registered - wsl --install -d $Distro" }
else {
  $vhd = Join-Path ($work.BasePath -replace '^\\\\\?\\', '') 'ext4.vhdx'
  $sizeGB = [math]::Round((Get-Item $vhd).Length / 1GB, 1)
  $attrs = (Get-Item $vhd).Attributes
  if ($attrs -band [IO.FileAttributes]::SparseFile) { Already "sparse ($sizeGB GB on disk)" }
  else {
    # wsl.exe writes UTF-16LE to a redirected stdout; decoded as the OEM code page every letter grows a NUL and no regex matches
    $oldEnc = [Console]::OutputEncoding
    try { [Console]::OutputEncoding = [Text.Encoding]::Unicode; $listing = (wsl.exe -l -v | Out-String) } finally { [Console]::OutputEncoding = $oldEnc }
    $state = $listing -split "`n" | Where-Object { $_ -match "\b$([regex]::Escape($Distro))\b" }
    if (-not $state) { Need "wsl -l -v does not list $Distro - read it by hand before: wsl --manage $Distro --set-sparse true" }
    elseif ($state -match 'Running') { Need "wsl --shutdown, then: wsl --manage $Distro --set-sparse true   ($sizeGB GB on disk, not sparse)" }
    else { Act "wsl --manage $Distro --set-sparse true" { wsl.exe --manage $Distro --set-sparse true | Out-Null; if ($LASTEXITCODE -ne 0) { throw "wsl --manage exited $LASTEXITCODE (needs WSL 2.0+ and a stopped distro)" } } }
  }
}

# ── 4 | stale distros ────────────────────────────────────────────────────────────────────────────
Step "4 | distros - one working, docker-desktop beside it"
foreach ($d in $lxss) {
  $n = $d.DistributionName
  if ($n -eq $Distro -or $n -like 'docker-desktop*') { Already $n; continue }
  $vhd = Join-Path ($d.BasePath -replace '^\\\\\?\\', '') 'ext4.vhdx'
  $last = (Get-Item $vhd -ErrorAction SilentlyContinue).LastWriteTime
  Need "$n last written $last - read it (wsl -d $n -- last -F), then: wsl --export $n <path>.tar; wsl --unregister $n"
}

Write-Host ''
Write-Host "host: $hostGB GB | $cpus threads | admin=$IsAdmin | dry-run=$DryRun"

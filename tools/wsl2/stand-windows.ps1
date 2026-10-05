<#
.SYNOPSIS
  stand-windows - Windows half of lar:///ha.ka.ba/wsl2/setup, idempotent by intent.

.DESCRIPTION
  It merges only resource keys owned by this runbook, preserves other `.wslconfig` sections and
  comments, selects the registered default Linux distro unless `-Distro` names one, and never
  unregisters, exports, or modifies a nonselected distro.

  -DryRun shows the plan without writes.
  -Distro optionally names the WSL distro whose vhdx should become sparse.
  -NoRelaunch keeps the run in the current PowerShell even when pwsh (7+) is installed.

  The runbook's PowerShell is 7 (pwsh). Step 0 reads the running engine: under Windows PowerShell
  5.1 with pwsh installed it relaunches itself there once; without pwsh it reports needs-you and
  continues, since every later step tolerates 5.1. The file keeps a UTF-8 BOM and ASCII-only code
  so that 5.1 bootstrap parse holds.
#>
[CmdletBinding()]
param([switch]$DryRun, [string]$Distro = '', [switch]$NoRelaunch)

$ErrorActionPreference = 'Stop'
function Already($m) { Write-Host ("  {0,-10} {1}" -f 'already', $m) -ForegroundColor DarkGray }
function Set_($m)    { Write-Host ("  {0,-10} {1}" -f 'set', $m) -ForegroundColor Green }
function Plan($m)    { Write-Host ("  {0,-10} {1}" -f 'would-set', $m) -ForegroundColor Yellow }
function Need($m)    { Write-Host ("  {0,-10} {1}" -f 'needs-you', $m) -ForegroundColor Red }
function Step($m)    { Write-Host "`n$m" -ForegroundColor White }
function Act($label, [scriptblock]$do) { if ($DryRun) { Plan $label } else { & $do; Set_ $label } }

Step '0 | PowerShell 7 - the runbook engine'
$psMajor = $PSVersionTable.PSVersion.Major
$pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if (-not $pwsh) {
  $candidate = Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'
  if (Test-Path $candidate) { $pwsh = Get-Item $candidate }
}
if ($psMajor -ge 7) {
  Already "pwsh $($PSVersionTable.PSVersion) running"
} elseif ($pwsh -and -not $NoRelaunch) {
  $pwshPath = if ($pwsh.Source) { $pwsh.Source } else { $pwsh.FullName }
  $forward = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-NoRelaunch')
  if ($DryRun) { $forward += '-DryRun' }
  if ($Distro) { $forward += @('-Distro', $Distro) }
  Set_ "relaunching under $pwshPath (was Windows PowerShell $($PSVersionTable.PSVersion))"
  & $pwshPath @forward
  exit $LASTEXITCODE
} elseif ($pwsh) {
  Already "pwsh present at $(if ($pwsh.Source) { $pwsh.Source } else { $pwsh.FullName }); staying in $($PSVersionTable.PSVersion) by -NoRelaunch"
} else {
  Need "install PowerShell 7: winget install --id Microsoft.PowerShell --source winget   (continuing under Windows PowerShell $($PSVersionTable.PSVersion))"
}

$hostGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$cpus = (Get-CimInstance Win32_Processor | Measure-Object NumberOfLogicalProcessors -Sum).Sum
$lxssRootPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
$lxssRoot = Get-ItemProperty $lxssRootPath -ErrorAction SilentlyContinue
$lxss = Get-ChildItem $lxssRootPath -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ItemProperty $_.PSPath } |
  Where-Object { $_.DistributionName -and $_.BasePath }

if (-not $Distro) {
  $defaultGuid = [string]$lxssRoot.DefaultDistribution
  $selected = @($lxss | Where-Object { $_.PSChildName -eq $defaultGuid }) | Select-Object -First 1
  if (-not $selected) { $selected = @($lxss | Where-Object { $_.DistributionName -notlike 'docker-desktop*' }) | Select-Object -First 1 }
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
    sparseVhd = 'true'
  }
}
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
  foreach ($key in $want[$sec].Keys) {
    $value = $want[$sec][$key]
    $idx = -1
    for ($i = 0; $i -lt $sections[$sec].Count; $i++) { if ($sections[$sec][$i] -match "^\s*$([regex]::Escape($key))\s*=") { $idx = $i; break } }
    if ($idx -ge 0) {
      $have = ($sections[$sec][$idx] -split '=', 2)[1].Trim()
      if ($have -eq $value) { Already "[$sec] $key=$value"; continue }
      $changed = $true
      Act "[$sec] $key=$value (was $have)" { $sections[$sec][$idx] = "$key=$value" }.GetNewClosure()
    } else {
      $changed = $true
      Act "[$sec] $key=$value (was unset)" {
        $body = @($sections[$sec]); $n = $body.Count
        while ($n -gt 0 -and [string]::IsNullOrWhiteSpace($body[$n - 1])) { $n-- }
        $head = if ($n -gt 0) { $body[0..($n - 1)] } else { @() }
        $tail = if ($n -lt $body.Count) { $body[$n..($body.Count - 1)] } else { @() }
        $sections[$sec] = @($head) + "$key=$value" + @($tail)
      }.GetNewClosure()
    }
  }
}
if ($changed -and -not $DryRun) {
  $out = @($preamble)
  foreach ($sec in $order) {
    $body = @($sections[$sec]); $n = $body.Count
    while ($n -gt 0 -and [string]::IsNullOrWhiteSpace($body[$n - 1])) { $n-- }
    $out += "[$sec]"
    if ($n -gt 0) { $out += $body[0..($n - 1)] }
    $out += ''
  }
  [IO.File]::WriteAllText($cfgPath, (($out -join "`r`n") + "`r`n"), $utf8)
  Need 'run wsl --shutdown at a session boundary - .wslconfig changes apply on the next VM start'
}

Step '2 | selected distro vhdx - opt into sparse allocation'
if (-not $Distro) {
  Need 'no non-Docker WSL distro is registered; install one with wsl --install -d <DistroName>'
} else {
  $work = @($lxss | Where-Object DistributionName -eq $Distro) | Select-Object -First 1
  if (-not $work) {
    Need "distro '$Distro' is not registered; run wsl -l -v, then pass -Distro with an exact name"
  } else {
    $vhd = Join-Path ($work.BasePath -replace '^\\\\\?\\', '') 'ext4.vhdx'
    if (-not (Test-Path $vhd)) { Need "'$Distro' has no ext4.vhdx at its registered base path" }
    else {
      $sizeGB = [math]::Round((Get-Item $vhd).Length / 1GB, 1)
      if ((Get-Item $vhd).Attributes -band [IO.FileAttributes]::SparseFile) { Already "$Distro sparse ($sizeGB GB on disk)" }
      else {
        # wsl.exe writes UTF-16LE to a redirected stdout; decoded as the OEM code page every letter grows a NUL and no regex matches
        $oldEnc = [Console]::OutputEncoding
        try { [Console]::OutputEncoding = [Text.Encoding]::Unicode; $listing = (wsl.exe -l -v | Out-String) } finally { [Console]::OutputEncoding = $oldEnc }
        $state = $listing -split "`n" | Where-Object { $_ -match "\b$([regex]::Escape($Distro))\b" }
        if (-not $state) { Need "wsl -l -v did not list '$Distro'; inspect it before using wsl --manage '$Distro' --set-sparse true" }
        elseif ($state -match 'Running') { Need "run wsl --shutdown, then re-run to set '$Distro' sparse ($sizeGB GB on disk)" }
        else { Act "wsl --manage '$Distro' --set-sparse true" { wsl.exe --manage $Distro --set-sparse true | Out-Null; if ($LASTEXITCODE -ne 0) { throw "wsl --manage exited $LASTEXITCODE" } } }
      }
    }
  }
}

Step '3 | registered distros - inventory only'
foreach ($d in ($lxss | Sort-Object DistributionName)) {
  $name = [string]$d.DistributionName
  if ($name -eq $Distro) { Already "$name (selected)" }
  elseif ($name -like 'docker-desktop*') { Already "$name (Docker-managed)" }
  else { Already "$name (left untouched)" }
}

Write-Host ''
$selectedLabel = if ($Distro) { $Distro } else { '<none>' }
Write-Host "host: $hostGB GB | $cpus threads | selected distro: $selectedLabel | dry-run=$DryRun"

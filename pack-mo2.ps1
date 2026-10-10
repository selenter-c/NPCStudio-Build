<#
.SYNOPSIS
    Pack NPC Studio into FOMOD archive for Mod Organizer 2.

.DESCRIPTION
    Creates a FOMOD-compatible .zip from:
      - NPCStudio-GamePlugin/Data/ (scripts, UI, configs)
      - NPCStudio-NativePlugin/build/NPCStudio.dll
      - NPCStudio-GamePlugin/fomod/ (MO2 installer)
    
    Uses .NET ZipArchive for forward-slash paths (FOMOD requirement).

.PARAMETER Version
    Mod version. Default: read from fomod/info.xml.

.PARAMETER DllPath
    Path to NPCStudio.dll. Default: auto-detect in build/.

.PARAMETER SkipValidation
    Skip ZIP validation (not recommended).

.EXAMPLE
    .\pack-mo2.ps1
    .\pack-mo2.ps1 -Version 0.2.0
#>
[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$DllPath = "",
    [switch]$SkipValidation
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$BS = [char]92
$FS = [char]47

$repoRoot   = Split-Path -Parent $PSScriptRoot
$gameDir    = Join-Path $repoRoot 'NPCStudio-GamePlugin'
$dataDir    = Join-Path $gameDir 'Data'
$fomodDir   = Join-Path $gameDir 'fomod'
$moduleCfg  = Join-Path $fomodDir 'ModuleConfig.xml'
$infoXml    = Join-Path $fomodDir 'info.xml'
$distDir    = Join-Path $PSScriptRoot 'dist'
$stagingDir = Join-Path $PSScriptRoot 'output\staging'

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NPC Studio - MO2 FOMOD Packager" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Version ---
if ([string]::IsNullOrWhiteSpace($Version)) {
    if (-not (Test-Path $infoXml)) { throw "fomod/info.xml not found at $infoXml" }
    [xml]$info = Get-Content -Raw -Path $infoXml
    $Version = ([string]$info.fomod.Version).Trim()
}
Write-Host "  Version: $Version" -ForegroundColor White

# --- Check sources ---
if (-not (Test-Path $dataDir)) { throw "Data/ not found at $dataDir" }
if (-not (Test-Path $moduleCfg)) { throw "ModuleConfig.xml not found at $moduleCfg" }
Write-Host "  Source:  $gameDir" -ForegroundColor DarkGray

# --- Find DLL ---
if ([string]::IsNullOrWhiteSpace($DllPath)) {
    $candidates = @(
        (Join-Path $repoRoot 'NPCStudio-NativePlugin\build\NPCStudio.dll'),
        (Join-Path $repoRoot 'NPCStudio-NativePlugin\build\Release\NPCStudio.dll'),
        (Join-Path $repoRoot 'NPCStudio-NativePlugin\build\bin\Release\NPCStudio.dll')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $DllPath = $c; break }
    }
}

$dllIncluded = $false
if (Test-Path $DllPath) {
    $sizeKB = [math]::Round((Get-Item $DllPath).Length / 1KB)
    Write-Host ("  DLL:     {0} ({1} KB)" -f $DllPath, $sizeKB) -ForegroundColor Green
    $dllIncluded = $true
} else {
    Write-Warning "DLL not found! Archive will NOT contain the native plugin."
    Write-Warning "Run build-native.ps1 first to compile the DLL."
}

# --- Staging ---
Write-Host ""
Write-Host "Preparing staging area..." -ForegroundColor Yellow

if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

# Копируем содержимое Data/ напрямую в staging (без папки Data/)
Get-ChildItem -Path $dataDir | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $stagingDir -Recurse -Force
}
Write-Host "  Copied Data/ contents" -ForegroundColor DarkGray

if ($dllIncluded) {
    $dllDestDir = Join-Path $stagingDir 'SKSE\Plugins'
    if (-not (Test-Path $dllDestDir)) { New-Item -ItemType Directory -Path $dllDestDir | Out-Null }
    
    Copy-Item -Path $DllPath -Destination (Join-Path $dllDestDir 'NPCStudio.dll') -Force
    Write-Host "  Copied NPCStudio.dll -> SKSE/Plugins/" -ForegroundColor DarkGray
    
    # Копируем зависимости DLL (если есть — для динамической линковки)
    $buildDir = Split-Path -Parent $DllPath
    $deps = @('spdlog.dll', 'fmt.dll')
    foreach ($dep in $deps) {
        $depSrc = Join-Path $buildDir $dep
        if (Test-Path $depSrc) {
            Copy-Item -Path $depSrc -Destination (Join-Path $dllDestDir $dep) -Force
            Write-Host "  Copied $dep -> SKSE/Plugins/" -ForegroundColor DarkGray
        }
    }
}

Copy-Item -Path $fomodDir -Destination (Join-Path $stagingDir 'fomod') -Recurse
Write-Host "  Copied fomod/" -ForegroundColor DarkGray

# --- Create ZIP ---
Write-Host ""
Write-Host "Creating FOMOD archive..." -ForegroundColor Yellow

if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }
$outZip = Join-Path $distDir "NPCStudio-$Version-fomod.zip"
if ([System.IO.File]::Exists($outZip)) { [System.IO.File]::Delete($outZip) }

$excludeNames = @('meta.ini','Thumbs.db','desktop.ini','.DS_Store')
$stagingLen = $stagingDir.Length + 1
$filesystem = [System.IO.File]::Open($outZip, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($filesystem, [System.IO.Compression.ZipArchiveMode]::Create)
$packed = 0

foreach ($f in (Get-ChildItem -Path $stagingDir -Recurse -File)) {
    if ($excludeNames -contains $f.Name) { continue }
    if ($f.Name -like '*.swp' -or $f.Name -like '*~') { continue }
    $rel = $f.FullName.Substring($stagingLen).Replace($BS, $FS)
    $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $es = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $es.Write($bytes, 0, $bytes.Length)
    $es.Dispose()
    $packed++
}
$zip.Dispose()
$filesystem.Close()

Write-Host "  Packed $packed files" -ForegroundColor DarkGray

# --- Validate ZIP ---
if (-not $SkipValidation) {
    Write-Host ""
    Write-Host "Validating archive..." -ForegroundColor Yellow
    
    $z = [System.IO.Compression.ZipFile]::OpenRead($outZip)
    $problems = @()
    try {
        $entries = @($z.Entries | ForEach-Object { $_.FullName })
        
        $bad = @($entries | Where-Object { $_.Contains($BS) })
        if ($bad.Count -gt 0) {
            $problems += "$($bad.Count) entries use backslash separators"
        }
        
        if (-not ($entries -contains 'fomod/ModuleConfig.xml')) {
            $problems += "Missing fomod/ModuleConfig.xml"
        }
        if (-not ($entries -contains 'fomod/info.xml')) {
            $problems += "Missing fomod/info.xml"
        }
        
        if ($dllIncluded -and -not ($entries -contains 'SKSE/Plugins/NPCStudio.dll')) {
            $problems += "Missing SKSE/Plugins/NPCStudio.dll"
        }
    } finally { $z.Dispose() }
    
    if ($problems.Count -gt 0) {
        Write-Host "VALIDATION FAILED:" -ForegroundColor Red
        $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        [System.IO.File]::Delete($outZip)
        exit 1
    }
    
    Write-Host "  Validation passed" -ForegroundColor Green
}

# --- Result ---
$sizeKB = [math]::Round((Get-Item $outZip).Length / 1KB)
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ARCHIVE CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  Path: $outZip" -ForegroundColor Green
Write-Host "  Size: $sizeKB KB ($packed files)" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
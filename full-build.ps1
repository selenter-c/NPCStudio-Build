<#
.SYNOPSIS
    Full build: ESP generation + compile + pack FOMOD archive for MO2.

.DESCRIPTION
    Single script that:
      1. Generates NPCStudio.esp via build-esp.ps1
      2. Compiles C++ plugin via build-native.ps1
      3. Packs into FOMOD .zip via pack-mo2.ps1
    
    Result: dist/NPCStudio-X.Y.Z-beta-fomod.zip.

.PARAMETER Config
    Build configuration: Release (default) or Debug.

.PARAMETER VcpkgRoot
    Path to vcpkg. Default: C:\vcpkg or $env:VCPKG_ROOT.

.PARAMETER Clean
    Force clean rebuild of C++ plugin (delete build/ and recompile all).
    Without this flag, only changed files are recompiled (incremental build).

.EXAMPLE
    .\full-build.ps1                    # Incremental build + pack (fast)
    .\full-build.ps1 -Clean             # Full rebuild from scratch + pack
    .\full-build.ps1 -Config Debug      # Debug incremental build
#>
[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$Config = "Release",
    [string]$VcpkgRoot = "",
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$startTime = Get-Date

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NPC Studio - Full Build Pipeline" -ForegroundColor Cyan
Write-Host "  Author: Selenter" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# STEP 1: Generate ESP
# ============================================================
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "  STEP 1/3: Generating NPCStudio.esp" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow

& "$PSScriptRoot\build-esp.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED at Step 1 (ESP generation)" -ForegroundColor Red
    exit 1
}

# ============================================================
# STEP 2: Compile Native Plugin
# ============================================================
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "  STEP 2/3: Building Native Plugin ($Config)" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow

if ($Clean) {
    if ([string]::IsNullOrWhiteSpace($VcpkgRoot)) {
        & "$PSScriptRoot\build-native.ps1" -Config $Config -Clean
    } else {
        & "$PSScriptRoot\build-native.ps1" -Config $Config -VcpkgRoot $VcpkgRoot -Clean
    }
} else {
    if ([string]::IsNullOrWhiteSpace($VcpkgRoot)) {
        & "$PSScriptRoot\build-native.ps1" -Config $Config
    } else {
        & "$PSScriptRoot\build-native.ps1" -Config $Config -VcpkgRoot $VcpkgRoot
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED at Step 2 (Native Plugin compilation)" -ForegroundColor Red
    exit 1
}

# ============================================================
# STEP 3: Pack FOMOD archive
# ============================================================
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "  STEP 3/3: Packing for Mod Organizer 2" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow

& "$PSScriptRoot\pack-mo2.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED at Step 3 (MO2 packing)" -ForegroundColor Red
    exit 1
}

# ============================================================
# DONE
# ============================================================
$elapsed = (Get-Date) - $startTime
$minutes = [math]::Floor($elapsed.TotalMinutes)
$seconds = [math]::Round($elapsed.Seconds)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  FULL BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  Time: ${minutes}m ${seconds}s" -ForegroundColor Green
Write-Host "  Archive: dist/NPCStudio-*-fomod.zip" -ForegroundColor Green
Write-Host ""
Write-Host "  Install via Mod Organizer 2:" -ForegroundColor Green
Write-Host "  1. Open MO2" -ForegroundColor Green
Write-Host "  2. Click Install Mod (folder icon)" -ForegroundColor Green
Write-Host "  3. Select the .zip from dist/" -ForegroundColor Green
Write-Host "  4. Enable the mod + activate NPCStudio.esp" -ForegroundColor Green
Write-Host "  5. Launch Skyrim SE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

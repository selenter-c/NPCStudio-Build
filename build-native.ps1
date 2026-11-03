<#
.SYNOPSIS
    Compile NPC Studio NativePlugin (C++ SKSE plugin).

.DESCRIPTION
    Builds NPCStudio.dll via CMake + Ninja + MSVC + vcpkg.
    Output: ../NPCStudio-NativePlugin/build/NPCStudio.dll

.PARAMETER Config
    Build configuration: Release (default) or Debug.

.PARAMETER VcpkgRoot
    Path to vcpkg. Default: C:\vcpkg or $env:VCPKG_ROOT.

.PARAMETER Clean
    Force clean rebuild (delete build/ directory). Without this flag,
    CMake performs incremental build (only changed files are recompiled).

.EXAMPLE
    .\build-native.ps1                    # Incremental build (fast)
    .\build-native.ps1 -Clean             # Full rebuild from scratch
    .\build-native.ps1 -Config Debug      # Debug incremental build
#>
[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$Config = "Release",
    [string]$VcpkgRoot = "",
    [switch]$Clean,
    [switch]$Fresh
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/BuildHelpers.ps1"

$repoRoot  = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $repoRoot 'NPCStudio-NativePlugin'
$buildDir  = Join-Path $nativeDir 'build'

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NPC Studio - Native Plugin Build" -ForegroundColor Cyan
Write-Host "  Config: $Config" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $nativeDir)) {
    throw "NPCStudio-NativePlugin not found at $nativeDir"
}

# --- Find vcpkg ---
if ([string]::IsNullOrWhiteSpace($VcpkgRoot)) {
    if ($env:VCPKG_ROOT -and (Test-Path $env:VCPKG_ROOT)) {
        $VcpkgRoot = $env:VCPKG_ROOT
    } elseif (Test-Path "C:\vcpkg") {
        $VcpkgRoot = "C:\vcpkg"
    }
}

$vcpkgToolchain = ""
if (-not [string]::IsNullOrWhiteSpace($VcpkgRoot) -and (Test-Path "$VcpkgRoot\scripts\buildsystems\vcpkg.cmake")) {
    $vcpkgToolchain = "$VcpkgRoot\scripts\buildsystems\vcpkg.cmake"
    Write-Host "[OK] vcpkg: $VcpkgRoot" -ForegroundColor Green
} else {
    Write-Warning "vcpkg not found."
}

# --- Find vcvarsall.bat ---
$vcvarsall = ""
$vsPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvarsall.bat",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\*\VC\Auxiliary\Build\vcvarsall.bat",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\*\VC\Auxiliary\Build\vcvarsall.bat"
)
foreach ($p in $vsPaths) {
    $f = Get-Item $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($f) { $vcvarsall = $f.FullName; break }
}

if ([string]::IsNullOrWhiteSpace($vcvarsall)) {
    throw "vcvarsall.bat not found. Install Visual Studio with C++ workload."
}
Write-Host "[OK] VS: $vcvarsall" -ForegroundColor Green

# --- Find cl.exe ---
$clExe = ""
$clPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Insiders\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\*\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\*\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe"
)
foreach ($p in $clPaths) {
    $f = Get-Item $p -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "14\.44\." } | Sort-Object FullName -Descending | Select-Object -First 1
    if ($f) { $clExe = $f.FullName; break }
}

if ([string]::IsNullOrWhiteSpace($clExe)) {
    throw "cl.exe not found. Install Visual Studio with C++ workload."
}
Write-Host "[OK] CL: $clExe" -ForegroundColor Green

# --- Find Ninja ---
$ninjaPath = ""
$ninjaPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Insiders\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\*\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\*\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe"
)
foreach ($p in $ninjaPaths) {
    $f = Get-Item $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($f) { $ninjaPath = $f.FullName; break }
}

if (-not [string]::IsNullOrWhiteSpace($ninjaPath)) {
    Write-Host "[OK] Ninja: $ninjaPath" -ForegroundColor Green
} else {
    Write-Warning "Ninja not found."
}

# --- Clean build dir (only if -Clean flag is set) ---
if ($Clean -and (Test-Path $buildDir)) {
    Write-Host "Cleaning previous build (-Clean flag)..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $buildDir
} elseif (Test-Path $buildDir) {
    Write-Host "Incremental build (use -Clean for full rebuild)" -ForegroundColor DarkGray
}

# --- Create temp batch file for configure ---
$tempBat = Join-Path $env:TEMP "npcstudio_build_$([guid]::NewGuid().ToString('N')).bat"

$toolchainLine = ""
if (-not [string]::IsNullOrWhiteSpace($vcpkgToolchain)) {
    $tripletFile = Join-Path $nativeDir 'x64-windows-static.cmake'
    if (Test-Path $tripletFile) {
        $toolchainLine = "-DCMAKE_TOOLCHAIN_FILE=$vcpkgToolchain -DVCPKG_OVERLAY_TRIPLETS=$nativeDir -DVCPKG_TARGET_TRIPLET=x64-windows-static"
    } else {
        $toolchainLine = "-DCMAKE_TOOLCHAIN_FILE=$vcpkgToolchain"
    }
}

$ninjaLine = ""
if (-not [string]::IsNullOrWhiteSpace($ninjaPath)) {
    $ninjaDir = Split-Path -Parent $ninjaPath
    $ninjaLine = "set PATH=$ninjaDir;%PATH%"
}

$freshArg = if ($Fresh) { "--fresh" } else { "" }
$batContent = @"
@echo off
call "$vcvarsall" x64 -vcvars_ver=14.44 >nul 2>&1
$ninjaLine
cmake $freshArg -S "$nativeDir" -B "$buildDir" -G Ninja -DCMAKE_BUILD_TYPE=$Config -DCMAKE_C_COMPILER="$clExe" -DCMAKE_CXX_COMPILER="$clExe" $toolchainLine
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
cmake --build "$buildDir" --parallel 6
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
ctest --test-dir "$buildDir" -C $Config --output-on-failure
exit /b %ERRORLEVEL%
"@

Set-Content -Path $tempBat -Value $batContent -Encoding ASCII

Write-Host ""
Write-Host "[1/2] Configuring and building..." -ForegroundColor Yellow

cmd /c "`"$tempBat`""
$buildResult = $LASTEXITCODE

Remove-Item $tempBat -Force -ErrorAction SilentlyContinue

if ($buildResult -ne 0) {
    Write-Host "Build FAILED (exit $buildResult)" -ForegroundColor Red
    exit 1
}

# --- Check result ---
$dllPath = Join-Path $buildDir "NPCStudio.dll"
if (-not (Test-Path $dllPath)) { $dllPath = Join-Path $buildDir "$Config\NPCStudio.dll" }
if (-not (Test-Path $dllPath)) { $dllPath = Join-Path $buildDir "bin\$Config\NPCStudio.dll" }

if (Test-Path $dllPath) {
    $stamp = @{ version = '0.6.1'; sourceHash = (Get-NativeSourceHash $nativeDir); dllHash = (Get-FileDigest $dllPath); validation = 'compiled; runtime unverified' }
    $stamp | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path -Parent $dllPath) 'NPCStudio.build.json') -Encoding UTF8
    $sizeKB = [math]::Round((Get-Item $dllPath).Length / 1KB)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "  DLL: $dllPath" -ForegroundColor Green
    Write-Host "  Size: $sizeKB KB" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Warning "DLL not found. Check build output above."
    exit 1
}
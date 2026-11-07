[CmdletBinding()]
param([string]$Version = "", [string]$DllPath = "", [switch]$Public)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/BuildHelpers.ps1"
$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $repoRoot 'NPCStudio-NativePlugin'
if (-not $DllPath) { $DllPath = Join-Path $nativeDir 'build/NPCStudio.dll' }
& "$PSScriptRoot/build-esp.ps1" -ValidateOnly
$sourceHash = Get-NativeSourceHash $nativeDir
$packOptions = @()
if ($Public) { $packOptions += '--public' }
& python "$PSScriptRoot/tools/pack.py" --root $repoRoot --dll $DllPath --source-hash $sourceHash "--version=$Version" @packOptions
if ($LASTEXITCODE -ne 0) { throw 'Package validation failed' }

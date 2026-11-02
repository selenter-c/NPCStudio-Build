[CmdletBinding()]
param([string]$Version = "", [string]$DllPath = "", [switch]$SkipValidation)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/BuildHelpers.ps1"
$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $repoRoot 'NPCStudio-NativePlugin'
if (-not $DllPath) { $DllPath = Join-Path $nativeDir 'build/NPCStudio.dll' }
& "$PSScriptRoot/build-esp.ps1" -ValidateOnly
$sourceHash = Get-NativeSourceHash $nativeDir
& python "$PSScriptRoot/tools/pack.py" --root $repoRoot --dll $DllPath --source-hash $sourceHash "--version=$Version"
if ($LASTEXITCODE -ne 0) { throw 'Package validation failed' }

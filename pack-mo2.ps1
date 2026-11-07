[CmdletBinding()]
param([string]$Version = "", [string]$DllPath = "", [switch]$IncludePhantasm)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/BuildHelpers.ps1"
$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $repoRoot 'NPCStudio-NativePlugin'
if (-not $DllPath) { $DllPath = Join-Path $nativeDir 'build/NPCStudio.dll' }
& "$PSScriptRoot/build-esp.ps1" -ValidateOnly
$sourceHash = Get-NativeSourceHash $nativeDir
$npcStudioPackOptions = @()
if ($IncludePhantasm) { $npcStudioPackOptions += '--include-phantasm' }
& python "$PSScriptRoot/tools/pack.py" --root $repoRoot --dll $DllPath --source-hash $sourceHash "--version=$Version" @npcStudioPackOptions
if ($LASTEXITCODE -ne 0) { throw 'Package validation failed' }

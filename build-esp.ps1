[CmdletBinding()]
param([string]$SkyrimData = "", [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $repoRoot 'NPCStudio-GamePlugin/Data'
$tool = Join-Path $PSScriptRoot 'tools/EspTool/EspTool.csproj'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'ESP generation requires .NET SDK 10' }
if ($ValidateOnly) {
    & dotnet run --project $tool -c Release -- validate $dataDir
} else {
    $candidates = @($SkyrimData)
    if ($env:SKYRIM_FOLDER) { $candidates += (Join-Path $env:SKYRIM_FOLDER 'Data') }
    foreach ($registryPath in @('HKLM:\SOFTWARE\WOW6432Node\Bethesda Softworks\Skyrim Special Edition', 'HKLM:\SOFTWARE\Bethesda Softworks\Skyrim Special Edition')) {
        $entry = Get-ItemProperty -LiteralPath $registryPath -ErrorAction SilentlyContinue
        if ($entry -and $entry.'Installed Path') { $candidates += (Join-Path $entry.'Installed Path' 'Data') }
    }
    $candidates += 'D:\SteamLibrary\steamapps\common\Skyrim Special Edition\Data'
    $source = $null
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'Skyrim.esm'))) { $source = Join-Path $candidate 'Skyrim.esm'; break }
    }
    if (-not $source) { throw 'Skyrim.esm not found. Pass -SkyrimData to build-esp.ps1' }
    & dotnet run --project $tool -c Release -- generate $dataDir $source
}
if ($LASTEXITCODE -ne 0) { throw 'ESP generation/validation failed' }

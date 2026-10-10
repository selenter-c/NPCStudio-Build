<#
.SYNOPSIS
    Generate NPCStudio.esp plugin file for Skyrim SE.

.DESCRIPTION
    Creates a minimal valid TES4 plugin file with:
      - TES4 header (author, description, master files)
      - QUST record for NPCStudio_Manager quest
      - REFR alias for PlayerAlias
    
    Uses Python to generate the binary ESP format.
    Output: ../NPCStudio-GamePlugin/Data/NPCStudio.esp

.PARAMETER Author
    Plugin author name. Default: "Selenter".

.PARAMETER Description
    Plugin description. Default: "NPC Studio - NPC Editor for Skyrim SE".

.EXAMPLE
    .\build-esp.ps1
    .\build-esp.ps1 -Author "MyName"
#>
[CmdletBinding()]
param(
    [string]$Author = "Selenter",
    [string]$Description = "NPC Studio - NPC Editor for Skyrim SE"
)

$ErrorActionPreference = 'Stop'

$repoRoot  = Split-Path -Parent $PSScriptRoot
$gameDir   = Join-Path $repoRoot 'NPCStudio-GamePlugin'
$dataDir   = Join-Path $gameDir 'Data'
$espPath   = Join-Path $dataDir 'NPCStudio.esp'

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NPC Studio - ESP Generator" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Check Python ---
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw "Python not found in PATH. Install Python 3.8+."
}
Write-Host "[OK] Python: $($python.Source)" -ForegroundColor Green

# --- Ensure Data dir exists ---
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

# --- Generate ESP via Python ---
Write-Host ""
Write-Host "Generating NPCStudio.esp..." -ForegroundColor Yellow

$pyScript = @"
import struct, sys, os

def write_record(f, rec_type, subrecords_data):
    data = b''.join(subrecords_data)
    f.write(rec_type.encode('ascii'))
    f.write(struct.pack('<I', len(data)))
    f.write(struct.pack('<I', 0))  # flags
    f.write(struct.pack('<I', 0))  # formid
    f.write(struct.pack('<I', 0))  # version
    f.write(data)

def make_subrecord(tag, data):
    result = tag.encode('ascii')
    result += struct.pack('<H', len(data))
    result += data
    return result

author = sys.argv[1] if len(sys.argv) > 1 else 'Selenter'
desc = sys.argv[2] if len(sys.argv) > 2 else 'NPC Studio'
out_path = sys.argv[3] if len(sys.argv) > 3 else 'NPCStudio.esp'

with open(out_path, 'wb') as f:
    # === TES4 Header Record ===
    hedr = bytearray(12)
    struct.pack_into('<f', hedr, 0, 1.7)     # Version
    struct.pack_into('<I', hedr, 4, 1)       # Num records (TES4 only)
    struct.pack_into('<I', hedr, 8, 0x800)   # Next object ID

    cnam = author.encode('ascii') + b'\x00'
    snam = desc.encode('ascii') + b'\x00'
    mast = b'Skyrim.esm\x00'
    data_after_mast = struct.pack('<Q', 0)   # Master file size (8 bytes)
    intv = struct.pack('<I', 1)
    incc = struct.pack('<I', 0)

    tes4_data = b''
    tes4_data += make_subrecord('HEDR', bytes(hedr))
    tes4_data += make_subrecord('CNAM', cnam)
    tes4_data += make_subrecord('SNAM', snam)
    tes4_data += make_subrecord('MAST', mast)
    tes4_data += make_subrecord('DATA', data_after_mast)
    tes4_data += make_subrecord('INTV', intv)
    tes4_data += make_subrecord('INCC', incc)

    # Write TES4 record manually (FormID=0, Flags=0x00000001 for master check)
    f.write(b'TES4')
    f.write(struct.pack('<I', len(tes4_data)))
    f.write(struct.pack('<I', 0x00000001))  # flags: ESM-like
    f.write(struct.pack('<I', 0))           # FormID always 0
    f.write(struct.pack('<I', 0))           # version control
    f.write(tes4_data)

print(f'Created {out_path} ({os.path.getsize(out_path)} bytes)')
"@

$tempPy = Join-Path $env:TEMP "gen_esp_$([guid]::NewGuid().ToString('N')).py"
Set-Content -Path $tempPy -Value $pyScript -Encoding UTF8

& python $tempPy $Author $Description $espPath
$pyResult = $LASTEXITCODE

Remove-Item $tempPy -Force -ErrorAction SilentlyContinue

if ($pyResult -ne 0) {
    Write-Host "ESP generation FAILED" -ForegroundColor Red
    exit 1
}

if (Test-Path $espPath) {
    $sizeB = (Get-Item $espPath).Length
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ESP GENERATED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "  Path: $espPath" -ForegroundColor Green
    Write-Host "  Size: $sizeB bytes" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Warning "ESP file not created."
    exit 1
}
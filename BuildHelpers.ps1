function Get-FileDigest([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','') }
    finally { $stream.Dispose(); $hash.Dispose() }
}

function Get-NativeSourceHash([string]$NativeDir) {
    $files = @()
    foreach ($folder in @('src', 'include')) {
        $files += Get-ChildItem -LiteralPath (Join-Path $NativeDir $folder) -Recurse -File | Where-Object { $_.Extension -in @('.cpp','.h') }
    }
    foreach ($name in @('CMakeLists.txt','vcpkg.json','x64-windows-static.cmake')) { $files += Get-Item -LiteralPath (Join-Path $NativeDir $name) }
    $lines = @($files | Sort-Object FullName | ForEach-Object {
        $_.FullName.Substring($NativeDir.Length).Replace('\','/') + ':' + (Get-FileDigest $_.FullName)
    })
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join "`n")))).Replace('-','') }
    finally { $hash.Dispose() }
}

function Assert-WorkspaceChild([string]$Path, [string]$Parent) {
    $resolved = [IO.Path]::GetFullPath($Path)
    $prefix = [IO.Path]::GetFullPath($Parent).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside build directory: $resolved" }
    return $resolved
}

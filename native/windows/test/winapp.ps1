function Get-WinAppPin {
    return [pscustomobject]@{
        version = '0.7.1'
        url = 'https://github.com/microsoft/winappCli/releases/download/v0.7.1/winappcli-x64.zip'
        archiveSha256 = 'd925d1e32cdc320b6d271f653fd2cd3c05b5d7558deb20d1b548bead77900fcf'
    }
}

function Get-WinAppStreamHash($Stream) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Assert-WinAppReceipt($Receipt) {
    $pin = Get-WinAppPin
    foreach ($field in @('directory', 'path', 'archivePath', 'version', 'archiveSha256', 'executableSha256')) {
        if ($Receipt.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($Receipt.$field)) {
            throw "Некорректное поле WinApp receipt: $field."
        }
    }
    $directory = [IO.Path]::GetFullPath($Receipt.directory)
    $archivePath = Join-Path $directory 'winapp.zip'
    if ($Receipt.version -cne $pin.version -or $Receipt.archiveSha256 -cne $pin.archiveSha256 -or
        ![IO.Path]::GetFullPath($Receipt.archivePath).Equals($archivePath, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'WinApp receipt не соответствует закреплённому архиву.'
    }
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.archiveSha256) {
        throw 'SHA256 winapp CLI не совпал.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        $entries = @($archive.Entries | Where-Object Name -ieq 'winapp.exe')
        if ($entries.Count -ne 1) { throw 'В архиве ожидался один winapp.exe.' }
        $toolDirectory = [IO.Path]::GetFullPath((Join-Path $directory 'tool'))
        $expectedPath = [IO.Path]::GetFullPath((Join-Path $toolDirectory $entries[0].FullName))
        if (!$expectedPath.StartsWith($toolDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
            ![IO.Path]::GetFullPath($Receipt.path).Equals($expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'WinApp executable не соответствует пути в закреплённом архиве.'
        }
        $entryStream = $entries[0].Open()
        try { $expectedHash = Get-WinAppStreamHash $entryStream }
        finally { $entryStream.Dispose() }
        $actualHash = (Get-FileHash -LiteralPath $expectedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Receipt.executableSha256 -cne $expectedHash -or $actualHash -cne $expectedHash) {
            throw 'WinApp executable отличается от закреплённого архива.'
        }
    } finally { $archive.Dispose() }
}

function Initialize-WinApp {
    param([Parameter(Mandatory)][string]$Directory)
    $directory = [IO.Path]::GetFullPath($Directory)
    # Каталог принадлежит одному запуску; повтор не перезаписывает чужой или частичный результат.
    if (Test-Path -LiteralPath $directory) { throw 'Каталог WinApp уже существует.' }
    New-Item -ItemType Directory -Path $directory | Out-Null
    $pin = Get-WinAppPin
    $archivePath = Join-Path $directory 'winapp.zip'
    Invoke-WebRequest $pin.url -OutFile $archivePath -TimeoutSec 60 | Out-Null
    $digest = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -cne $pin.archiveSha256) { throw 'SHA256 winapp CLI не совпал.' }
    $toolDirectory = Join-Path $directory 'tool'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolDirectory
    $executables = @(Get-ChildItem -LiteralPath $toolDirectory -Filter winapp.exe -Recurse -File)
    if ($executables.Count -ne 1) { throw 'Ожидался один winapp.exe.' }
    $receipt = [pscustomobject]@{
        directory = $directory; path = $executables[0].FullName; archivePath = $archivePath
        version = $pin.version; archiveSha256 = $digest
        executableSha256 = (Get-FileHash -LiteralPath $executables[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    Assert-WinAppReceipt $receipt
    return $receipt
}

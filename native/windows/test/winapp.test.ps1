$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. "$PSScriptRoot/winapp.ps1"

function Assert($Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Assert-Rejected([scriptblock]$Action, [string]$Pattern) {
    $failure = $null
    try { & $Action | Out-Null } catch { $failure = $_ }
    Assert ($null -ne $failure -and $failure.Exception.Message -match $Pattern) "Ожидался отказ: $Pattern."
}

$realPin = Get-WinAppPin
Assert ($realPin.version -ceq '0.7.1' -and $realPin.archiveSha256 -ceq 'd925d1e32cdc320b6d271f653fd2cd3c05b5d7558deb20d1b548bead77900fcf') 'Изменён квалифицированный WinApp pin.'
Assert ($realPin.url -ceq 'https://github.com/microsoft/winappCli/releases/download/v0.7.1/winappcli-x64.zip') 'Изменён источник WinApp.'
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('labui-winapp-fixture-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $inputDirectory = Join-Path $fixtureRoot 'input'
    New-Item -ItemType Directory -Path $inputDirectory | Out-Null
    # Это текстовые байты для проверки упаковки; fixture никогда не исполняется.
    [IO.File]::WriteAllText((Join-Path $inputDirectory 'winapp.exe'), 'harmless archive fixture')
    [IO.File]::WriteAllText((Join-Path $inputDirectory 'support.txt'), 'support fixture')
    $script:fixtureArchive = Join-Path $fixtureRoot 'fixture.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($inputDirectory, $script:fixtureArchive)
    $script:fixturePin = [pscustomobject]@{
        version = $realPin.version; url = $realPin.url
        archiveSha256 = (Get-FileHash -LiteralPath $script:fixtureArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $script:downloads = 0
    function Get-WinAppPin { return $script:fixturePin }
    function Invoke-WebRequest($Uri, $OutFile, $TimeoutSec) {
        Assert ($Uri -ceq $realPin.url -and $TimeoutSec -eq 60) 'Bootstrap потерял источник или конечный timeout.'
        $script:downloads++
        Copy-Item -LiteralPath $script:fixtureArchive -Destination $OutFile
    }

    $receipt = Initialize-WinApp -Directory (Join-Path $fixtureRoot 'prepared')
    Assert ($script:downloads -eq 1 -and $receipt.version -ceq $realPin.version) 'Bootstrap не создал один receipt.'
    Assert-WinAppReceipt $receipt
    Assert ($script:downloads -eq 1) 'Проверка готового receipt повторно скачала архив.'
    Assert-Rejected { Initialize-WinApp -Directory $receipt.directory } 'уже существует'
    Assert ($script:downloads -eq 1) 'Повтор перезаписал готовый каталог.'

    $changed = $receipt.PSObject.Copy()
    $changed.version = '0.0.0'
    Assert-Rejected { Assert-WinAppReceipt $changed } 'закреплённому архиву'
    $changed = $receipt.PSObject.Copy()
    $changed.path = Join-Path $fixtureRoot 'same-bytes.exe'
    Copy-Item -LiteralPath $receipt.path -Destination $changed.path
    Assert-Rejected { Assert-WinAppReceipt $changed } 'пути в закреплённом архиве'

    [IO.File]::WriteAllText($receipt.path, 'changed executable fixture')
    $changed = $receipt.PSObject.Copy()
    $changed.executableSha256 = (Get-FileHash -LiteralPath $changed.path -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Rejected { Assert-WinAppReceipt $changed } 'отличается от закреплённого архива'

    $goodHash = $script:fixturePin.archiveSha256
    $script:fixturePin.archiveSha256 = 'f' * 64
    $badDirectory = Join-Path $fixtureRoot 'bad-pin'
    Assert-Rejected { Initialize-WinApp -Directory $badDirectory } 'SHA256'
    Assert (!(Test-Path -LiteralPath (Join-Path $badDirectory 'tool'))) 'Непроверенный архив распакован.'
    $script:fixturePin.archiveSha256 = $goodHash

    $nested = Join-Path $inputDirectory 'nested'
    New-Item -ItemType Directory -Path $nested | Out-Null
    [IO.File]::WriteAllText((Join-Path $nested 'winapp.exe'), 'second harmless executable fixture')
    $script:fixtureArchive = Join-Path $fixtureRoot 'duplicate.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($inputDirectory, $script:fixtureArchive)
    $script:fixturePin.archiveSha256 = (Get-FileHash -LiteralPath $script:fixtureArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Rejected { Initialize-WinApp -Directory (Join-Path $fixtureRoot 'duplicate') } 'один winapp.exe'
    Write-Output 'PASS: fresh pinned bootstrap, prepared receipt, archive/executable identity and rejection controls; no network or executable launch.'
} finally {
    $cleanupPath = [IO.Path]::GetFullPath($fixtureRoot)
    $allowedPrefix = Join-Path ([IO.Path]::GetTempPath()) 'labui-winapp-fixture-'
    if (!$cleanupPath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected fixture cleanup path.' }
    Remove-Item -LiteralPath $cleanupPath -Recurse -Force
}

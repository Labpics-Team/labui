param(
    [Parameter(Mandatory)][string]$ApplicationDirectory,
    [Parameter(Mandatory)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'Ввод и захват окна разрешены этой проверке только на одноразовом GitHub hosted runner.'
}
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Каталог результата уже существует.' }
New-Item -ItemType Directory -Path $output | Out-Null
$app = Join-Path ([IO.Path]::GetFullPath($ApplicationDirectory)) 'Buttons.exe'
$commands = [Collections.Generic.List[object]]::new()
$process = $null
$saved = @{}
foreach ($name in @('WINAPP_UI_WORKFLOW_ID', 'WINAPP_CLI_TELEMETRY_OPTOUT', 'WINAPP_CLI_UPDATE_CHECK')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}

function Ui([string]$Name, [string[]]$Arguments) {
    $info = [Diagnostics.ProcessStartInfo]::new($script:cli)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in (@('ui') + $Arguments + @('-w', $script:window, '--json'))) {
        $info.ArgumentList.Add($argument)
    }
    $child = [Diagnostics.Process]::Start($info)
    $stdout = $child.StandardOutput.ReadToEndAsync()
    $stderr = $child.StandardError.ReadToEndAsync()
    try {
        if (!$child.WaitForExit(30000)) {
            $child.Kill($true)
            $child.WaitForExit()
            throw "Таймаут winapp: $Name"
        }
        $text = $stdout.GetAwaiter().GetResult()
        [IO.File]::WriteAllText((Join-Path $output "$Name.json"), $text)
        [IO.File]::WriteAllText((Join-Path $output "$Name.stderr.log"), $stderr.GetAwaiter().GetResult())
        $commands.Add(@{ name = $Name; arguments = $Arguments; exitCode = $child.ExitCode })
        if ($child.ExitCode -ne 0) { throw "winapp $Name завершился с кодом $($child.ExitCode)" }
        return $text | ConvertFrom-Json
    } finally { $child.Dispose() }
}

function Assert-Count([int]$Expected) {
    Ui "wait-count-$Expected" @('wait-for', 'LabActionResult', '--property', 'Name',
        '--value', "Действие выполнено: $Expected", '--timeout', '5000') | Out-Null
    $state = Ui "count-$Expected" @('get-property', 'LabActionResult', '--property', 'Name')
    if ($state.properties.Name -ne "Действие выполнено: $Expected") {
        throw "Click/keyboard не подтвердили ровно $Expected действий."
    }
}

function Read-Fill([string]$File) {
    $bitmap = [Drawing.Bitmap]::new($File)
    try {
        if ($bitmap.Width -lt 1 -or $bitmap.Height -lt 1) { throw 'Пустой снимок кнопки.' }
        $rgb = foreach ($channel in @('R', 'G', 'B')) {
            $values = for ($x = 0; $x -lt $bitmap.Width; $x++) {
                $pixel = $bitmap.GetPixel($x, [int][Math]::Floor($bitmap.Height / 2))
                $pixel.$channel
            }
            ($values | Sort-Object)[[int][Math]::Floor($values.Count / 2)]
        }
        return @{ width = $bitmap.Width; height = $bitmap.Height; medianRgb = @($rgb) }
    } finally { $bitmap.Dispose() }
}

try {
    $env:WINAPP_UI_WORKFLOW_ID = [guid]::NewGuid().ToString()
    $env:WINAPP_CLI_TELEMETRY_OPTOUT = '1'
    $env:WINAPP_CLI_UPDATE_CHECK = '0'
    $zip = Join-Path $output 'winapp.zip'
    Invoke-WebRequest 'https://github.com/microsoft/winappCli/releases/download/v0.7.1/winappcli-x64.zip' -OutFile $zip
    $digest = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -ne 'd925d1e32cdc320b6d271f653fd2cd3c05b5d7558deb20d1b548bead77900fcf') {
        throw 'SHA256 winapp CLI не совпал.'
    }
    Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $output 'tool')
    $executables = @(Get-ChildItem -LiteralPath (Join-Path $output 'tool') -Filter winapp.exe -Recurse -File)
    if ($executables.Count -ne 1) { throw 'Ожидался один winapp.exe.' }
    $script:cli = $executables[0].FullName
    $process = Start-Process -FilePath $app -WorkingDirectory $ApplicationDirectory -WindowStyle Hidden -PassThru
    $started = $process.StartTime
    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    do {
        $process.Refresh()
        if ($process.HasExited) { throw 'Приложение завершилось до появления окна.' }
        if ($process.MainWindowHandle -ne 0) { break }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($process.MainWindowHandle -eq 0) { throw 'Не найдено окно собственного процесса.' }
    $script:window = $process.MainWindowHandle.ToInt64().ToString()
    @{ pid = $process.Id; window = $window; source = (git -C $PSScriptRoot rev-parse HEAD);
       os = [Environment]::OSVersion.VersionString; appSha256 = (Get-FileHash -LiteralPath $app).Hash;
       uiSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'LabUI.WinUI.dll')).Hash;
       motionSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'LabMotion.WinUI.dll')).Hash;
       cliVersion = '0.7.1'; cliZipSha256 = $digest } |
        ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $output 'identity.json')

    Ui 'ready' @('wait-for', 'LabButtonMedium', '--timeout', '10000') | Out-Null
    Add-Type -AssemblyName System.Drawing
    $fills = @{}
    foreach ($theme in @('Light', 'Dark')) {
        Ui "theme-$theme" @('invoke', "LabTheme$theme") | Out-Null
        Ui "tree-$theme" @('inspect', '--depth', '8') | Out-Null
        foreach ($size in @('Small', 'Medium', 'Large')) {
            $capture = Join-Path $output "$theme-$size.png"
            $deadline = [DateTime]::UtcNow.AddSeconds(10)
            $attempt = 0
            do {
                Ui "$theme-$size-$attempt" @('screenshot', "LabButton$size", '--output', $capture) | Out-Null
                $paint = Read-Fill $capture
                if ($theme -eq 'Light') {
                    $fills[$size] = @{ light = $paint }
                    break
                }
                $fills[$size].dark = $paint
                $light = $fills[$size].light
                if ($light.width -ne $paint.width -or $light.height -ne $paint.height) {
                    throw "Смена темы изменила размер $size; снимки несопоставимы."
                }
                if (($light.medianRgb -join ',') -ne ($paint.medianRgb -join ',')) { break }
                # Повторяется наблюдение, не действие: UIA Invoke не завершает отложенный Redraw.
                $attempt++
            } while ([DateTime]::UtcNow -lt $deadline)
            $fills | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $output 'theme-pixels.json')
            if ($theme -eq 'Dark' -and ($fills[$size].light.medianRgb -join ',') -eq ($paint.medianRgb -join ',')) {
                throw "Смена темы не изменила окраску $size за ограниченное время."
            }
        }
        Ui "page-$theme" @('screenshot', '--output', (Join-Path $output "page-$theme.png")) | Out-Null
    }
    Ui 'click' @('click', 'LabButtonMedium') | Out-Null
    Assert-Count 1
    Ui 'keyboard' @('send-keys', 'space', '--target', 'LabButtonMedium', '--via', 'send-input') | Out-Null
    Assert-Count 2
    Ui 'focus' @('screenshot', '--output', (Join-Path $output 'focus.png')) | Out-Null
    $disabled = Ui 'disabled' @('get-property', 'LabButtonDisabled')
    if ($disabled.element.isEnabled -ne $false) { throw 'Disabled кнопка доступна для действия.' }
    Ui 'enable' @('invoke', 'LabToggleEnabled') | Out-Null
    Ui 'wait-enabled' @('wait-for', 'LabButtonDisabled', '--property', 'IsEnabled',
        '--value', 'True', '--timeout', '5000') | Out-Null
    $enabled = Ui 'enabled' @('get-property', 'LabButtonDisabled')
    if ($enabled.element.isEnabled -ne $true) { throw 'Кнопка не стала доступна.' }
    Ui 'enabled-click' @('click', 'LabButtonDisabled') | Out-Null
    Assert-Count 3
    @{ passed = $true; scope = 'native render capture, click, Space, disabled-to-enabled';
       visualReview = 'pending'; motionLifetime = 'not-qualified' } |
        ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $output 'result.json')
} catch {
    $_ | Out-String | Set-Content -Encoding utf8 (Join-Path $output 'failure.txt')
    throw
} finally {
    if ($process) {
        try {
            $process.Refresh()
            if (!$process.HasExited) {
                $process.CloseMainWindow() | Out-Null
                if (!$process.WaitForExit(5000)) {
                    $current = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
                    if ($current -and $current.Path -eq $app -and $current.StartTime -eq $started) {
                        Stop-Process -Id $current.Id -Force
                        $process.WaitForExit()
                    }
                }
            }
            @{ exited = $process.HasExited; exitCode = $process.ExitCode } |
                ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $output 'close.json')
        } finally { $process.Dispose() }
    }
    $commands | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output 'commands.json')
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}

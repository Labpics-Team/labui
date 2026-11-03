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
$clock = [Diagnostics.Stopwatch]::StartNew()
$process = $null
$saved = @{}
foreach ($name in @('WINAPP_UI_WORKFLOW_ID', 'WINAPP_CLI_TELEMETRY_OPTOUT', 'WINAPP_CLI_UPDATE_CHECK')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}

function Start-Tool([string]$Name, [string[]]$Arguments, [switch]$Recording) {
    $info = [Diagnostics.ProcessStartInfo]::new($script:cli)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $startedMs = $clock.Elapsed.TotalMilliseconds
    $child = [Diagnostics.Process]::Start($info)
    try {
        $stdout = $child.StandardOutput.ReadToEndAsync()
        $stderr = if ($Recording) { $null } else { $child.StandardError.ReadToEndAsync() }
        return @{ process = $child; stdout = $stdout; stderr = $stderr; prefix = ''; lineTask = $null;
            ended = $false; name = $Name; arguments = $Arguments; startedMs = $startedMs }
    } catch {
        try {
            if (!$child.HasExited) { $child.Kill($true); $null = $child.WaitForExit(5000) }
        } finally { $child.Dispose() }
        throw
    }
}

function Close-Tool($Tool) {
    if ($Tool.ended) { return }
    try {
        if (!$Tool.process.HasExited) {
            $Tool.process.Kill($true)
            if (!$Tool.process.WaitForExit(5000)) { throw "Не завершился собственный winapp: $($Tool.name)" }
        }
        if (!$Tool.stderr) {
            if ($Tool.lineTask) { $Tool.prefix += "$($Tool.lineTask.GetAwaiter().GetResult())`n" }
            $Tool.stderr = $Tool.process.StandardError.ReadToEndAsync()
        }
        [IO.File]::WriteAllText((Join-Path $output "$($Tool.name).stderr.log"),
            $Tool.prefix + $Tool.stderr.GetAwaiter().GetResult())
    } finally { $Tool.ended = $true; $Tool.process.Dispose() }
}

function Finish-Tool($Tool, [int]$Timeout = 30000) {
    try {
        $timedOut = !$Tool.process.WaitForExit($Timeout)
        if ($timedOut) {
            $Tool.process.Kill($true)
            if (!$Tool.process.WaitForExit(5000)) { throw "Не завершился собственный winapp: $($Tool.name)" }
        }
        $text = $Tool.stdout.GetAwaiter().GetResult()
        [IO.File]::WriteAllText((Join-Path $output "$($Tool.name).json"), $text)
        $commands.Add(@{ name = $Tool.name; arguments = $Tool.arguments; exitCode = $Tool.process.ExitCode;
            startedMs = $Tool.startedMs; completedMs = $clock.Elapsed.TotalMilliseconds; timedOut = $timedOut })
        if ($timedOut) { throw "Таймаут winapp: $($Tool.name)" }
        if ($Tool.process.ExitCode -ne 0) { throw "winapp $($Tool.name) завершился с кодом $($Tool.process.ExitCode)" }
        return $text | ConvertFrom-Json
    } finally { Close-Tool $Tool }
}

function Ui([string]$Name, [string[]]$Arguments) {
    $tool = Start-Tool $Name (@('ui') + $Arguments + @('-w', $script:window, '--json'))
    return Finish-Tool $tool
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

function Assert-Capture([string]$Name, $Record, $Window) {
    $directory = Join-Path $output "$Name.frames"
    $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
    $frames = @(Get-Content -LiteralPath (Join-Path $directory 'frames.ndjson') | ForEach-Object { $_ | ConvertFrom-Json })
    $video = Get-Item -LiteralPath (Join-Path $output "$Name.mp4")
    if ($Record.mode -ne 'wgc' -or $Record.frames -lt 10 -or $video.Length -le 16 -or
        $video.Length -ne $Record.fileSize -or $manifest.status -ne 'complete' -or
        $manifest.video.status -ne 'complete' -or $manifest.frames.truncated -or
        $frames.Count -lt 10 -or $frames.Count -ne $manifest.timing.sampleCount) {
        throw "Неполная WGC-запись $Name."
    }
    $images = [Collections.Generic.HashSet[string]]::new()
    $previous = $null
    foreach ($frame in $frames) {
        if (!$frame.PSObject.Properties['sampleIndex'] -or !$frame.PSObject.Properties['elapsedMs'] -or
            ![double]::IsFinite($frame.elapsedMs) -or $frame.elapsedMs -lt 0 -or
            $frame.sampleIndex -lt 0 -or $frame.sampleIndex -ne [Math]::Floor($frame.sampleIndex) -or
            ($previous -and ($frame.sampleIndex -le $previous.sampleIndex -or $frame.elapsedMs -lt $previous.elapsedMs))) {
            throw "Повреждён индекс кадров $Name."
        }
        if ($frame.file -notmatch '^frames[/\\][^/\\]+\.jpe?g$' -or $frame.file.Contains('..')) {
            throw "Кадр $Name не является относительным JPEG."
        }
        if ($images.Add($frame.file)) {
            $bitmap = [Drawing.Bitmap]::new((Join-Path $directory $frame.file))
            try {
                if ($bitmap.Width -le 0 -or $bitmap.Height -le 0) { throw "Пустой кадр $Name." }
            } finally { $bitmap.Dispose() }
        }
        $previous = $frame
    }
    # Часы harness стартуют до recorder: это консервативная верхняя граница конца ввода.
    if ($Window.firstFrameReceivedMs -le $Window.recordStartedMs -or
        ($Window.gestures.name -join ',') -ne 'hover,pressed,rapid-space,pointer-out' -or
        $Window.gestures[0].startedMs -lt $Window.firstFrameReceivedMs) {
        throw "Не подтверждён первый кадр до ввода $Name."
    }
    foreach ($gesture in $Window.gestures) {
        if (![double]::IsFinite($gesture.startedMs) -or ![double]::IsFinite($gesture.completedMs) -or
            $gesture.completedMs -le $gesture.startedMs -or
            $gesture.completedMs - $Window.recordStartedMs -ge $frames[-1].elapsedMs) {
            throw "Запись $Name не охватила полный ввод $($gesture.name)."
        }
    }
    return @{ mode = $Record.mode; samples = $frames.Count; images = $images.Count;
        visualReview = 'pending'; gestureTiming = "$Name-window.json" }
}

function Capture-Interaction([string]$Theme, [int]$Count) {
    $name = "interaction-$Theme"
    Ui "$name-theme" @('invoke', "LabTheme$Theme") | Out-Null
    Ui "$name-before" @('hover', 'LabActionResult', '--dwell-time', '800') | Out-Null
    Ui "$name-target" @('get-property', 'LabButtonMedium') | Out-Null
    $gestures = [Collections.Generic.List[object]]::new()
    $recording = $null
    # Бюджет включает запуск recorder и все команды; последний кадр проверяется отдельно.
    $inputBudgetMs = 60000
    $durationSec = [int]($inputBudgetMs / 1000) + 1
    try {
        $recording = Start-Tool "$name-record" @('ui', 'record', '-w', $window, '--frames',
            '--duration-sec', "$durationSec", '--fps', '30', '--max-edge', '1000',
            '--output', (Join-Path $output "$name.mp4"), '--json') -Recording
        $ready = $false
        $recording.lineTask = $recording.process.StandardError.ReadLineAsync()
        while ($clock.Elapsed.TotalMilliseconds - $recording.startedMs -lt 15000) {
            if ($recording.process.HasExited) { throw 'Запись завершилась до первого кадра.' }
            if (!$recording.lineTask.Wait(100)) { continue }
            $line = $recording.lineTask.GetAwaiter().GetResult()
            $recording.lineTask = $null
            if ($null -eq $line) { throw 'Поток записи закрыт до первого кадра.' }
            $recording.prefix += "$line`n"
            try { $event = $line | ConvertFrom-Json } catch { $event = $null }
            if ($event -and $event.PSObject.Properties['event'] -and $event.event -eq 'recording-started') {
                $ready = $true
                break
            }
            $recording.lineTask = $recording.process.StandardError.ReadLineAsync()
        }
        if (!$ready -or $clock.Elapsed.TotalMilliseconds - $recording.startedMs -ge 15000) {
            throw 'Нет подтверждения первого кадра за 15 секунд.'
        }
        $recording.stderr = $recording.process.StandardError.ReadToEndAsync()
        $captureWindow = @{ recordStartedMs = $recording.startedMs; firstFrameReceivedMs = $clock.Elapsed.TotalMilliseconds;
            clock = 'harness-stopwatch-ms'; gestures = $gestures }
        $steps = @(
            @{ name = 'hover'; arguments = @('hover', 'LabButtonMedium', '--dwell-time', '1000') },
            @{ name = 'pressed'; arguments = @('drag', 'LabButtonMedium', 'LabButtonMedium', '--hold-ms', '1000') },
            @{ name = 'rapid-space'; arguments = @('send-keys', 'space space space', '--target', 'LabButtonMedium', '--via', 'send-input') },
            @{ name = 'pointer-out'; arguments = @('hover', 'LabActionResult', '--dwell-time', '800') }
        )
        foreach ($step in $steps) {
            $startedMs = $clock.Elapsed.TotalMilliseconds
            Ui "$name-$($step.name)" $step.arguments | Out-Null
            $gestures.Add(@{ name = $step.name; arguments = $step.arguments;
                startedMs = $startedMs; completedMs = $clock.Elapsed.TotalMilliseconds })
            $captureWindow | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output "$name-window.json")
            if ($step.name -eq 'hover') {
                Ui "$name-hover-image" @('screenshot', 'LabButtonMedium', '--output', (Join-Path $output "$name-hover.png")) | Out-Null
            }
            if ($step.name -eq 'pressed') { Assert-Count ($Count + 1) }
            if ($step.name -eq 'rapid-space') { Assert-Count ($Count + 4) }
            if ($clock.Elapsed.TotalMilliseconds - $recording.startedMs -ge $inputBudgetMs) {
                throw "Ввод $name вышел за бюджет записи."
            }
        }
        $recordResult = Finish-Tool $recording -Timeout ($durationSec * 1000 + 30000)
        return Assert-Capture $name $recordResult $captureWindow
    } finally { if ($recording) { Close-Tool $recording } }
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
       consumerSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'Buttons.dll')).Hash;
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
    $captures = @{}
    $captures.Light = Capture-Interaction 'Light' 3
    $captures.Dark = Capture-Interaction 'Dark' 7
    @{ passed = $true; scope = 'native render capture, click, Space, disabled-to-enabled, hover/hold/rapid-input capture';
       captures = $captures; visualReview = 'pending'; motionLifetime = 'not-qualified';
       smoothness = 'not-qualified'; performance = 'not-qualified'; reducedMotion = 'not-qualified' } |
        ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output 'result.json')
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

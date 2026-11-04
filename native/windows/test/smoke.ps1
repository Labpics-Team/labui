param(
    [Parameter(Mandatory)][string]$ApplicationDirectory,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [Parameter(Mandatory)][string]$AnimationSettingsPath,
    [bool]$AnimationsEnabled = $true,
    [ValidateRange(1.0, 2.25)][Nullable[double]]$ExpectedTextScale = $null,
    [switch]$Lifetime,
    [object]$WinApp = $null
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'Ввод и захват окна разрешены этой проверке только на одноразовом GitHub hosted runner.'
}
if ($Lifetime -and !$AnimationsEnabled) { throw 'Lifetime требует normal-анимацию для наблюдения удаления внутри перехода.' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Каталог результата уже существует.' }
New-Item -ItemType Directory -Path $output | Out-Null
$app = Join-Path ([IO.Path]::GetFullPath($ApplicationDirectory)) 'Buttons.exe'
$commands = [Collections.Generic.List[object]]::new()
$clockOriginTicks = [Diagnostics.Stopwatch]::GetTimestamp().ToString([Globalization.CultureInfo]::InvariantCulture)
$clock = [Diagnostics.Stopwatch]::StartNew()
$clockOriginUpperTicks = [Diagnostics.Stopwatch]::GetTimestamp().ToString([Globalization.CultureInfo]::InvariantCulture)
$process = $null
$spaceChannel = $null
$smokeFailure = $null
$animationBefore = $null
$animationReadback = $null
$animationObservationPath = Join-Path $output 'animation-observation.json'
$lifetimeObservationPath = Join-Path $output 'lifetime-observation.json'
$layoutObservationPath = Join-Path $output 'layout-observation.json'
$close = @{}
$saved = @{}
foreach ($name in @('WINAPP_UI_WORKFLOW_ID', 'WINAPP_CLI_TELEMETRY_OPTOUT', 'WINAPP_CLI_UPDATE_CHECK',
    'LABUI_ANIMATION_OBSERVATION', 'LABUI_LIFETIME_OBSERVATION', 'LABUI_LAYOUT_OBSERVATION', 'LABUI_SPACE_OBSERVATION')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}

function Test-LayoutNumber($Value) {
    return ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) -and [double]::IsFinite($Value)
}

function Assert-LayoutBounds($Bounds) {
    foreach ($field in @('x', 'y', 'width', 'height')) {
        if (!(Test-LayoutNumber $Bounds.$field) -or ($field -in @('width', 'height') -and $Bounds.$field -le 0)) {
            throw "Начальная геометрия не содержит конечное допустимое значение $field."
        }
    }
}

function Assert-LayoutObservation($Observation, $Process, [Nullable[double]]$ExpectedTextScale = $null) {
    if ($null -eq $Observation -or
        ($Observation.schemaVersion -isnot [int] -and $Observation.schemaVersion -isnot [long]) -or $Observation.schemaVersion -ne 1 -or
        ($Observation.pid -isnot [int] -and $Observation.pid -isnot [long]) -or $Observation.pid -ne $Process.Id -or
        ($Observation.observedAtUnixMs -isnot [int] -and $Observation.observedAtUnixMs -isnot [long])) {
        throw 'Начальная геометрия не связана с форматом и запущенным процессом.'
    }
    $start = ([DateTimeOffset]$Process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
    if ($Observation.observedAtUnixMs -lt $start -or $Observation.observedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
        throw 'Время наблюдения начальной геометрии вне текущего запуска.'
    }
    foreach ($field in @('textScaleFactor', 'rasterizationScale')) {
        if (!(Test-LayoutNumber $Observation.$field) -or $Observation.$field -le 0) {
            throw "Не прочитан фактический масштаб $field."
        }
    }
    if ($null -ne $ExpectedTextScale -and $Observation.textScaleFactor -ne $ExpectedTextScale) {
        throw 'UISettings внутри приложения не подтвердил ожидаемый масштаб текста.'
    }
    if ($Observation.theme -cnotin @('Light', 'Dark')) { throw 'Не прочитана фактическая тема страницы.' }
    Assert-LayoutBounds $Observation.page
    $expected = @(
        @{ id = 'LabButtonSmall'; size = 'Small'; label = 'Button' },
        @{ id = 'LabButtonMedium'; size = 'Medium'; label = 'Button' },
        @{ id = 'LabButtonLarge'; size = 'Large'; label = 'Button' },
        @{ id = 'LabButtonSmallDescription'; size = 'Small'; label = 'Button'; description = 'Description' },
        @{ id = 'LabButtonDescription'; size = 'Medium'; label = 'Добавить'; description = 'файл' },
        @{ id = 'LabButtonTrailingIcon'; size = 'Medium'; label = 'Открыть' },
        @{ id = 'LabButtonDisabled'; size = 'Medium'; label = 'Недоступно' }
    )
    if ($Observation.buttons -isnot [array] -or $Observation.buttons.Count -ne $expected.Count) {
        throw 'Начальная геометрия не содержит ровно семь кнопок примера.'
    }
    foreach ($target in $expected) {
        $matches = @($Observation.buttons | Where-Object { $_.automationId -ceq $target.id })
        if ($matches.Count -ne 1) { throw "Нет единственной начальной кнопки $($target.id)." }
        $button = $matches[0]
        if ($button.size -cne $target.size -or $button.isEnabled -isnot [bool] -or
            $button.isEnabled -ne ($target.id -cne 'LabButtonDisabled')) {
            throw "Изменено начальное состояние кнопки $($target.id)."
        }
        Assert-LayoutBounds $button.bounds
        $parts = @{ PART_Label = $target.label }
        if ($target.ContainsKey('description')) { $parts.PART_Description = $target.description }
        if ($button.texts -isnot [array] -or $button.texts.Count -ne $parts.Count) {
            throw "Не прочитаны все видимые текстовые части $($target.id)."
        }
        foreach ($part in $parts.Keys) {
            $texts = @($button.texts | Where-Object { $_.part -ceq $part })
            if ($texts.Count -ne 1 -or $texts[0].text -cne $parts[$part]) {
                throw "Повреждена текстовая часть $($target.id).$part."
            }
            $text = $texts[0]
            Assert-LayoutBounds $text.bounds
            foreach ($field in @('desiredWidth', 'desiredHeight', 'fontSize')) {
                if (!(Test-LayoutNumber $text.$field) -or $text.$field -le 0) {
                    throw "Не прочитана положительная текстовая метрика $($target.id).$part.$field."
                }
            }
            if (!(Test-LayoutNumber $text.lineHeight) -or $text.lineHeight -lt 0) {
                throw "Не прочитана неотрицательная высота строки $($target.id).$part."
            }
            if ($text.lineStackingStrategy -cnotin @('MaxHeight', 'BlockLineHeight', 'BaselineToBaseline') -or
                $text.isTextScaleFactorEnabled -isnot [bool] -or !$text.isTextScaleFactorEnabled) {
                throw "Не подтверждена настройка масштабирования текстовой части $($target.id).$part."
            }
        }
    }
}

function Read-LayoutObservation([string]$Path, $Process, [Nullable[double]]$ExpectedTextScale = $null) {
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'Приложение завершилось до наблюдения начальной геометрии.' }
        if (Test-Path -LiteralPath $Path) {
            if ((Get-Item -LiteralPath $Path).Length -gt 64 * 1024) { throw 'Layout JSON превысил лимит.' }
            $value = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
            Assert-LayoutObservation $value $Process $ExpectedTextScale
            return $value
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Приложение не записало начальную геометрию за ограниченное время.'
}

function Read-AnimationObservation([string]$Path, $Process) {
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'Приложение завершилось до наблюдения настройки анимации.' }
        if (Test-Path -LiteralPath $Path) {
            return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Приложение не записало наблюдение настройки анимации.'
}

function Assert-AnimationObservation($Observation, $Process, [bool]$ExpectedAnimationsEnabled) {
    if ($null -eq $Observation -or !$Observation.PSObject.Properties['pid'] -or
        ($Observation.pid -isnot [int] -and $Observation.pid -isnot [long]) -or
        $Observation.pid -ne $Process.Id -or !$Observation.PSObject.Properties['observedAtUnixMs'] -or
        ($Observation.observedAtUnixMs -isnot [int] -and $Observation.observedAtUnixMs -isnot [long])) {
        throw 'Наблюдение настройки анимации не связано с запущенным процессом.'
    }
    $startedAtUnixMs = ([DateTimeOffset]$Process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
    if ($Observation.observedAtUnixMs -lt $startedAtUnixMs -or
        $Observation.observedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
        throw 'Время наблюдения настройки анимации вне текущего запуска.'
    }
    if (!$Observation.PSObject.Properties['animationsEnabled'] -or
        $Observation.animationsEnabled -isnot [bool] -or
        $Observation.animationsEnabled -ne $ExpectedAnimationsEnabled) {
        throw 'UISettings внутри приложения не подтвердил ожидаемый режим анимации.'
    }
}

function Test-LifetimeNumber($Value) {
    return ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) -and [double]::IsFinite($Value)
}

function Test-LifetimeInteger($Value) {
    return $Value -is [int] -or $Value -is [long]
}

function Assert-LifetimeObservation($Observation, $Process, [string]$ExpectedStatus) {
    if ($null -eq $Observation -or !(Test-LifetimeInteger $Observation.schemaVersion) -or $Observation.schemaVersion -ne 1 -or
        !(Test-LifetimeInteger $Observation.pid) -or $Observation.pid -ne $Process.Id -or
        !(Test-LifetimeInteger $Observation.observedAtUnixMs)) {
        throw 'Lifetime observation не связан с форматом и запущенным процессом.'
    }
    $start = ([DateTimeOffset]$Process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
    if ($Observation.observedAtUnixMs -lt $start -or
        $Observation.observedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
        !(Test-LifetimeNumber $Observation.elapsedMs) -or $Observation.elapsedMs -lt 0) {
        throw 'Lifetime observation вне времени текущего запуска.'
    }
    if ($Observation.status -cnotin @('ready', 'armed', 'removing', 'removed', 'restoring', 'restored', 'completing', 'passed') -or
        $null -ne $Observation.failure -or ($ExpectedStatus -and $Observation.status -cne $ExpectedStatus)) {
        throw "Lifetime probe не подтвердил ожидаемый статус $ExpectedStatus."
    }
    if ($Observation.events -isnot [array] -or $Observation.events.Count -gt 64 -or
        $Observation.observations -isnot [array] -or $Observation.observations.Count -gt 512) {
        throw 'Lifetime observation не содержит полные ограниченные массивы.'
    }
    foreach ($field in @('countBefore', 'countNow', 'restoredClicks', 'lateObservations')) {
        if (!(Test-LifetimeInteger $Observation.$field) -or $Observation.$field -lt 0) {
            throw "Lifetime counter $field не является целым неотрицательным значением."
        }
    }
    $previous = -1
    foreach ($event in $Observation.events) {
        if (!(Test-LifetimeNumber $event.elapsedMs) -or $event.elapsedMs -lt $previous -or
            $event.elapsedMs -gt $Observation.elapsedMs -or $event.elapsedMs -lt 0 -or
            !(Test-LifetimeInteger $event.unixMs) -or
            $event.unixMs -lt $start -or $event.unixMs -gt $Observation.observedAtUnixMs -or
            $event.kind -isnot [string] -or $null -eq $event.data) {
            throw 'Повреждена последовательность lifetime events.'
        }
        $previous = $event.elapsedMs
    }
    $previous = -1
    foreach ($sample in $Observation.observations) {
        if (!(Test-LifetimeNumber $sample.elapsedMs) -or $sample.elapsedMs -lt $previous -or
            $sample.elapsedMs -gt $Observation.elapsedMs -or $sample.elapsedMs -lt 0 -or
            $sample.generation -notin @('old', 'new') -or $sample.channel -notin @('hover', 'pressed') -or
            !(Test-LifetimeNumber $sample.motion.readbackPosition)) {
            throw 'Повреждён полный lifetime trace.'
        }
        $previous = $sample.elapsedMs
    }
}

function Assert-LifetimeCompletion($Observation, $Process, [int]$Count) {
    Assert-LifetimeObservation $Observation $Process 'passed'
    if (($Observation.events.kind -join ',') -cne 'armed,removing,unloaded,detached,restoring,loaded,restored,activated,completed' -or
        $Observation.countBefore -ne $Count -or $Observation.countNow -ne $Count + 1 -or
        $Observation.restoredClicks -ne 1 -or $Observation.lateObservations -ne 0) {
        throw 'Lifetime не сохранил полный сценарий и число активаций.'
    }
    $events = @{}
    foreach ($event in $Observation.events) { $events[$event.kind] = $event }
    foreach ($entry in @(
        @{ name = 'removing'; fields = @('isLoaded', 'isPressed') },
        @{ name = 'detached'; fields = @('containerAbsent', 'hoverRejected', 'pressedRejected') },
        @{ name = 'restored'; fields = @('isLoaded', 'freshHover', 'freshPressed', 'containerPresent', 'freshContainerReference') }
    )) {
        foreach ($field in $entry.fields) {
            $value = $events[$entry.name].data.$field
            if ($value -isnot [bool] -or !$value) { throw "Не подтверждён lifetime readback $($entry.name).$field." }
        }
    }
    if ($events.detached.data.isLoaded -isnot [bool] -or $events.detached.data.isLoaded -or
        $events.restored.data.containerIdentityScope -cne 'managed-reference' -or
        !(Test-LifetimeNumber $events.removing.data.pressed) -or
        $events.removing.data.pressed -le 0 -or $events.removing.data.pressed -ge 1) {
        throw 'Удаление не произошло внутри перехода либо потеряна область identity.'
    }
    foreach ($name in @('removing', 'detached', 'restoring', 'restored')) {
        if (!(Test-LifetimeInteger $events[$name].data.count) -or $events[$name].data.count -ne $Count) {
            throw "Lifetime stage $name изменил счётчик."
        }
    }
    $end = $events.completed.data
    if (!(Test-LifetimeInteger $events.activated.data.restoredClicks) -or $events.activated.data.restoredClicks -ne 1 -or
        !(Test-LifetimeInteger $events.activated.data.count) -or $events.activated.data.count -ne $Count + 1 -or
        !(Test-LifetimeInteger $end.countBefore) -or $end.countBefore -ne $Count -or
        !(Test-LifetimeInteger $end.countAfter) -or $end.countAfter -ne $Count + 1 -or
        !(Test-LifetimeInteger $end.lateObservations) -or $end.lateObservations -ne 0) {
        throw 'Повторное подключение не сохранило ровно одну активацию.'
    }
    foreach ($field in @('oldObservationWindowStartMs', 'oldObservationWindowEndMs', 'quietFromMs', 'quietUntilMs')) {
        if (!(Test-LifetimeNumber $end.$field)) { throw 'Нет численной границы lifetime observation.' }
    }
    foreach ($name in @('unloaded', 'loaded')) {
        $event = $events[$name]
        $earliest = if ($name -eq 'unloaded') { $events.removing.data.removeStartedMs } else { $events.restoring.elapsedMs }
        if (!(Test-LifetimeNumber $event.data.eventAtMs) -or $event.data.eventAtMs -gt $event.elapsedMs -or
            $event.data.eventAtMs -lt $earliest) {
            throw 'Время фактического Loaded/Unloaded не связано со сценарием.'
        }
    }
    $removing = $events.removing.data
    foreach ($field in @('positionReadAtMs', 'removeStartedMs', 'removeCompletedMs')) {
        if (!(Test-LifetimeNumber $removing.$field)) { throw 'Нет границ readback и удаления.' }
    }
    if ($removing.positionReadAtMs -lt $events.armed.elapsedMs -or $removing.positionReadAtMs -gt $removing.removeStartedMs -or
        $removing.removeStartedMs -gt $removing.removeCompletedMs -or $removing.removeCompletedMs -gt $events.removing.elapsedMs) {
        throw 'Readback и фактическое удаление не связаны последовательностью времени.'
    }
    if ($end.oldObservationWindowStartMs -ne $events.unloaded.data.eventAtMs -or
        $end.oldObservationWindowEndMs -lt $end.quietUntilMs -or $end.quietFromMs -lt $events.activated.elapsedMs -or
        $end.quietUntilMs - $end.quietFromMs -lt 120 -or $end.oldObservationWindowEndMs -gt $events.completed.elapsedMs) {
        throw 'Lifetime не содержит замкнутое окно наблюдения после удаления и новой активации.'
    }
    if (!(Test-LifetimeNumber $end.releasedPosition) -or !(Test-LifetimeNumber $end.releaseTolerance) -or
        $end.releaseTolerance -ne 0.001 -or [Math]::Abs($end.releasedPosition) -gt 0.001) {
        throw 'Конечный pressed readback не подтвердил отпускание с допуском закреплённого Motion.'
    }
    $old = @($Observation.observations | Where-Object { $_.generation -eq 'old' })
    $newPressed = @($Observation.observations | Where-Object { $_.generation -eq 'new' -and $_.channel -eq 'pressed' })
    $oldInterior = @($old | Where-Object { $_.channel -eq 'pressed' -and $_.motion.origin -eq 'Animation' -and
        $_.motion.phase -eq 'value' -and $_.motion.readbackPosition -gt 0 -and $_.motion.readbackPosition -lt 1 -and
        $_.elapsedMs -le $removing.positionReadAtMs })
    $newInterior = @($newPressed | Where-Object { $_.motion.origin -eq 'Animation' -and $_.motion.phase -eq 'value' -and
        $_.motion.readbackPosition -gt 0 -and $_.motion.readbackPosition -lt 1 -and $_.elapsedMs -ge $events.restored.elapsedMs })
    if ($oldInterior.Count -eq 0 -or $newInterior.Count -eq 0 -or $newPressed[-1].motion.phase -ne 'idle' -or
        [Math]::Abs($newPressed[-1].motion.readbackPosition) -gt 0.001 -or
        @($old | Where-Object { $_.elapsedMs -gt $end.oldObservationWindowStartMs }).Count -ne 0) {
        throw 'Raw trace не подтвердил движение, покой нового канала либо тишину старого.'
    }
}

function Read-LifetimeObservation([string]$Path, $Process, [string]$ExpectedStatus) {
    $deadline = [DateTime]::UtcNow.AddSeconds(16)
    do {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'Приложение завершилось до lifetime readback.' }
        if (Test-Path -LiteralPath $Path) {
            if ((Get-Item -LiteralPath $Path).Length -gt 256 * 1024) { throw 'Lifetime JSON превысил лимит.' }
            $value = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
            Assert-LifetimeObservation $value $Process ''
            if ($value.status -ceq $ExpectedStatus) { return $value }
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Lifetime не достиг $ExpectedStatus за ограниченное время."
}

function Invoke-Lifetime([string]$Path, $Process, [int]$Count) {
    Ui 'lifetime-arm' @('invoke', 'LabLifetimeArm') | Out-Null
    $null = Read-LifetimeObservation $Path $Process 'armed'
    Ui 'lifetime-remove' @('drag', 'LabButtonMedium', 'LabButtonMedium', '--hold-ms', '1000') | Out-Null
    $null = Read-LifetimeObservation $Path $Process 'removed'
    Assert-Count $Count
    # Возвращаем экземпляр только после завершения команды, отпустившей указатель.
    Ui 'lifetime-restore' @('invoke', 'LabLifetimeRestore') | Out-Null
    $null = Read-LifetimeObservation $Path $Process 'restored'
    Ui 'lifetime-activate' @('drag', 'LabButtonMedium', 'LabButtonMedium', '--hold-ms', '1000') | Out-Null
    Ui 'lifetime-complete' @('invoke', 'LabLifetimeComplete') | Out-Null
    $value = Read-LifetimeObservation $Path $Process 'passed'
    Assert-LifetimeCompletion $value $Process $Count
    Assert-Count ($Count + 1)
    return $value
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
    $cancellation = [Threading.CancellationTokenSource]::new()
    $stdoutReader = $null
    $stderrReader = $null
    try {
        $stdoutReader = $child.StandardOutput
        $stderrReader = $child.StandardError
        $stdout = $stdoutReader.ReadToEndAsync($cancellation.Token)
        $stderr = if ($Recording) { $null } else { $stderrReader.ReadToEndAsync($cancellation.Token) }
        return @{ process = $child; stdout = $stdout; stderr = $stderr; prefix = ''; lineTask = $null;
            stdoutReader = $stdoutReader; stderrReader = $stderrReader; cancellation = $cancellation;
            ended = $false; name = $Name; arguments = $Arguments; startedMs = $startedMs }
    } catch {
        try {
            $cancellation.Cancel()
            if (!$child.HasExited) { $child.Kill($true); $null = $child.WaitForExit(5000) }
        } finally {
            if ($stdoutReader) { $stdoutReader.Dispose() }
            if ($stderrReader) { $stderrReader.Dispose() }
            $child.Dispose(); $cancellation.Dispose()
        }
        throw
    }
}

function Wait-ToolRead($Task, [Diagnostics.Stopwatch]$Budget, [int]$Timeout, [string]$Name) {
    $remaining = [int][Math]::Max(0, $Timeout - $Budget.ElapsedMilliseconds)
    try { $completed = $Task.IsCompleted -or $Task.Wait($remaining) }
    catch {
        if (!$Task.IsCompleted) { throw }
        $completed = $true
    }
    if (!$completed -or $Task.IsCanceled) {
        throw "Вывод winapp превысил общий срок ожидания: $Name"
    }
    return $Task.GetAwaiter().GetResult()
}

function Close-Tool($Tool) {
    if ($Tool.ended) { return }
    $budget = [Diagnostics.Stopwatch]::StartNew()
    # Cleanup получает свой бюджет после запроса отмены, чтобы дождаться read-задач.
    $Tool.cancellation.Cancel()
    $failure = $null
    $errorText = ''
    try {
        if (!$Tool.process.HasExited) {
            $Tool.process.Kill($true)
            $remaining = [int][Math]::Max(0, 5000 - $budget.ElapsedMilliseconds)
            if (!$Tool.process.WaitForExit($remaining)) { throw "Не завершился собственный winapp: $($Tool.name)" }
        }
        if (!$Tool.stderr) {
            if ($Tool.lineTask) { $Tool.prefix += "$(Wait-ToolRead $Tool.lineTask $budget 5000 $Tool.name)`n" }
            $Tool.stderr = $Tool.stderrReader.ReadToEndAsync($Tool.cancellation.Token)
        }
        $errorText = Wait-ToolRead $Tool.stderr $budget 5000 $Tool.name
    } catch { $failure = $_ }
    finally {
        try {
            try {
                # Завершённые строки recorder сохраняются и при незавершённом хвосте.
                [IO.File]::WriteAllText((Join-Path $output "$($Tool.name).stderr.log"), $Tool.prefix + $errorText)
            } catch {
                if ($failure) { $failure.Exception.Data['stderrLogError'] = $_.Exception.ToString() }
                else { $failure = $_ }
            }
            $Tool.cancellation.Cancel()
            $reads = @(@($Tool.stdout, $Tool.stderr, $Tool.lineTask) | Where-Object { $null -ne $_ })
            $remaining = [int][Math]::Max(0, 5000 - $budget.ElapsedMilliseconds)
            if ($reads.Count) {
                try { $null = [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$reads, $remaining) } catch { }
                if (@($reads | Where-Object { !$_.IsCompleted }).Count) {
                    throw "Отменённое чтение winapp не завершилось: $($Tool.name)"
                }
            }
        } catch {
            if ($failure) { $failure.Exception.Data['readCleanupError'] = $_.Exception.ToString() }
            else { $failure = $_ }
        } finally {
            $Tool.ended = $true
            $Tool.stdoutReader.Dispose(); $Tool.stderrReader.Dispose(); $Tool.process.Dispose(); $Tool.cancellation.Dispose()
        }
    }
    if ($failure) { throw $failure }
}

function Finish-Tool($Tool, [int]$Timeout = 30000) {
    $budget = [Diagnostics.Stopwatch]::StartNew()
    $failure = $null
    $value = $null
    $Tool.cancellation.CancelAfter($Timeout)
    try {
        $remaining = [int][Math]::Max(0, $Timeout - $budget.ElapsedMilliseconds)
        $timedOut = !$Tool.process.WaitForExit($remaining)
        if ($timedOut) { throw "Таймаут winapp: $($Tool.name)" }
        $text = Wait-ToolRead $Tool.stdout $budget $Timeout $Tool.name
        [IO.File]::WriteAllText((Join-Path $output "$($Tool.name).json"), $text)
        $commands.Add(@{ name = $Tool.name; arguments = $Tool.arguments; exitCode = $Tool.process.ExitCode;
            startedMs = $Tool.startedMs; completedMs = $clock.Elapsed.TotalMilliseconds; timedOut = $timedOut })
        if ($Tool.process.ExitCode -ne 0) { throw "winapp $($Tool.name) завершился с кодом $($Tool.process.ExitCode)" }
        $value = $text | ConvertFrom-Json
    } catch { $failure = $_ }
    finally {
        try {
            # Доставка вывода относится к бюджету команды, включая stderr после exit.
            if (!$Tool.stderr) {
                if ($Tool.lineTask) {
                    $Tool.prefix += "$(Wait-ToolRead $Tool.lineTask $budget $Timeout $Tool.name)`n"
                    $Tool.lineTask = $null
                }
                $Tool.stderr = $Tool.stderrReader.ReadToEndAsync($Tool.cancellation.Token)
            }
            $null = Wait-ToolRead $Tool.stderr $budget $Timeout $Tool.name
        } catch {
            if ($failure) { $failure.Exception.Data['winappCleanupError'] = $_.Exception.ToString() }
            else { $failure = $_ }
        }
        try { Close-Tool $Tool }
        catch {
            if ($failure) {
                $key = if ($failure.Exception.Data.Contains('winappCleanupError')) { 'readCleanupError' } else { 'winappCleanupError' }
                $failure.Exception.Data[$key] = $_.Exception.ToString()
            }
            else { $failure = $_ }
        }
    }
    if ($failure) { throw $failure }
    return $value
}

function Ui([string]$Name, [string[]]$Arguments) {
    $tool = Start-Tool $Name (@('ui') + $Arguments + @('-w', $script:window, '--json'))
    return Finish-Tool $tool
}

function Invoke-SpaceCommand([string]$Command, [int]$Timeout = 5000) {
    if ($Command -cnotin @('arm Light', 'arm Dark', 'complete')) { throw 'Неверная команда Space.' }
    if ($Timeout -lt 1 -or $Timeout -gt 5000) { throw 'Неверный бюджет ответа Space.' }
    $spaceChannel.id++
    $process.StandardInput.WriteLine($Command)
    $process.StandardInput.Flush()
    if (!$spaceChannel.read.Wait($Timeout)) { throw 'Space не ответил в бюджете команды.' }
    $line = $spaceChannel.read.GetAwaiter().GetResult()
    if ($null -eq $line -or [Text.Encoding]::UTF8.GetByteCount($line) -gt 128 * 1024) { throw 'Нет полного ограниченного ответа Space.' }
    $spaceChannel.read = [LabUI.Buttons.SpaceProtocol]::ReadLineAsync($spaceChannel.stdoutReader, 128 * 1024, $spaceChannel.cancellation.Token)
    $reply = $line | ConvertFrom-Json
    if (($reply.id -isnot [int] -and $reply.id -isnot [long]) -or $reply.id -ne $spaceChannel.id -or
        $reply.ok -isnot [bool] -or !$reply.ok) { throw "Space отклонил $Command`: $line" }
    if (($reply.value.pid -isnot [int] -and $reply.value.pid -isnot [long]) -or $reply.value.pid -ne $process.Id) {
        throw 'Space ответил от другого процесса.'
    }
    return $reply.value
}

function Invoke-SpaceGesture([string]$Theme) {
    $timing = @{ armStartedMs = $clock.Elapsed.TotalMilliseconds }
    $armed = Invoke-SpaceCommand "arm $Theme"
    $timing.armCompletedMs = $clock.Elapsed.TotalMilliseconds
    if ($armed.status -cne 'armed' -or $armed.theme -cne $Theme -or
        $armed.automationId -cne 'LabButtonMedium' -or $armed.focused -isnot [bool] -or !$armed.focused) {
        throw 'Space не подтвердил подключение к нужной кнопке.'
    }
    $timing.inputStartedMs = $clock.Elapsed.TotalMilliseconds
    $injection = [SpaceInput]::Run($process.Id, [long]$window)
    $timing.inputCompletedMs = $clock.Elapsed.TotalMilliseconds
    $timing.completeStartedMs = $clock.Elapsed.TotalMilliseconds
    $deadline = $clock.Elapsed.TotalMilliseconds + 5000
    $observation = $null
    do {
        $remaining = [int][Math]::Max(0, $deadline - $clock.Elapsed.TotalMilliseconds)
        if ($remaining -eq 0) { break }
        $observation = Invoke-SpaceCommand 'complete' $remaining
        if ($observation.status -ceq 'complete') { break }
        if ($observation.status -cne 'waiting') { throw 'Неизвестное состояние Space.' }
        Start-Sleep -Milliseconds 50
    } while ($clock.Elapsed.TotalMilliseconds -lt $deadline)
    $timing.completeCompletedMs = $clock.Elapsed.TotalMilliseconds
    if ($null -eq $observation -or $observation.status -cne 'complete') { throw 'Space не достиг последнего idle за 5 секунд.' }
    return @{ observation = $observation; injection = $injection; window = $timing }
}

function Capture-LowerControls([string]$Theme) {
    $file = "page-lower-$Theme.png"
    $states = @{}
    $scrollable = $false
    $targets = @(
        @{ id = 'LabThemeLight'; label = 'Светлая тема' },
        @{ id = 'LabThemeDark'; label = 'Тёмная тема' },
        @{ id = 'LabToggleEnabled'; label = 'Включить кнопку' }
    )
    foreach ($stage in @('before', 'captured', 'restored')) {
        if ($scrollable -and $stage -ne 'before') {
            $destination = if ($stage -eq 'captured') { 'bottom' } else { 'top' }
            $expected = if ($stage -eq 'captured') { '100' } else { '0' }
            Ui "lower-$Theme-$destination" @('scroll', 'LabButtonViewport', '--to', $destination) | Out-Null
            Ui "lower-$Theme-$destination-ready" @('wait-for', 'LabButtonViewport',
                '--property', 'ScrollVerticalPercent', '--value', $expected, '--timeout', '5000') | Out-Null
        }
        $state = Ui "lower-$Theme-$stage-viewport" @('get-property', 'LabButtonViewport', '--property', 'ScrollVerticalPercent')
        $percent = $state.properties.ScrollVerticalPercent
        # CLI 0.7.1 отдаёт строки; UIA NoScroll (-1) исключает вызов scroll без overflow.
        if ($percent -isnot [string] -or ($stage -eq 'before' -and $percent -cnotin @('-1', '0'))) {
            throw "Не подтверждена исходная прокрутка нижней группы $Theme."
        }
        if ($stage -eq 'before') { $scrollable = $percent -ceq '0' }
        $expected = if (!$scrollable) { '-1' } elseif ($stage -eq 'captured') { '100' } else { '0' }
        if ($percent -cne $expected) { throw "Не подтверждена прокрутка нижней группы ${Theme}/${stage}: $percent вместо $expected." }
        $viewport = $state.element
        Assert-LayoutBounds $viewport
        $actions = foreach ($target in $targets) {
            if ($stage -eq 'captured') {
                Ui "lower-$Theme-visible-$($target.id)" @('wait-for', $target.id, '--property', 'IsOffscreen',
                    '--value', 'False', '--timeout', '5000') | Out-Null
            }
            $action = (Ui "lower-$Theme-$stage-$($target.id)" @('get-property', $target.id)).element
            if ($action.automationId -cne $target.id -or $action.name -cne $target.label -or $action.isOffscreen -isnot [bool]) {
                throw "Не подтверждены исходная подпись и состояние $($target.id)."
            }
            if ($stage -eq 'captured') {
                Assert-LayoutBounds $action
                if ($action.isOffscreen -or $action.x -lt $viewport.x -or $action.y -lt $viewport.y -or
                    $action.x + $action.width -gt $viewport.x + $viewport.width -or
                    $action.y + $action.height -gt $viewport.y + $viewport.height) {
                    throw "Нижняя кнопка $($target.id) не помещается в viewport."
                }
            }
            $action | Select-Object automationId, name, isOffscreen, x, y, width, height
        }
        $states[$stage] = @{
            viewport = @{ scrollVerticalPercent = $percent; x = $viewport.x; y = $viewport.y;
                width = $viewport.width; height = $viewport.height }
            actions = @($actions)
        }
        if ($stage -eq 'captured') {
            Ui "page-lower-$Theme" @('screenshot', '--output', (Join-Path $output $file)) | Out-Null
        }
    }
    return @{ file = $file; before = $states.before; captured = $states.captured; restored = $states.restored }
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
        ($Window.gestures.name -join ',') -ne 'hover,pressed,rapid-space,cancel-drag,pointer-out' -or
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
    $recordingFailure = $null
    # Бюджет включает запуск recorder и все команды; последний кадр проверяется отдельно.
    $inputBudgetMs = 60000
    $durationSec = [int]($inputBudgetMs / 1000) + 1
    try {
        $recording = Start-Tool "$name-record" @('ui', 'record', '-w', $window, '--frames',
            '--duration-sec', "$durationSec", '--fps', '30', '--max-edge', '1000',
            '--output', (Join-Path $output "$name.mp4"), '--json') -Recording
        $ready = $false
        $recording.lineTask = $recording.stderrReader.ReadLineAsync($recording.cancellation.Token).AsTask()
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
            $recording.lineTask = $recording.stderrReader.ReadLineAsync($recording.cancellation.Token).AsTask()
        }
        if (!$ready -or $clock.Elapsed.TotalMilliseconds - $recording.startedMs -ge 15000) {
            throw 'Нет подтверждения первого кадра за 15 секунд.'
        }
        $recording.stderr = $recording.stderrReader.ReadToEndAsync($recording.cancellation.Token)
        $captureWindow = @{ recordStartedMs = $recording.startedMs; firstFrameReceivedMs = $clock.Elapsed.TotalMilliseconds;
            clock = 'harness-stopwatch-ms'; clockOriginTicks = $clockOriginTicks; clockOriginUpperTicks = $clockOriginUpperTicks;
            clockFrequency = [Diagnostics.Stopwatch]::Frequency; gestures = $gestures }
        $space = $null
        $steps = @(
            @{ name = 'hover'; arguments = @('hover', 'LabButtonMedium', '--dwell-time', '1000') },
            @{ name = 'pressed'; arguments = @('drag', 'LabButtonMedium', 'LabButtonMedium', '--hold-ms', '1000') },
            @{ name = 'rapid-space'; arguments = @('space-down-up-down-up', 'LabButtonMedium') },
            @{ name = 'cancel-drag'; arguments = @('drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', '50') },
            @{ name = 'pointer-out'; arguments = @('hover', 'LabActionResult', '--dwell-time', '800') }
        )
        foreach ($step in $steps) {
            $startedMs = $clock.Elapsed.TotalMilliseconds
            if ($step.name -eq 'rapid-space') { $space = Invoke-SpaceGesture $Theme }
            else { Ui "$name-$($step.name)" $step.arguments | Out-Null }
            $gestures.Add(@{ name = $step.name; arguments = $step.arguments;
                startedMs = $startedMs; completedMs = $clock.Elapsed.TotalMilliseconds })
            $captureWindow | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output "$name-window.json")
            if ($step.name -eq 'hover') {
                Ui "$name-hover-image" @('screenshot', 'LabButtonMedium', '--output', (Join-Path $output "$name-hover.png")) | Out-Null
            }
            if ($step.name -eq 'pressed') { Assert-Count ($Count + 1) }
            if ($step.name -in @('rapid-space', 'cancel-drag', 'pointer-out')) { Assert-Count ($Count + 3) }
            if ($clock.Elapsed.TotalMilliseconds - $recording.startedMs -ge $inputBudgetMs) {
                throw "Ввод $name вышел за бюджет записи."
            }
        }
        $recordResult = Finish-Tool $recording -Timeout ($durationSec * 1000 + 30000)
        $capture = Assert-Capture $name $recordResult $captureWindow
        $capture.space = $space
        return $capture
    } catch { $recordingFailure = $_; throw }
    finally {
        if ($recording) {
            try { Close-Tool $recording }
            catch {
                if ($recordingFailure) { $recordingFailure.Exception.Data['winappCleanupError'] = $_.Exception.ToString() }
                else { throw }
            }
        }
    }
}

try {
    $env:WINAPP_UI_WORKFLOW_ID = [guid]::NewGuid().ToString()
    $env:WINAPP_CLI_TELEMETRY_OPTOUT = '1'
    $env:WINAPP_CLI_UPDATE_CHECK = '0'
    . "$PSScriptRoot/winapp.ps1"
    if ($null -eq $WinApp) { $WinApp = Initialize-WinApp -Directory (Join-Path $output 'winapp') }
    else { Assert-WinAppReceipt $WinApp }
    $digest = $WinApp.archiveSha256
    $script:cli = $WinApp.path
    Add-Type -Path $AnimationSettingsPath
    Add-Type -Path "$PSScriptRoot/space-input.cs"
    Add-Type -Path "$PSScriptRoot/../../../examples/windows/SpaceProtocol.cs"
    $env:LABUI_LAYOUT_OBSERVATION = $layoutObservationPath
    $animationBefore = [ClientAreaAnimation]::Read()
    [ClientAreaAnimation]::Write($AnimationsEnabled)
    $animationReadback = [ClientAreaAnimation]::Read()
    if ($animationReadback -ne $AnimationsEnabled) { throw 'Настройка анимации hosted runner не подтвердилась.' }
    $env:LABUI_ANIMATION_OBSERVATION = $animationObservationPath
    $env:LABUI_LIFETIME_OBSERVATION = if ($Lifetime) { $lifetimeObservationPath } else { $null }
    $env:LABUI_SPACE_OBSERVATION = '1'
    $appStart = [Diagnostics.ProcessStartInfo]::new($app)
    $appStart.WorkingDirectory = $ApplicationDirectory
    $appStart.UseShellExecute = $false
    $appStart.CreateNoWindow = $true
    $appStart.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $appStart.RedirectStandardInput = $true
    $appStart.RedirectStandardOutput = $true
    $appStart.RedirectStandardError = $true
    $appStart.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $appStart.StandardOutputEncoding = [Text.UTF8Encoding]::new($false, $true)
    $appStart.StandardErrorEncoding = [Text.UTF8Encoding]::new($false, $true)
    $process = [Diagnostics.Process]::Start($appStart)
    $spaceChannel = @{ id = 0; stdoutReader = $null; stderrReader = $null; read = $null; errorRead = $null;
        cancellation = [Threading.CancellationTokenSource]::new() }
    $spaceChannel.stdoutReader = $process.StandardOutput
    $spaceChannel.stderrReader = $process.StandardError
    $spaceChannel.read = [LabUI.Buttons.SpaceProtocol]::ReadLineAsync($spaceChannel.stdoutReader, 128 * 1024, $spaceChannel.cancellation.Token)
    $spaceChannel.errorRead = [LabUI.Buttons.SpaceProtocol]::ReadErrorAsync($spaceChannel.stderrReader, $spaceChannel.cancellation.Token)
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
    $initialLayout = Read-LayoutObservation $layoutObservationPath $process $ExpectedTextScale
    $animationObservation = Read-AnimationObservation $animationObservationPath $process
    @{ pid = $process.Id; startedAtUnixMs = ([DateTimeOffset]$started.ToUniversalTime()).ToUnixTimeMilliseconds();
       window = $window; source = (git -C $PSScriptRoot rev-parse HEAD);
       os = [Environment]::OSVersion.VersionString; appSha256 = (Get-FileHash -LiteralPath $app).Hash;
       consumerSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'Buttons.dll')).Hash;
       uiSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'LabUI.WinUI.dll')).Hash;
       motionSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'LabMotion.WinUI.dll')).Hash;
       cliVersion = $WinApp.version; cliZipSha256 = $digest;
       animation = @{ expected = $AnimationsEnabled; clientAreaBefore = $animationBefore; clientAreaReadback = $animationReadback;
           helperSha256 = (Get-FileHash -LiteralPath $AnimationSettingsPath).Hash;
           process = $animationObservation } } |
        ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $output 'identity.json')
    Assert-AnimationObservation $animationObservation $process $AnimationsEnabled

    Ui 'ready' @('wait-for', 'LabButtonMedium', '--timeout', '10000') | Out-Null
    Add-Type -AssemblyName System.Drawing
    $fills = @{}
    $lowerControls = @{}
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
        $lowerControls[$theme] = Capture-LowerControls $theme
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
    $captures.Dark = Capture-Interaction 'Dark' 6
    $result = @{ passed = $true; scope = 'native render capture, click, Space, disabled-to-enabled, hover/hold/rapid-input/cancelled-press capture';
       gesturePattern = 'cancel-drag'; spacePattern = 'interrupted'; retarget = 'not-qualified';
       captures = $captures; lowerControls = $lowerControls; initialLayout = $initialLayout;
       visualReview = 'pending'; motionLifetime = 'not-qualified';
       smoothness = 'not-qualified'; performance = 'not-qualified'; reducedMotion = 'not-qualified' }
    if ($Lifetime) {
        $result.lifetime = Invoke-Lifetime $lifetimeObservationPath $process 9
        $result.motionLifetime = 'bounded-disposal-reuse'
    }
    $resultJson = $result | ConvertTo-Json -Depth 12
    if ([Text.Encoding]::UTF8.GetByteCount($resultJson + [Environment]::NewLine) -gt 256 * 1024) { throw 'Полный result.json превысил лимит evidence.' }
    $resultJson | Set-Content -Encoding utf8 (Join-Path $output 'result.json')
    & node "$PSScriptRoot/space-observation.mjs" (Join-Path $output 'result.json') (Join-Path $output 'identity.json')
    if ($LASTEXITCODE -ne 0) { throw 'Space trace не прошёл полную проверку.' }
} catch {
    $smokeFailure = $_
    $_ | Out-String | Set-Content -Encoding utf8 (Join-Path $output 'failure.txt')
    throw
} finally {
    try {
        if ($process) {
            $cleanupBudget = [Diagnostics.Stopwatch]::StartNew()
            $cleanupErrors = [Collections.Generic.List[Exception]]::new()
            if ($spaceChannel) {
                try { $spaceChannel.cancellation.Cancel() } catch { $cleanupErrors.Add($_.Exception) }
            }
            try {
                $process.Refresh()
                if ($spaceChannel) { $process.StandardInput.Close() }
                if (!$process.HasExited) {
                    $process.CloseMainWindow() | Out-Null
                    $remaining = [int][Math]::Max(0, [Math]::Min(5000, 10000 - $cleanupBudget.ElapsedMilliseconds))
                    if (!$process.WaitForExit($remaining)) {
                        $current = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
                        if ($current -and $current.Path -eq $app -and $current.StartTime -eq $started) {
                            Stop-Process -Id $current.Id -Force
                            $remaining = [int][Math]::Max(0, [Math]::Min(5000, 10000 - $cleanupBudget.ElapsedMilliseconds))
                            if (!$process.WaitForExit($remaining)) { throw 'Собственное приложение не завершилось после принудительного закрытия.' }
                        }
                    }
                }
                $close.exited = $process.HasExited
                $close.exitCode = $process.ExitCode
            } catch { $cleanupErrors.Add($_.Exception) }
            finally {
                if ($spaceChannel) {
                    try {
                        $reads = @(@($spaceChannel.read, $spaceChannel.errorRead) | Where-Object { $null -ne $_ })
                        $remaining = [int][Math]::Max(0, 10000 - $cleanupBudget.ElapsedMilliseconds)
                        if ($reads.Count) {
                            try { $null = [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$reads, $remaining) } catch { }
                            if (@($reads | Where-Object { !$_.IsCompleted }).Count) { throw 'Отменённые потоки Space не завершились в общем бюджете.' }
                        }
                        $close.spaceChannel = 'closed'
                    } catch { $cleanupErrors.Add($_.Exception) }
                    foreach ($name in @('read', 'errorRead')) {
                        $task = $spaceChannel[$name]
                        if ($null -ne $task -and $task.IsCompleted -and !$task.IsCanceled) {
                            try {
                                $result = $task.GetAwaiter().GetResult()
                                if ($name -eq 'read' -and $null -ne $result) { throw 'Space отправил лишний ответ.' }
                                if ($name -eq 'errorRead') { $close.stderr = $result }
                            } catch { $cleanupErrors.Add($_.Exception) }
                        }
                    }
                    # Ошибка одного Dispose не отнимает владение оставшимися ресурсами.
                    foreach ($resource in @($spaceChannel.stdoutReader, $spaceChannel.stderrReader, $spaceChannel.cancellation)) {
                        if ($null -ne $resource) {
                            try { $resource.Dispose() } catch { $cleanupErrors.Add($_.Exception) }
                        }
                    }
                }
                try { $process.Dispose() } catch { $cleanupErrors.Add($_.Exception) }
            }
            if ($cleanupErrors.Count) { throw [AggregateException]::new('Ошибка очистки собственного приложения.', $cleanupErrors) }
        }
        $commands | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output 'commands.json')
    } catch {
        if ($smokeFailure) {
            $close.applicationCleanupError = $_.Exception.ToString()
            $smokeFailure.Exception.Data['applicationCleanupError'] = $close.applicationCleanupError
        } else { throw }
    } finally {
        try {
            foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
        } finally {
            try {
                if ($null -ne $animationBefore) {
                    [ClientAreaAnimation]::Write($animationBefore)
                    $restored = [ClientAreaAnimation]::Read()
                    $close.animation = @{ expected = $animationBefore; actual = $restored }
                    if ($restored -ne $animationBefore) { throw 'Исходная настройка анимации не восстановлена.' }
                }
            } finally {
                $close | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $output 'close.json')
            }
        }
    }
}

param(
    [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or
    $env:RUNNER_OS -ne 'Windows') {
    throw 'Settings разрешены этой проверке только на одноразовом GitHub-hosted Windows runner.'
}

function Invoke-TextScaleChild([string]$Executable, [string[]]$Arguments, [int]$TimeoutMs = 15000) {
    $info = [Diagnostics.ProcessStartInfo]::new($Executable)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $info.Environment['WINAPP_CLI_TELEMETRY_OPTOUT'] = '1'
    $info.Environment['WINAPP_CLI_UPDATE_CHECK'] = '0'
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $budget = [Diagnostics.Stopwatch]::StartNew()
    $cancellation = [Threading.CancellationTokenSource]::new()
    $child = $null
    $stdoutReader = $null
    $stderrReader = $null
    $stdout = $null
    $stderr = $null
    try {
        $child = [Diagnostics.Process]::Start($info)
        $cancellation.CancelAfter([int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds))
        $stdoutReader = $child.StandardOutput
        $stderrReader = $child.StandardError
        $stdout = $stdoutReader.ReadToEndAsync($cancellation.Token)
        $stderr = $stderrReader.ReadToEndAsync($cancellation.Token)
        $remaining = [int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds)
        if (!$child.WaitForExit($remaining)) { throw 'Дочерний процесс превысил срок наблюдения.' }
        $remaining = [int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds)
        if (![Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdout, $stderr), $remaining)) {
            throw 'Вывод дочернего процесса превысил общий срок наблюдения.'
        }
        $text = $stdout.GetAwaiter().GetResult()
        $errorText = $stderr.GetAwaiter().GetResult()
        if ($text.Length -gt 262144 -or $errorText.Length -gt 16384) { throw 'Ответ превысил лимит наблюдения.' }
        if ($child.ExitCode -ne 0) {
            $code = 'child_failed'
            try {
                $envelope = $errorText | ConvertFrom-Json
                if ($envelope.error.code -match '^[a-z_]{1,64}$') { $code = $envelope.error.code }
            } catch { }
            throw "Дочерний процесс: $code, exit=$($child.ExitCode)."
        }
        if ($errorText.Trim()) { throw 'Успешный дочерний процесс записал неожиданный stderr.' }
        return $text
    } finally {
        try {
            $cancellation.Cancel()
            if ($child -and !$child.HasExited) {
                $child.Kill()
                if (!$child.WaitForExit(5000)) { throw 'Собственный дочерний процесс не завершился.' }
            }
            $reads = @(@($stdout, $stderr) | Where-Object { $null -ne $_ })
            if ($reads.Count) {
                try { $null = [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$reads, 5000) } catch { }
                if (@($reads | Where-Object { !$_.IsCompleted }).Count) {
                    throw 'Отменённые чтения дочернего процесса не завершились.'
                }
            }
        } finally {
            if ($stdoutReader) { $stdoutReader.Dispose() }
            if ($stderrReader) { $stderrReader.Dispose() }
            if ($child) { $child.Dispose() }
            $cancellation.Dispose()
        }
    }
}

function Get-SettingsSnapshot {
    $items = [Collections.Generic.List[object]]::new()
    foreach ($process in [Diagnostics.Process]::GetProcessesByName('SystemSettings')) {
        try {
            if ($process.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId) {
                $items.Add(@{ pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks;
                    path = $process.Path; sessionId = $process.SessionId })
            }
        } finally { $process.Dispose() }
    }
    return $items.ToArray()
}

function Get-OwnedSettings($Owned) {
    $process = Get-Process -Id $Owned.pid -ErrorAction Stop
    if ($process.StartTime.ToUniversalTime().Ticks -ne $Owned.startTicks -or
        $process.Path -ine $Owned.path -or $process.SessionId -ne $Owned.sessionId) {
        $process.Dispose()
        throw 'Изменилось поколение процесса Settings; чтение и закрытие запрещены.'
    }
    return $process
}

function Assert-SettingsWindow($Owned) {
    $process = Get-OwnedSettings $Owned
    try {
        if ($process.MainWindowHandle.ToInt64() -ne $Owned.hwnd) {
            throw 'Settings HWND больше не совпадает с выбранным окном.'
        }
    } finally { $process.Dispose() }
}

function Close-SettingsWindow($Owned) {
    if ($null -eq $Owned -or !$Owned.hwnd) { return 'no-owned-window' }
    $process = Get-OwnedSettings $Owned
    try {
        if ($process.MainWindowHandle.ToInt64() -ne $Owned.hwnd) {
            throw 'Settings HWND изменился до закрытия; чужое окно не закрывается.'
        }
        if (!$process.CloseMainWindow()) { throw 'Settings отклонил закрытие собственного окна.' }
        if (!$process.WaitForExit(5000)) {
            $process.Refresh()
            if ($process.MainWindowHandle.ToInt64() -ne 0) { throw 'Окно Settings не закрылось в срок.' }
        }
        return 'closed'
    } finally { $process.Dispose() }
}

function Get-TextScaleElements($Tree, [long]$Handle) {
    if (@($Tree.windows).Count -ne 1 -or $Tree.windows[0].hwnd -ne $Handle) {
        throw 'Inspect вышел за выбранный HWND.'
    }
    $pending = [Collections.Generic.Queue[object]]::new()
    foreach ($item in $Tree.windows[0].elements) { $pending.Enqueue($item) }
    $inventory = [Collections.Generic.List[object]]::new()
    $count = 0
    while ($pending.Count) {
        $item = $pending.Dequeue()
        if (++$count -gt 512) { throw 'Settings tree превысил 512 элементов.' }
        $name = if ($item.PSObject.Properties['name']) { [string]$item.name } else { '' }
        if ($item.type -eq 'Slider' -or $name -match '^(Text size|Make text bigger|Apply)$') {
            if ($inventory.Count -ge 32) { throw 'Text size inventory превысил 32 элемента.' }
            foreach ($field in @('selector', 'type')) {
                if ($item.$field -isnot [string] -or $item.$field.Length -gt 256) {
                    throw 'Повреждено поле элемента Settings.'
                }
            }
            $automationId = if ($item.PSObject.Properties['automationId']) { [string]$item.automationId } else { '' }
            if ($automationId.Length -gt 256 -or $name.Length -gt 256) { throw 'Label/AutomationId превысил лимит.' }
            $inventory.Add(@{ selector = $item.selector; name = $name; type = $item.type;
                automationId = $automationId; isEnabled = $item.isEnabled; isOffscreen = $item.isOffscreen })
        }
        if ($item.PSObject.Properties['children']) {
            foreach ($child in $item.children) { $pending.Enqueue($child) }
        }
    }
    return $inventory.ToArray()
}

function Read-SettingsRanges($Owned) {
    # CLI 0.7.1 не публикует RangeValue getters. Этот reader удаляется при появлении
    # квалифицированного CLI getter; он не получает setters или другие UI-команды.
    $reader = @'
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$process = Get-Process -Id $settingsPid -ErrorAction Stop
try {
    if ($process.StartTime.ToUniversalTime().Ticks -ne $startTicks -or
        $process.MainWindowHandle.ToInt64() -ne $handle) { throw 'Settings identity changed.' }
    $root = [Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
    if ($root.Current.ProcessId -ne $settingsPid) { throw 'UIA root belongs to another PID.' }
    $condition = [Windows.Automation.PropertyCondition]::new(
        [Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::Slider)
    $elements = $root.FindAll([Windows.Automation.TreeScope]::Descendants, $condition)
    if ($elements.Count -gt 8) { throw 'More than eight Settings sliders.' }
    $ranges = @()
    foreach ($element in $elements) {
        if ($element.Current.ProcessId -ne $settingsPid) { throw 'Slider belongs to another PID.' }
        $pattern = $null
        $supported = $element.TryGetCurrentPattern([Windows.Automation.RangeValuePattern]::Pattern, [ref]$pattern)
        $entry = @{ name = $element.Current.Name; automationId = $element.Current.AutomationId;
            type = 'Slider'; supported = $supported; minimum = $null; maximum = $null;
            value = $null; isReadOnly = $null }
        if ($entry.name.Length -gt 256 -or $entry.automationId.Length -gt 256) { throw 'Slider label exceeds limit.' }
        if ($supported) {
            $current = ([Windows.Automation.RangeValuePattern]$pattern).Current
            $entry.minimum = $current.Minimum
            $entry.maximum = $current.Maximum
            $entry.value = $current.Value
            $entry.isReadOnly = $current.IsReadOnly
        }
        $ranges += $entry
    }
    @{ ranges = $ranges } | ConvertTo-Json -Depth 5 -Compress
} finally { $process.Dispose() }
'@
    Assert-SettingsWindow $Owned
    $prefix = "`$settingsPid = $([int]$Owned.pid); `$startTicks = $([long]$Owned.startTicks); `$handle = $([long]$Owned.hwnd)`n"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($prefix + $reader))
    $frameworkShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $text = Invoke-TextScaleChild $frameworkShell @('-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', $encoded)
    Assert-SettingsWindow $Owned
    return ($text | ConvertFrom-Json).ranges
}

function Set-TextScaleCapability($Result, $Ranges) {
    $markers = @($Result.elements | Where-Object {
        $_.type -in @('Text', 'Group', 'Pane') -and $_.name -match '^(Text size|Make text bigger)$' -and !$_.isOffscreen
    })
    $sliders = @($Result.elements | Where-Object { $_.type -eq 'Slider' -and !$_.isOffscreen })
    $apply = @($Result.elements | Where-Object { $_.type -eq 'Button' -and $_.name -eq 'Apply' -and !$_.isOffscreen })
    if (!$markers.Count) { $Result.reason = 'text-size-page-marker-not-observed'; return }
    if ($sliders.Count -ne 1) { $Result.reason = 'text-size-slider-not-unique'; return }
    if ($sliders[0].name -notmatch '(?i)\b(text size|make text bigger)\b') {
        $Result.reason = 'text-size-slider-label-not-observed'; return
    }
    if (@($Ranges).Count -ne 1) { $Result.reason = 'range-reader-slider-not-unique'; return }
    $matches = @($Ranges | Where-Object {
        $_.automationId -ceq $sliders[0].automationId -and $_.name -ceq $sliders[0].name -and $_.type -eq 'Slider'
    })
    if ($matches.Count -ne 1) { $Result.reason = 'range-reader-identity-not-unique'; return }
    $range = $matches[0]
    $sliders[0].rangeValue = $range
    if ($range.supported -isnot [bool]) { throw 'RangeValue supported не является boolean.' }
    if (!$range.supported) { $Result.reason = 'range-value-pattern-not-supported'; return }
    foreach ($field in @('minimum', 'maximum', 'value')) {
        if (($range.$field -isnot [int] -and $range.$field -isnot [long] -and $range.$field -isnot [double]) -or
            ![double]::IsFinite($range.$field)) { throw 'RangeValue не содержит конечное числовое значение.' }
    }
    if ($range.minimum -gt $range.maximum -or $range.value -lt $range.minimum -or $range.value -gt $range.maximum -or
        $range.isReadOnly -isnot [bool]) { throw 'RangeValue нарушил контракт диапазона.' }
    if ($range.isReadOnly -or !$sliders[0].isEnabled) { $Result.reason = 'text-size-slider-read-only-or-disabled'; return }
    if ($apply.Count -ne 1) { $Result.reason = 'apply-button-not-unique'; return }
    $Result.status = 'available'
    $Result.reason = 'text-size-page-and-writable-range-observed'
}

$output = [IO.Path]::GetFullPath($OutputPath)
$tempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (!$output.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)) {
    throw 'Результат должен быть новым файлом внутри RUNNER_TEMP.'
}
$toolRoot = Join-Path $env:RUNNER_TEMP 'labui-native/evidence/tool'
$executables = @(Get-ChildItem -LiteralPath $toolRoot -Filter winapp.exe -Recurse -File)
if ($executables.Count -ne 1) { throw 'Требуется единственный CLI после успешного native smoke.' }
$cli = $executables[0].FullName
$owned = $null
$failure = $null
$stage = 'snapshot-before'
$result = [ordered]@{
    schemaVersion = 1; experiment = 'settings-text-size-capability'; status = 'unavailable'; reason = $null;
    uri = 'ms-settings:easeofaccess-display'; observedAtUtc = [DateTime]::UtcNow.ToString('o');
    osVersion = [Environment]::OSVersion.Version.ToString(); imageOS = $env:ImageOS; imageVersion = $env:ImageVersion;
    cliVersion = '0.7.1'; cliSha256 = (Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash.ToLowerInvariant();
    systemTextScaleChanged = $false; fontQualification = 'not-performed';
    snapshotBefore = @(); snapshotAfter = @(); window = $null; elements = @(); ranges = @(); cleanup = 'not-started'; error = $null
}
try {
    $before = @(Get-SettingsSnapshot)
    $result.snapshotBefore = @($before | Select-Object pid, startTicks, sessionId)
    if ($before.Count) {
        $result.reason = 'settings-process-already-existed'
        $result.snapshotAfter = @(Get-SettingsSnapshot | Select-Object pid, startTicks, sessionId)
    } else {
        $stage = 'launch-uri'
        $launchTicks = [DateTime]::UtcNow.Ticks
        # URI не выдаёт receipt нового Settings PID. Владелец устанавливается отдельно.
        $null = Invoke-TextScaleChild (Join-Path $PSHOME 'pwsh.exe') @('-NoProfile', '-NonInteractive', '-Command',
            'Start-Process -FilePath ms-settings:easeofaccess-display') 10000
        $deadline = [DateTime]::UtcNow.AddSeconds(20)
        $stage = 'snapshot-after'
        do {
            $after = @(Get-SettingsSnapshot)
            if ($after.Count) { break }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $deadline)
        $result.snapshotAfter = @($after | Select-Object pid, startTicks, sessionId)
        $settingsPath = Join-Path $env:SystemRoot 'ImmersiveControlPanel/SystemSettings.exe'
        if ($after.Count -ne 1 -or $after[0].startTicks -lt $launchTicks -or $after[0].path -ine $settingsPath) {
            $result.reason = 'fresh-settings-process-not-unique'
        } else {
            $stage = 'discover-window'
            do {
                $windows = @(Invoke-TextScaleChild $cli @('ui', 'list-windows', '-a', [string]$after[0].pid, '--json') | ConvertFrom-Json)
                if ($windows.Count) { break }
                Start-Sleep -Milliseconds 250
            } while ([DateTime]::UtcNow -lt $deadline)
            if ($windows.Count -ne 1 -or $windows[0].processId -ne $after[0].pid -or $windows[0].hwnd -le 0) {
                $result.reason = 'settings-window-not-unique'
            } else {
                $owned = $after[0]
                $owned.hwnd = [long]$windows[0].hwnd
                Assert-SettingsWindow $owned
                $result.window = @{ pid = $owned.pid; startTicks = $owned.startTicks; hwnd = $owned.hwnd }
                $stage = 'inspect-page'
                for ($attempt = 0; $attempt -lt 3; $attempt++) {
                    Assert-SettingsWindow $owned
                    $tree = Invoke-TextScaleChild $cli @('ui', 'inspect', '-w', [string]$owned.hwnd, '--depth', '12', '--json') | ConvertFrom-Json
                    Assert-SettingsWindow $owned
                    $result.elements = @(Get-TextScaleElements $tree $owned.hwnd)
                    if (@($result.elements | Where-Object type -eq 'Slider').Count) { break }
                    if ($attempt -lt 2) { Start-Sleep -Milliseconds 500 }
                }
                $stage = 'read-range-value'
                $result.ranges = @(Read-SettingsRanges $owned)
                Set-TextScaleCapability $result $result.ranges
            }
        }
    }
} catch {
    $failure = $_
    $result.status = 'unavailable'
    $result.reason = 'unexpected-error'
    $result.error = @{ stage = $stage; type = $_.Exception.GetType().FullName; message = $_.Exception.Message }
} finally {
    try { $result.cleanup = Close-SettingsWindow $owned } catch {
        $result.cleanup = 'failed'
        $result.status = 'unavailable'
        $result.reason = 'cleanup-error'
        $result.error = @{ stage = 'cleanup'; type = $_.Exception.GetType().FullName; message = $_.Exception.Message }
        if (!$failure) { $failure = $_ }
    }
    $json = $result | ConvertTo-Json -Depth 8 -Compress
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536) { throw 'Capability JSON превысил 64 KiB.' }
    [IO.File]::WriteAllText($output, $json, [Text.UTF8Encoding]::new($false))
    Write-Output "LABUI_TEXT_SCALE_CAPABILITY_JSON $json"
}
if ($failure) { throw $failure }

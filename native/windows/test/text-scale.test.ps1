param([string]$Harness = (Join-Path $PSScriptRoot 'text-scale.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
$tokens = $null
$errors = $null
$source = [IO.File]::ReadAllText($Harness)
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис capability harness.'
foreach ($definition in $ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst]
}) { . ([scriptblock]::Create($definition.Extent.Text)) }

# Запускается настоящий script entry; отказ обязан предшествовать любому discovery.
$saved = @{}
foreach ($name in @('GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'RUNNER_OS')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}
try {
    foreach ($setting in @(
        @('false', 'github-hosted', 'Windows'), @('true', 'self-hosted', 'Windows'),
        @('true', 'github-hosted', 'Linux')
    )) {
        $env:GITHUB_ACTIONS, $env:RUNNER_ENVIRONMENT, $env:RUNNER_OS = $setting
        $failure = $null
        try { & $Harness -OutputPath 'unreachable.json' } catch { $failure = $_ }
        Assert ($null -ne $failure -and $failure.Exception.Message -match '^Settings разрешены') 'Hosted guard пропустил неподходящую среду.'
    }
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}

# Cleanup исполняется без GUI: чужое поколение/окно обязано остаться нетронутым.
foreach ($fault in @('none', 'pid-reused', 'path-changed', 'session-changed', 'window-changed', 'close-refused', 'close-timeout')) {
    & {
        param($fault)
        $started = [DateTime]::UtcNow.AddMinutes(-1)
        $owned = @{ pid = 3187; startTicks = $started.Ticks; path = 'fixture/SystemSettings.exe'; sessionId = 1; hwnd = 42 }
        $process = [pscustomobject]@{ StartTime = $started; Path = $owned.path; SessionId = 1;
            MainWindowHandle = [IntPtr]42; Closed = $false; Fault = $fault; Disposed = $false }
        $process | Add-Member ScriptMethod CloseMainWindow {
            $this.Closed = $true
            return $this.Fault -ne 'close-refused'
        }
        $process | Add-Member ScriptMethod WaitForExit { param($Timeout) return $this.Fault -ne 'close-timeout' }
        $process | Add-Member ScriptMethod Refresh { }
        $process | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
        switch ($fault) {
            'pid-reused' { $process.StartTime = $started.AddSeconds(1) }
            'path-changed' { $process.Path = 'fixture/foreign.exe' }
            'session-changed' { $process.SessionId = 2 }
            'window-changed' { $process.MainWindowHandle = [IntPtr]43 }
        }
        function Get-Process { param($Id, $ErrorAction) return $process }
        $failure = $null
        $result = $null
        try { $result = Close-SettingsWindow $owned } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Cleanup потерял отказ: $fault."
        Assert ($process.Closed -eq ($fault -in @('none', 'close-refused', 'close-timeout'))) "Закрыто чужое поколение/окно: $fault."
        Assert $process.Disposed "Process handle не освобождён: $fault."
        if ($fault -eq 'none') { Assert ($result -eq 'closed') 'Нет readback закрытия.' }
    } $fault
}
Assert ((Close-SettingsWindow $null) -eq 'no-owned-window') 'Cleanup требует несуществующее владение.'

function New-CapabilityFixture {
    return [ordered]@{ status = 'unavailable'; reason = $null; elements = @(
        @{ selector = 'observed-header'; name = 'Text size'; automationId = 'observed-header'; type = 'Text'; isOffscreen = $false; isEnabled = $true },
        @{ selector = 'observed-slider'; name = 'Text size'; automationId = 'observed-slider'; type = 'Slider'; isOffscreen = $false; isEnabled = $true },
        @{ selector = 'observed-apply'; name = 'Apply'; automationId = 'observed-apply'; type = 'Button'; isOffscreen = $false; isEnabled = $false }
    ) }
}
foreach ($fault in @('none', 'missing-page', 'duplicate-slider', 'wrong-slider-label', 'foreign-range', 'extra-range', 'missing-apply', 'unsupported', 'readonly', 'invalid-value', 'string-value')) {
    $result = New-CapabilityFixture
    $range = @{ name = 'Text size'; automationId = 'observed-slider'; type = 'Slider'; supported = $true;
        minimum = 100; maximum = 225; value = 130; isReadOnly = $false }
    switch ($fault) {
        'missing-page' { $result.elements = @($result.elements | Where-Object type -ne 'Text') }
        'duplicate-slider' { $result.elements += $result.elements[1].Clone() }
        'wrong-slider-label' { $result.elements[1].name = 'Brightness'; $range.name = 'Brightness' }
        'foreign-range' { $range.automationId = 'foreign' }
        'missing-apply' { $result.elements = @($result.elements | Where-Object type -ne 'Button') }
        'unsupported' { $range.supported = $false }
        'readonly' { $range.isReadOnly = $true }
        'invalid-value' { $range.value = 300 }
        'string-value' { $range.value = '130' }
    }
    $ranges = @($range)
    if ($fault -eq 'extra-range') {
        $other = $range.Clone()
        $other.automationId = 'second-slider-beyond-inspect-depth'
        $ranges += $other
    }
    $failure = $null
    try { Set-TextScaleCapability $result $ranges } catch { $failure = $_ }
    Assert (($null -ne $failure) -eq ($fault -in @('invalid-value', 'string-value'))) "Неверный контракт RangeValue: $fault."
    Assert (($result.status -eq 'available') -eq ($fault -eq 'none')) "Ложный capability available: $fault."
}

$tree = '{"windows":[{"hwnd":42,"elements":[{"selector":"account","name":"PRIVATE ACCOUNT","type":"Text","isEnabled":true,"isOffscreen":false,"children":[{"selector":"live-slider","name":"Text size","automationId":"live-slider","type":"Slider","isEnabled":true,"isOffscreen":false},{"type":"Pane"}]}]}]}' | ConvertFrom-Json
$inventory = @(Get-TextScaleElements $tree 42)
Assert ($inventory.Count -eq 1 -and $inventory[0].selector -eq 'live-slider') 'В опубликованный inventory попал посторонний текст Settings.'
Assert (!(($inventory | ConvertTo-Json -Depth 5) -match 'PRIVATE ACCOUNT')) 'Inventory раскрыл нерелевантный label.'
$failure = $null
try { Get-TextScaleElements $tree 43 | Out-Null } catch { $failure = $_ }
Assert ($null -ne $failure) 'Inspect другого HWND принят.'

# Вложенный PS5 reader проверяется как source; UIAutomation/Settings здесь не запускаются.
$readerText = @($ast.FindAll({ param($node)
    $node -is [Management.Automation.Language.StringConstantExpressionAst] -and
    $node.StringConstantType -eq [Management.Automation.Language.StringConstantType]::SingleQuotedHereString
}, $true) | Where-Object Value -Match 'UIAutomationClient')[0].Value
$null = [Management.Automation.Language.Parser]::ParseInput($readerText, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис framework reader.'
Assert ($source -notmatch '\bSetValue\s*\(|\bset-value\b|\bSet-ItemProperty\b|\bStop-Process\b') 'Read-only experiment получил путь изменения настройки/чужого процесса.'

# Настоящий bounded child, но только echo/exit/sleep: никакого GUI или UIAutomation.
$shell = Join-Path $PSHOME 'pwsh.exe'
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("[Console]::OutputEncoding = [Text.UTF8Encoding]::new(`$false); 'Размер текста'"))
$readback = Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded)
Assert ($readback.Trim() -ceq 'Размер текста') 'Дочерний процесс исказил UTF-8.'
foreach ($command in @('exit 2', 'Start-Sleep -Seconds 30')) {
    $failure = $null
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try { Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-Command', $command) 1000 | Out-Null } catch { $failure = $_ }
    Assert ($null -ne $failure -and $timer.Elapsed.TotalSeconds -lt 10) 'Child error/timeout не завершился ограниченно.'
}

# Прямой child уже вышел, но потомок держит унаследованные pipes ещё четыре секунды.
$definition = @($ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-TextScaleChild'
})[0]
$readAssignment = $definition.Find({ param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$stderr' -and $node.Right.Extent.Text -match 'ReadToEndAsync'
}, $true)
$script:textScaleReadTasks = @()
# Наблюдаются ссылки настоящих Task; реализация чтения/ожидания/cleanup не подменяется.
$instrumented = $definition.Extent.Text.Replace($readAssignment.Extent.Text,
    $readAssignment.Extent.Text + "`n`$script:textScaleReadTasks = @(`$stdout, `$stderr)")
. ([scriptblock]::Create($instrumented))
$childCode = '$info=[Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME ''pwsh.exe'')); $info.UseShellExecute=$false; $info.CreateNoWindow=$true; foreach($argument in @(''-NoProfile'',''-NonInteractive'',''-Command'',''Start-Sleep -Seconds 4'')){$info.ArgumentList.Add($argument)}; $child=[Diagnostics.Process]::Start($info); $child.Dispose()'
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCode))
$failure = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
try { Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded) 1500 | Out-Null } catch { $failure = $_ }
$elapsed = $timer.ElapsedMilliseconds
$readsCompleted = $script:textScaleReadTasks.Count -eq 2 -and @($script:textScaleReadTasks | Where-Object { !$_.IsCompleted }).Count -eq 0
# Потомок fixture завершится сам; это не новая production-политика управления потомками.
if ($elapsed -lt 5000) { Start-Sleep -Milliseconds (5000 - $elapsed) }
Write-Output "Pipe witness: timeoutMs=1500 elapsedMs=$elapsed failed=$($null -ne $failure) readsCompleted=$readsCompleted"
Assert ($null -ne $failure -and $elapsed -lt 4000) 'Ожидание EOF вышло за общий deadline дочернего процесса.'
Assert $readsCompleted 'После возврата harness остались незавершённые чтения pipes.'
Write-Output 'PASS: hosted guard, scoped cleanup, capability identity and bounded inventory; GUI not executed.'

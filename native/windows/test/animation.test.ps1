param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Подменяется только системная граница. Настройки Windows тест не читает и не меняет.
class ClientAreaAnimation {
    static [bool] $Current = $true
    static [bool] $FailWrite = $false
    static [bool] $FailAfterWrite = $false
    static [bool] $FailReadOnce = $false
    static [Collections.Generic.List[string]] $Events = [Collections.Generic.List[string]]::new()
    static [void] Write([bool]$value) {
        [ClientAreaAnimation]::Events.Add("write:$value")
        if ([ClientAreaAnimation]::FailWrite) { throw [IO.IOException]::new('injected setting failure') }
        [ClientAreaAnimation]::Current = $value
        if ([ClientAreaAnimation]::FailAfterWrite) {
            [ClientAreaAnimation]::FailAfterWrite = $false
            throw [IO.IOException]::new('injected failure after setting change')
        }
    }
    static [bool] Read() {
        [ClientAreaAnimation]::Events.Add('read')
        if ([ClientAreaAnimation]::FailReadOnce) {
            [ClientAreaAnimation]::FailReadOnce = $false
            throw [IO.IOException]::new('injected initial read failure')
        }
        return [ClientAreaAnimation]::Current
    }
}

function Assert([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}

$source = [IO.File]::ReadAllText($Harness)
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })[-1]
$cleanup = [scriptblock]::Create($outer.Finally.Extent.Text.Substring(1, $outer.Finally.Extent.Text.Length - 2))

# Setup и его finally остаются кодом harness; загрузка DLL и GUI не исполняются.
$statements = @($outer.Body.Statements)
$setupStart = -1
$launch = -1
for ($i = 0; $i -lt $statements.Count; $i++) {
    if ($statements[$i].Extent.Text -match '^\$animationBefore\s*=') { $setupStart = $i }
    if ($statements[$i].Extent.Text -match '^\$process\s*=\s*Start-Process') { $launch = $i; break }
}
Assert ($setupStart -ge 0 -and $launch -gt $setupStart) 'Нет настройки перед запуском процесса.'
$setup = [scriptblock]::Create(($statements[$setupStart..($launch - 1)].Extent.Text -join "`n"))
foreach ($before in @($false, $true)) {
    foreach ($fault in @('none', 'read', 'after-write')) {
        & {
            param($before, $fault)
            [ClientAreaAnimation]::Events.Clear()
            [ClientAreaAnimation]::Current = $before
            [ClientAreaAnimation]::FailWrite = $false
            [ClientAreaAnimation]::FailAfterWrite = $fault -eq 'after-write'
            [ClientAreaAnimation]::FailReadOnce = $fault -eq 'read'
            $animationBefore = $null
            $animationReadback = $null
            $animationObservationPath = 'unused-observation.json'
            $saved = @{ LABUI_ANIMATION_OBSERVATION = $env:LABUI_ANIMATION_OBSERVATION }
            $process = $null
            $close = @{}
            $commands = @()
            $output = [IO.Path]::GetTempPath()
            function Set-Content {
                param([Parameter(Position = 0)][string]$Path, [string]$Encoding,
                    [Parameter(ValueFromPipeline = $true)]$InputObject)
                process { }
            }
            $failed = $false
            try {
                . $setup
                Assert ([ClientAreaAnimation]::Current -and $animationReadback) 'Анимация не включена или не прочитана обратно.'
                Assert ($animationBefore -eq $before) 'Setup потерял исходную настройку.'
            } catch { $failed = $true } finally { . $cleanup }
            Assert ($failed -eq ($fault -ne 'none')) 'Результат ошибки включения потерян.'
            Assert ([ClientAreaAnimation]::Current -eq $before) 'Настройка утекла при отказе до запуска приложения.'
            if ($fault -eq 'read') {
                Assert ([ClientAreaAnimation]::Events.Count -eq 1) 'Настройка записана без известного исходного значения.'
            }
        } $before $fault
    }
}

# Выполняется настоящий finally, включая его порядок операций и распространение ошибок.
foreach ($before in @($false, $true)) {
    foreach ($fault in @('none', 'commands', 'close', 'process', 'dispose', 'setting')) {
        & {
            param($before, $fault)
            [ClientAreaAnimation]::Events.Clear()
            [ClientAreaAnimation]::Current = !$before
            [ClientAreaAnimation]::FailWrite = $fault -eq 'setting'
            $animationBefore = $before
            $animationReadback = $true
            $saved = @{}
            $close = @{}
            $output = [IO.Path]::GetTempPath()
            $app = 'fake-app.exe'
            $commands = @(@{ name = 'fixture'; arguments = @(); exitCode = 0 })
            $written = @{}
            $process = [pscustomobject]@{
                HasExited = $false; ExitCode = 0; Id = 3187; Path = $app
                StartTime = [DateTime]::UtcNow.AddMinutes(-1); Fault = $fault
            }
            $started = $process.StartTime
            $process | Add-Member ScriptMethod Refresh { }
            $process | Add-Member ScriptMethod CloseMainWindow {
                [ClientAreaAnimation]::Events.Add('close')
                if ($this.Fault -eq 'process') { throw [IO.IOException]::new('injected process failure') }
                $this.HasExited = $true
                return $true
            }
            $process | Add-Member ScriptMethod WaitForExit { param($Timeout) return $this.HasExited }
            $process | Add-Member ScriptMethod Dispose {
                [ClientAreaAnimation]::Events.Add('dispose')
                if ($this.Fault -eq 'dispose') { throw [IO.IOException]::new('injected dispose failure') }
            }
            function Get-Process { param($Id, $ErrorAction) return $process }
            function Stop-Process { param($Id, [switch]$Force) $process.HasExited = $true }
            function Set-Content {
                param([Parameter(Position = 0)][string]$Path, [string]$Encoding,
                    [Parameter(ValueFromPipeline = $true)]$InputObject)
                process {
                    $name = [IO.Path]::GetFileName($Path)
                    if ($name -eq "$fault.json") { throw [IO.IOException]::new('injected evidence failure') }
                    $written[$name] = $InputObject
                }
            }
            $failure = $null
            try { . $cleanup } catch { $failure = $_ }
            $events = [ClientAreaAnimation]::Events
            Assert ($events.Contains("write:$before")) "Настройка не восстановлена: $before/$fault."
            Assert ($events.IndexOf('close') -lt $events.IndexOf("write:$before")) "Настройка восстановлена до закрытия процесса: $fault."
            Assert ($events.Contains('dispose')) "Ресурс процесса не освобождён: $fault."
            Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Ошибка cleanup потеряна или создана: $fault."
            if ($fault -ne 'setting') {
                Assert ([ClientAreaAnimation]::Current -eq $before) "Не возвращено исходное значение: $fault."
            }
            if ($fault -eq 'none') {
                Assert ($written.ContainsKey('close.json')) 'Не сохранено завершение процесса.'
                Assert ($written.ContainsKey('commands.json')) 'Не сохранены команды.'
            }
        } $before $fault
    }
}

# Guard исполняется целиком, но первая внешняя операция остановлена подменой.
foreach ($mode in @(
    @{ actions = $null; runner = $null; allowed = $false },
    @{ actions = 'true'; runner = 'self-hosted'; allowed = $false },
    @{ actions = 'false'; runner = 'github-hosted'; allowed = $false },
    @{ actions = 'true'; runner = 'github-hosted'; allowed = $true }
)) {
    & {
        param($mode)
        $previousActions = $env:GITHUB_ACTIONS
        $previousRunner = $env:RUNNER_ENVIRONMENT
        $effects = [Collections.Generic.List[string]]::new()
        [ClientAreaAnimation]::Events.Clear()
        [ClientAreaAnimation]::FailWrite = $false
        function New-Item { param($ItemType, $Path) $effects.Add('create-output'); throw 'injected first effect' }
        function Add-Type { param($Path, $AssemblyName) $effects.Add('load-settings'); throw 'injected first effect' }
        function Start-Process { $effects.Add('launch'); throw 'injected first effect' }
        function Invoke-WebRequest { $effects.Add('download'); throw 'injected first effect' }
        try {
            $env:GITHUB_ACTIONS = $mode.actions
            $env:RUNNER_ENVIRONMENT = $mode.runner
            $arguments = @{ ApplicationDirectory = $PSScriptRoot
                OutputDirectory = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()) }
            if ($ast.ParamBlock.Parameters.Name.VariablePath.UserPath -contains 'AnimationSettingsPath') {
                $arguments.AnimationSettingsPath = 'unused-settings.cs'
            }
            $failure = $null
            try { & $Harness @arguments } catch { $failure = $_ }
            Assert ($null -ne $failure) 'Guard control неожиданно выполнил harness.'
            Assert (($effects.Count -gt 0) -eq $mode.allowed) 'Hosted guard допустил эффект либо отверг hosted control.'
            Assert ([ClientAreaAnimation]::Events.Count -eq 0) 'Guard пропустил обращение к настройке до проверки среды.'
        } finally {
            $env:GITHUB_ACTIONS = $previousActions
            $env:RUNNER_ENVIRONMENT = $previousRunner
        }
    } $mode
}

$validator = @($ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Assert-AnimationObservation'
})
Assert ($validator.Count -eq 1) 'Нет проверки observation на границе harness.'
. ([scriptblock]::Create($validator[0].Extent.Text))
$observedProcess = [pscustomobject]@{ Id = 3187; StartTime = [DateTime]::UtcNow.AddMinutes(-1) }
function New-Observation {
    return [pscustomobject]@{ pid = 3187; observedAtUnixMs = [DateTimeOffset]::UtcNow.AddSeconds(-1).ToUnixTimeMilliseconds(); animationsEnabled = $true }
}
Assert-AnimationObservation (New-Observation) $observedProcess
Assert-AnimationObservation ((New-Observation) | ConvertTo-Json | ConvertFrom-Json) $observedProcess
$mutations = @(
    { param($value) $value.animationsEnabled = $false },
    { param($value) $value.animationsEnabled = 'true' },
    { param($value) $value.animationsEnabled = 1 },
    { param($value) $value.PSObject.Properties.Remove('animationsEnabled') },
    { param($value) $value.pid = 3188 },
    { param($value) $value.pid = '3187' },
    { param($value) $value.pid = 3187.25 },
    { param($value) $value.PSObject.Properties.Remove('pid') },
    { param($value) $value.observedAtUnixMs = [DateTimeOffset]::UtcNow.AddMinutes(-2).ToUnixTimeMilliseconds() },
    { param($value) $value.observedAtUnixMs = [DateTimeOffset]::UtcNow.AddMinutes(1).ToUnixTimeMilliseconds() },
    { param($value) $value.observedAtUnixMs = [string]$value.observedAtUnixMs },
    { param($value) $value.observedAtUnixMs = [double]$value.observedAtUnixMs + 0.25 },
    { param($value) $value.PSObject.Properties.Remove('observedAtUnixMs') }
)
foreach ($mutation in $mutations) {
    $observation = New-Observation
    & $mutation $observation
    $failed = $false
    try { Assert-AnimationObservation $observation $observedProcess } catch { $failed = $true }
    Assert $failed "Неверное observation принято: $($mutation.ToString())."
}

# Проверяется настоящая цепочка read -> identity -> policy gate -> первый ввод.
$observationStart = -1
$firstInput = -1
for ($i = 0; $i -lt $statements.Count; $i++) {
    if ($statements[$i].Extent.Text -match '^\$animationObservation\s*=') { $observationStart = $i }
    if ($statements[$i].Extent.Text -match '^Ui\s') { $firstInput = $i; break }
}
Assert ($observationStart -ge 0 -and $firstInput -gt $observationStart) 'Нет цепочки наблюдения до первого ввода.'
$admission = [scriptblock]::Create(($statements[$observationStart..$firstInput].Extent.Text -join "`n"))
foreach ($enabled in @($true, $false)) {
    & {
        param($enabled)
        $process = $observedProcess
        $started = $process.StartTime
        $window = 'fixture-window'
        $app = 'fixture-app.exe'
        $ApplicationDirectory = $PSScriptRoot
        $AnimationSettingsPath = 'fixture-settings.cs'
        $animationObservationPath = 'fixture-observation.json'
        $animationBefore = $false
        $animationReadback = $true
        $output = [IO.Path]::GetTempPath()
        $digest = 'f' * 64
        $probe = @{ input = 0; identity = $null }
        function Read-AnimationObservation {
            $value = New-Observation
            $value.animationsEnabled = $enabled
            return $value
        }
        function Get-FileHash { param($LiteralPath) return @{ Hash = 'a' * 64 } }
        function git { return 'b' * 40 }
        function Ui { $probe.input++ }
        function Set-Content {
            param([Parameter(Position = 0)][string]$Path, [string]$Encoding,
                [Parameter(ValueFromPipeline = $true)]$InputObject)
            process { $probe.identity = $InputObject | ConvertFrom-Json }
        }
        $failed = $false
        try { . $admission } catch { $failed = $true }
        Assert ($failed -eq !$enabled) 'Policy gate не управляет первым вводом.'
        Assert ($probe.input -eq [int]$enabled) 'Ввод начался без положительного observation.'
        Assert ($null -ne $probe.identity) 'Наблюдение не сохранено до gate.'
        Assert ($probe.identity.animation.process.pid -eq $process.Id) 'Identity потерял PID observation.'
        Assert ($probe.identity.animation.process.animationsEnabled -eq $enabled) 'Identity потерял фактическую политику.'
    } $enabled
}
'animation contract: PASS (cleanup, hosted guard, process observation)'

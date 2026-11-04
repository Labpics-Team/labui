param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Value, [string]$Message) { if (!$Value) { throw $Message } }
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($Harness, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
foreach ($name in @('Assert-DynamicReply', 'Wait-SpaceReady', 'Invoke-DynamicGesture', 'Capture-Dynamic', 'Write-SpaceFailure')) {
    $found = @($ast.FindAll({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name
    }, $false))
    Assert ($found.Count -eq 1) "Нет однозначной функции $name."
    . ([scriptblock]::Create($found[0].Extent.Text))
}
$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })
Assert ($outer.Count -eq 1 -and $null -ne $outer[0].Finally) 'Нет однозначного finally.'
$finalizer = [scriptblock]::Create(($outer[0].Finally.Statements.Extent.Text -join "`n"))

# Граница настоящего JSON; primitive type coercion не превращает чужой формат в identity.
foreach ($fault in @('none', 'schema-string', 'schema-float', 'schema-bool', 'schema-null', 'schema-value',
    'scenario-value', 'scenario-array', 'scenario-empty', 'pid-string', 'pid-float', 'pid-null', 'pid-value')) {
    & {
        param($fault)
        $process = [pscustomobject]@{ Id = 3187 }
        $reply = @{ schemaVersion = 1; scenario = 'dynamic-reduced-motion'; pid = 3187 }
        switch ($fault) {
            'schema-string' { $reply.schemaVersion = '1' }
            'schema-float' { $reply.schemaVersion = [double]1 }
            'schema-bool' { $reply.schemaVersion = $true }
            'schema-null' { $reply.schemaVersion = $null }
            'schema-value' { $reply.schemaVersion = 2 }
            'scenario-value' { $reply.scenario = 'interrupted' }
            'scenario-array' { $reply.scenario = @('dynamic-reduced-motion') }
            'scenario-empty' { $reply.scenario = @() }
            'pid-string' { $reply.pid = '3187' }
            'pid-float' { $reply.pid = [double]3187 }
            'pid-null' { $reply.pid = $null }
            'pid-value' { $reply.pid = 3188 }
        }
        $reply = $reply | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json
        $failure = $null; $actual = @()
        try { $actual = @(Assert-DynamicReply $reply) } catch { $failure = $_ }
        Assert (($null -eq $failure) -eq ($fault -eq 'none')) "Неверный admission dynamic wrapper: $fault."
        if ($fault -eq 'none') { Assert ($actual.Count -eq 1 -and [object]::ReferenceEquals($actual[0], $reply)) 'Здоровый wrapper потерян.' }
    } $fault
}
'Dynamic wrapper: PASS (real JSON, scenario/schema/PID types and values)'

# Временная копия sender меняет только имя публичного входа; internal Run исполняется с fake Platform.
# NativePlatform и публичный hosted-вход здесь не вызываются. Cleanup собственного down остаётся настоящим.
$sender = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'space-input.cs'))
Assert (($sender.Split('public static class SpaceInput').Count - 1) -eq 1) 'Не найдена однозначная граница sender.'
$sender = $sender.Replace('public static class SpaceInput', 'public static class BoundSpaceInput')
Add-Type -TypeDefinition ($sender + @'

public static class SpaceInput {
    public static DynamicPlatform Current;
    public static int SpendOnFirstDown;
    public static object Receipt;
    public static object Run(int pid, long window, Action<int, int> ready) {
        Current = new DynamicPlatform(pid, window, SpendOnFirstDown);
        try { return Receipt = BoundSpaceInput.Run(Current, pid, window, ready); }
        catch (Exception error) { Receipt = error.Data["spaceInputReceipt"]; throw; }
    }
    public sealed class DynamicPlatform : BoundSpaceInput.Platform {
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private readonly int pid;
        private readonly long window;
        private readonly int spend;
        private long advanced;
        public readonly List<bool> Edges = new List<bool>();
        public bool Held;
        public DynamicPlatform(int pid, long window, int spend) { this.pid = pid; this.window = window; this.spend = spend; }
        public long Timestamp { get { return clock.ElapsedMilliseconds + advanced; } }
        public long Frequency { get { return 1000; } }
        public long Foreground { get { return window; } }
        public long Root(long value) { return value; }
        public int Process(long value) { return pid; }
        public bool IsDown(int key) { return key == 0x20 && Held; }
        public uint Send(bool down) {
            Held = down; Edges.Add(down);
            if (Edges.Count == 1) advanced += spend;
            return 1;
        }
        public int LastError { get { return 0; } }
        public void Delay(int milliseconds) { advanced += milliseconds; }
    }
}
'@)
$script:dynamicCalls = [Collections.Generic.List[object]]::new()
$script:dynamicFault = 'none'
$script:prepareWaiting = $false
function Invoke-SpaceCommand([string]$Command, [int]$Timeout = 5000) {
    $script:dynamicCalls.Add(@{ command = $Command; timeout = $Timeout })
    $wrapper = @{ schemaVersion = 1; scenario = 'dynamic-reduced-motion'; pid = 3187 }
    if ($Command -ceq 'dynamic arm') {
        $wrapper.armed = @{ status = 'armed'; theme = 'Dark'; channel = 3; automationId = 'LabButtonMedium'; focused = $true;
            countBefore = 10; clockOriginTicks = '9007199254740993'; clockFrequency = 10000000 }
        if ($script:dynamicFault -eq 'arm-channel-type') { $wrapper.armed.channel = '3' }
    } elseif ($Command -ceq 'dynamic disable') {
        if ($script:dynamicFault -eq 'setter-timeout') { throw [TimeoutException]::new('injected-setting-timeout') }
        if ($script:dynamicFault -eq 'setter-late') { [Threading.Thread]::Sleep(350) }
        else { [Threading.Thread]::Sleep(20) }
        $wrapper.status = 'disabled'; $wrapper.mutation = @{ readback = $false }
        if ($script:dynamicFault -eq 'setter-readback') { $wrapper.mutation.readback = $true }
    } elseif ($Command -ceq 'dynamic complete') {
        $wrapper.status = 'complete'
    } else {
        $prepare = $Command -ceq 'dynamic prepare'
        $isStatic = $Command.StartsWith('ready ')
        $step = if ($prepare) { 1 } else { [int]($Command.Split(' ')[-1]) }
        $animate = $prepare -or ($isStatic -and $AnimationsEnabled)
        $ready = @{ schemaVersion = 1; status = 'ready'; pid = 3187; processStartedAtUnixMs = 1700000000000L;
            theme = 'Dark'; channel = $(if ($isStatic) { 2 } else { 3 }); step = $step; automationId = 'LabButtonMedium';
            animationsEnabled = $animate; clockOriginTicks = '9007199254740993'; clockFrequency = 10000000;
            operation = $(if ($animate) { 10 + $step } else { 0 }); nativeRequestId = $(if ($prepare) { 20 } else { 20 + $step });
            origin = $(if ($animate) { 'Animation' } else { 'Snap' }); reason = $null }
        if ($prepare -and $script:dynamicFault -eq 'prepare-waiting' -and !$script:prepareWaiting) {
            $script:prepareWaiting = $true; $ready.status = 'waiting'; $ready.operation = $null; $ready.nativeRequestId = $null; $ready.origin = $null
        }
        if ($Command -ceq 'dynamic ready 1' -and $script:dynamicFault -eq 'wrong-snap') { $ready.origin = 'Animation' }
        if ($Command -ceq 'dynamic ready 1' -and $script:dynamicFault -eq 'ready-wrapper-pid') { $wrapper.pid = 3188 }
        if ($Command -ceq 'dynamic ready 1' -and $script:dynamicFault -eq 'ready-mode') { $ready.animationsEnabled = $true }
        if ($Command -ceq 'dynamic ready 1' -and $script:dynamicFault -eq 'ready-failed') {
            $ready.status = 'failed'; $ready.reason = 'fixture-dynamic-overflow'
            $ready.diagnostic = @{ schemaVersion = 1; status = 'failed'; pid = 3187; channel = 3; overflow = 1;
                observations = @(0..127 | ForEach-Object { @{ elapsedMs = $_; motion = @{ phase = 'value'; nativeRequestId = 21; readbackPosition = 1.0 } } });
                firstDiscarded = @{ elapsedMs = 128; motion = @{ phase = 'idle'; nativeRequestId = 22; readbackPosition = 0.0 } } }
        }
        if ($prepare) { [Threading.Thread]::Sleep(20) }
        if ($isStatic) { return ($ready | ConvertTo-Json -Depth 7 -Compress | ConvertFrom-Json) }
        $wrapper.readiness = $ready
    }
    return ($wrapper | ConvertTo-Json -Depth 7 -Compress | ConvertFrom-Json)
}
foreach ($fault in @('none', 'prepare-waiting', 'setter-timeout', 'setter-late', 'setter-readback', 'wrong-snap', 'ready-wrapper-pid', 'ready-mode', 'ready-failed', 'arm-channel-type')) {
    & {
        param($fault)
        $script:dynamicFault = $fault; $script:dynamicCalls.Clear(); $script:prepareWaiting = $false
        [SpaceInput]::SpendOnFirstDown = if ($fault -eq 'setter-late') { 4800 } else { 0 }
        [SpaceInput]::Receipt = $null; [SpaceInput]::Current = $null
        $process = [pscustomobject]@{ Id = 3187 }; $window = '100'
        $started = [DateTimeOffset]::FromUnixTimeMilliseconds(1700000000000).UtcDateTime
        $AnimationsEnabled = $true; $clock = [Diagnostics.Stopwatch]::StartNew()
        $failure = $null; $actual = @()
        try { $actual = @(Invoke-DynamicGesture 10) } catch { $failure = $_ }
        $healthy = $fault -in @('none', 'prepare-waiting')
        Assert (($null -eq $failure) -eq $healthy) "Неверный dynamic gesture: $fault."
        if ($fault -eq 'arm-channel-type') { return }
        Assert ([object]::ReferenceEquals($spaceDiagnostic.injection, [SpaceInput]::Receipt)) 'Потерян завершённый или частичный receipt.'
        Assert (![SpaceInput]::Current.Held) 'Настоящий sender не освободил собственное удержание.'
        $commands = @($script:dynamicCalls.command)
        Assert (@($commands | Where-Object { $_ -ceq 'dynamic disable' }).Count -eq 1) 'Setter был пропущен или повторён.'
        Assert ($commands[0] -ceq 'dynamic arm' -and $commands[1] -ceq 'dynamic prepare') 'Мутация началась без prepare.'
        $setter = @($script:dynamicCalls | Where-Object command -CEQ 'dynamic disable')[0]
        $prepare = @($script:dynamicCalls | Where-Object command -CEQ 'dynamic prepare')[-1]
        Assert ($setter.timeout -gt 0 -and $setter.timeout -lt $prepare.timeout -and $prepare.timeout -le 5000) 'Prepare сбросил единый бюджет 5s.'
        if ($healthy) {
            Assert ($actual.Count -eq 1 -and $actual[0].scenario -ceq 'dynamic-reduced-motion' -and $actual[0].observation.status -ceq 'complete') 'Полезный dynamic result потерян.'
            Assert (([SpaceInput]::Current.Edges -join ',') -ceq 'True,False,True,False') 'Неверная последовательность настоящего sender.'
            $after = @($script:dynamicCalls | Where-Object command -CEQ 'dynamic ready 1')[0]
            Assert ($after.timeout -gt 0 -and $after.timeout -lt $setter.timeout) 'Setter сбросил остаток бюджета.'
            Assert ($commands[-3] -ceq 'dynamic ready 1' -and $commands[-2] -ceq 'dynamic ready 2' -and $commands[-1] -ceq 'dynamic complete') 'Нет Snap readiness и дальнейшего ввода.'
        } else {
            Assert ($actual.Count -eq 0 -and ([SpaceInput]::Current.Edges -join ',') -ceq 'True,False') 'После отказа отправлен новый down либо потерян cleanup up.'
            Assert ($commands -cnotcontains 'dynamic ready 2' -and $commands -cnotcontains 'dynamic complete') 'После отказа продолжился сценарий.'
            if ($fault -in @('setter-timeout', 'setter-late', 'setter-readback')) {
                Assert ($commands -cnotcontains 'dynamic ready 1') 'После отказа setter был запрошен Snap.'
            }
            if ($fault -eq 'setter-timeout') { Assert ($failure.Exception.ToString().Contains('injected-setting-timeout')) 'Первичный timeout заменён.' }
            if ($fault -eq 'setter-late') { Assert ($failure.Exception.ToString().Contains('исчерпал бюджет')) 'Поздний setter принят.' }
            if ($fault -eq 'ready-failed') {
                Assert ($failure.Exception.ToString().Contains('fixture-dynamic-overflow')) 'Первичная ошибка readiness потеряна.'
                Assert ($null -ne $spaceDiagnostic.readiness['1'].PSObject.Properties['diagnostic']) 'Failed readiness потерял сохранённый prefix.'
                $diagnostic = $spaceDiagnostic.readiness['1'].diagnostic
                Assert ($diagnostic.status -ceq 'failed' -and $diagnostic.overflow -eq 1 -and
                    $diagnostic.observations.Count -eq 128 -and $diagnostic.firstDiscarded.motion.nativeRequestId -eq 22) 'Failed readiness потерял сохранённый prefix.'
                $expected = $diagnostic | ConvertTo-Json -Depth 8 -Compress
                $original = $failure.Exception
                $writer = [IO.StringWriter]::new(); $previousError = [Console]::Error
                try {
                    [Console]::SetError($writer)
                    $successOutput = @(Write-SpaceFailure $spaceDiagnostic $failure)
                } finally { [Console]::SetError($previousError) }
                try {
                    Assert ($successOutput.Count -eq 0 -and [object]::ReferenceEquals($failure.Exception, $original) -and
                        !$failure.Exception.Data.Contains('spaceDiagnosticError')) 'Вывод диагностики заменил первичный отказ.'
                    $written = $writer.ToString()
                    Assert ($written.StartsWith('LABUI_SPACE_FAILURE_JSON ') -and
                        [Text.Encoding]::UTF8.GetByteCount($written) -le 256 * 1024) 'Не сохранена ограниченная диагностика динамического отказа.'
                    $transported = $written.Substring('LABUI_SPACE_FAILURE_JSON '.Length) | ConvertFrom-Json
                    $actualDiagnostic = $transported.readiness.'1'.diagnostic | ConvertTo-Json -Depth 8 -Compress
                    Assert ($actualDiagnostic -ceq $expected -and $transported.mutation.mutation.readback -eq $false -and
                        $null -ne $transported.injection) 'Вывод потерял полный prefix, setter receipt или input cleanup receipt.'
                } finally { $writer.Dispose() }
            }
        }
    } $fault
}
'Dynamic gesture: PASS (actual sender ownership, prepare/setter/Snap, shared budget, partial receipt)'

foreach ($animate in @($true, $false)) {
    & {
        param($animate)
        $script:dynamicFault = 'none'; $script:dynamicCalls.Clear()
        $process = [pscustomobject]@{ Id = 3187 }; $AnimationsEnabled = $animate
        $started = [DateTimeOffset]::FromUnixTimeMilliseconds(1700000000000).UtcDateTime
        $armed = @{ channel = 2; clockOriginTicks = '9007199254740993'; clockFrequency = 10000000 }
        $spaceDiagnostic = @{ readiness = @{} }; $state = @{ nextStep = 1; previous = $null }
        $actual = @(Wait-SpaceReady 1 1000 'Dark' $armed $state)
        $actual += @(Wait-SpaceReady 2 900 'Dark' $armed $state)
        Assert ($actual.Count -eq 0 -and $state.nextStep -eq 3 -and ($script:dynamicCalls.command -join ',') -ceq 'ready 1,ready 2') 'Статический ready маршрут изменён.'
        Assert ($state.previous.origin -ceq $(if ($animate) { 'Animation' } else { 'Snap' })) 'Статический режим потерян.'
    } $animate
}
'Dynamic compatibility: PASS (unprefixed normal and reduced readiness)'

# Запись использует тот же живой gesture и не теряет его trace при упаковке результата.
# Команды recorder заменены у границы запуска/завершения; время задано детерминированно.
foreach ($case in @('none', 'budget', 'gesture', 'gesture-close', 'finish', 'finish-close', 'assert', 'assert-close', 'close')) {
    & {
        param($case)
        $output = [IO.Path]::GetTempPath()
        $clock = [pscustomobject]@{ Elapsed = [pscustomobject]@{ TotalMilliseconds = 150.0 } }
        $clockOriginTicks = '9007199254740993'; $clockOriginUpperTicks = '9007199254740994'
        $state = @{ calls = [Collections.Generic.List[object]]::new(); written = $null; asserted = $null }
        $captureRecording = @{ startedMs = 100.0; firstFrameReceivedMs = 150.0 }
        $captureRecordResult = @{ mode = 'frames'; source = 'recorder-fixture' }
        $captureSpaceResult = @{ observation = @{ trace = 'dynamic-trace' }; injection = @{ events = @(1, 2, 3, 4) } }
        $captureFinalResult = @{ mode = 'frames'; gestureTiming = 'interaction-Dynamic-window.json'; source = 'asserted-fixture' }
        $primary = [IO.IOException]::new("injected-$case-failure")
        function Ui {
            param($Name, $Arguments)
            $state.calls.Add(@{ kind = 'ui'; name = $Name; arguments = $Arguments })
        }
        function Start-Recording {
            param($Name, $DurationSec)
            $state.calls.Add(@{ kind = 'start'; name = $Name; duration = $DurationSec })
            return $captureRecording
        }
        function Invoke-DynamicGesture {
            param($CountBefore)
            $state.calls.Add(@{ kind = 'gesture'; count = $CountBefore })
            if ($case.StartsWith('gesture')) { throw $primary }
            $clock.Elapsed.TotalMilliseconds = if ($case -eq 'budget') { 30100.0 } else { 200.0 }
            return $captureSpaceResult
        }
        function Finish-Tool {
            param($Tool, $Timeout)
            $state.calls.Add(@{ kind = 'finish'; tool = $Tool; timeout = $Timeout })
            if ($case.StartsWith('finish')) { throw $primary }
            return $captureRecordResult
        }
        function Assert-Capture {
            param($Name, $Record, $Window, $GestureNames)
            $state.calls.Add(@{ kind = 'assert' })
            $state.asserted = @{ name = $Name; record = $Record; window = $Window; names = $GestureNames }
            if ($case.StartsWith('assert')) { throw $primary }
            return $captureFinalResult
        }
        function Close-Tool {
            param($Tool)
            $state.calls.Add(@{ kind = 'close'; tool = $Tool })
            if ($case -eq 'close' -or $case.EndsWith('-close')) { throw [IO.IOException]::new('injected-recorder-close-failure') }
        }
        function Set-Content {
            param([Parameter(Position = 0)][string]$Path, [string]$Encoding, [Parameter(ValueFromPipeline = $true)]$InputObject)
            process {
                $state.calls.Add(@{ kind = 'write'; path = $Path })
                $state.written = $InputObject | ConvertFrom-Json
            }
        }
        $escaped = $null; $actual = @()
        try { $actual = @(Capture-Dynamic 10) } catch { $escaped = $_ }
        $calls = $state.calls
        Assert (($null -eq $escaped) -eq ($case -eq 'none')) "Неверный исход записи: $case."
        Assert ($calls[0].kind -ceq 'ui' -and $calls[0].name -ceq 'interaction-Dynamic-before' -and
            ($calls[0].arguments[0..1] -join ',') -ceq 'screenshot,LabButtonMedium') 'Потерян исходный кадр кнопки.'
        Assert ($calls[1].kind -ceq 'start' -and $calls[1].name -ceq 'interaction-Dynamic' -and $calls[1].duration -eq 31) 'Recorder не охватывает общий бюджет 30s с последним кадром.'
        Assert ($calls[2].kind -ceq 'gesture' -and $calls[2].count -eq 10) 'Gesture потерял исходный счётчик.'
        $closed = @($calls | Where-Object kind -CEQ 'close')
        Assert ($closed.Count -eq 1 -and [object]::ReferenceEquals($closed[0].tool, $captureRecording)) 'Recorder не освобождён ровно один раз.'
        if ($case -eq 'budget' -or $case.StartsWith('gesture')) {
            Assert ($null -eq $state.written -and $null -eq $state.asserted -and $calls.kind -cnotcontains 'finish') 'Recorder принят после отказа ввода.'
            if ($case -eq 'budget') { Assert ($escaped.Exception.Message.Contains('бюджет записи')) 'Истёкший бюджет отклонён другой причиной.' }
        } else {
            $savedWindow = $state.written
            Assert ($null -ne $savedWindow -and $savedWindow.clock -ceq 'harness-stopwatch-ms' -and
                $savedWindow.clockOriginTicks -ceq $clockOriginTicks -and $savedWindow.clockOriginUpperTicks -ceq $clockOriginUpperTicks -and
                $savedWindow.clockFrequency -eq [Diagnostics.Stopwatch]::Frequency -and $savedWindow.recordStartedMs -eq 100 -and
                $savedWindow.firstFrameReceivedMs -eq 150) 'Запись потеряла исходные часы и первый кадр.'
            Assert ($savedWindow.gestures.Count -eq 1 -and $savedWindow.gestures[0].name -ceq 'dynamic-space' -and
                $savedWindow.gestures[0].startedMs -eq 150 -and $savedWindow.gestures[0].completedMs -eq 200) 'Запись потеряла полный интервал gesture.'
            $finish = @($calls | Where-Object kind -CEQ 'finish')
            Assert ($finish.Count -eq 1 -and [object]::ReferenceEquals($finish[0].tool, $captureRecording) -and $finish[0].timeout -eq 61000) 'Recorder получил другой handle или неограниченный срок.'
            if (!$case.StartsWith('finish')) {
                Assert ($state.asserted.name -ceq 'interaction-Dynamic' -and
                    [object]::ReferenceEquals($state.asserted.record, $captureRecordResult) -and
                    ($state.asserted.names -join ',') -ceq 'dynamic-space') 'Frame validator потерял record или требуемый gesture.'
            }
        }
        if ($case -eq 'none') {
            Assert ($actual.Count -eq 1 -and [object]::ReferenceEquals($actual[0], $captureFinalResult) -and
                $actual[0].scenario -ceq 'dynamic-reduced-motion' -and [object]::ReferenceEquals($actual[0].space, $captureSpaceResult) -and
                $actual[0].source -ceq 'asserted-fixture') 'Результат потерял trace, receipt или исходную проверку recorder.'
        } elseif ($case -eq 'close') {
            Assert ($escaped.Exception.Message -ceq 'injected-recorder-close-failure') 'Ошибка cleanup после полезного результата потеряна.'
        } elseif ($case -ne 'budget') {
            Assert ([object]::ReferenceEquals($escaped.Exception, $primary)) 'Recorder cleanup заменил исходный отказ.'
            if ($case.EndsWith('-close')) { Assert ($primary.Data.Contains('winappCleanupError')) 'Вторичный отказ recorder потерян.' }
        }
    } $case
}
'Dynamic capture: PASS (31s recording, trace/timing preservation, bounded completion, primary cleanup error)'

class ClientAreaAnimation {
    static [bool] $Current = $false
    static [bool] $FailWrite = $false
    static [bool] $IgnoreWrite = $false
    static [Collections.Generic.List[string]] $Events = [Collections.Generic.List[string]]::new()
    static [void] Write([bool]$value) {
        [ClientAreaAnimation]::Events.Add('setting-write')
        if ([ClientAreaAnimation]::FailWrite) { throw [IO.IOException]::new('injected-setting-restore-failure') }
        if (![ClientAreaAnimation]::IgnoreWrite) { [ClientAreaAnimation]::Current = $value }
    }
    static [bool] Read() { [ClientAreaAnimation]::Events.Add('setting-read'); return [ClientAreaAnimation]::Current }
}
foreach ($case in @('closed', 'exited', 'alive', 'alive-primary', 'setting', 'setting-primary', 'readback', 'readback-primary', 'close-write', 'close-write-primary', 'setting-close-primary', 'setting-close')) {
    & {
        param($case)
        $primary = if ($case.EndsWith('-primary')) {
            [Management.Automation.ErrorRecord]::new([TimeoutException]::new('primary-dynamic-timeout'), 'dynamic-timeout',
                [Management.Automation.ErrorCategory]::OperationTimeout, $null)
        } else { $null }
        $smokeFailure = $primary; $DynamicMotion = $true; $saved = @{}; $close = @{}; $spaceChannel = $null
        $failCloseWrite = $case -in @('close-write', 'close-write-primary', 'setting-close-primary', 'setting-close')
        $animationBefore = $true; $commands = @(@{ name = 'fixture'; exitCode = 0 }); $output = [IO.Path]::GetTempPath()
        $app = 'own-fixture.exe'; $started = [DateTime]::UtcNow.AddMinutes(-1)
        [ClientAreaAnimation]::Events.Clear(); [ClientAreaAnimation]::Current = $false
        [ClientAreaAnimation]::FailWrite = $case.StartsWith('setting')
        [ClientAreaAnimation]::IgnoreWrite = $case.StartsWith('readback')
        $process = [pscustomobject]@{ Id = 3187; Path = $app; StartTime = $started; HasExited = ($case -eq 'exited');
            ExitCode = 0; RemainAlive = $case.StartsWith('alive') }
        $process | Add-Member ScriptMethod Refresh { }
        $process | Add-Member ScriptMethod CloseMainWindow {
            [ClientAreaAnimation]::Events.Add('process-close'); if (!$this.RemainAlive) { $this.HasExited = $true }; return $true
        }
        $process | Add-Member ScriptMethod WaitForExit { param($Timeout) return $this.HasExited }
        $process | Add-Member ScriptMethod Dispose { [ClientAreaAnimation]::Events.Add('process-dispose') }
        function Get-Process { param($Id, $ErrorAction) return $process }
        function Stop-Process { param($Id, [switch]$Force) throw [IO.IOException]::new('injected-process-still-alive') }
        function Set-Content {
            param([Parameter(Position = 0)][string]$Path, [string]$Encoding, [Parameter(ValueFromPipeline = $true)]$InputObject)
            process {
                if ($Path.EndsWith('close.json')) {
                    [ClientAreaAnimation]::Events.Add('close-write')
                    if ($failCloseWrite) { throw [IO.IOException]::new('injected-close-write-failure') }
                }
            }
        }
        $escaped = $null
        try { . $finalizer } catch { $escaped = $_ }
        $events = [ClientAreaAnimation]::Events
        if ($case.StartsWith('alive')) {
            Assert ($events -notcontains 'setting-write' -and $events -notcontains 'setting-read') 'Живой setter получил restore до подтверждённого exit.'
            Assert ($close.ContainsKey('animationCleanupError') -and !$close.ContainsKey('animation')) 'Пропущенный restore ошибочно объявлен завершённым.'
        } else {
            Assert ($events -contains 'setting-write') 'Завершённый consumer не разрешил restore.'
            Assert ($close.exited -eq $true -and $events.IndexOf('process-dispose') -lt $events.IndexOf('setting-write')) 'Restore обогнал завершение consumer.'
            if (!$case.StartsWith('setting')) {
                Assert ($events.IndexOf('setting-read') -gt $events.IndexOf('setting-write')) 'Restore не прочитан обратно.'
                if (!$case.StartsWith('readback')) { Assert ($close.animation.actual -eq $true -and [ClientAreaAnimation]::Current) 'Restore не подтверждён.' }
            }
        }
        if ($primary) {
            Assert ($null -eq $escaped -and [object]::ReferenceEquals($smokeFailure.Exception, $primary.Exception)) 'Cleanup заменил исходную ошибку.'
            Assert ($primary.Exception.Message -ceq 'primary-dynamic-timeout') 'Primary message потерян.'
            if ($case.StartsWith('setting') -or $case.StartsWith('alive') -or $case.StartsWith('readback')) {
                Assert ($primary.Exception.Data.Contains('animationCleanupError')) 'Secondary restore error потеряна.'
            }
            if ($failCloseWrite) { Assert ($primary.Exception.Data.Contains('closeWriteError')) 'Secondary close write error потеряна.' }
        } elseif ($case -in @('closed', 'exited')) {
            Assert ($null -eq $escaped) 'Здоровый cleanup отказал.'
        } else {
            Assert ($null -ne $escaped) 'Неуспешный cleanup объявлен успешным.'
            if ($case -eq 'setting-close') { Assert ($escaped.Exception.ToString().Contains('injected-setting-restore-failure')) 'Close write скрыл исходный restore failure.' }
        }
    } $case
}
'Dynamic cleanup: PASS (exit-before-restore, readback, primary error and secondary failures)'

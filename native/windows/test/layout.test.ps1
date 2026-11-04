param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$smokeFailure = $null
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Assert-Rejected([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action } catch { $failed = $true }
    Assert $failed $Message
}

$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput(
    [IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
Assert ($ast.ParamBlock.Parameters.Name.VariablePath.UserPath -contains 'ExpectedTextScale') 'Нет необязательного ожидаемого масштаба.'
$binding = [scriptblock]::Create($ast.ParamBlock.Extent.Text + "`nreturn `$ExpectedTextScale")
$arguments = @{ ApplicationDirectory = 'fixture-app'; OutputDirectory = 'fixture-output'; AnimationSettingsPath = 'fixture-settings.cs' }
Assert ($null -eq (& $binding @arguments)) 'Отсутствие ожидаемого масштаба превратилось в 100%.'
foreach ($scale in @(1.0, 1.25, 2.25)) {
    $bound = & $binding @arguments -ExpectedTextScale $scale
    Assert ($bound -is [double] -and $bound -eq $scale) 'Ожидаемый масштаб потерял числовой тип или значение.'
}
foreach ($scale in @(0, 0.99, 2.251, [double]::NaN, [double]::PositiveInfinity, [double]::NegativeInfinity)) {
    Assert-Rejected { & $binding @arguments -ExpectedTextScale $scale } "Принят недопустимый ожидаемый масштаб $scale."
}

$functions = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] })
foreach ($name in @('Test-LayoutNumber', 'Assert-LayoutBounds', 'Assert-LayoutObservation', 'Read-LayoutObservation')) {
    $definition = @($functions | Where-Object { $_.Name -eq $name })
    Assert ($definition.Count -eq 1) "Отсутствует исполняемая граница $name."
    . ([scriptblock]::Create($definition[0].Extent.Text))
}

$started = [DateTime]::UtcNow.AddMinutes(-1)
$epoch = ([DateTimeOffset]$started).ToUnixTimeMilliseconds()
$processFixture = [pscustomobject]@{ Id = 3187; StartTime = $started; HasExited = $false }
$processFixture | Add-Member ScriptMethod Refresh { }

# Эталон следует семи начальным кнопкам ButtonsPage, а не таблице validator.
function New-Observation([double]$Scale = 1.0) {
    $buttons = foreach ($entry in @(
        @('LabButtonSmall', 'Small', 'Button', $null),
        @('LabButtonMedium', 'Medium', 'Button', $null),
        @('LabButtonLarge', 'Large', 'Button', $null),
        @('LabButtonSmallDescription', 'Small', 'Button', 'Description'),
        @('LabButtonDescription', 'Medium', 'Добавить', 'файл'),
        @('LabButtonTrailingIcon', 'Medium', 'Открыть', $null),
        @('LabButtonDisabled', 'Medium', 'Недоступно', $null)
    )) {
        $texts = @(@{ part = 'PART_Label'; text = $entry[2] })
        if ($null -ne $entry[3]) { $texts += @{ part = 'PART_Description'; text = $entry[3] } }
        foreach ($text in $texts) {
            $text.bounds = @{ x = 52.0; y = 160.0; width = 70.0; height = 24.0 }
            $text.desiredWidth = 70.0
            $text.desiredHeight = 24.0
            $text.fontSize = 24.0
            $text.lineHeight = 20.0
            $text.lineStackingStrategy = 'MaxHeight'
            $text.isTextScaleFactorEnabled = $true
        }
        @{ automationId = $entry[0]; size = $entry[1]; isEnabled = $entry[0] -ne 'LabButtonDisabled';
           bounds = @{ x = 40.0; y = 144.0; width = 200.0; height = 56.0 }; texts = $texts }
    }
    return @{ schemaVersion = 1; pid = 3187; observedAtUnixMs = $epoch + 1000;
        textScaleFactor = $Scale; rasterizationScale = 1.5; theme = 'Light';
        page = @{ x = 0.0; y = 0.0; width = 1280.0; height = 800.0 }; buttons = @($buttons) } |
        ConvertTo-Json -Depth 10 | ConvertFrom-Json
}

foreach ($scale in @(1.0, 1.25, 2.25)) {
    $observation = New-Observation $scale
    Assert-LayoutObservation $observation $processFixture
    Assert-LayoutObservation $observation $processFixture $scale
    $other = if ($scale -eq 1) { 2.25 } else { 1.0 }
    Assert-Rejected { Assert-LayoutObservation $observation $processFixture $other } 'Несовпадение ожидаемого и наблюдаемого масштаба принято.'
    # Порядок обхода visual tree не меняет полноту независимого множества.
    for ($offset = 0; $offset -lt 7; $offset++) {
        $observation.buttons = @($observation.buttons[1..6]) + @($observation.buttons[0])
        foreach ($button in $observation.buttons) { [array]::Reverse($button.texts) }
        Assert-LayoutObservation $observation $processFixture
    }
}

# LineHeight=0 выбирает штатные метрики шрифта; измеренные размеры остаются положительными.
foreach ($lineHeight in @(0, [long]0, 0.0, 0.5, 20.0)) {
    $value = New-Observation
    foreach ($button in $value.buttons) {
        foreach ($text in $button.texts) { $text.lineHeight = $lineHeight }
    }
    Assert-LayoutObservation $value $processFixture
}

$mutations = @(
    { param($v) $v.schemaVersion = 2 },
    { param($v) $v.schemaVersion = '1' },
    { param($v) $v.pid = 3188 },
    { param($v) $v.pid = '3187' },
    { param($v) $v.pid = 3187.5 },
    { param($v) $v.observedAtUnixMs = $epoch - 1 },
    { param($v) $v.observedAtUnixMs = [DateTimeOffset]::UtcNow.AddMinutes(1).ToUnixTimeMilliseconds() },
    { param($v) $v.observedAtUnixMs = [string]$v.observedAtUnixMs },
    { param($v) $v.theme = '' },
    { param($v) $v.theme = 'Default' },
    { param($v) $v.buttons = @() },
    { param($v) $v.buttons = $v.buttons[0] },
    { param($v) $v.buttons += $v.buttons[0] },
    { param($v) $v.buttons[1] = $v.buttons[0] },
    { param($v) $v.buttons[0].automationId = 'LabThemeLight' },
    { param($v) $v.buttons[0].automationId = 'labbuttonsmall' },
    { param($v) $v.buttons[0].size = 'Large' },
    { param($v) $v.buttons[6].isEnabled = $true },
    { param($v) $v.buttons[0].isEnabled = 'true' },
    { param($v) $v.buttons[0].texts = @() },
    { param($v) $v.buttons[0].texts = $v.buttons[0].texts[0] },
    { param($v) $v.buttons[0].texts += $v.buttons[0].texts[0] },
    { param($v) $v.buttons[3].texts = @($v.buttons[3].texts[0]) },
    { param($v) $v.buttons[4].texts[1] = $v.buttons[4].texts[0] },
    { param($v) $v.buttons[0].texts[0].part = 'PART_Icon' },
    { param($v) $v.buttons[0].texts[0].text = '' },
    { param($v) $v.buttons[4].texts[1].text = 'другой текст' },
    { param($v) $v.buttons[0].texts[0].lineStackingStrategy = 'unknown' },
    { param($v) $v.buttons[0].texts[0].isTextScaleFactorEnabled = $false },
    { param($v) $v.buttons[0].texts[0].isTextScaleFactorEnabled = 'true' }
)
foreach ($mutation in $mutations) {
    $value = New-Observation
    & $mutation $value
    Assert-Rejected { Assert-LayoutObservation $value $processFixture } "Принят повреждённый layout: $mutation."
}
foreach ($field in @('schemaVersion', 'pid', 'observedAtUnixMs', 'textScaleFactor', 'rasterizationScale', 'theme', 'page', 'buttons')) {
    $value = New-Observation
    $value.PSObject.Properties.Remove($field)
    Assert-Rejected { Assert-LayoutObservation $value $processFixture } "Принято отсутствие $field."
}
foreach ($field in @('textScaleFactor', 'rasterizationScale')) {
    foreach ($bad in @($null, '1', $true, 0, -1, [double]::NaN, [double]::PositiveInfinity)) {
        $value = New-Observation
        $value.$field = $bad
        Assert-Rejected { Assert-LayoutObservation $value $processFixture } "Принято неверное число $field."
    }
}
foreach ($index in 0..6) {
    $value = New-Observation
    $value.buttons = @($value.buttons | Where-Object { $_.automationId -cne $value.buttons[$index].automationId })
    Assert-Rejected { Assert-LayoutObservation $value $processFixture } "Принята потеря кнопки $index."
}

# Повреждение любой геометрии или исходной текстовой метрики должно закрыть admission.
foreach ($target in @('page') + @(0..6 | ForEach-Object { "button:$_"; "label:$_" }) + @('description:3', 'description:4')) {
    foreach ($field in @('x', 'y', 'width', 'height', 'desiredWidth', 'desiredHeight', 'fontSize', 'lineHeight')) {
        if ($target -notmatch '^(label|description):' -and $field -notin @('x', 'y', 'width', 'height')) { continue }
        $bads = @($null, '12', $false, [double]::NaN, [double]::PositiveInfinity, [double]::NegativeInfinity)
        if ($field -eq 'lineHeight') { $bads += -1 }
        elseif ($field -notin @('x', 'y')) { $bads += @(0, -1) }
        foreach ($bad in $bads) {
            $value = New-Observation
            $parts = $target.Split(':')
            $element = if ($target -eq 'page') { $value } else { $value.buttons[[int]$parts[1]] }
            if ($parts[0] -in @('label', 'description')) { $element = $element.texts[[int]($parts[0] -eq 'description')] }
            $object = if ($target -eq 'page') { $value.page } elseif ($field -in @('x', 'y', 'width', 'height')) { $element.bounds } else { $element }
            $object.$field = $bad
            Assert-Rejected { Assert-LayoutObservation $value $processFixture } "Принята повреждённая геометрия $target.$field."
        }
    }
}

$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })[-1]
$statements = @($outer.Body.Statements)
$layoutIndex = -1
$inputIndex = -1
$resultIndex = -1
for ($i = 0; $i -lt $statements.Count; $i++) {
    $text = $statements[$i].Extent.Text
    if ($text -match '^\$initialLayout\s*=') { $layoutIndex = $i }
    if ($inputIndex -lt 0 -and $text -match '^Ui\s') { $inputIndex = $i }
    if ($text -match '^\$result\s*=') { $resultIndex = $i }
}
Assert ($layoutIndex -ge 0 -and $layoutIndex -lt $inputIndex) 'Layout admission отсутствует до первого ввода.'
Assert ($resultIndex -gt $inputIndex) 'Нет результата после сценария ввода.'
$admission = [scriptblock]::Create($statements[$layoutIndex].Extent.Text)
$publication = [scriptblock]::Create(($statements[$resultIndex..($statements.Count - 1)].Extent.Text -join "`n"))
$cleanup = [scriptblock]::Create($outer.Finally.Extent.Text.Substring(1, $outer.Finally.Extent.Text.Length - 2))
$saveEnvironment = [scriptblock]::Create((@($ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.ForEachStatementAst] -and $_.Extent.Text -match '\$saved\['
}).Extent.Text -join "`n"))
$setEnvironment = @($statements | Where-Object { $_.Extent.Text -match '^\$env:LABUI_LAYOUT_OBSERVATION\s*=' })
Assert ($setEnvironment.Count -eq 1) 'Нет единого включения layout probe.'
$layoutPath = @($ast.EndBlock.Statements | Where-Object { $_.Extent.Text -match '^\$layoutObservationPath\s*=' })
Assert ($layoutPath.Count -eq 1) 'Нет собственного пути layout observation.'

$output = Join-Path ([IO.Path]::GetTempPath()) ('labui-layout-contract-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $output | Out-Null
$previousLayoutEnv = [Environment]::GetEnvironmentVariable('LABUI_LAYOUT_OBSERVATION')
try {
    . ([scriptblock]::Create($layoutPath[0].Extent.Text))
    Assert ([IO.Path]::GetDirectoryName($layoutObservationPath) -ceq $output) 'Observation записывается вне output текущего запуска.'
    foreach ($mode in @(@($true, $false), @($false, $false), @($true, $true))) {
        $AnimationsEnabled, $Lifetime = $mode
        $env:LABUI_LAYOUT_OBSERVATION = 'prior-layout-value'
        $saved = @{}
        . $saveEnvironment
        try {
            . ([scriptblock]::Create($setEnvironment[0].Extent.Text))
            Assert ($env:LABUI_LAYOUT_OBSERVATION -ceq $layoutObservationPath) 'Probe не включён в данном режиме.'
            foreach ($case in @('valid', 'auto-line-height', 'expected-scale', 'wrong-scale', 'near-scale', 'wrong-pid', 'stale', 'missing-scale', 'bad-geometry')) {
                $value = New-Observation 2.25
                switch ($case) {
                    'auto-line-height' { foreach ($button in $value.buttons) { foreach ($text in $button.texts) { $text.lineHeight = 0 } } }
                    'near-scale' { $value.textScaleFactor = 2.2499999 }
                    'wrong-pid' { $value.pid++ }
                    'stale' { $value.observedAtUnixMs = $epoch - 1 }
                    'missing-scale' { $value.PSObject.Properties.Remove('textScaleFactor') }
                    'bad-geometry' { $value.buttons[4].texts[1].bounds.height = 0 }
                }
                $value | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $layoutObservationPath -Encoding utf8
                $process = $processFixture
                $ExpectedTextScale = switch ($case) { 'expected-scale' { 2.25 }; 'near-scale' { 2.25 }; 'wrong-scale' { 1.0 }; default { $null } }
                $initialLayout = $null
                $failed = $false
                try { . $admission } catch { $failed = $true }
                Assert ($failed -eq ($case -notin @('valid', 'auto-line-height', 'expected-scale'))) "Настоящий reader/admission принял неверный результат: $case."
                if ($case -in @('valid', 'auto-line-height')) {
                    # Выполняется настоящий serializer result.json; GUI и настройки не запускаются.
                    $Lifetime = $false
                    $captures = @{}
                    $lowerControls = @{}
                    function node {
                        param($Validator, $Result, $Identity)
                        Assert ($Validator.EndsWith('space-observation.mjs')) 'Неизвестная внешняя проверка результата.'
                        Assert (Test-Path -LiteralPath $Result) 'Проверка Space запущена до сериализации.'
                        $script:LASTEXITCODE = 0
                    }
                    . $publication
                    $readback = Get-Content -LiteralPath (Join-Path $output 'result.json') -Raw | ConvertFrom-Json
                    Assert ($readback.initialLayout.textScaleFactor -eq 2.25) 'Result потерял фактический масштаб.'
                    Assert (($readback.initialLayout | ConvertTo-Json -Depth 10 -Compress) -ceq ($value | ConvertTo-Json -Depth 10 -Compress)) 'Result потерял полное исходное наблюдение.'
                    function Invoke-Lifetime($Path, $Process, [int]$Count) {
                        Assert ($Count -eq 9) 'Lifetime caller не сохранил две активации Space на тему.'
                        return @{ countBefore = $Count; countAfter = $Count + 1 }
                    }
                    $Lifetime = $true
                    $lifetimeObservationPath = 'fixture-lifetime.json'
                    . $publication
                    $readback = Get-Content -LiteralPath (Join-Path $output 'result.json') -Raw | ConvertFrom-Json
                    Assert ($readback.lifetime.countBefore -eq 9 -and $readback.lifetime.countAfter -eq 10) 'Result потерял lifetime caller.'
                }
            }
            $processFixture.HasExited = $true
            Assert-Rejected { Read-LayoutObservation $layoutObservationPath $processFixture } 'Принято наблюдение завершившегося процесса.'
            $processFixture.HasExited = $false
            Set-Content -LiteralPath $layoutObservationPath -Value '{broken-json' -Encoding utf8
            Assert-Rejected { Read-LayoutObservation $layoutObservationPath $processFixture } 'Принят повреждённый JSON.'
            Set-Content -LiteralPath $layoutObservationPath -Value (' ' * (64 * 1024 + 1)) -Encoding utf8
            Assert-Rejected { Read-LayoutObservation $layoutObservationPath $processFixture } 'Принят JSON сверх лимита.'
        } finally {
            $process = $null
            $spaceChannel = $null
            $animationBefore = $null
            $commands = @()
            $close = @{}
            . $cleanup
        }
        Assert ($env:LABUI_LAYOUT_OBSERVATION -ceq 'prior-layout-value') 'Layout env не восстановлен настоящим finally.'
    }
} finally {
    [Environment]::SetEnvironmentVariable('LABUI_LAYOUT_OBSERVATION', $previousLayoutEnv)
    Remove-Item -LiteralPath $output -Recurse -Force
}
'layout contract: PASS (identity, scale, complete targets, finite geometry, reader, result, environment)'

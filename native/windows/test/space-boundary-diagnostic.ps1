param(
    [Parameter(Mandatory)][string]$ApplicationDirectory,
    [Parameter(Mandatory)][string]$OutputPath,
    [Parameter(Mandatory)][string]$AnimationSettingsPath,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$Source,
    [switch]$Retarget
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'The boundary diagnostic requires an ephemeral GitHub hosted runner.'
}
if (Test-Path -LiteralPath $OutputPath) { throw 'The diagnostic output already exists.' }
$app = Join-Path ([IO.Path]::GetFullPath($ApplicationDirectory)) 'Buttons.exe'
$process = $null
$before = $null
$failure = $null
$cleanupFailure = $null
try {
    Add-Type -Path $AnimationSettingsPath
    $before = [ClientAreaAnimation]::Read()
    [ClientAreaAnimation]::Write($true)
    $start = [Diagnostics.ProcessStartInfo]::new($app)
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.WorkingDirectory = [IO.Path]::GetFullPath($ApplicationDirectory)
    $start.ArgumentList.Add('--space-boundary')
    $start.Environment['LABUI_SPACE_BOUNDARY_OUTPUT'] = [IO.Path]::GetFullPath($OutputPath)
    $start.Environment['LABUI_SPACE_BOUNDARY_SOURCE'] = $Source
    $start.Environment['LABUI_SPACE_BOUNDARY_RETARGET'] = $Retarget.IsPresent.ToString().ToLowerInvariant()
    $process = [Diagnostics.Process]::Start($start)
    # Existing 20s startup budget plus three initial/terminal pairs of 5s.
    if (!$process.WaitForExit(20000 + 3 * 2 * 5000)) { throw 'Boundary process did not finish in its bounded budget.' }
    $bytes = [IO.File]::ReadAllBytes([IO.Path]::GetFullPath($OutputPath))
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 256 * 1024) { throw 'Boundary evidence size is invalid.' }
    $json = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    $observation = $json | ConvertFrom-Json
    if ($observation.schemaVersion -ne 1 -or $observation.source -cne $Source -or $observation.pid -ne $process.Id) {
        throw 'Boundary evidence does not identify the executed source and process.'
    }
    Write-Output ('LABUI_SPACE_BOUNDARY_IDENTITY ' + (@{
        source = $Source; pid = $process.Id; exitCode = $process.ExitCode;
        appSha256 = (Get-FileHash -LiteralPath $app).Hash;
        consumerSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'Buttons.dll')).Hash;
        motionSha256 = (Get-FileHash -LiteralPath (Join-Path $ApplicationDirectory 'LabMotion.WinUI.dll')).Hash;
        observationSha256 = (Get-FileHash -LiteralPath $OutputPath).Hash
    } | ConvertTo-Json -Compress))
    Write-Output ('LABUI_SPACE_BOUNDARY_JSON ' + $json)
    if ($observation.passed -ne $true -or $process.ExitCode -ne 0) { throw 'Native boundary lifecycle failed; evidence is retained above.' }
} catch { $failure = $_.Exception }
finally {
    try {
        if ($null -ne $process -and !$process.HasExited) {
            $process.Kill($true)
            if (!$process.WaitForExit(5000)) { throw 'Owned boundary process did not exit during cleanup.' }
        }
    } catch { $cleanupFailure = $_.Exception }
    finally {
        if ($null -ne $process) { $process.Dispose() }
        try { if ($null -ne $before) { [ClientAreaAnimation]::Write($before) } }
        catch {
            $cleanupFailure = if ($cleanupFailure) {
                [AggregateException]::new('Process cleanup and animation restoration failed.', [Exception[]]@($cleanupFailure, $_.Exception))
            } else { $_.Exception }
        }
    }
}
if ($failure -and $cleanupFailure) { throw [AggregateException]::new('Boundary capture and cleanup failed.', [Exception[]]@($failure, $cleanupFailure)) }
if ($failure) { throw $failure }
if ($cleanupFailure) { throw $cleanupFailure }

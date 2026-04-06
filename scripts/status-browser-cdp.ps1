param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$wrapper = Join-Path $PSScriptRoot 'aios.ps1'

$passArgs = @()
if ($Args -and @($Args).Count -gt 0) {
  $passArgs = @($Args) | Where-Object { $_ -and $_.Trim() }
}

& $wrapper internal browser cdp-status @passArgs
exit $LASTEXITCODE

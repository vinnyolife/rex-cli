param(
  [switch]$Enable = $true,
  [switch]$Disable,
  [ValidateSet('regex', 'ollama', 'hybrid')]
  [string]$Mode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'privacy-guard.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Missing required command: node'
}

$args = @('init')
if ($Enable) {
  $args += '--enable'
}
if ($Disable) {
  $args += '--disable'
}
if ($Mode) {
  $args += @('--mode', $Mode)
}

$rendered = "node `"$scriptPath`" $($args -join ' ')"
Write-Host "+ $rendered"
& node $scriptPath @args
if ($LASTEXITCODE -ne 0) {
  throw 'privacy-guard init failed'
}

$configPath = if ($env:REXCIL_PRIVACY_CONFIG) {
  $env:REXCIL_PRIVACY_CONFIG
} elseif ($env:REXCIL_HOME) {
  Join-Path $env:REXCIL_HOME 'privacy-guard.json'
} else {
  Join-Path (Join-Path $HOME '.rexcil') 'privacy-guard.json'
}

Write-Host ""
Write-Host "================ Privacy Guard ================" -ForegroundColor Cyan
Write-Host "已默认启用隐私脱敏：命中 key/secret 的配置文件必须先走脱敏读取。" -ForegroundColor Yellow
Write-Host "Config: $configPath" -ForegroundColor Green
Write-Host ""
Write-Host "Strict status:"
Write-Host "  aios privacy status"
Write-Host "Strict read (required for config-like files):"
Write-Host "  aios privacy read --file <path>"
Write-Host ""
Write-Host "Optional local LLM (Ollama + qwen3.5:4b):"
Write-Host "  aios privacy ollama-on"
Write-Host "  # equivalent: node `"$scriptPath`" set --mode hybrid --ollama-enabled true --model qwen3.5:4b"
Write-Host ""
Write-Host "If you must disable temporarily:"
Write-Host "  aios privacy disable"
Write-Host "===============================================" -ForegroundColor Cyan

param([switch]$Build)

$ErrorActionPreference = 'Stop'

if (!$Build) {
    $loginUrl = 'http://127.0.0.1:5174/login'
    Write-Host 'DCPCoreXWeb: checking Vite'
    try {
        $page = Invoke-WebRequest -Uri $loginUrl -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0
    } catch {
        $page = $null
    }
    if ($page -and $page.StatusCode -eq 200 -and $page.Content.Contains('/@vite/client') -and
        $page.Content.Contains('<title>DCPCoreX</title>')) {
        Write-Host 'DCPCoreXWeb: Vite already running'
        exit 0
    }
}

$nodePath = (Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue).Source
if (!$nodePath) {
    $runtime = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' |
        Sort-Object Version -Descending | Select-Object -First 1
    if ($runtime) {
        $nodePath = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'
    }
}
if (!$nodePath -or !(Test-Path -LiteralPath $nodePath -PathType Leaf)) {
    throw 'Node.js was not found on PATH or in the installed Codex runtime.'
}

$workspacePath = Split-Path -Parent $PSScriptRoot
$vitePath = Join-Path $workspacePath 'node_modules\vite\bin\vite.js'
if (!(Test-Path -LiteralPath $vitePath -PathType Leaf)) {
    throw 'Vite is missing from node_modules. Install the project dependencies first.'
}

if ($Build) {
    Push-Location -LiteralPath $workspacePath
    try {
        & $nodePath $vitePath build
        exit $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

& $nodePath $vitePath --host 127.0.0.1 --port 5174 --strictPort
exit $LASTEXITCODE

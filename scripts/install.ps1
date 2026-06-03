# Install cocosmcp MCP (Cursor) + Creator extension
# Usage:
#   .\scripts\install.ps1 -ProjectRoot D:\UGit\proj-l-client-candy
#   .\scripts\install.ps1 -ProjectRoot D:\proj -ExtensionGlobal -CursorProfile workflow
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [string]$RepoRoot = "",
    [string]$IrRoot = "",
    [ValidateSet("minimal", "workflow", "admin", "all")]
    [string]$CursorProfile = "minimal",
    [ValidateSet("global", "project")]
    [string]$CursorTarget = "global",
    [ValidateSet("global", "project", "none")]
    [string]$ExtensionMode = "global",
    [switch]$ExtensionLink,
    [switch]$DryRun,
    [switch]$SkipBuild,
    [switch]$CursorOnly,
    [switch]$ExtensionOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = if ($RepoRoot) { $RepoRoot } else { Resolve-Path (Join-Path $ScriptDir "..") }

function Invoke-InstallNode {
    param([string[]]$Args)
    & node @Args
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$common = @("--repo", $Repo)
if ($DryRun) { $common += "--dry-run" }

if (-not $ExtensionOnly) {
    $cursorArgs = @(
        (Join-Path $ScriptDir "install-cursor.mjs"),
        "--project-root", (Resolve-Path $ProjectRoot),
        "--profile", $CursorProfile,
        "--target", $CursorTarget
    ) + $common
    if ($IrRoot) {
        $cursorArgs += @("--ir-root", $IrRoot)
    }
    Write-Host "==> Cursor MCP" -ForegroundColor Cyan
    Invoke-InstallNode $cursorArgs
}

if (-not $CursorOnly -and $ExtensionMode -ne "none") {
    $extArgs = @(
        (Join-Path $ScriptDir "install-extension.mjs"),
        "--mode", $ExtensionMode,
        "--project-root", (Resolve-Path $ProjectRoot)
    ) + $common
    if ($ExtensionLink) { $extArgs += "--link" }
    if ($SkipBuild) { $extArgs += "--skip-build" }
    Write-Host "==> Creator extension ($ExtensionMode)" -ForegroundColor Cyan
    Invoke-InstallNode $extArgs
}

Write-Host "Done." -ForegroundColor Green

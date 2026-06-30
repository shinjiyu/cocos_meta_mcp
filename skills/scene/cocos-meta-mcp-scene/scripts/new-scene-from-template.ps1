# Copy a Cocos .scene from template with text replacements; create .meta if missing.
# Usage:
#   .\new-scene-from-template.ps1 `
#     -RepoRoot D:\path\to\your-cocos-project `
#     -TemplateScene assets/scene/test/Template.scene `
#     -DestScene assets/scene/test/MyTest.scene `
#     -Replace @{ 'Template' = 'MyTest'; 'test/template/manifest' = 'test/my_test/manifest' }
#
# Optional script swap (compressed __type__ in .scene JSON):
#   -ScriptFromType <fromCompressed> -ScriptToType <toCompressed>

param(
    [Parameter(Mandatory = $true)]
    [string]$TemplateScene,
    [Parameter(Mandatory = $true)]
    [string]$DestScene,
    [string]$RepoRoot = '',
    [hashtable]$Replace = @{},
    [string]$ScriptFromType = '',
    [string]$ScriptToType = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
    $RepoRoot = (Get-Location).Path
}
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

function Resolve-ProjectPath([string]$RelOrAbs) {
    if ([System.IO.Path]::IsPathRooted($RelOrAbs)) {
        return [System.IO.Path]::GetFullPath($RelOrAbs)
    }
    return Join-Path $RepoRoot ($RelOrAbs -replace '/', '\')
}

$src = Resolve-ProjectPath $TemplateScene
$dst = Resolve-ProjectPath $DestScene
$dstMeta = "$dst.meta"

if (-not (Test-Path $src)) {
    Write-Error "Template not found: $src"
}
if ((Test-Path $dst) -and -not $Force) {
    Write-Error "Dest exists (use -Force): $dst"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$text = [System.IO.File]::ReadAllText($src)

foreach ($key in $Replace.Keys) {
    $text = $text.Replace([string]$key, [string]$Replace[$key])
}
if ($ScriptFromType -and $ScriptToType) {
    $text = $text.Replace($ScriptFromType, $ScriptToType)
}

$destDir = Split-Path $dst -Parent
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}
[System.IO.File]::WriteAllText($dst, $text, $utf8NoBom)
Write-Host "Scene -> $dst"

if (-not (Test-Path $dstMeta)) {
    $newUuid = [guid]::NewGuid().ToString()
    $metaJson = @"
{
  "ver": "1.1.50",
  "importer": "scene",
  "imported": true,
  "uuid": "$newUuid",
  "files": [
    ".json"
  ],
  "subMetas": {},
  "userData": {}
}
"@
    [System.IO.File]::WriteAllText($dstMeta, $metaJson, $utf8NoBom)
    Write-Host "Meta  -> $dstMeta (uuid=$newUuid)"
} else {
    Write-Host "Meta  -> $dstMeta (kept existing)"
}

Write-Host "Next: refresh assets in Creator, then open $DestScene"

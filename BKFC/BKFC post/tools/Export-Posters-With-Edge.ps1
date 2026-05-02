$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$HtmlDir = Join-Path $Root "html"
$ExportDir = Join-Path $Root "exports"
New-Item -ItemType Directory -Force -Path $ExportDir | Out-Null

$Candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$Browser = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Browser) {
  throw "Could not find Microsoft Edge or Google Chrome. Open the HTML manually and screenshot/export instead."
}

Get-ChildItem $HtmlDir -Filter "*.html" | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $out = Join-Path $ExportDir ($name + ".png")
  $url = "file:///" + ($_.FullName -replace "\\","/")
  & $Browser --headless --disable-gpu --hide-scrollbars --screenshot="$out" --window-size=1080,1350 "$url" | Out-Null
  Write-Host "Exported $out"
}

Write-Host ""
Write-Host "Done. PNG poster exports are in: $ExportDir"

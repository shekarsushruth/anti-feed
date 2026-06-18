# publish.ps1 — commit the current edition and push to GitHub Pages.
# First-time setup steps are in README.md. After that, the daily job just runs this.
#
#   powershell -ExecutionPolicy Bypass -File publish.ps1
#
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".git")) {
    Write-Error "No git repo here yet. Do the one-time setup in README.md first."
    exit 1
}

git add index.html edition.json edition.js
# Nothing staged => nothing to publish; exit quietly so the scheduler doesn't error.
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No changes to publish."
    exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "edition: $stamp"
git push origin main
Write-Host "Published edition $stamp."

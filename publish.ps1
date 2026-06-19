# publish.ps1 -- commit the current edition and push to GitHub Pages.
# First-time setup steps are in README.md. After that, the daily job just runs this.
#
#   powershell -ExecutionPolicy Bypass -File publish.ps1
#
# Auth: reads a GitHub token (fine-grained PAT, Contents: write on this repo) from
#   1) the GITHUB_TOKEN environment variable, else
#   2) a local, gitignored .env file (GITHUB_TOKEN=...).
# The token is used only at push time via a one-shot auth header; it is never
# written to .git/config, the remote URL, or any committed file.
#
# ASCII-only on purpose: PowerShell 5.1 reads .ps1 as ANSI, so non-ASCII bytes
# (em dashes etc.) corrupt the script. Keep this file plain ASCII.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# --- PUBLISH FREEZE (safety) ---------------------------------------------------
# Auto-publishing is intentionally frozen. This script will NOT commit or push
# unless an operator explicitly opts in for this run by setting ANTIFEED_PUBLISH=1.
# This prevents unattended/looping agents from overwriting the live site. When you
# deliberately set up the real schedule, set the env var in that job, e.g.:
#   $env:ANTIFEED_PUBLISH = "1"; powershell -ExecutionPolicy Bypass -File publish.ps1
if ($env:ANTIFEED_PUBLISH -ne "1") {
    Write-Host "publish.ps1 is FROZEN -- no commit, no push. Set ANTIFEED_PUBLISH=1 to publish deliberately."
    exit 3
}

if (-not (Test-Path ".git")) {
    Write-Error "No git repo here. Do the one-time setup in README.md first."
    exit 1
}

# --- resolve the push token: env var first, then .env ---
$token = $env:GITHUB_TOKEN
if (-not $token -and (Test-Path ".env")) {
    foreach ($line in Get-Content ".env") {
        if ($line -match '^\s*GITHUB_TOKEN\s*=\s*(.+?)\s*$') { $token = $matches[1].Trim() }
    }
}

git add index.html edition.json edition.js
# Nothing staged => nothing to publish; exit quietly so the scheduler does not error.
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No changes to publish."
    exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "edition: $stamp"

if ($token) {
    # GitHub HTTPS basic auth: base64("x-access-token:<token>"), passed as a one-shot
    # -c http.extraheader so the token is never stored in config or the remote URL.
    $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
    git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $b64" push origin main
} else {
    Write-Host "No GITHUB_TOKEN found (env or .env); falling back to ambient git credentials."
    git push origin main
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Push failed."
    exit 1
}
Write-Host "Published edition $stamp."

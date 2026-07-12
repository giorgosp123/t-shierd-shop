param(
    [string]$Message = "Update website"
)

$ErrorActionPreference = "Stop"

function Fail {
    param([string]$Text)
    Write-Host "ERROR: $Text" -ForegroundColor Red
    exit 1
}

$repoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoPath

if (-not (Test-Path ".git")) {
    Fail "No git repository found in this folder."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git is not installed or not in PATH."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fail "GitHub CLI (gh) is not installed or not in PATH."
}

$branch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
    Fail "Could not detect current branch."
}

$remote = (git remote).Trim()
if ([string]::IsNullOrWhiteSpace($remote)) {
    Fail "No remote configured. Add origin first."
}

$authCheck = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Fail "GitHub CLI is not authenticated. Run: gh auth login"
}

Write-Host "Adding files..." -ForegroundColor Cyan
git add .

$hasChanges = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($hasChanges)) {
    Write-Host "No new changes to publish." -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$finalMessage = "$Message ($timestamp)"

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m $finalMessage
if ($LASTEXITCODE -ne 0) {
    Fail "Commit failed."
}

Write-Host "Pushing to origin/$branch..." -ForegroundColor Cyan
git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Fail "Push failed."
}

$repoUrl = (gh repo view --json url -q .url).Trim()
$repoPathShort = $repoUrl -replace "^https://github.com/", "" -replace "/$", ""
$pagesUrl = "https://" + ($repoPathShort -replace "/", ".github.io/") + "/"

Write-Host "Published successfully." -ForegroundColor Green
Write-Host "Repository: $repoUrl"
Write-Host "Pages URL:  $pagesUrl"

[CmdletBinding()]
param(
  [string]$RepoRoot = "D:\mis-system",
  [string]$Server = "yaftom@15.204.60.67",
  [string]$ServerRepoRoot = "/home/yaftom/mis-system",
  [string]$BuildId = "",
  [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[deploy-frontend-live] $Message"
}

$repoGit = @("git", "-C", $RepoRoot)

$frontendDirty = & $repoGit[0] $repoGit[1] $repoGit[2] "status" "--short" "--" "mis-front"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to inspect local frontend git status."
}

if ($frontendDirty) {
  throw "Local frontend has uncommitted changes. Commit them first before live deploy.`n$frontendDirty"
}

$localHead = & $repoGit[0] $repoGit[1] $repoGit[2] "rev-parse" "--short" "HEAD"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to read local git HEAD."
}

if ([string]::IsNullOrWhiteSpace($BuildId)) {
  $BuildId = "release-$(Get-Date -Format 'yyyy-MM-dd')-$localHead"
}

$archivePath = Join-Path $env:TEMP "mis-front-$localHead.tar"
$serverScriptLocal = Join-Path $RepoRoot "scripts\deploy-frontend-server.sh"

if (-not (Test-Path $serverScriptLocal)) {
  throw "Missing server deploy script: $serverScriptLocal"
}

Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue

Write-Step "Creating frontend archive from local HEAD $localHead"
& $repoGit[0] $repoGit[1] $repoGit[2] "archive" "--format=tar" "--output=$archivePath" "HEAD" "mis-front"
if ($LASTEXITCODE -ne 0) {
  throw "git archive failed."
}

Write-Step "Uploading frontend archive to server"
scp $archivePath "$Server`:/tmp/mis-front-$localHead.tar"

Write-Step "Uploading server deploy script"
ssh $Server "mkdir -p $ServerRepoRoot/scripts"
scp $serverScriptLocal "$Server`:$ServerRepoRoot/scripts/deploy-frontend-server.sh"

Write-Step "Extracting archive on server"
ssh $Server "cd $ServerRepoRoot && tar -xf /tmp/mis-front-$localHead.tar && rm -f /tmp/mis-front-$localHead.tar && chmod +x $ServerRepoRoot/scripts/deploy-frontend-server.sh"

$runNpmInstall = if ($SkipNpmInstall) { "0" } else { "1" }

Write-Step "Running server deploy script"
ssh $Server "BUILD_ID='$BuildId' RUN_NPM_INSTALL='$runNpmInstall' REPO_ROOT='$ServerRepoRoot' bash '$ServerRepoRoot/scripts/deploy-frontend-server.sh'"

Write-Step "Live frontend deploy finished"

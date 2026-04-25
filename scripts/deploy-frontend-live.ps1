[CmdletBinding()]
param(
  [string]$RepoRoot = "D:\mis-system",
  [string]$Server = "yaftom@15.204.60.67",
  [string]$ServerRepoRoot = "/home/yaftom/mis-system",
  [string]$BuildId = "",
  [switch]$SkipNpmInstall,
  [switch]$UseServerGitPull
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[deploy-frontend-live] $Message"
}

function Format-MB {
  param([long]$Bytes)
  return "{0:N1} MB" -f ($Bytes / 1MB)
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

$archivePath = Join-Path $env:TEMP "mis-front-$localHead.tar.gz"
$serverScriptLocal = Join-Path $RepoRoot "scripts\deploy-frontend-server.sh"

if (-not (Test-Path $serverScriptLocal)) {
  throw "Missing server deploy script: $serverScriptLocal"
}

Write-Step "Uploading server deploy script"
ssh $Server "mkdir -p $ServerRepoRoot/scripts"
scp $serverScriptLocal "$Server`:$ServerRepoRoot/scripts/deploy-frontend-server.sh"
ssh $Server "chmod +x $ServerRepoRoot/scripts/deploy-frontend-server.sh"

if (-not $UseServerGitPull) {
  Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue

  Write-Step "Creating compressed frontend archive from local HEAD $localHead"
  & $repoGit[0] $repoGit[1] $repoGit[2] "archive" "--format=tar.gz" "--output=$archivePath" "HEAD" "mis-front"
  if ($LASTEXITCODE -ne 0) {
    throw "git archive failed."
  }

  $archiveInfo = Get-Item $archivePath
  Write-Step "Archive size: $(Format-MB $archiveInfo.Length)"

  Write-Step "Uploading frontend archive to server"
  scp -C $archivePath "$Server`:/tmp/mis-front-$localHead.tar.gz"

  Write-Step "Extracting archive on server"
  ssh $Server "cd $ServerRepoRoot && tar -xzf /tmp/mis-front-$localHead.tar.gz && rm -f /tmp/mis-front-$localHead.tar.gz"
}

$runNpmInstall = if ($SkipNpmInstall) { "0" } else { "1" }
$doGitPull = if ($UseServerGitPull) { "1" } else { "0" }

Write-Step "Running server deploy script"
ssh $Server "BUILD_ID='$BuildId' RUN_NPM_INSTALL='$runNpmInstall' DO_GIT_PULL='$doGitPull' REPO_ROOT='$ServerRepoRoot' bash '$ServerRepoRoot/scripts/deploy-frontend-server.sh'"

Write-Step "Live frontend deploy finished"

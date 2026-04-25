#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/home/yaftom/mis-system}"
FRONTEND_DIR="$REPO_ROOT/mis-front"
APP_NAME="${APP_NAME:-mis-front}"
RUN_NPM_INSTALL="${RUN_NPM_INSTALL:-1}"
DO_GIT_PULL="${DO_GIT_PULL:-0}"
BUILD_ID_INPUT="${BUILD_ID:-}"

log() {
  printf '[deploy-frontend] %s\n' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

update_env_build_id() {
  local env_file="$1"
  local build_id="$2"

  if [ ! -f "$env_file" ]; then
    printf 'Expected env file not found: %s\n' "$env_file" >&2
    exit 1
  fi

  if grep -q '^APP_BUILD_ID=' "$env_file"; then
    sed -i "s/^APP_BUILD_ID=.*/APP_BUILD_ID=$build_id/" "$env_file"
  else
    printf '\nAPP_BUILD_ID=%s\n' "$build_id" >>"$env_file"
  fi
}

restore_compatibility_chunks() {
  local login_html="$FRONTEND_DIR/.next/server/app/login.html"
  local current_layout
  local current_login

  if [ ! -f "$login_html" ]; then
    printf 'Cannot find login.html after build: %s\n' "$login_html" >&2
    exit 1
  fi

  current_layout="$(strings "$login_html" | grep -o 'app/layout-[a-z0-9]*\.js' | head -n1 || true)"
  current_login="$(strings "$login_html" | grep -o 'app/(auth)/login/page-[a-z0-9]*\.js' | head -n1 || true)"

  if [ -z "$current_layout" ] || [ -z "$current_login" ]; then
    printf 'Could not detect current compatibility chunk targets.\n' >&2
    exit 1
  fi

  mkdir -p "$FRONTEND_DIR/.next/static/chunks/app/(auth)/login"
  cp "$FRONTEND_DIR/.next/static/chunks/$current_layout" \
    "$FRONTEND_DIR/.next/static/chunks/app/layout-18d47e90e58da309.js"
  cp "$FRONTEND_DIR/.next/static/chunks/$current_login" \
    "$FRONTEND_DIR/.next/static/chunks/app/(auth)/login/page-8bce6af12d4bf90d.js"

  log "Compatibility chunks restored: $current_layout and $current_login"
}

restart_frontend() {
  require_cmd uapi

  uapi PassengerApps disable_application "name=$APP_NAME" >/dev/null
  uapi PassengerApps enable_application "name=$APP_NAME" >/dev/null
  uapi NginxCaching clear_cache >/dev/null
  log "Passenger restarted and NGINX cache cleared"
}

maybe_git_pull() {
  if [ "$DO_GIT_PULL" != "1" ]; then
    return 0
  fi

  require_cmd git

  cd "$REPO_ROOT"

  if [ -n "$(git status --porcelain)" ]; then
    log "Repo has local changes; stashing before pull"
    git stash push -u -m "pre-deploy-$(date +%F-%H%M%S)" >/dev/null
  fi

  git pull origin main
}

main() {
  require_cmd git
  require_cmd npm
  require_cmd sed
  require_cmd strings

  maybe_git_pull

  cd "$REPO_ROOT"
  local git_sha
  git_sha="$(git rev-parse --short HEAD)"

  local build_id
  if [ -n "$BUILD_ID_INPUT" ]; then
    build_id="$BUILD_ID_INPUT"
  else
    build_id="release-$(date +%F)-$git_sha"
  fi

  log "Using build id: $build_id"
  update_env_build_id "$FRONTEND_DIR/.env" "$build_id"

  cd "$FRONTEND_DIR"

  if [ "$RUN_NPM_INSTALL" = "1" ]; then
    log "Running npm install"
    npm install
  else
    log "Skipping npm install"
  fi

  log "Building frontend"
  npm run build

  restore_compatibility_chunks
  restart_frontend

  log "Frontend deploy complete"
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

KEY_PATH="${1:-$HOME/.ssh/github_mis}"
EMAIL_LABEL="${2:-yaftom-server}"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$KEY_PATH" ]; then
  printf 'Deploy key already exists: %s\n' "$KEY_PATH"
else
  ssh-keygen -t ed25519 -C "$EMAIL_LABEL" -f "$KEY_PATH" -N ""
fi

if ! grep -q "Host github.com" "$HOME/.ssh/config" 2>/dev/null; then
  cat >>"$HOME/.ssh/config" <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile $KEY_PATH
  IdentitiesOnly yes
EOF
  chmod 600 "$HOME/.ssh/config"
fi

printf '\nAdd this public key to GitHub Deploy Keys for yaftomictsolution/mis-system:\n\n'
cat "$KEY_PATH.pub"
printf '\n'

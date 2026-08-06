#!/bin/zsh
# C1 THE NIGHT WATCHMAN — the LaunchAgent entry. Runs the signed contract cycle at 03:00.
# launchd hands us a bare environment, so we set cwd + PATH ourselves and export ONLY the
# SMTP credentials from .env (nothing else) so the mailer can arm once the operator adds an
# app-specific password. Until then the contract is log-only and nothing is sent.
cd /Users/vishnumovva/vulcan || exit 1
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [ -f .env ]; then
  U="$(grep -E '^VULCAN_SMTP_USER=' .env | tail -1 | cut -d= -f2-)"
  P="$(grep -E '^VULCAN_SMTP_PASS=' .env | tail -1 | cut -d= -f2-)"
  [ -n "$U" ] && export VULCAN_SMTP_USER="$U"
  [ -n "$P" ] && export VULCAN_SMTP_PASS="$P"
fi

exec /opt/homebrew/bin/node contracts/runner.mjs --contract night-watchman

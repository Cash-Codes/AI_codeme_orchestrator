#!/bin/sh
set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  if [ ! -f /root/.claude/.credentials.json ]; then
    echo "[entrypoint] No ANTHROPIC_API_KEY and no stored credentials — running claude login"
    claude login
  else
    echo "[entrypoint] Using stored Claude credentials"
  fi
else
  echo "[entrypoint] Using ANTHROPIC_API_KEY"
fi

exec node dist/server.js

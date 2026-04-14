#!/bin/sh
set -e

if [ ! -f /root/.claude/.credentials.json ]; then
  echo "[entrypoint] No stored Claude credentials — running claude login"
  claude login
else
  echo "[entrypoint] Using stored Claude credentials"
fi

exec node dist/server.js

#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install dependencies (uses cache on subsequent runs)
cd "$CLAUDE_PROJECT_DIR"
npm install

# Start the Next.js dev server in the background
npm run dev &

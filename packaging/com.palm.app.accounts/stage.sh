#!/bin/bash
# stage.sh — package the WHOLE com.palm.app.accounts app (not just the patched files) as its own
# ipk. This repo is the single source of truth for the app; postinst replaces the real stock
# /usr/palm/applications/com.palm.app.accounts wholesale (backing it up first) rather than
# patching individual files, so a fresh install and an upgrade always converge on exactly what's
# committed here.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/com.palm.app.accounts" /usr/palm/applications/com.palm.app.accounts com.palm.app.accounts

echo "com.palm.app.accounts stage complete: $STAGE"

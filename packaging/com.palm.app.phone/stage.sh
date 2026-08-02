#!/bin/bash
# stage.sh — package the WHOLE com.palm.app.phone app (not just the patched files) as its own ipk.
# See packaging/com.palm.app.accounts/stage.sh for the full reasoning (same pattern).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/com.palm.app.phone" /usr/palm/applications/com.palm.app.phone com.palm.app.phone

echo "com.palm.app.phone stage complete: $STAGE"

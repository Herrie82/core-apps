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

# db/kinds and db/permissions ship harmlessly into $DST above too (inert there, db8 never scans an
# app's own directory) -- provision them to their real, system-wide db8 location as well. See
# stage_db8_schema's comment in common.sh: these were stock-shipped OUTSIDE this app's own directory
# and got silently deleted by installing our repackaged ipk as a stock upgrade.
stage_db8_schema "$REPO/com.palm.app.phone/db/kinds" "$REPO/com.palm.app.phone/db/permissions" com.palm.app.phone

echo "com.palm.app.phone stage complete: $STAGE"

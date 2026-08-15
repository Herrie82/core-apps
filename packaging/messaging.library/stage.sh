#!/bin/bash
# stage.sh — package the WHOLE messaging.library framework as its own ipk. Same pattern as the app
# packages (see packaging/com.palm.app.accounts/stage.sh): this repo is the single source of
# truth, postinst replaces /usr/palm/frameworks/messaging.library wholesale.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/messaging.library" /usr/palm/frameworks/messaging.library messaging.library

echo "messaging.library stage complete: $STAGE"

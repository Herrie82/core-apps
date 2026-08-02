#!/bin/bash
# stage.sh — package the WHOLE contacts.plugin.messaging framework as its own ipk. Same pattern as
# the app packages (see packaging/com.palm.app.accounts/stage.sh): this repo is the single source
# of truth, postinst replaces /usr/palm/frameworks/contacts.plugin.messaging wholesale.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/contacts.plugin.messaging" /usr/palm/frameworks/contacts.plugin.messaging contacts.plugin.messaging

echo "contacts.plugin.messaging stage complete: $STAGE"

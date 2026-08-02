#!/bin/bash
# stage.sh — package the WHOLE com.palm.app.messaging app as its own ipk. This repo is the single
# source of truth (confirmed via full md5 manifest against the live device -- only difference was
# leftover *.webosinternals.orig backup cruft and dev-only tooling files, already excluded by
# stage_whole). The REAL on-device install path is under /media/cryptofs/apps/... (App Manager's
# path for an app upgraded post-install), NOT /usr/palm/applications/com.palm.app.messaging (that
# path still exists but is just a stub -- confirmed live, don't touch it).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/com.palm.app.messaging" /media/cryptofs/apps/usr/palm/applications/com.palm.app.messaging com.palm.app.messaging

echo "com.palm.app.messaging stage complete: $STAGE"

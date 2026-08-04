#!/bin/bash
# stage.sh — package the WHOLE com.palm.app.contacts app (not just the patched files) as its own
# ipk. This repo is the single source of truth for the app; postinst replaces it wholesale
# (backing it up first) rather than patching individual files, so a fresh install and an upgrade
# always converge on exactly what's committed here.
#
# Unlike every other app in this repo, the real destination is the OFFLINE-ROOT-prefixed path, not
# the direct /usr/palm/applications/com.palm.app.contacts one -- confirmed live (2026-08-04):
# palm://com.palm.applicationManager/getAppInfo for com.palm.app.contacts reports its "main" as
# file:///media/cryptofs/apps/usr/palm/applications/com.palm.app.contacts/..., and the direct path
# doesn't exist on-device at all (com.palm.app.phone/com.palm.app.accounts, by contrast, both
# genuinely live at their direct paths). Packaging this to the direct path like the others would
# silently do nothing -- the app registry would keep using the old, unpatched offline-root copy.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAGE="$1"
# shellcheck source=/dev/null
source "$REPO/packaging/lib/common.sh"

stage_whole "$REPO/com.palm.app.contacts" /media/cryptofs/apps/usr/palm/applications/com.palm.app.contacts com.palm.app.contacts

echo "com.palm.app.contacts stage complete: $STAGE"

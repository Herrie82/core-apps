#!/bin/bash
# deploy-core-apps.sh — deploy the FULL patched webOS core apps (Messaging, Contacts,
# Phone, Photos) to the connected TouchPad via novacom.
#
# WHY FULL APP (not a git-diff subset): the patches for these apps span many commits and
# touch whole subtrees (e.g. Messaging's app/servers/ Server tab + patched depends.js,
# Contacts' app/patches.js). A "deploy only the changed files" approach silently misses
# files added in older commits, leaving a half-patched app (no Server tab, unpatched
# Contacts). So we ship the entire app code tree.
#
# WHY `git archive HEAD` (not the working tree): a plain `cp` from the checkout ships any
# UNCOMMITTED WIP — which once shipped an incomplete reactions feature and broke reaction
# rendering on device. Deploying the committed HEAD guarantees a known-good state. Commit
# (or stash) your WIP first if you want it on device.
#
# Device app root — these are NOT all the same:
#   - Messaging/Contacts/Photos are OVERLAY-installed apps: they live at
#     /media/cryptofs/apps/usr/palm/applications/<appId>, an overlay that shadows the stock
#     rootfs app (wiped by an "Erase Apps & Data"/EraseVar reset — re-run this after a
#     recovery; see webos-synergy-revival memory device-reset-recovery).
#   - Phone is a STOCK ROOTFS app (see packaging/com.palm.app.phone/stage.sh, which has
#     always staged it straight to /usr/palm/applications/com.palm.app.phone) — the overlay
#     convention doesn't apply to it at all. Confirmed live: pushing phone-app fixes to the
#     overlay path silently no-op'd for an entire session (every "kind not registered"/video-
#     search debugging round was chasing a copy nothing was reading) before this was caught.
#     Deployed straight to the (normally read-only) rootfs instead, remounted rw first —
#     same as packaging/*/postinst scripts already do for their own rootfs writes.
set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
OVERLAY_APPS="com.palm.app.messaging com.palm.app.contacts com.palm.app.photos"
ROOTFS_APPS="com.palm.app.phone"
OVERLAY_ROOT=/media/cryptofs/apps/usr/palm/applications
ROOTFS_ROOT=/usr/palm/applications
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

STAGE="$TMP/stage"
stage_app() {  # $1 = app, $2 = device root (no trailing slash)
  local app="$1" devroot="$2"
  [ -d "$REPO/$app" ] || { echo "skip $app (not in repo)"; return; }
  echo "== staging $app from committed HEAD =="
  mkdir -p "$STAGE$devroot/$app"
  # committed tree only; excludes dev cruft + stock locale resources (already on device)
  ( cd "$REPO" && git archive HEAD -- "$app" ) | tar -x -C "$TMP"
  # copy the app payload, dropping test/build cruft to keep the push small
  ( cd "$TMP/$app" && tar -c \
      --exclude='spec' --exclude='tests' --exclude='mock/fixtures' \
      --exclude='Gemfile*' --exclude='Rakefile' --exclude='*.log' \
      --exclude='ci_build.sh' --exclude='jasminerunner.html' --exclude='index-desktop.html' \
      . ) | tar -x -C "$STAGE$devroot/$app"
  echo "   $(find "$STAGE$devroot/$app" -type f | wc -l) files"
}

for app in $OVERLAY_APPS; do stage_app "$app" "$OVERLAY_ROOT"; done
for app in $ROOTFS_APPS; do stage_app "$app" "$ROOTFS_ROOT"; done

TARBALL="$TMP/core-apps.tar.gz"
# tar everything staged (spans both the media/... overlay tree and the usr/... rootfs tree)
( cd "$STAGE" && tar czf "$TARBALL" . )
echo "== pushing $(du -h "$TARBALL" | cut -f1) to device =="
novacom put file:///media/internal/core-apps.tar.gz < "$TARBALL"

printf '%s\n' '
# Phone lands under /usr/palm/applications, which is read-only by default - remount rw
# first (harmless no-op for the Messaging/Contacts/Photos overlay paths).
mount -o remount,rw /dev/mapper/store-root / 2>/dev/null
mount -o remount,rw / 2>/dev/null
cd / && tar xzof /media/internal/core-apps.tar.gz 2>&1 | grep -v "utime\|change mode\|Read-only\|Error exit" || true
rm -f /media/internal/core-apps.tar.gz
# Reload cached app JS. Restarting LunaSysMgr alone is NOT reliable: WebAppMgr (the separate
# process that actually hosts app webviews) can survive a LunaSysMgr restart with its old
# in-memory JS still loaded - confirmed live, this cost an entire debugging session before
# being caught (the app kept running stale code despite every file on disk being correct).
# Killing WebAppMgr directly forces a genuine reload; LunaSysMgr respawns it.
set -- $(ps | grep WebAppMgr | grep -v grep)
WAM_PID="$1"
if [ -n "$WAM_PID" ]; then
  kill -9 "$WAM_PID"
else
  stop LunaSysMgr 2>/dev/null; start LunaSysMgr 2>/dev/null
fi
sleep 2
ps | grep -E "WebAppMgr|LunaSysMgr" | grep -v grep
echo "core-apps deployed + UI restarted"
' | novacom run file://bin/sh

echo "== done. Messaging (Server tab + reactions), Contacts (id-format), Phone (call picker), Photos =="

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
# Device app root: /media/cryptofs/apps/usr/palm/applications/<appId>   (the overlay that
# shadows the stock rootfs app; wiped by an "Erase Apps & Data"/EraseVar reset, so re-run
# this after a recovery — see webos-synergy-revival memory device-reset-recovery).
set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
APPS="com.palm.app.messaging com.palm.app.contacts com.palm.app.phone com.palm.app.photos"
DEVROOT=/media/cryptofs/apps/usr/palm/applications
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

STAGE="$TMP/stage"
for app in $APPS; do
  [ -d "$REPO/$app" ] || { echo "skip $app (not in repo)"; continue; }
  echo "== staging $app from committed HEAD =="
  mkdir -p "$STAGE$DEVROOT/$app"
  # committed tree only; excludes dev cruft + stock locale resources (already on device)
  ( cd "$REPO" && git archive HEAD -- "$app" ) | tar -x -C "$TMP"
  # copy the app payload, dropping test/build cruft to keep the push small
  ( cd "$TMP/$app" && tar -c \
      --exclude='spec' --exclude='tests' --exclude='mock/fixtures' \
      --exclude='Gemfile*' --exclude='Rakefile' --exclude='*.log' \
      --exclude='ci_build.sh' --exclude='jasminerunner.html' --exclude='index-desktop.html' \
      . ) | tar -x -C "$STAGE$DEVROOT/$app"
  echo "   $(find "$STAGE$DEVROOT/$app" -type f | wc -l) files"
done

TARBALL="$TMP/core-apps.tar.gz"
( cd "$STAGE" && tar czf "$TARBALL" ./media )
echo "== pushing $(du -h "$TARBALL" | cut -f1) to device =="
novacom put file:///media/internal/core-apps.tar.gz < "$TARBALL"

printf '%s\n' '
cd / && tar xzof /media/internal/core-apps.tar.gz 2>&1 | grep -v "utime\|change mode\|Read-only\|Error exit" || true
rm -f /media/internal/core-apps.tar.gz
# reload cached app JS
stop LunaSysMgr 2>/dev/null; sleep 1; start LunaSysMgr 2>/dev/null
echo "core-apps deployed + UI restarted"
' | novacom run file://bin/sh

echo "== done. Messaging (Server tab + reactions), Contacts (id-format), Phone (call picker), Photos =="

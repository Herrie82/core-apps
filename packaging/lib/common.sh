#!/bin/bash
# common.sh — shared staging helper for packaging/*/stage.sh scripts in this repo.
set -euo pipefail

# stage_whole <src-dir> <dest-absolute-path> <pkg-name>
# Stages an entire app/framework directory as the package payload (excluding dev-only cruft:
# tests, CI/build scripts, Ruby bundler files -- not part of the running app/framework), plus a
# dest.txt naming the real absolute path postinst/prerm replace. One ipk == one whole-directory
# replacement (not a surgical per-file patch): the repo is the single source of truth for this
# component, so shipping everything (not just recently-touched files) keeps a fresh install and an
# upgrade identical instead of depending on accumulated history.
#
# <pkg-name> scopes the staging path per package (/media/cryptofs/core-apps-overwrite/<pkg-name>/...)
# -- without this, every package's payload/appinfo.json, payload/depends.js, dest.txt etc. would
# all land at the exact same shared path, and ipkg treats two packages both shipping the same
# tracked filename as a hard conflict (confirmed live installing accounts then phone).
#
# Staged under /media/cryptofs, NOT /opt: /opt is on the root filesystem, which stock webOS boots
# READ-ONLY. ipkg extracts data.tar.gz itself, before postinst ever runs and gets a chance to
# remount root rw -- staging anywhere under root fails that extraction outright ("Read-only file
# system", confirmed live via Preware/WebOS Quick Install: postinst then reports "no dest.txt
# found" since nothing was ever written). /media/cryptofs is its own always-writable fuse mount
# regardless of root's ro/rw state (per the webos-mcp postinst-packaging doc's own convention of
# staging app payloads there), so ipkg's extraction always succeeds; postinst still remounts root
# rw itself before copying from there to the real (root-fs) destination.
stage_whole() {
  local src="$1" dst="$2" name="$3"
  [ -d "$src" ] || { echo "!! stage_whole: $src missing" >&2; exit 1; }
  local ov="$STAGE/media/cryptofs/core-apps-overwrite/$name"
  mkdir -p "$ov"
  echo "$dst" > "$ov/dest.txt"
  local excludes=(--exclude=spec --exclude=mock --exclude=test --exclude=Gemfile
    --exclude=Gemfile.lock --exclude=Rakefile --exclude=ci_build.sh --exclude=run_tests.sh
    --exclude=all-tests.json --exclude='.rvmrc' --exclude='.project')

  # Symlinks (e.g. a framework's version/1.0 -> ../submission/1.3) can't be staged through the
  # payload at all: /media/cryptofs is a FUSE mount that rejects symlink() outright ("Operation
  # not permitted", confirmed live installing messaging.library/contacts.plugin.messaging).
  # Record them separately and exclude their paths from the tar; postinst recreates them with a
  # real ln -s at the final (root-fs, symlink-capable) destination after extracting the payload.
  : > "$ov/symlinks.txt"
  local link relpath target
  while IFS= read -r -d '' link; do
    relpath="${link#"$src"/}"
    target="$(readlink "$link")"
    printf '%s\t%s\n' "$relpath" "$target" >> "$ov/symlinks.txt"
    excludes+=(--exclude="$relpath")
  done < <(find "$src" -type l -print0)

  # Ship the payload as ONE tarball, not thousands of loose files: confirmed live that ipkg's own
  # data.tar.gz extraction under -o offline-root mode is dramatically slower per-file than a plain
  # tar extraction of the identical content (com.palm.app.messaging's ~2800 files: ~139s via ipkg
  # vs ~34s via a single `tar xzf` of the same bytes) -- ipkg's own per-file bookkeeping, not raw
  # cryptofs FUSE throughput, is the bottleneck. Wrapping the payload in payload.tar.gz means ipkg
  # only ever extracts ONE file from data.tar.gz; postinst does the real many-small-files
  # extraction itself via plain tar, and can extract straight to the final destination instead of
  # extracting to $ov/payload/ and then cp -r'ing a second time.
  # --owner=0 --group=0: this is built on a dev machine under a regular user account, and GNU tar
  # on-device tries to restore the archive's recorded ownership on extraction as root by default --
  # confirmed live this fails per-file ("Cannot change ownership to uid 1000, gid 1000: Operation
  # not permitted" on cryptofs) and measurably slows extraction. Store everything as root instead
  # (postinst's --no-same-owner belt-and-suspenders the same fix on the extraction side).
  tar -C "$src" "${excludes[@]}" --owner=0 --group=0 -czf "$ov/payload.tar.gz" .
}

# stage_db8_schema <kinds-dir> <permissions-dir> <pkg-name>
# Provisions db8 kind/permission definitions to their real, SYSTEM-WIDE location
# (/etc/palm/db/kinds, /etc/palm/db/permissions) -- NOT inside this app's own
# /usr/palm/applications/<id>/ directory that stage_whole ships (db8 never scans that path at all).
#
# Confirmed live (2026-08-04): com.palm.app.phone's stock ipk shipped com.palm.callcapabilites,
# com.palm.carrierbook, com.palm.phonecall, com.palm.phonecallgroup, com.palm.vvm.mailbox,
# com.palm.vvm.voicemessages (kinds) and its own db/permissions/com.palm.app.phone entirely OUTSIDE
# /usr/palm/applications/com.palm.app.phone -- this packaging tree's stage_whole/postinst never
# declared them in its own manifest, so installing our whole-directory-replace ipk as an upgrade
# over stock silently deleted them via normal ipkg upgrade semantics (exact same root cause as the
# com.palm.service.accounts LS2-activation incident in app-services/packaging). Reuses the SAME
# per-package OV subdir stage_whole uses for this <pkg-name> so postinst applies it in one pass.
stage_db8_schema() {
  local kinds_dir="$1" perms_dir="$2" name="$3"
  local ov="$STAGE/media/cryptofs/core-apps-overwrite/$name"
  mkdir -p "$ov/db8-kinds" "$ov/db8-permissions"
  local f
  if [ -d "$kinds_dir" ]; then
    for f in "$kinds_dir"/*; do
      [ -f "$f" ] || continue
      cp "$f" "$ov/db8-kinds/$(basename "$f")"
    done
  fi
  if [ -d "$perms_dir" ]; then
    for f in "$perms_dir"/*; do
      [ -f "$f" ] || continue
      cp "$f" "$ov/db8-permissions/$(basename "$f")"
    done
  fi
}

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
  mkdir -p "$ov/payload"
  local excludes=(--exclude=spec --exclude=mock --exclude=test --exclude=Gemfile
    --exclude=Gemfile.lock --exclude=Rakefile --exclude=ci_build.sh --exclude=run_tests.sh
    --exclude=all-tests.json --exclude='.rvmrc' --exclude='.project')

  # Symlinks (e.g. a framework's version/1.0 -> ../submission/1.3) can't be staged through the
  # payload at all: /media/cryptofs is a FUSE mount that rejects symlink() outright ("Operation
  # not permitted", confirmed live installing messaging.library/contacts.plugin.messaging).
  # Record them separately and exclude their paths from the tar; postinst recreates them with a
  # real ln -s at the final (root-fs, symlink-capable) destination after copying the payload.
  : > "$ov/symlinks.txt"
  local link relpath target
  while IFS= read -r -d '' link; do
    relpath="${link#"$src"/}"
    target="$(readlink "$link")"
    printf '%s\t%s\n' "$relpath" "$target" >> "$ov/symlinks.txt"
    excludes+=(--exclude="$relpath")
  done < <(find "$src" -type l -print0)

  tar -C "$src" "${excludes[@]}" -cf - . \
    | tar -C "$ov/payload" -xf -
}

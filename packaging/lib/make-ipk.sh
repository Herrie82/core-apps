#!/bin/bash
# make-ipk.sh — turn a staged root-relative file tree into a real webOS .ipk.
#
# An .ipk is just `ar` of three members: debian-binary, control.tar.gz, data.tar.gz (see
# webos-mcp knowledge/postinst-packaging.md). palm-package only knows how to package a single
# app directory; Synergy connectors need files under /usr/palm/services, /usr/palm/public/accounts,
# /etc/palm/db, etc, so this builds the .ipk by hand instead.
#
# Usage: make-ipk.sh <package-dir> <stage-dir> <output-dir>
#   <package-dir>/control.env   required: PKG_ID, PKG_DESC; optional PKG_DEPENDS, PKG_REPLACES,
#                                PKG_CONFLICTS, PKG_MAINTAINER (defaults below). PKG_VERSION is
#                                only required here if <repo>/<PKG_ID>/appinfo.json doesn't exist --
#                                when it does, its own "version" field wins (see below), so don't
#                                set PKG_VERSION at all for app packages.
#   <package-dir>/preinst       optional: copied in as control.tar.gz's preinst (chmod 755) --
#                                ipkg runs this BEFORE unpacking data.tar.gz, which matters
#                                because stock webOS boots root read-only: without a preinst that
#                                remounts it rw first, ipkg's own extraction of data.tar.gz onto
#                                / silently fails ("Read-only file system") and postinst then
#                                reports "no dest.txt found" -- confirmed live, root cause of a
#                                real install failure via Preware/WebOS Quick Install.
#   <package-dir>/postinst      optional: copied in as control.tar.gz's postinst (chmod 755)
#   <package-dir>/prerm         optional: same, as prerm
#
# Installs via Preware / WebOS Quick Install, NOT palm-install (which runs postinst/prerm as a
# non-root user, i.e. not at all) — see packaging/README.md.
set -euo pipefail

PKGDIR="$1"; STAGE="$2"; OUT="$3"

[ -f "$PKGDIR/control.env" ] || { echo "!! $PKGDIR/control.env missing" >&2; exit 1; }
[ -d "$STAGE" ] || { echo "!! stage dir $STAGE missing" >&2; exit 1; }

# Resolve to absolute paths up front — everything below cd's around (into $WORK, into $STAGE),
# so a relative $OUT/$PKGDIR would otherwise resolve against the wrong directory.
PKGDIR="$(cd "$PKGDIR" && pwd)"
STAGE="$(cd "$STAGE" && pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# shellcheck source=/dev/null
source "$PKGDIR/control.env"
: "${PKG_ID:?PKG_ID not set in $PKGDIR/control.env}"
: "${PKG_DESC:?PKG_DESC not set in $PKGDIR/control.env}"

# Prefer the app's own appinfo.json "version" over a hand-maintained PKG_VERSION in control.env --
# webOS itself reads appinfo.json directly (it's what Preware/App Manager/Settings show as the
# app's version), so keeping a SEPARATE copy in control.env just invites drift with nothing to
# catch it (confirmed live: com.palm.app.phone's control.env said 3.1.1 while its own appinfo.json
# said 2.0.1, with nobody having a reason to notice). REPO/$PKG_ID matches every app package in
# this tree (stage.sh always stages "$REPO/$PKG_ID"), so this needs no per-package configuration.
# Packages with no appinfo.json (services, framework libs) just fall back to control.env as before.
REPO="$(cd "$PKGDIR/../.." && pwd)"
APPINFO="$REPO/$PKG_ID/appinfo.json"
if [ -f "$APPINFO" ]; then
  APPINFO_VERSION="$(node -e "try{process.stdout.write(String(require('$APPINFO').version||''))}catch(e){}" 2>/dev/null || true)"
  if [ -n "$APPINFO_VERSION" ]; then
    if [ -n "${PKG_VERSION:-}" ] && [ "$PKG_VERSION" != "$APPINFO_VERSION" ]; then
      echo "!! $PKGDIR/control.env's PKG_VERSION ($PKG_VERSION) differs from $APPINFO's version ($APPINFO_VERSION) -- using appinfo.json's, since that's what webOS itself reads. Remove PKG_VERSION from control.env to silence this." >&2
    fi
    PKG_VERSION="$APPINFO_VERSION"
  fi
fi
: "${PKG_VERSION:?PKG_VERSION not set in $PKGDIR/control.env and no $APPINFO to derive it from}"
PKG_MAINTAINER="${PKG_MAINTAINER:-Herman van Hazendonk <github.com@herrie.org>}"
PKG_ARCH="${PKG_ARCH:-armv7}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ---------------------------------------------------------------- control.tar.gz
mkdir -p "$WORK/ctrl"
{
  echo "Package: $PKG_ID"
  echo "Version: $PKG_VERSION"
  echo "Architecture: $PKG_ARCH"
  echo "Maintainer: $PKG_MAINTAINER"
  [ -n "${PKG_DEPENDS:-}" ] && echo "Depends: $PKG_DEPENDS"
  [ -n "${PKG_REPLACES:-}" ] && echo "Replaces: $PKG_REPLACES"
  [ -n "${PKG_CONFLICTS:-}" ] && echo "Conflicts: $PKG_CONFLICTS"
  echo "Description: $PKG_DESC"
} > "$WORK/ctrl/control"

# PREINST/POSTINST/PRERM env vars let a caller point at a shared script (e.g. one postinst reused
# by every cloud connector) instead of requiring a per-package copy; $PKGDIR/preinst|postinst|prerm
# wins if both a file and the env var somehow exist.
PREINST_SRC="${PKGDIR}/preinst"; [ -f "$PREINST_SRC" ] || PREINST_SRC="${PREINST:-}"
POSTINST_SRC="${PKGDIR}/postinst"; [ -f "$POSTINST_SRC" ] || POSTINST_SRC="${POSTINST:-}"
PRERM_SRC="${PKGDIR}/prerm"; [ -f "$PRERM_SRC" ] || PRERM_SRC="${PRERM:-}"

if [ -n "$PREINST_SRC" ] && [ -f "$PREINST_SRC" ]; then
  cp "$PREINST_SRC" "$WORK/ctrl/preinst"
  chmod 755 "$WORK/ctrl/preinst"
fi
if [ -n "$POSTINST_SRC" ] && [ -f "$POSTINST_SRC" ]; then
  cp "$POSTINST_SRC" "$WORK/ctrl/postinst"
  chmod 755 "$WORK/ctrl/postinst"
fi
if [ -n "$PRERM_SRC" ] && [ -f "$PRERM_SRC" ]; then
  cp "$PRERM_SRC" "$WORK/ctrl/prerm"
  chmod 755 "$WORK/ctrl/prerm"
fi

( cd "$WORK/ctrl" && tar -czf "$WORK/control.tar.gz" ./control $( [ -f preinst ] && echo ./preinst ) $( [ -f postinst ] && echo ./postinst ) $( [ -f prerm ] && echo ./prerm ) )

# ---------------------------------------------------------------- data.tar.gz
( cd "$STAGE" && tar -czf "$WORK/data.tar.gz" . )

# ---------------------------------------------------------------- debian-binary + ar
printf '2.0\n' > "$WORK/debian-binary"

mkdir -p "$OUT"
IPK="$OUT/${PKG_ID}_${PKG_VERSION}_all.ipk"
rm -f "$IPK"
# ---------------------------------------------------------------- pmPostInstall.script / pmPreRemove.script
# Preware / WebOS Quick Install don't actually run control.tar.gz's own postinst/prerm at all --
# confirmed live via /var/log/messages: ApplicationInstallerUtility invokes
# `ipkg -o /media/cryptofs/apps -force-overwrite install <ipk>`, and ipkg's own offline-root mode
# explicitly SKIPS running the package's postinst/prerm ("offline root mode: not running
# <pkg>.postinst"). Instead it runs a separate, older Palm-package convention: top-level ar
# members named pmPostInstall.script / pmPreRemove.script (siblings of control.tar.gz/data.tar.gz
# -- confirmed present in real stock ipks, e.g. com.palm.quickofficeservicegenerator's own
# pmPostInstall.script), copied out and run via `sh -c` after/before the ipkg step. Reuse the
# exact same postinst/prerm content here: the logic is identical either way, since the shared
# postinst/prerm this repo ships already check BOTH the direct-root and the
# /media/cryptofs/apps-prefixed offline-root location for their staged $OV.
[ -n "$POSTINST_SRC" ] && [ -f "$POSTINST_SRC" ] && cp "$POSTINST_SRC" "$WORK/pmPostInstall.script" && chmod 755 "$WORK/pmPostInstall.script"
[ -n "$PRERM_SRC" ] && [ -f "$PRERM_SRC" ] && cp "$PRERM_SRC" "$WORK/pmPreRemove.script" && chmod 755 "$WORK/pmPreRemove.script"

( cd "$WORK" && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz \
    $( [ -f pmPostInstall.script ] && echo pmPostInstall.script ) \
    $( [ -f pmPreRemove.script ] && echo pmPreRemove.script ) )

echo "built $IPK ($(du -h "$IPK" | cut -f1))"

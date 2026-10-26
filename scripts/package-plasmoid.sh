#!/usr/bin/env bash
# Builds a distributable .plasmoid archive from kde-plasmoid/.
#
# The archive keeps a version-independent file name so that
# https://github.com/<owner>/<repo>/releases/latest/download/<file> always points at
# the newest build. The version is still stored inside metadata.json.
#
# Usage:
#   scripts/package-plasmoid.sh [output-directory]

set -euo pipefail

PLUGIN_ID="io.github.akamusti.pomodoro"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/kde-plasmoid"
OUTPUT_DIR="${1:-$ROOT_DIR/dist}"

if [[ ! -f "$PACKAGE_DIR/metadata.json" ]]; then
    echo "Package metadata not found in $PACKAGE_DIR" >&2
    exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
    echo "zip is missing. Install it (for example: sudo dnf install zip) and retry." >&2
    exit 1
fi

VERSION="$(sed -n 's/^ *"Version": "\([^"]*\)".*/\1/p' "$PACKAGE_DIR/metadata.json" | head -n 1)"
if [[ -z "$VERSION" ]]; then
    echo "Could not read the version from $PACKAGE_DIR/metadata.json" >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
ARCHIVE="$OUTPUT_DIR/$PLUGIN_ID.plasmoid"

rm -f "$ARCHIVE"
(
    cd "$PACKAGE_DIR"
    zip -qr "$ARCHIVE" . -x '*.DS_Store' '__MACOSX/*' '*~'
)

echo "Built $ARCHIVE (version $VERSION)"
echo "Install it with: kpackagetool6 --type Plasma/Applet --install \"$ARCHIVE\""

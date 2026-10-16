#!/usr/bin/env bash
#
# Build the single-file Windows bridge: mrk-printer-bridge.exe
#
# The result needs NOTHING installed on the Windows PC — it is a copy of Node
# with this agent packed inside (Node's Single Executable Application support).
#
# Usage (from anywhere):
#     ./printer-bridge/build-sea.sh [DEFAULT_PRINTER_HOST] [DEFAULT_PRINTER_PORT]
#
# The default printer is baked into the exe; override it at run time with a
# config.local.json next to the exe or the PRINTER_HOST / PRINTER_PORT env vars.
#
# Requires: Node.js on PATH, and `npm install` already run in the repo root
# (for esbuild). Downloads the matching Windows node.exe (~35 MB) to a temp dir.
#
set -euo pipefail

DEFAULT_HOST="${1:-192.168.1.100}"
DEFAULT_PORT="${2:-9100}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../printer-bridge
REPO_ROOT="$(cd "$HERE/.." && pwd)"
ESBUILD="$REPO_ROOT/node_modules/.bin/esbuild"
OUT_DIR="$HERE/dist"
OUT_EXE="$OUT_DIR/mrk-printer-bridge.exe"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

NODE_V="$(node -v | tr -d 'v')"
echo "Building mrk-printer-bridge.exe  (Node $NODE_V, baked printer $DEFAULT_HOST:$DEFAULT_PORT)"

if [ ! -x "$ESBUILD" ]; then
  echo "ERROR: esbuild not found at $ESBUILD" >&2
  echo "       Run 'npm install' in the repository root first." >&2
  exit 1
fi

echo "  1/5 bundling src/sea-entry.js"
"$ESBUILD" "$HERE/src/sea-entry.js" \
  --bundle --platform=node --format=cjs \
  --loader:.ps1=text \
  --define:process.env.MRK_DEFAULT_PRINTER_HOST="\"$DEFAULT_HOST\"" \
  --define:process.env.MRK_DEFAULT_PRINTER_PORT="\"$DEFAULT_PORT\"" \
  --outfile="$BUILD_DIR/bundle.js"

echo "  2/5 downloading Windows node.exe (v$NODE_V)"
WIN_URL="https://nodejs.org/dist/v${NODE_V}/node-v${NODE_V}-win-x64.zip"
curl -fsSL "$WIN_URL" -o "$BUILD_DIR/node-win.zip"
unzip -o -q "$BUILD_DIR/node-win.zip" "node-v${NODE_V}-win-x64/node.exe" -d "$BUILD_DIR"
cp "$BUILD_DIR/node-v${NODE_V}-win-x64/node.exe" "$BUILD_DIR/node.exe"

echo "  3/5 generating SEA blob (cross-platform: no code cache / snapshot)"
cat > "$BUILD_DIR/sea-config.json" <<JSON
{
  "main": "$BUILD_DIR/bundle.js",
  "output": "$BUILD_DIR/sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": false
}
JSON
node --experimental-sea-config "$BUILD_DIR/sea-config.json"

echo "  4/5 injecting blob into the exe"
mkdir -p "$OUT_DIR"
cp "$BUILD_DIR/node.exe" "$OUT_EXE"
npx --yes postject "$OUT_EXE" NODE_SEA_BLOB "$BUILD_DIR/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

node "$HERE/tools/hide-console.js" "$OUT_EXE"

echo
echo "Done: $OUT_EXE ($(du -h "$OUT_EXE" | cut -f1))"
echo "Bake a different printer with: $0 <host> <port>"

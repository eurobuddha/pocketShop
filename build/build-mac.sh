#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pocket Shop Studio — macOS .app + .dmg builder
# Run from the project root: npm run build:mac
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="Pocket Shop Studio"
BINARY_NAME="pocketshop-studio"
VERSION="1.0.0"
OUT_DIR="$PROJECT_DIR/release"
APP_DIR="$OUT_DIR/$APP_NAME.app"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          Pocket Shop Studio — macOS build                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "❌  Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

cd "$PROJECT_DIR"

# Install @yao-pkg/pkg if not present
if ! npx --no-install @yao-pkg/pkg --version &> /dev/null 2>&1; then
    echo "📦  Installing @yao-pkg/pkg..."
    npm install --save-dev @yao-pkg/pkg
fi

# ── 2. Clean previous Mac release files ──────────────────────────────────────
rm -rf "$OUT_DIR/Pocket Shop Studio.app" "$OUT_DIR/PocketShop-Studio-"*".dmg"
mkdir -p "$OUT_DIR"
echo "✓  Output directory: $OUT_DIR"

# ── 3. Compile with pkg ───────────────────────────────────────────────────────
echo ""
echo "🔨  Compiling binary (this takes a minute on first run)..."

cat > "$PROJECT_DIR/pkg.config.json" << 'PKGEOF'
{
  "pkg": {
    "scripts": [
      "studio.js",
      "studio-builder.js"
    ],
    "assets": [
      "web/**/*",
      "pocketshop-shop/**/*",
      "mInbox/**/*"
    ]
  }
}
PKGEOF

npx @yao-pkg/pkg studio.js \
    --config pkg.config.json \
    --targets node22-macos-arm64 \
    --output "$OUT_DIR/$BINARY_NAME" \
    --compress GZip

rm -f "$PROJECT_DIR/pkg.config.json"

echo "✓  Binary compiled: $OUT_DIR/$BINARY_NAME"
chmod +x "$OUT_DIR/$BINARY_NAME"
echo "✓  Binary ready (arm64 — runs on Apple Silicon; Intel via Rosetta 2)"

# ── 4. Assemble .app bundle ───────────────────────────────────────────────────
echo ""
echo "📦  Assembling .app bundle..."

mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$OUT_DIR/$BINARY_NAME" "$APP_DIR/Contents/MacOS/$BINARY_NAME"
chmod +x "$APP_DIR/Contents/MacOS/$BINARY_NAME"

# Launcher shell script — keeps the process alive so macOS is happy
cat > "$APP_DIR/Contents/MacOS/launcher" << 'EOF'
#!/bin/bash
# Pocket Shop Studio launcher
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/pocketshop-studio"
EOF
chmod +x "$APP_DIR/Contents/MacOS/launcher"

cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$SCRIPT_DIR/icon.icns"  "$APP_DIR/Contents/Resources/icon.icns"
echo -n "APPLpkss" > "$APP_DIR/Contents/PkgInfo"

rm "$OUT_DIR/$BINARY_NAME"
echo "✓  .app bundle created: $APP_DIR"

# ── 5. Create .dmg staging folder ────────────────────────────────────────────
echo ""
echo "💿  Preparing .dmg..."

DMG_NAME="PocketShop-Studio-$VERSION.dmg"
DMG_PATH="$OUT_DIR/$DMG_NAME"
TMP_DMG_DIR="$OUT_DIR/dmg_staging"

mkdir -p "$TMP_DMG_DIR"
cp -R "$APP_DIR" "$TMP_DMG_DIR/"
ln -s /Applications "$TMP_DMG_DIR/Applications"

# ── 6. Sign and strip quarantine ──────────────────────────────────────────────
echo ""
echo "✍️   Signing app bundle (ad-hoc)..."
STAGED_APP="$TMP_DMG_DIR/$APP_NAME.app"
codesign --force --deep --sign - "$STAGED_APP" 2>&1
xattr -cr "$STAGED_APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP_DIR" 2>/dev/null || true
xattr -cr "$APP_DIR" 2>/dev/null || true
echo "✓  Signed and quarantine cleared"

# ── 7. Create .dmg ───────────────────────────────────────────────────────────
hdiutil create \
    -volname "Pocket Shop Studio" \
    -srcfolder "$TMP_DMG_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

rm -rf "$TMP_DMG_DIR"
echo "✓  DMG created: $DMG_PATH"

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║               ✅ Build Complete!                          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
printf "║  📦 App:  %-48s║\n" "$APP_NAME.app"
printf "║  💿 DMG:  %-48s║\n" "$DMG_NAME"
printf "║  📁 In:   %-48s║\n" "release/"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  To install:                                              ║"
echo "║    Open release/PocketShop-Studio-$VERSION.dmg             ║"
echo "║    Drag Pocket Shop Studio to Applications                  ║"
echo "║                                                           ║"
echo "║  First launch: right-click → Open (bypasses Gatekeeper)  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

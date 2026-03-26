#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pocket Shop Studio — Windows installer builder (runs on macOS)
# Prerequisites: brew install nsis imagemagick
# Usage: npm run build:win
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION="1.0.0"
NODE_VERSION="22.14.0"    # LTS
NODE_ZIP="node-v${NODE_VERSION}-win-x64.zip"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"
OUT_DIR="$PROJECT_DIR/release"
STAGING="$OUT_DIR/staging"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       Pocket Shop Studio — Windows build                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
if ! command -v makensis &> /dev/null; then
    echo "❌  makensis not found. Install with: brew install nsis"
    exit 1
fi

cd "$PROJECT_DIR"

# ── 2. Clean previous Windows release files only (preserve Mac .dmg) ─────────
rm -rf "$OUT_DIR/staging" "$OUT_DIR/PocketShop-Studio-"*"-Setup.exe"
mkdir -p "$OUT_DIR" "$STAGING"
echo "✓  Output directory: $OUT_DIR"

# ── 3. Download portable Node.js for Windows ──────────────────────────────────
echo ""
echo "📥  Downloading portable Node.js ${NODE_VERSION} for Windows..."
NODE_CACHE="$SCRIPT_DIR/.node-win-cache"
mkdir -p "$NODE_CACHE"

if [ ! -f "$NODE_CACHE/$NODE_ZIP" ]; then
    curl -L --progress-bar "$NODE_URL" -o "$NODE_CACHE/$NODE_ZIP"
    echo "✓  Downloaded: $NODE_ZIP"
else
    echo "✓  Using cached: $NODE_ZIP"
fi

# Extract node.exe from the zip
echo "    Extracting node.exe..."
unzip -p "$NODE_CACHE/$NODE_ZIP" "node-v${NODE_VERSION}-win-x64/node.exe" > "$STAGING/node.exe"
echo "✓  node.exe extracted"

# ── 4. Stage app source files ─────────────────────────────────────────────────
echo ""
echo "📦  Staging app source files..."

mkdir -p "$STAGING/web"
mkdir -p "$STAGING/pocketshop-shop"
mkdir -p "$STAGING/mInbox"

# Copy source files (studio.js and studio-builder.js live at root)
cp "$PROJECT_DIR/studio.js"         "$STAGING/"
cp "$PROJECT_DIR/studio-builder.js" "$STAGING/"

# Copy web UI
cp "$PROJECT_DIR/web/index.html"  "$STAGING/web/"
cp "$PROJECT_DIR/web/style.css"   "$STAGING/web/"
cp "$PROJECT_DIR/web/app.js"      "$STAGING/web/"

# Copy MiniDapp templates
cp -r "$PROJECT_DIR/pocketshop-shop/"  "$STAGING/pocketshop-shop/"
cp -r "$PROJECT_DIR/mInbox/"         "$STAGING/mInbox/"

# Install production dependencies via npm ci (resolves full transitive tree)
cp "$PROJECT_DIR/package.json"       "$STAGING/package.json"
cp "$PROJECT_DIR/package-lock.json"  "$STAGING/package-lock.json"
cd "$STAGING"
npm ci --omit=dev --silent
rm "$STAGING/package-lock.json"
cd "$PROJECT_DIR"

echo "✓  App files staged"

# ── 5. Generate icon.ico ──────────────────────────────────────────────────────
echo ""
echo "🎨  Generating icon..."
if [ ! -f "$SCRIPT_DIR/icon.ico" ]; then
    # Convert SVG → PNG first, then PNG → ICO
    MAGICK_CMD="magick"
    command -v magick &> /dev/null || MAGICK_CMD="convert"
    for size in 16 32 48 64 128 256; do
        $MAGICK_CMD -background none "$PROJECT_DIR/pocketshop-shop/icon.svg" -resize ${size}x${size} "/tmp/mfs_icon_${size}.png" 2>/dev/null
    done
    $MAGICK_CMD /tmp/mfs_icon_16.png /tmp/mfs_icon_32.png /tmp/mfs_icon_48.png \
        /tmp/mfs_icon_64.png /tmp/mfs_icon_128.png /tmp/mfs_icon_256.png \
        "$SCRIPT_DIR/icon.ico" 2>/dev/null
    rm -f /tmp/mfs_icon_{16,32,48,64,128,256}.png
fi
cp "$SCRIPT_DIR/icon.ico" "$STAGING/icon.ico"
echo "✓  icon.ico ready"

# ── 6. Build NSIS installer ───────────────────────────────────────────────────
echo ""
echo "🔨  Building NSIS installer..."

cd "$SCRIPT_DIR"
makensis installer.nsi
cd "$PROJECT_DIR"

INSTALLER="PocketShop-Studio-$VERSION-Setup.exe"
rm -rf "$STAGING"
echo "✓  Installer: $OUT_DIR/$INSTALLER"

# ── 7. Summary ────────────────────────────────────────────────────────────────
SIZE=$(du -sh "$OUT_DIR/$INSTALLER" | cut -f1)
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║               ✅ Build Complete!                          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
printf "║  🪟 %-55s║\n" "$INSTALLER  ($SIZE)"
printf "║  📁 %-55s║\n" "release/"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  To install on Windows:                                   ║"
echo "║    1. Double-click the Setup.exe                          ║"
echo "║    2. SmartScreen → More info → Run anyway                ║"
echo "║    3. One-click install — no admin, no Node.js needed     ║"
echo "║    4. Desktop shortcut launches the Studio                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

#!/bin/sh
# DeepSeek Harness Portable. Copyright 2026 Tsungloong.
# Bootstrap uses only host shell tools; no system Node is needed.
set -eu
TARGET=${1:?Usage: portable.sh target [command]}
shift
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
MANIFEST="$ROOT/scripts/manifest.json"
log() { printf '[portable] %s\n' "$*"; }
fail() { log "$*" >&2; exit 1; }
case "$TARGET:$(uname -s):$(uname -m)" in
    linux-x64:Linux:x86_64)
        if ldd --version 2>&1 | grep -qi musl; then fail '需要 glibc Linux / musl is not supported'; fi ;;
    macos-arm64:Darwin:arm64) ;;
    *) fail "不支持的平台 / Unsupported platform: $TARGET $(uname -sm)" ;;
esac
# Read named blocks in our pretty-printed manifest, not the first version.
field() {
    awk -v block="$1" -v key="$2" '
      $0 ~ "\"" block "\"[[:space:]]*:" { inside=1; next }
      inside && $0 ~ "\"" key "\"[[:space:]]*:" { split($0,a,"\""); print a[4]; exit }
      inside && /}/ { exit }
    ' "$MANIFEST"
}
VERSION=$(field node version)
URL=$(field "$TARGET" url)
HASH=$(field "$TARGET" sha256)
[ -n "$VERSION" ] && [ -n "$URL" ] && [ -n "$HASH" ] || fail 'Node manifest is incomplete'
RUNTIME="$ROOT/runtimes/$TARGET"
NODE="$RUNTIME/node/bin/node"
ACTUAL_VERSION=$("$NODE" --version 2>/dev/null || true)
if [ "$ACTUAL_VERSION" != "v$VERSION" ] || [ "${1:-}" = repair ]; then
    command -v xz >/dev/null 2>&1 || fail '请安装 xz-utils / xz is required to extract Node'
    ARCHIVE_DIR="$ROOT/packages/bootstrap/$TARGET"
    ARCHIVE="$ARCHIVE_DIR/node-$VERSION.tar.xz"
    STAGE="$ROOT/temp/node-$TARGET-$$"
    mkdir -p "$ARCHIVE_DIR" "$RUNTIME" "$ROOT/temp"
    mkdir "$RUNTIME/.node-lock" 2>/dev/null || fail "Node 安装正在进行；若已中断，删除 $RUNTIME/.node-lock 后重试"
    cleanup() {
        rm -rf "$STAGE"
        rmdir "$RUNTIME/.node-lock"
    }
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    download() {
        if command -v curl >/dev/null 2>&1; then
            curl -fL --connect-timeout 20 --retry 2 -C - --progress-bar -o "$ARCHIVE.part" "$1"
        elif command -v wget >/dev/null 2>&1; then
            wget -c -O "$ARCHIVE.part" "$1"
        else fail '需要 curl 或 wget / curl or wget is required'; fi
    }
    if [ ! -f "$ARCHIVE" ]; then
        log "下载 Node.js $VERSION / Downloading Node.js $VERSION"
        if ! download "$URL"; then
            MIRRORS=$(awk '/"mirrors"[[:space:]]*:/ {m=1} m && /https:/ {split($0,a,"\""); print a[2]} m && /}/ {exit}' "$MANIFEST")
            DONE=0
            for MIRROR in $MIRRORS; do
                if download "${MIRROR}${URL#https://nodejs.org/dist/}"; then DONE=1; break; fi
            done
            [ "$DONE" = 1 ] || fail '下载失败，请检查网络或 HTTPS_PROXY / Download failed; check network or HTTPS_PROXY'
        fi
        mv "$ARCHIVE.part" "$ARCHIVE"
    fi
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL=$(sha256sum "$ARCHIVE" | awk '{print $1}')
    else ACTUAL=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}'); fi
    if [ "$ACTUAL" != "$HASH" ]; then
        mv "$ARCHIVE" "$ARCHIVE.bad"
        fail "校验失败，已隔离 / Checksum mismatch, quarantined: $ARCHIVE.bad"
    fi
    log '解压 Node.js / Extracting Node.js'
    mkdir -p "$STAGE"
    # Omit the official CLI symlinks at extraction time, including on exFAT.
    # npm is invoked directly through its JavaScript entry.
    tar -xf "$ARCHIVE" -C "$STAGE" --exclude='*/bin/npm' --exclude='*/bin/npx' --exclude='*/bin/corepack'
    EXTRACTED=$(find "$STAGE" -mindepth 1 -maxdepth 1 -type d | head -1)
    [ -x "$EXTRACTED/bin/node" ] || fail 'Node archive layout is invalid'
    [ "$("$EXTRACTED/bin/node" --version)" = "v$VERSION" ] || fail 'Node version does not match manifest'
    # Old runtime is removed only after the staged one proved valid.
    rm -rf "$RUNTIME/node"
    mv "$EXTRACTED" "$RUNTIME/node"
    cleanup
    trap - EXIT INT TERM
fi
exec "$NODE" "$ROOT/scripts/portable.mjs" --root "$ROOT" --target "$TARGET" "$@"

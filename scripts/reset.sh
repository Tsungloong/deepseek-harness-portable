#!/bin/sh
# Reset mutable data, keeping models/ and launchers.
# Usage: ./scripts/reset.sh  (or via launcher: ./linux.sh reset)
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)

if [ -f "$ROOT/state/running.json" ]; then
  PID=$(sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$ROOT/state/running.json")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo '[portable] 请先退出工作台 / Stop the workbench before resetting'
    exit 1
  fi
fi
if [ -d "$ROOT/state/.setup-lock" ]; then
  echo '[portable] 安装正在进行 / Setup is active; stop it before resetting'
  exit 1
fi

DELETE_DIRS="data runtimes packages logs state temp"
KEEP_DIRS="models"
KEEP_FILES="windows.bat linux.sh mac.sh README.txt README.md README.en.md LICENSE NOTICE.md .gitignore"

echo "[portable] DeepSeek Harness Portable reset"
echo "[portable] 位置 / Location: $ROOT"
echo
echo "[portable] 将删除 / Will delete:"
for d in $DELETE_DIRS; do
  if [ -d "$ROOT/$d" ]; then
    echo "  $d/"
  fi
done
echo
echo "[portable] 将保留 / Will keep:"
for d in $KEEP_DIRS; do
  echo "  $d/"
done
for f in $KEEP_FILES; do
  if [ -f "$ROOT/$f" ]; then
    echo "  $f"
  fi
done
echo "  scripts/"
echo

printf "[portable] 确认删除？这不可恢复 / Confirm delete? This cannot be undone [y/N] "
read -r confirm || confirm=n
case "$confirm" in
  [Yy])
    ;;
  *)
    echo "[portable] 已取消 / Cancelled"
    exit 0
    ;;
esac

for d in $DELETE_DIRS; do
  if [ -d "$ROOT/$d" ]; then
    rm -rf "$ROOT/$d"
    echo "[portable] 已删除 / Deleted: $d/"
  fi
done

echo
echo "[portable] 重置完成 / Reset complete"
echo "[portable] 运行 setup 重新安装：./linux.sh setup"

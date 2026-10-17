#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
if [ "${1:-}" = reset ]; then exec sh "$ROOT/scripts/reset.sh"; fi
exec sh "$ROOT/scripts/portable.sh" linux-x64 "$@"

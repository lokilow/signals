#!/usr/bin/env bash
set -e

# Build uiua-gain using wasm-pack
# Output is placed in pkg/ directory

wasm-pack build \
  --target web \
  --out-dir pkg \
  --out-name uiua_gain \
  --no-typescript \
  --no-pack

echo "✓ uiua-gain built successfully"

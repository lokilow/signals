#!/usr/bin/env bash
set -e

# Build uiua-worklet using wasm-pack
# Output is placed in pkg/ directory

wasm-pack build \
  --target web \
  --out-dir pkg \
  --out-name uiua_worklet \
  --no-typescript \
  --no-pack

echo "✓ uiua-worklet built successfully"

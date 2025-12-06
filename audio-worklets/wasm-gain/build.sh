#!/usr/bin/env bash
set -e

# Build wasm-gain using wasm-pack
# Output is placed in pkg/ directory

wasm-pack build \
  --target web \
  --out-dir pkg \
  --out-name wasm_gain \
  --no-typescript \
  --no-pack

echo "✓ wasm-gain built successfully"

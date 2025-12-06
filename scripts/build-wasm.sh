#!/usr/bin/env bash
set -e

# Build all WASM worklets
echo "Building WASM worklets..."

cd audio-worklets/wasm-gain
./build.sh
cd ..

cd uiua-gain
./build.sh
cd ..

cd uiua-worklet
./build.sh
cd ../..

echo "✓ All WASM worklets built"

#!/usr/bin/env bash
set -e

# --- Configuration ---
WASM_PROJECT_ROOT="audio-worklets"
PUBLIC_WORKLETS_DIR="public/audio-worklets"
JS_PROCESSORS_SRC_DIR="src/audio/worklets"

# --- Main Logic ---

echo "Building and syncing WASM worklets..."

# 1. Clean previous public worklets output
echo "Cleaning $PUBLIC_WORKLETS_DIR..."
rm -rf "$PUBLIC_WORKLETS_DIR"
mkdir -p "$PUBLIC_WORKLETS_DIR"

# 2. Build all WASM projects
echo "Building WASM projects in $WASM_PROJECT_ROOT/..."
for project_dir in "$WASM_PROJECT_ROOT"/*/; do
  if [ -f "$project_dir/Cargo.toml" ]; then
    project_name=$(basename "$project_dir")
    echo "  -> Building $project_name..."
    (cd "$project_dir" && ./build.sh) # Execute build script within project dir
  fi
done

# 3. Copy WASM pkg artifacts to public worklets directory
echo "Copying WASM pkg artifacts to $PUBLIC_WORKLETS_DIR/..."
for project_dir in "$WASM_PROJECT_ROOT"/*/; do
  if [ -d "$project_dir/pkg" ]; then
    project_name=$(basename "$project_dir")
    mkdir -p "$PUBLIC_WORKLETS_DIR/$project_name" # Create sub-folder in public/ for pkg
    cp -r "$project_dir/pkg" "$PUBLIC_WORKLETS_DIR/$project_name/" # Copy pkg into public/project_name/
    echo "  -> Copied $project_name/pkg to $PUBLIC_WORKLETS_DIR/$project_name/pkg"
  fi
done

# 4. Copy JavaScript processor files to public worklets directory
echo "Copying JavaScript processor files from $JS_PROCESSORS_SRC_DIR/ to $PUBLIC_WORKLETS_DIR/..."
cp "$JS_PROCESSORS_SRC_DIR"/*.js "$PUBLIC_WORKLETS_DIR/"
echo "  -> Copied JS processors to $PUBLIC_WORKLETS_DIR/"

echo "✓ All WASM worklets and processors synced to public/"

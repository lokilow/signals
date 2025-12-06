# Audio Worklets

This directory contains Rust-based WASM audio processors for the Signals project.

## Structure

Each audio worklet is a separate Rust crate compiled to WebAssembly:

- `wasm-gain/` - Simple gain processor (foundation for future Uiua-based nodes)

## Building

### Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

```bash
# Install Rust target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Build Commands

```bash
# Build all worklets (from project root)
npm run build:wasm

# Build specific worklet
cd audio-worklets/wasm-gain
./build.sh
```

## Adding New Worklets

1. Create new crate in this directory
2. Add to workspace members in `Cargo.toml`
3. Add build script following `wasm-gain/build.sh` pattern
4. Update `scripts/build-wasm.sh` to include new worklet
5. Update `vite.config.ts` to copy new WASM files
6. Create AudioWorklet processor in `src/audio/worklets/`
7. Register in `src/audio/stages.ts`

## Future: Uiua Integration

This infrastructure is designed to support [Uiua](https://uiua.org) v0.17.2 as a Rust library for building audio processors. The `wasm-gain` worklet demonstrates the pattern that will be extended with Uiua-based signal processing.

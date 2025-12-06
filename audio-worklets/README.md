# Audio Worklets

This directory contains Rust-based WASM audio processors for the Signals project.

## Structure

- `wasm-gain/` - Simple gain processor (baseline Rust example)
- `uiua-worklet/` - Unified Uiua-based audio processor system

## Architecture: Unified Worklet System

The `uiua-worklet` crate provides a **single WASM binary** for all Uiua-based effects. Adding a new effect only requires writing a `.ua` file - no additional Rust code, build scripts, or configuration needed.

### How It Works

1. **Compile-time embedding**: The `define_worklet!` macro embeds `.ua` files at compile time using `include_str!`
2. **Single binary**: All Uiua effects share one WASM module (~6MB, 1.5MB gzipped)
3. **Runtime routing**: The AudioWorklet processor routes to different effects based on `workletType` parameter
4. **Simple additions**: New effects = new `.ua` file + one line in `lib.rs`

### Example: gain.ua

```uiua
# Gain worklet - multiply samples by gain value
# Stack: [samples gain]
# Result: [samples * gain]
×
```

That's it! The macro handles all the wasm-bindgen boilerplate.

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

cd audio-worklets/uiua-worklet
./build.sh
```

## Adding New Uiua Effects

### 1. Write the Uiua code

Create `audio-worklets/uiua-worklet/src/worklets/your-effect.ua`:

```uiua
# Your effect - describe what it does
# Stack: [samples param1 param2 ...]
# Result: [processed samples]
# Your Uiua code here
```

### 2. Register in lib.rs

Add one line to `audio-worklets/uiua-worklet/src/lib.rs`:

```rust
define_worklet!(YourEffectWorklet, "worklets/your-effect.ua", "Your effect description");
```

### 3. Update the processor

Add your worklet type to `src/audio/worklets/uiua-worklet-processor.js`:

```javascript
import init, { UiuaGainWorklet, YourEffectWorklet } from '...'

class UiuaWorkletProcessor extends AudioWorkletProcessor {
  async initWasm(wasmBytes) {
    await init(wasmBytes);
    switch (this.workletType) {
      case 'gain':
        this.processor = UiuaGainWorklet.new();
        break;
      case 'your-effect':
        this.processor = YourEffectWorklet.new();
        break;
    }
  }
}
```

### 4. Register in stages.ts

Add to `src/audio/stages.ts`:

```typescript
// Add type
export type StageParamsMap = {
  // ...
  'uiua-worklet-your-effect': { param1: number; param2: number }
}

// Add stage definition
STAGE_REGISTRY['uiua-worklet-your-effect'] = {
  name: 'Your Effect',
  create: (ctx, params) => ({
    type: 'uiua-worklet-your-effect',
    input: ctx.createGain(),
    output: ctx.createGain(),
    audioWorklet: new AudioWorkletNode(ctx, 'uiua-worklet-processor', {
      processorOptions: { workletType: 'your-effect' },
    }),
  }),
  // ...
}
```

### 5. Rebuild and test

```bash
npm run build:wasm
npm run dev
```

## Technical Details

### Uiua Version

- Using Uiua 0.17.2 with `features = ["web"]`, `default-features = false`
- wasm-bindgen pinned to `=0.2.93` (required by Uiua 0.17.2)
- wasm-opt disabled due to compatibility issues

### AudioWorklet Context Limitations

AudioWorklet runs in a separate thread with restricted APIs:

- **TextDecoder/TextEncoder**: Polyfilled in `TextEncoderPolyfill.js`
- **URL API**: Not available - WASM loaded from main thread via `fetch()` and `postMessage()`

### Array API Workaround

Uiua's `Array` type has private fields. We use `rows()` iterator + `format!("{}", row)` + parse as a workaround:

```rust
match result {
    Value::Num(arr) => {
        for (i, row) in arr.rows().take(length).enumerate() {
            let s = format!("{}", row);
            if let Ok(value) = s.trim().parse::<f64>() {
                samples[i] = value as f32;
            }
        }
    }
}
```

## Workspace Configuration

All worklets share dependencies via `Cargo.toml` workspace:

```toml
[workspace]
resolver = "2"
members = ["wasm-gain", "uiua-worklet"]

[workspace.dependencies]
wasm-bindgen = "=0.2.93"
```

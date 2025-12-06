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

### Execution Model

The Uiua runtime is kept alive across audio blocks for real-time performance:

1. **Compile once**: At worklet construction, the `.ua` file is compiled to an `Assembly`
2. **Extract root node**: The `Assembly.root` (`Node` type) is extracted and stored
3. **Execute per block**: Each audio block calls `uiua.exec(root_node.clone())`

The key insight is that `Node.clone()` is cheap - it uses `Arc` and `EcoVec` internally, so cloning just increments reference counts rather than copying data. This avoids the overhead of cloning the entire `Assembly` on every audio callback.

### Shared Buffer API

For zero-copy audio processing:

1. WASM exposes `input_ptr()` and `output_ptr()` - pointers to pre-allocated buffers in WASM memory
2. JavaScript copies input samples directly into WASM memory via `Float32Array` views
3. `process_block(frames, gain)` processes in-place
4. JavaScript reads output samples directly from WASM memory

This avoids marshalling arrays across the JS/WASM boundary on every audio callback.

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

The stack receives values in the order they're pushed. For the gain worklet:
- First push: `samples` (array of f64)
- Second push: `gain` (scalar f64)

So when `×` executes, it sees `gain` on top of stack and `samples` below.

### 2. Register in lib.rs

Add one line to `audio-worklets/uiua-worklet/src/lib.rs`:

```rust
define_worklet!(YourEffectWorklet, "worklets/your-effect.ua", "Your effect description");
```

### 3. Update the processor

Add your worklet type to `src/audio/worklets/uiua-worklet-processor.js`:

```javascript
import init, { UiuaGainWorklet, YourEffectWorklet } from '...'

// In initWasm():
switch (this.workletType) {
  case 'gain':
    this.processor = new UiuaGainWorklet()
    break
  case 'your-effect':
    this.processor = new YourEffectWorklet()
    break
}
```

### 4. Register in stages.ts

Add to `src/audio/stages.ts`:

```typescript
// Add to StageParamsMap type
export type StageParamsMap = {
  // ...existing types...
  'uiua-worklet-your-effect': { param1: number }
}

// Add stage definition to STAGE_REGISTRY
'uiua-worklet-your-effect': {
  kind: 'uiua-worklet-your-effect',
  label: 'Your Effect',
  params: {
    param1: {
      min: 0, max: 1, step: 0.01, default: 0.5,
      label: 'Param 1',
      format: (v) => v.toFixed(2),
    },
  },
  createInstance: (ctx, params) => {
    const workletNode = new AudioWorkletNode(ctx, 'uiua-worklet-processor', {
      processorOptions: {
        workletType: 'your-effect',
        param1: params.param1,
      },
    })

    // Load WASM
    fetch(new URL('../../audio-worklets/uiua-worklet/pkg/uiua_worklet_bg.wasm', import.meta.url))
      .then(r => r.arrayBuffer())
      .then(wasmBytes => {
        workletNode.port.postMessage({ type: 'initWasm', wasmBytes })
      })

    return {
      input: workletNode,
      output: workletNode,
      update: (p) => {
        if (typeof p.param1 === 'number') {
          // Always use postMessage for parameter updates
          workletNode.port.postMessage({ type: 'setParam1', value: p.param1 })
        }
      },
      dispose: () => workletNode.disconnect(),
    }
  },
}
```

**Important**: Always use `postMessage` for parameter updates, not `AudioParam.setValueAtTime()`. AudioParam values don't reliably propagate to WASM worklets.

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

### Data Flow

```
Main Thread                          AudioWorklet Thread
-----------                          -------------------
1. fetch() WASM bytes
2. postMessage({type:'initWasm'}) -->
                                     3. init(wasmBytes)
                                     4. new UiuaGainWorklet()
                                        - Compiler.load_str(ua_code)
                                        - Extract root_node from Assembly
                                        - Store Uiua runtime
                                     
5. postMessage({type:'setGain'})  -->
                                     6. this.gain = value

                                     [audio callback loop]
                                     7. Copy input to WASM memory
                                     8. processor.process_block(frames, gain)
                                        - push samples to stack
                                        - push gain to stack  
                                        - exec(root_node.clone())
                                        - pop result from stack
                                     9. Copy output from WASM memory
```

### Why Node.clone() is Fast

Uiua's `Node` enum uses copy-on-write data structures:
- `Arc<T>` for shared ownership (clone = increment refcount)
- `EcoVec` for arrays (clone = increment refcount, copy on mutation)

This makes cloning the root node essentially free compared to cloning the entire `Assembly`.

## Workspace Configuration

All worklets share dependencies via `Cargo.toml` workspace:

```toml
[workspace]
resolver = "2"
members = ["wasm-gain", "uiua-worklet"]

[workspace.dependencies]
wasm-bindgen = "=0.2.93"
```

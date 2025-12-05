# Claude Development Guide

> Read this file at the start of every new conversation to maintain context.
> Also read README.md for project overview and current status.

## Design Philosophy

### Gall's Law (Core Principle)
"A complex system that works is invariably found to have evolved from a simple system that worked."

- Start simple, extend incrementally
- Each change should be small and atomic
- Every commit should leave the system in a working state
- Resist the urge to over-engineer upfront
- Add complexity only when the simple solution no longer works

### Development Approach
1. **Progressive iteration** - Small, focused changes over big rewrites
2. **Atomic commits** - Each commit does one thing well
3. **Extensibility by design** - Use registries and patterns that allow growth
4. **Single source of truth** - State drives everything, UI is declarative
5. **Type safety** - Leverage TypeScript's type system to prevent bugs

## Architecture

### State Management Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                     STAGE_REGISTRY (stages.ts)                  │
│  Static definitions: factories, UI metadata, default params     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EngineState (engine.ts)                     │
│  Single source of truth for all audio state                     │
│  - source: 'oscillator' | 'microphone'                         │
│  - oscillator: { running, type, frequency }                     │
│  - mic: { enabled }                                             │
│  - stages: Array<{ id, kind, bypassed, params }>               │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   [UI Components]    [WebAudio Graph]    [Subscribers]
   (declarative)      (derived/rebuilt)   (reactive updates)
```

### Key Design Decisions

**1. Stage Registry Pattern** (`src/audio/stages.ts`)
- All stage types defined in one place
- Each entry contains: kind, label, param definitions, factory function
- UI reads from registry to render controls dynamically
- Adding a new effect = adding one registry entry

**2. Idempotent Graph Rebuilding** (`engine.ts:rebuildSignalChain`)
- Any state change triggers a full graph rebuild
- Disconnect all → Rebuild connections → Garbage collect orphans
- Simple to reason about, avoids partial state bugs
- Only disconnect outputs (not inputs) to preserve internal stage wiring

**3. Observer Pattern for State**
- `engine.subscribe(handler)` returns unsubscribe function
- State changes emit cloned snapshots to all subscribers
- UI components use SolidJS stores synced to engine state

### File Structure

```
src/
├── audio/
│   ├── engine.ts      # AudioEngine class, state management, WebAudio graph
│   └── stages.ts      # STAGE_REGISTRY, type definitions, factory functions
├── components/
│   ├── App.tsx        # Root layout, initialization
│   ├── SignalChain.tsx    # Horizontal DAW-style chain view
│   ├── StageCard.tsx      # Individual stage UI (params, bypass, move, remove)
│   ├── LevelMeter.tsx     # Stereo meter with peak/RMS, clipping indicator
│   ├── Waveform.tsx       # Time-domain visualization (uPlot)
│   ├── Spectrum.tsx       # Frequency-domain visualization (uPlot)
│   └── AudioDebug.tsx     # Debug panel (context state, signal levels, JSON)
├── index.tsx          # Entry point
└── styles.css         # Tailwind imports
```

### WebAudio Signal Flow

```
[Source] ──→ [Stage 1] ──→ [Stage 2] ──→ ... ──→ [masterGain] ──→ [destination]
   │              │             │                      │
   │              │             │                      ▼
   │              │             │                 [analyser] (waveform/spectrum)
   │              │             │                      │
   │              │             │                      ▼
   │              │             │                 [meterInput] (stereo upmix)
   │              │             │                      │
   │              │             │                      ▼
   │              │             │                 [splitter]
   │              │             │                   │     │
   │              │             │                   ▼     ▼
   │              │             │              [analyserL] [analyserR]
   └──────────────┴─────────────┴──── (bypassed stages are skipped)
```

### Stereo Signal Handling
- Oscillator and Microphone are mono sources
- StereoPannerNode converts mono to stereo (positions in stereo field)
- `meterInput` GainNode with `channelInterpretation='speakers'` upmixes mono→stereo
- ChannelSplitter separates L/R for independent metering

## Common Patterns

### Adding a New Stage Type

1. Add params type to `StageParamsMap` in `stages.ts`:
```typescript
export type StageParamsMap = {
  // ... existing
  newEffect: { param1: number; param2: number }
}
```

2. Add definition to `STAGE_REGISTRY`:
```typescript
newEffect: {
  kind: 'newEffect',
  label: 'New Effect',
  params: {
    param1: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Param 1', format: (v) => v.toFixed(2) },
    param2: { ... }
  },
  createInstance: (ctx, params) => {
    // Create WebAudio nodes
    // Return { input, output, update, dispose }
  }
}
```

3. That's it! UI automatically picks up the new stage type.

### State Updates
```typescript
// All state changes go through updateState()
this.updateState((state) => {
  state.someProperty = newValue
})
// This automatically: mutates state → emits to subscribers → rebuilds graph
```

### Complex Stage Internal Wiring (e.g., Delay)
```typescript
createInstance: (ctx, params) => {
  const input = ctx.createGain()   // Entry point
  const output = ctx.createGain()  // Exit point
  // ... create internal nodes ...
  
  // Wire internally
  input.connect(internalNode1)
  internalNode1.connect(output)
  
  return {
    input,
    output,
    update: (p) => { /* update internal node params */ },
    dispose: () => { /* disconnect ALL internal nodes */ }
  }
}
```

## Known Issues / Tech Debt

1. **Both meters show same signal** - Master and Output meters both show post-chain/pre-masterGain. Could add post-master metering if needed.

2. **No persistence** - Stage configuration is lost on reload. Could add localStorage or URL state.

3. **Fixed analyser FFT size** - Currently hardcoded to 2048. Could be configurable.

## Future Plans

- **WASM AudioWorklet nodes** - Custom DSP processors compiled from Rust/C++
- **More stage types** - Filter, compressor, reverb, etc.
- **Preset system** - Save/load stage configurations
- **MIDI control** - Map parameters to MIDI CC

## Development Commands

```bash
# Type check
npx tsc --noEmit

# Development server
npx vite

# Production build
npx vite build
```

## Debugging Tips

1. **Debug Panel** - Click "Debug" button (bottom-right) to see:
   - AudioContext state
   - Signal levels (stereo)
   - Stage instances and bypass state
   - Full engine state JSON

2. **Console Access** - Engine is exposed as `window.engine`:
   ```javascript
   engine.getState()           // Current state
   engine.getStereoLevels()    // L/R levels
   engine.getDebugInfo()       // Full debug info
   ```

3. **Chrome WebAudio Inspector** - DevTools → More tools → WebAudio

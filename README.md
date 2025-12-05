# Signals

A WebAudio-based audio processing application built with SolidJS and TypeScript. Features a DAW-style horizontal signal chain with real-time visualization and stereo metering.

## Features

- **Modular Signal Chain** - Add, remove, and reorder audio processing stages
- **Built-in Effects** - Gain, Stereo Pan, Delay (with feedback)
- **Real-time Visualization** - Waveform and spectrum analyzers
- **Stereo Metering** - L/R level meters with peak hold and clipping indicators
- **Multiple Sources** - Oscillator (with waveform selection) or microphone input

## Screenshot

```
┌─────────────────────────────────────────────────────────────────────┐
│  Signals                                                            │
├────────────────────────┬────────────────────────┬───────────────────┤
│      [Waveform]        │      [Spectrum]        │   Master Meter    │
├────────────────────────┴────────────────────────┴───────────────────┤
│  Signal Chain                                                       │
│  [Source] → [Gain] → [Pan] → [Delay] → [Output Meter]              │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: SolidJS 1.9
- **Language**: TypeScript 5.9
- **Audio**: WebAudio API
- **Visualization**: uPlot
- **Styling**: Tailwind CSS 4
- **Bundler**: Vite 7

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bunx vite

# Type check
bunx tsc --noEmit

# Production build
bunx vite build
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation, design patterns, and development guidelines.

### Quick Overview

- **Single source of truth**: `EngineState` in `engine.ts` drives everything
- **Stage Registry**: New effects are added by defining them in `stages.ts`
- **Declarative UI**: Components subscribe to state and render accordingly
- **Idempotent rebuilds**: Any state change triggers a full graph rebuild

## Project Structure

```
src/
├── audio/
│   ├── engine.ts      # AudioEngine class, state, WebAudio graph
│   └── stages.ts      # Stage definitions and factories
├── components/
│   ├── SignalChain.tsx    # Horizontal chain view
│   ├── StageCard.tsx      # Individual stage controls
│   ├── LevelMeter.tsx     # Stereo meter component
│   ├── Waveform.tsx       # Time-domain display
│   ├── Spectrum.tsx       # Frequency-domain display
│   └── AudioDebug.tsx     # Debug panel
└── App.tsx                # Root component
```

## Current Status

### Implemented
- [x] Oscillator and microphone sources
- [x] Gain, Pan, Delay effects
- [x] Dynamic stage add/remove/reorder
- [x] Stereo metering with peak/RMS toggle
- [x] Waveform and spectrum visualization
- [x] Debug panel

### Planned
- [ ] WASM AudioWorklet nodes (custom DSP)
- [ ] More effects (filter, compressor, reverb)
- [ ] Preset save/load
- [ ] MIDI parameter control

## License

MIT

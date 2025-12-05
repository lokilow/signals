# Signals

A WebAudio-based audio processing application built with SolidJS and TypeScript. Features a DAW-style horizontal signal chain with real-time visualization and stereo metering.

## Features

- **Modular Signal Chain** - Add, remove, and reorder audio processing stages
- **Built-in Effects** - Gain, Stereo Pan, Delay (with feedback)
- **Real-time Visualization** - Waveform and spectrum analyzers
- **Stereo Metering** - L/R level meters with peak hold and clipping indicators
- **Multiple Sources** - Oscillator (with waveform selection) or microphone input

## Tech Stack

- SolidJS, TypeScript, WebAudio API, uPlot, Tailwind CSS, Vite

## Getting Started

```bash
bun install
bunx vite        # dev server
bunx tsc --noEmit   # type check
bunx vite build     # production build
```

## Development

See [CLAUDE.md](./CLAUDE.md) for development principles and gotchas.

## Future Ideas

- WASM AudioWorklet nodes (custom DSP in Rust/C++)
- More effects (filter, compressor, reverb)
- Preset save/load
- MIDI parameter control

## License

MIT

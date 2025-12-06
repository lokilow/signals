# Signals

A WebAudio-based audio processing application built with SolidJS and TypeScript. Features a DAW-style horizontal signal chain with real-time visualization and stereo metering.

## Features

- **Modular Signal Chain** - Add, remove, and reorder audio processing stages
- **Built-in Effects** - Gain, Stereo Pan, Delay (with feedback)
- **Real-time Visualization** - Waveform and spectrum analyzers
- **Stereo Metering** - L/R level meters with peak hold and clipping indicators
- **Multiple Sources** - Oscillator (with waveform selection) or microphone input
- **Mobile-First Design** - Fully responsive, works on phones, tablets, and desktops

## Tech Stack

- SolidJS, TypeScript, WebAudio API, uPlot, Tailwind CSS, Vite

## Getting Started

```bash
bun install
bun run dev         # dev server (accessible on local network at http://mbp.local:5173)
bun run typecheck   # type check
bun run build       # production build
bun run preview     # preview production build
```

### Testing on Mobile Devices

The dev server is configured to be accessible from your local network:
- Start the dev server: `bun run dev`
- On your phone/tablet (same WiFi): visit `http://<your-hostname>.local:5173`
- Example: `http://my-macbook.local:5173`

## Deployment

Automatically deploys to GitHub Pages on push to `main`:
- **Production URL**: `https://<username>.github.io/signals/`
- Workflow: `.github/workflows/deploy.yml`
- Enable in repo settings: Settings → Pages → Source: "GitHub Actions"

## Development

See [CLAUDE.md](./CLAUDE.md) for development principles and gotchas.

## Future Ideas

- WASM AudioWorklet nodes (custom DSP in Rust/C++)
- More effects (filter, compressor, reverb)
- Preset save/load
- MIDI parameter control

## License

MIT
